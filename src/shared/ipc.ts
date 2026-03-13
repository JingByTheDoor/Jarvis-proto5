import { z } from "zod";

import {
  ApprovalDecisionSchema,
  ApprovalDecisionKindSchema,
  ApprovalScopeClassSchema,
  EffectPreviewSchema,
  ExecutionAttestationSchema,
  ExecutionManifestSchema,
  NetworkScopeSchema,
  PathScopeSchema,
  PlannerAssistanceSchema,
  PlannerProviderConfigSchema,
  PlannerProviderStatusSchema,
  PlanSchema,
  RunExportBundleSchema,
  RiskLevelSchema,
  RunEventSchema,
  RunLogSchema,
  SideEffectFamilySchema,
  ToolResultSchema,
  VerificationStatusSchema,
  WorkflowProofReportSchema,
  WorkflowProofRecordSchema,
  WorkflowProofGateStatusSchema,
  WorkflowProofSummarySchema,
  WorkflowStateSchema
} from "../core/schemas";
import {
  defaultRetentionPolicy,
  routeKinds,
  riskLevels,
  sensitiveSessionDefaults,
  taskTypes,
  workflowSequence
} from "./constants";

export const TaskRouteSchema = z
  .object({
    task_level: z.number().int().min(1).max(5),
    task_type: z.enum(taskTypes),
    risk_class: z.enum(riskLevels),
    chosen_route: z.enum(routeKinds),
    operator_explanation: z.string().min(1)
  })
  .strict();

export const DiffPreviewSchema = z
  .object({
    path: z.string().min(1),
    status: z.enum(["created", "modified", "unchanged"]),
    before: z.string(),
    after: z.string(),
    unified_diff: z.string()
  })
  .strict();

export const TaskIntentRequestSchema = z
  .object({
    task: z.string().min(1),
    session_id: z.string().min(1),
    workspace_roots: z.array(z.string().min(1)).min(1),
    requested_at: z.string().datetime({ offset: true })
  })
  .strict();

export const ApprovalRequestSchema = z
  .object({
    action_id: z.string().min(1),
    risk_level: RiskLevelSchema,
    decision_options: z.array(ApprovalDecisionKindSchema).min(1),
    allowed_scope_classes: z.array(ApprovalScopeClassSchema).min(1),
    approval_signature: z.string().min(1),
    execution_hash: z.string().min(1),
    max_execution_count: z.number().int().min(1),
    session_id: z.string().min(1),
    expires_at: z.string().datetime({ offset: true }),
    path_scope: PathScopeSchema,
    network_scope: NetworkScopeSchema,
    side_effect_family: SideEffectFamilySchema,
    justification: z.string().min(1)
  })
  .strict();

export const SimulationSummarySchema = z
  .object({
    highest_risk: RiskLevelSchema,
    approval_required: z.boolean(),
    preview_count: z.number().int().min(0),
    confidence_breakdown: z
      .object({
        high: z.number().int().min(0),
        medium: z.number().int().min(0),
        low: z.number().int().min(0)
      })
      .strict(),
    notes: z.array(z.string())
  })
  .strict();

export const ApprovalDecisionResponseSchema = z
  .object({
    accepted: z.boolean(),
    manifest_id: z.string().min(1),
    action_id: z.string().min(1),
    decision: ApprovalDecisionKindSchema,
    approval_scope_class: ApprovalScopeClassSchema,
    approval_signature: z.string().min(1),
    execution_hash: z.string().min(1),
    max_execution_count: z.number().int().min(0),
    session_id: z.string().min(1),
    expires_at: z.string().datetime({ offset: true }),
    decided_at: z.string().datetime({ offset: true }),
    decided_by: z.string().min(1),
    remaining_uses: z.number().int().min(0),
    reusable_within_session: z.boolean(),
    message: z.string().min(1)
  })
  .strict();

