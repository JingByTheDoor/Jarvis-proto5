import { describe, expect, it } from "vitest";

import { evaluateWorkflowProofGate } from "../../src/core/proof/proof-gate-evaluator";
import { validWorkflowProofRecord, WORKSPACE_ROOT } from "../fixtures";

function createGoldenRecord(input: {
  readonly journeyId: string;
  readonly updatedAt: string;
  readonly workflowState?: "review_ready" | "failed";
  readonly resumeUsed?: boolean;
  readonly taskToPreviewMs?: number;
  readonly previewToApprovalMs?: number;
  readonly approvalToFirstResultMs?: number;
  readonly workflowStepCount?: number;
  readonly operatorClickCount?: number;
} = {
  journeyId: "journey-default",
  updatedAt: "2026-03-11T19:00:00.000Z"
}) {
  return {
    ...validWorkflowProofRecord,
    journey_id: input.journeyId,
    workspace_root: WORKSPACE_ROOT,
    updated_at: input.updatedAt,
    workflow_state: input.workflowState ?? "review_ready",
    resume_used: input.resumeUsed ?? false,
    resumed_from_recall_id: input.resumeUsed ? "run:run-1" : null,
    task_to_preview_ms: input.taskToPreviewMs ?? 1000,
    preview_to_approval_ms: input.previewToApprovalMs ?? 800,
    approval_to_first_result_ms: input.approvalToFirstResultMs ?? 2000,
    workflow_step_count: input.workflowStepCount ?? 4,
    operator_click_count: input.operatorClickCount ?? 4
  } as const;
}

