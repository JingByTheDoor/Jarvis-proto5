import fs from "node:fs";
import path from "node:path";

import { z } from "zod";

import {
  DefaultEncryptedAtRestProvider,
  type EncryptedAtRestProvider
} from "../persistence/encrypted-at-rest";
import {
  WorkflowProofGateStatusSchema,
  WorkflowProofReportSchema,
  WorkflowProofRecordSchema,
  WorkflowProofSummarySchema,
  type WorkflowProofGateStatus,
  type WorkflowProofReport,
  type WorkflowProofRecord,
  type WorkflowProofSummary
} from "../schemas";
import { evaluateWorkflowProofGate } from "./proof-gate-evaluator";
import { createWorkflowProofReport } from "./workflow-proof-report";

const WorkflowProofStoreEnvelopeSchema = z
  .object({
    version: z.literal(1),
    records: z.array(WorkflowProofRecordSchema)
  })
  .strict();

type WorkflowProofStoreEnvelope = z.infer<typeof WorkflowProofStoreEnvelopeSchema>;

export interface WorkflowProofSummarySnapshot {
  readonly summary: WorkflowProofSummary;
  readonly gate_status: WorkflowProofGateStatus;
  readonly recent_journeys: WorkflowProofRecord[];
}

export interface WorkflowProofStore {
  readonly upsertRecord: (
    workspaceRoot: string,
    record: WorkflowProofRecord
  ) => WorkflowProofRecord;
  readonly getSummary: (
    workspaceRoot: string,
    limit: number
  ) => WorkflowProofSummarySnapshot;
  readonly getReport: (
    workspaceRoot: string,
    limit: number,
    generatedAt: string
  ) => WorkflowProofReport;
}

function getWorkflowProofPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, ".tmp", "cache", "workflow-proof.json");
}

function getKeyDirectory(workspaceRoot: string): string {
  return path.join(workspaceRoot, ".tmp", "cache", "keys");
}

function createEmptyEnvelope(): WorkflowProofStoreEnvelope {
  return {
    version: 1,
    records: []
  };
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sortedValues = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 1) {
    return sortedValues[midpoint] ?? null;
  }

  return Math.round(((sortedValues[midpoint - 1] ?? 0) + (sortedValues[midpoint] ?? 0)) / 2);
}

function summarizeWorkflowProofRecords(
  records: readonly WorkflowProofRecord[]
): WorkflowProofSummary {
  const goldenWorkflowRecords = records.filter(
    (record) => record.journey_kind === "golden_edit_workflow"
  );
  const reviewReadyCount = goldenWorkflowRecords.filter(
    (record) => record.workflow_state === "review_ready"
  ).length;
  const resumeJourneys = records.filter((record) => record.resume_used);
  const latestUpdatedAt = records[0]?.updated_at ?? null;

  return WorkflowProofSummarySchema.parse({
    golden_workflow_attempts: goldenWorkflowRecords.length,
    golden_workflow_review_ready: reviewReadyCount,
    golden_workflow_stability_rate:
      goldenWorkflowRecords.length === 0
        ? 0
        : Number((reviewReadyCount / goldenWorkflowRecords.length).toFixed(2)),
    median_cold_start_to_composer_ms: median(
      records.flatMap((record) =>
        typeof record.cold_start_to_composer_ms === "number"
          ? [record.cold_start_to_composer_ms]
          : []
      )
    ),
    median_task_to_preview_ms: median(
      goldenWorkflowRecords.flatMap((record) =>
        typeof record.task_to_preview_ms === "number" ? [record.task_to_preview_ms] : []
      )
    ),
    median_preview_to_approval_ms: median(
      goldenWorkflowRecords.flatMap((record) =>
        typeof record.preview_to_approval_ms === "number" ? [record.preview_to_approval_ms] : []
      )
    ),
    median_approval_to_first_result_ms: median(
      goldenWorkflowRecords.flatMap((record) =>
        typeof record.approval_to_first_result_ms === "number"
          ? [record.approval_to_first_result_ms]
          : []
      )
    ),
    median_execute_to_first_result_ms: median(
      goldenWorkflowRecords.flatMap((record) =>
        typeof record.execute_to_first_result_ms === "number"
          ? [record.execute_to_first_result_ms]
          : []
      )
    ),
    median_workflow_step_count: median(
      goldenWorkflowRecords.map((record) => record.workflow_step_count)
    ),
    median_operator_click_count: median(
      goldenWorkflowRecords.map((record) => record.operator_click_count)
    ),
    median_repeat_task_to_preview_ms: median(
      goldenWorkflowRecords.flatMap((record) =>
        record.resume_used && typeof record.task_to_preview_ms === "number"
          ? [record.task_to_preview_ms]
          : []
      )
    ),
    resume_journeys: resumeJourneys.length,
    resume_review_ready: resumeJourneys.filter(
      (record) => record.workflow_state === "review_ready"
    ).length,
    latest_updated_at: latestUpdatedAt
  });
}