export const TaskIntentResponseSchema = z
  .object({
    accepted: z.boolean(),
    workflow_state: WorkflowStateSchema,
    state_trace: z.array(WorkflowStateSchema).min(1),
    message: z.string().min(1),
    route: TaskRouteSchema,
    plan: PlanSchema.nullable(),
    manifest: ExecutionManifestSchema.nullable(),
    effect_previews: z.array(EffectPreviewSchema),
    approval_requests: z.array(ApprovalRequestSchema),
    simulation_summary: SimulationSummarySchema.nullable(),
    diff_previews: z.array(DiffPreviewSchema),
    planner_assistance: PlannerAssistanceSchema,
    preview_generated_at: z.string().datetime({ offset: true })
  })
  .strict();

export const PolicySnapshotRequestSchema = z
  .object({
    session_id: z.string().min(1)
  })
  .strict();

export const PolicySnapshotResponseSchema = z
  .object({
    version: z.string().min(1),
    workflow: z.literal(workflowSequence),
    local_first: z.literal(true),
    approval_required_for_risky_actions: z.literal(true),
    app_started_at: z.string().datetime({ offset: true }),
    retention_policy: z
      .object({
        run_history_days: z.literal(defaultRetentionPolicy.run_history_days),
        event_logs_days: z.literal(defaultRetentionPolicy.event_logs_days),
        cache_days: z.literal(defaultRetentionPolicy.cache_days),
        sensitive_session_cache_hours: z.literal(defaultRetentionPolicy.sensitive_session_cache_hours),
        export_staging_encrypted_at_rest: z.literal(true)
      })
      .strict(),
    sensitive_session_defaults: z
      .object({
        reduced_logging: z.literal(sensitiveSessionDefaults.reduced_logging),
        tier2_memory_writes_enabled: z.literal(
          sensitiveSessionDefaults.tier2_memory_writes_enabled
        ),
        tier3_analytics_writes_enabled: z.literal(
          sensitiveSessionDefaults.tier3_analytics_writes_enabled
        ),
        minimal_summaries_only: z.literal(
          sensitiveSessionDefaults.minimal_summaries_only
        )
      })
      .strict()
  })
  .strict();

export const PlannerStatusRequestSchema = z
  .object({
    session_id: z.string().min(1)
  })
  .strict();

export const PlannerStatusResponseSchema = PlannerProviderStatusSchema;

export const PlannerSettingsUpdateRequestSchema = PlannerProviderConfigSchema.omit({
  source: true
});

export const PlannerSettingsUpdateResponseSchema = PlannerProviderStatusSchema;

export const RunExecutionRequestSchema = z
  .object({
    manifest_id: z.string().min(1),
    session_id: z.string().min(1)
  })
  .strict();

export const RunExecutionResponseSchema = z
  .object({
    accepted: z.boolean(),
    workflow_state: WorkflowStateSchema,
    message: z.string().min(1),
    run_id: z.string().min(1).nullable(),
    persisted_run_path: z.string().min(1).nullable(),
    run_log: RunLogSchema.nullable(),
    tool_results: z.array(ToolResultSchema),
    attestations: z.array(ExecutionAttestationSchema)
  })
  .strict();

export const RunHistoryRequestSchema = z
  .object({
    workspace_root: z.string().min(1),
    limit: z.number().int().min(1).max(50)
  })
  .strict();

export const RunHistoryResponseSchema = z
  .object({
    runs: z.array(RunLogSchema)
  })
  .strict();

export const RunDeleteRequestSchema = z
  .object({
    workspace_root: z.string().min(1),
    run_id: z.string().regex(/^[A-Za-z0-9._-]+$/)
  })
  .strict();

export const RunDeleteResponseSchema = z
  .object({
    run_id: z.string().min(1),
    deleted: z.boolean(),
    deleted_paths: z.array(z.string().min(1)),
    message: z.string().min(1)
  })
  .strict();

export const RunExportRequestSchema = z
  .object({
    workspace_root: z.string().min(1),
    run_id: z.string().regex(/^[A-Za-z0-9._-]+$/)
  })
  .strict();