describe("proof gate evaluator", () => {
  it("stays in collecting_evidence until enough local proof exists", () => {
    const gateStatus = evaluateWorkflowProofGate([
      createGoldenRecord({
        journeyId: "journey-2",
        updatedAt: "2026-03-11T19:02:00.000Z",
        resumeUsed: true
      }),
      createGoldenRecord({
        journeyId: "journey-1",
        updatedAt: "2026-03-11T19:01:00.000Z"
      })
    ]);

    expect(gateStatus.overall_status).toBe("collecting_evidence");
    expect(gateStatus.stability.status).toBe("not_enough_data");
    expect(gateStatus.stability.sample_count).toBe(2);
    expect(gateStatus.stability.required_sample_count).toBe(3);
    expect(gateStatus.resume_helpfulness.status).toBe("on_track");
    expect(gateStatus.resume_helpfulness.satisfied_count).toBe(1);
  });

  it("blocks expansion when recent golden workflows stop reaching review_ready", () => {
    const gateStatus = evaluateWorkflowProofGate([
      createGoldenRecord({
        journeyId: "journey-3",
        updatedAt: "2026-03-11T19:03:00.000Z",
        workflowState: "failed",
        resumeUsed: true
      }),
      createGoldenRecord({
        journeyId: "journey-2",
        updatedAt: "2026-03-11T19:02:00.000Z"
      }),
      createGoldenRecord({
        journeyId: "journey-1",
        updatedAt: "2026-03-11T19:01:00.000Z"
      })
    ]);

    expect(gateStatus.overall_status).toBe("blocked");
    expect(gateStatus.stability.status).toBe("attention_needed");
    expect(gateStatus.stability.satisfied_count).toBe(2);
    expect(gateStatus.blocking_reasons).toContain(
      "One or more of the latest 3 golden edit journeys did not reach review_ready."
    );
  });

  it("blocks expansion when preview-to-approval latency regresses", () => {
    const gateStatus = evaluateWorkflowProofGate([
      createGoldenRecord({
        journeyId: "journey-6",
        updatedAt: "2026-03-11T19:06:00.000Z",
        resumeUsed: true,
        taskToPreviewMs: 180,
        previewToApprovalMs: 900,
        approvalToFirstResultMs: 420
      }),
      createGoldenRecord({
        journeyId: "journey-5",
        updatedAt: "2026-03-11T19:05:00.000Z",
        taskToPreviewMs: 170,
        previewToApprovalMs: 880,
        approvalToFirstResultMs: 400
      }),
      createGoldenRecord({
        journeyId: "journey-4",
        updatedAt: "2026-03-11T19:04:00.000Z",
        taskToPreviewMs: 160,
        previewToApprovalMs: 860,
        approvalToFirstResultMs: 380
      }),
      createGoldenRecord({
        journeyId: "journey-3",
        updatedAt: "2026-03-11T19:03:00.000Z",
        taskToPreviewMs: 240,
        previewToApprovalMs: 700,
        approvalToFirstResultMs: 520
      }),
      createGoldenRecord({
        journeyId: "journey-2",
        updatedAt: "2026-03-11T19:02:00.000Z",
        taskToPreviewMs: 230,
        previewToApprovalMs: 690,
        approvalToFirstResultMs: 510
      }),
      createGoldenRecord({
        journeyId: "journey-1",
        updatedAt: "2026-03-11T19:01:00.000Z",
        taskToPreviewMs: 220,
        previewToApprovalMs: 680,
        approvalToFirstResultMs: 500
      })
    ]);

    expect(gateStatus.overall_status).toBe("blocked");
    expect(gateStatus.preview_to_approval_trend.status).toBe("attention_needed");
    expect(gateStatus.preview_to_approval_trend.recent_median).toBe(880);
    expect(gateStatus.preview_to_approval_trend.previous_median).toBe(690);
  });

  it("marks the proof gate candidate_ready when recent golden workflows are stable and improving", () => {
    const gateStatus = evaluateWorkflowProofGate([
      createGoldenRecord({
        journeyId: "journey-6",
        updatedAt: "2026-03-11T19:06:00.000Z",
        resumeUsed: true,
        taskToPreviewMs: 180,
        previewToApprovalMs: 280,
        approvalToFirstResultMs: 420,
        workflowStepCount: 4,
        operatorClickCount: 5
      }),
      createGoldenRecord({
        journeyId: "journey-5",
        updatedAt: "2026-03-11T19:05:00.000Z",
        taskToPreviewMs: 170,
        previewToApprovalMs: 270,
        approvalToFirstResultMs: 400,
        workflowStepCount: 4,
        operatorClickCount: 4
      }),
      createGoldenRecord({
        journeyId: "journey-4",
        updatedAt: "2026-03-11T19:04:00.000Z",
        taskToPreviewMs: 160,
        previewToApprovalMs: 260,
        approvalToFirstResultMs: 380,
        workflowStepCount: 3,
        operatorClickCount: 4
      }),
      createGoldenRecord({
        journeyId: "journey-3",
        updatedAt: "2026-03-11T19:03:00.000Z",
        taskToPreviewMs: 240,
        previewToApprovalMs: 340,
        approvalToFirstResultMs: 520,
        workflowStepCount: 5,
        operatorClickCount: 6
      }),
      createGoldenRecord({
        journeyId: "journey-2",
        updatedAt: "2026-03-11T19:02:00.000Z",
        taskToPreviewMs: 230,
        previewToApprovalMs: 330,
        approvalToFirstResultMs: 510,
        workflowStepCount: 5,
        operatorClickCount: 6
      }),
      createGoldenRecord({
        journeyId: "journey-1",
        updatedAt: "2026-03-11T19:01:00.000Z",
        taskToPreviewMs: 220,
        previewToApprovalMs: 320,
        approvalToFirstResultMs: 500,
        workflowStepCount: 4,
        operatorClickCount: 5
      })
    ]);

    expect(gateStatus.overall_status).toBe("candidate_ready");
    expect(gateStatus.blocking_reasons).toEqual([]);
    expect(gateStatus.preview_to_approval_trend.status).toBe("on_track");
    expect(gateStatus.step_count_trend.status).toBe("on_track");
    expect(gateStatus.click_count_trend.status).toBe("on_track");
    expect(gateStatus.repeat_task_speed.status).toBe("on_track");
    expect(gateStatus.repeat_task_speed.sample_count).toBe(1);
    expect(gateStatus.repeat_task_speed.recent_median).toBe(180);
    expect(gateStatus.resume_helpfulness.status).toBe("on_track");
  });
});