function getGateEligibleRecords(
  records: readonly WorkflowProofRecord[]
): WorkflowProofRecord[] {
  return records.filter((record) => record.counts_toward_gate);
}

function getGuidedCaptureRecords(
  records: readonly WorkflowProofRecord[]
): WorkflowProofRecord[] {
  return records.filter(
    (record) => record.evidence_origin === "guided_operator_capture"
  );
}

function createSummarySnapshot(
  orderedRecords: readonly WorkflowProofRecord[],
  limit: number
): WorkflowProofSummarySnapshot {
  const gateEligibleRecords = getGateEligibleRecords(orderedRecords);
  const guidedCaptureRecords = getGuidedCaptureRecords(orderedRecords);

  return {
    summary: summarizeWorkflowProofRecords(gateEligibleRecords),
    gate_status: WorkflowProofGateStatusSchema.parse(
      evaluateWorkflowProofGate(gateEligibleRecords)
    ),
    recent_journeys: guidedCaptureRecords.slice(0, limit)
  };
}

export class EncryptedWorkflowProofStore implements WorkflowProofStore {
  public constructor(
    private readonly encryptedAtRestProvider: EncryptedAtRestProvider = new DefaultEncryptedAtRestProvider()
  ) {}

  public upsertRecord(
    workspaceRoot: string,
    record: WorkflowProofRecord
  ): WorkflowProofRecord {
    const parsedRecord = WorkflowProofRecordSchema.parse(record);
    const envelope = this.readEnvelope(workspaceRoot);
    const nextRecords = [parsedRecord, ...envelope.records.filter((entry) => entry.journey_id !== parsedRecord.journey_id)]
      .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
      .slice(0, 200);

    this.writeEnvelope(workspaceRoot, {
      version: 1,
      records: nextRecords
    });

    return parsedRecord;
  }

  public getSummary(
    workspaceRoot: string,
    limit: number
  ): WorkflowProofSummarySnapshot {
    const envelope = this.readEnvelope(workspaceRoot);
    const orderedRecords = [...envelope.records].sort((left, right) =>
      right.updated_at.localeCompare(left.updated_at)
    );

    return createSummarySnapshot(orderedRecords, limit);
  }

  public getReport(
    workspaceRoot: string,
    limit: number,
    generatedAt: string
  ): WorkflowProofReport {
    const envelope = this.readEnvelope(workspaceRoot);
    const orderedRecords = [...envelope.records].sort((left, right) =>
      right.updated_at.localeCompare(left.updated_at)
    );
    const snapshot = createSummarySnapshot(orderedRecords, limit);

    return WorkflowProofReportSchema.parse(
      createWorkflowProofReport({
        workspace_root: workspaceRoot,
        generated_at: generatedAt,
        summary: snapshot.summary,
        gate_status: snapshot.gate_status,
        recent_journeys: snapshot.recent_journeys
      })
    );
  }

  private readEnvelope(workspaceRoot: string): WorkflowProofStoreEnvelope {
    const workflowProofPath = getWorkflowProofPath(workspaceRoot);
    if (!fs.existsSync(workflowProofPath)) {
      return createEmptyEnvelope();
    }

    const envelope = this.encryptedAtRestProvider.readEncryptedJson<unknown>(
      workflowProofPath,
      "cache_entry",
      getKeyDirectory(workspaceRoot)
    );

    return WorkflowProofStoreEnvelopeSchema.parse(envelope);
  }

  private writeEnvelope(
    workspaceRoot: string,
    envelope: WorkflowProofStoreEnvelope
  ): void {
    this.encryptedAtRestProvider.writeEncryptedJson(
      getWorkflowProofPath(workspaceRoot),
      "cache_entry",
      WorkflowProofStoreEnvelopeSchema.parse(envelope),
      getKeyDirectory(workspaceRoot)
    );
  }
}