export const RunExportResponseSchema = z
  .object({
    run_id: z.string().min(1),
    staged_export_path: z.string().min(1),
    exported_at: z.string().datetime({ offset: true }),
    redaction_count: z.number().int().min(0),
    placeholders: z.array(z.string().min(1)),
    bundle: RunExportBundleSchema,
    message: z.string().min(1)
  })
  .strict();

export const RecallEntrySchema = z
  .object({
    id: z.string().min(1),
    source_kind: z.enum(["run_log", "operator_note"]),
    title: z.string().min(1),
    excerpt: z.string(),
    provenance_label: z.string().min(1),
    trust_label: VerificationStatusSchema,
    updated_at: z.string().datetime({ offset: true }),
    location: z.string().min(1).nullable(),
    resume_prompt: z.string().min(1).nullable(),
    searchable_text: z.string()
  })
  .strict();

export const RecallSearchRequestSchema = z
  .object({
    workspace_root: z.string().min(1),
    query: z.string(),
    limit: z.number().int().min(1).max(25)
  })
  .strict();

export const RecallSearchResponseSchema = z
  .object({
    results: z.array(RecallEntrySchema)
  })
  .strict();

export const WorkflowProofSummaryRequestSchema = z
  .object({
    workspace_root: z.string().min(1),
    limit: z.number().int().min(1).max(25)
  })
  .strict();

export const WorkflowProofReportRequestSchema = z
  .object({
    workspace_root: z.string().min(1),
    limit: z.number().int().min(1).max(25)
  })
  .strict();

export const WorkflowProofSummaryResponseSchema = z
  .object({
    summary: WorkflowProofSummarySchema,
    gate_status: WorkflowProofGateStatusSchema,
    recent_journeys: z.array(WorkflowProofRecordSchema)
  })
  .strict();

export const WorkflowProofReportResponseSchema = WorkflowProofReportSchema;

export const RunEventEnvelopeSchema = z
  .object({
    channel: z.literal("run.event.push"),
    payload: RunEventSchema
  })
  .strict();

export const ipcContractMap = {
  "task.intent.submit": {
    direction: "renderer_to_main",
    payloadSchema: TaskIntentRequestSchema
  },
  "task.intent.response": {
    direction: "main_to_renderer",
    payloadSchema: TaskIntentResponseSchema
  },
  "approval.decision.submit": {
    direction: "renderer_to_main",
    payloadSchema: ApprovalDecisionSchema
  },
  "approval.decision.response": {
    direction: "main_to_renderer",
    payloadSchema: ApprovalDecisionResponseSchema
  },
  "run.execution.submit": {
    direction: "renderer_to_main",
    payloadSchema: RunExecutionRequestSchema
  },
  "run.execution.response": {
    direction: "main_to_renderer",
    payloadSchema: RunExecutionResponseSchema
  },
  "run.history.list": {
    direction: "renderer_to_main",
    payloadSchema: RunHistoryRequestSchema
  },
  "run.history.response": {
    direction: "main_to_renderer",
    payloadSchema: RunHistoryResponseSchema
  },
  "run.delete.request": {
    direction: "renderer_to_main",
    payloadSchema: RunDeleteRequestSchema
  },
  "run.delete.response": {
    direction: "main_to_renderer",
    payloadSchema: RunDeleteResponseSchema
  },
  "run.export.request": {
    direction: "renderer_to_main",
    payloadSchema: RunExportRequestSchema
  },
  "run.export.response": {
    direction: "main_to_renderer",
    payloadSchema: RunExportResponseSchema
  },
  "recall.search.query": {
    direction: "renderer_to_main",
    payloadSchema: RecallSearchRequestSchema
  },
  "recall.search.response": {
    direction: "main_to_renderer",
    payloadSchema: RecallSearchResponseSchema
  },
  "workflow.proof.record": {
    direction: "renderer_to_main",
    payloadSchema: WorkflowProofRecordSchema
  },
  "workflow.proof.recorded": {
    direction: "main_to_renderer",
    payloadSchema: WorkflowProofRecordSchema
  },
  "workflow.proof.summary.get": {
    direction: "renderer_to_main",
    payloadSchema: WorkflowProofSummaryRequestSchema
  },
  "workflow.proof.summary.response": {
    direction: "main_to_renderer",
    payloadSchema: WorkflowProofSummaryResponseSchema
  },
  "workflow.proof.report.get": {
    direction: "renderer_to_main",
    payloadSchema: WorkflowProofReportRequestSchema
  },
  "workflow.proof.report.response": {
    direction: "main_to_renderer",
    payloadSchema: WorkflowProofReportResponseSchema
  },
  "policy.snapshot.get": {
    direction: "renderer_to_main",
    payloadSchema: PolicySnapshotRequestSchema
  },
  "policy.snapshot.response": {
    direction: "main_to_renderer",
    payloadSchema: PolicySnapshotResponseSchema
  },
  "planner.status.get": {
    direction: "renderer_to_main",
    payloadSchema: PlannerStatusRequestSchema
  },
  "planner.status.response": {
    direction: "main_to_renderer",
    payloadSchema: PlannerStatusResponseSchema
  },
  "planner.settings.update": {
    direction: "renderer_to_main",
    payloadSchema: PlannerSettingsUpdateRequestSchema
  },
  "planner.settings.response": {
    direction: "main_to_renderer",
    payloadSchema: PlannerSettingsUpdateResponseSchema
  },
  "run.event.push": {
    direction: "main_to_renderer",
    payloadSchema: RunEventSchema
  }
} as const;

export type IpcChannel = keyof typeof ipcContractMap;

export const IpcEnvelopeSchema = z.discriminatedUnion("channel", [
  z.object({
    channel: z.literal("task.intent.submit"),
    payload: TaskIntentRequestSchema
  }),
  z.object({
    channel: z.literal("task.intent.response"),
    payload: TaskIntentResponseSchema
  }),
  z.object({
    channel: z.literal("approval.decision.submit"),
    payload: ApprovalDecisionSchema
  }),
  z.object({
    channel: z.literal("approval.decision.response"),
    payload: ApprovalDecisionResponseSchema
  }),
  z.object({
    channel: z.literal("run.execution.submit"),
    payload: RunExecutionRequestSchema
  }),
  z.object({
    channel: z.literal("run.execution.response"),
    payload: RunExecutionResponseSchema
  }),
  z.object({
    channel: z.literal("run.history.list"),
    payload: RunHistoryRequestSchema
  }),
  z.object({
    channel: z.literal("run.history.response"),
    payload: RunHistoryResponseSchema
  }),
  z.object({
    channel: z.literal("run.delete.request"),
    payload: RunDeleteRequestSchema
  }),
  z.object({
    channel: z.literal("run.delete.response"),
    payload: RunDeleteResponseSchema
  }),
  z.object({
    channel: z.literal("run.export.request"),
    payload: RunExportRequestSchema
  }),
  z.object({
    channel: z.literal("run.export.response"),
    payload: RunExportResponseSchema
  }),
  z.object({
    channel: z.literal("recall.search.query"),
    payload: RecallSearchRequestSchema
  }),
  z.object({
    channel: z.literal("recall.search.response"),
    payload: RecallSearchResponseSchema
  }),
  z.object({
    channel: z.literal("workflow.proof.record"),
    payload: WorkflowProofRecordSchema
  }),
  z.object({
    channel: z.literal("workflow.proof.recorded"),
    payload: WorkflowProofRecordSchema
  }),
  z.object({
    channel: z.literal("workflow.proof.summary.get"),
    payload: WorkflowProofSummaryRequestSchema
  }),
  z.object({
    channel: z.literal("workflow.proof.summary.response"),
    payload: WorkflowProofSummaryResponseSchema
  }),
  z.object({
    channel: z.literal("workflow.proof.report.get"),
    payload: WorkflowProofReportRequestSchema
  }),
  z.object({
    channel: z.literal("workflow.proof.report.response"),
    payload: WorkflowProofReportResponseSchema
  }),
  z.object({
    channel: z.literal("policy.snapshot.get"),
    payload: PolicySnapshotRequestSchema
  }),
  z.object({
    channel: z.literal("policy.snapshot.response"),
    payload: PolicySnapshotResponseSchema
  }),
  z.object({
    channel: z.literal("planner.status.get"),
    payload: PlannerStatusRequestSchema
  }),
  z.object({
    channel: z.literal("planner.status.response"),
    payload: PlannerStatusResponseSchema
  }),
  z.object({
    channel: z.literal("planner.settings.update"),
    payload: PlannerSettingsUpdateRequestSchema
  }),
  z.object({
    channel: z.literal("planner.settings.response"),
    payload: PlannerSettingsUpdateResponseSchema
  }),
  RunEventEnvelopeSchema
]);

export type IpcEnvelope = z.infer<typeof IpcEnvelopeSchema>;
export type TaskIntentRequest = z.infer<typeof TaskIntentRequestSchema>;
export type TaskIntentResponse = z.infer<typeof TaskIntentResponseSchema>;
export type PolicySnapshotRequest = z.infer<typeof PolicySnapshotRequestSchema>;
export type PolicySnapshotResponse = z.infer<typeof PolicySnapshotResponseSchema>;
export type PlannerStatusRequest = z.infer<typeof PlannerStatusRequestSchema>;
export type PlannerStatusResponse = z.infer<typeof PlannerStatusResponseSchema>;
export type PlannerSettingsUpdateRequest = z.infer<typeof PlannerSettingsUpdateRequestSchema>;
export type PlannerSettingsUpdateResponse = z.infer<typeof PlannerSettingsUpdateResponseSchema>;
export type RunEventEnvelope = z.infer<typeof RunEventEnvelopeSchema>;
export type RunExecutionRequest = z.infer<typeof RunExecutionRequestSchema>;
export type RunExecutionResponse = z.infer<typeof RunExecutionResponseSchema>;
export type RunHistoryRequest = z.infer<typeof RunHistoryRequestSchema>;
export type RunHistoryResponse = z.infer<typeof RunHistoryResponseSchema>;
export type RunDeleteRequest = z.infer<typeof RunDeleteRequestSchema>;
export type RunDeleteResponse = z.infer<typeof RunDeleteResponseSchema>;
export type RunExportRequest = z.infer<typeof RunExportRequestSchema>;
export type RunExportResponse = z.infer<typeof RunExportResponseSchema>;
export type RecallEntry = z.infer<typeof RecallEntrySchema>;
export type RecallSearchRequest = z.infer<typeof RecallSearchRequestSchema>;
export type RecallSearchResponse = z.infer<typeof RecallSearchResponseSchema>;
export type WorkflowProofSummaryRequest = z.infer<typeof WorkflowProofSummaryRequestSchema>;
export type WorkflowProofSummaryResponse = z.infer<typeof WorkflowProofSummaryResponseSchema>;
export type WorkflowProofReportRequest = z.infer<typeof WorkflowProofReportRequestSchema>;
export type WorkflowProofReportResponse = z.infer<typeof WorkflowProofReportResponseSchema>;
export type TaskRoute = z.infer<typeof TaskRouteSchema>;
export type DiffPreview = z.infer<typeof DiffPreviewSchema>;
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;
export type SimulationSummary = z.infer<typeof SimulationSummarySchema>;
export type ApprovalDecisionResponse = z.infer<typeof ApprovalDecisionResponseSchema>;

export function parseIpcEnvelope(input: unknown): IpcEnvelope {
  return IpcEnvelopeSchema.parse(input);
}
