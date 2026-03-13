import {
  ActionSchema,
  ApprovalDecisionSchema,
  CompiledActionSchema,
  EffectPreviewSchema,
  ExecutionAttestationSchema,
  ExecutionManifestSchema,
  MemoryRecordSchema,
  PlannerAssistanceSchema,
  PlannerProviderConfigSchema,
  PlannerProviderStatusSchema,
  PlanSchema,
  RunExportBundleSchema,
  RunEventSchema,
  RunLogSchema,
  ToolResultSchema,
  WorkflowProofGateStatusSchema,
  WorkflowProofReportSchema,
  WorkflowProofRecordSchema,
  WorkflowProofSummarySchema
} from "./contracts";

export const schemaRegistry = {
  PLAN: PlanSchema,
  ACTION: ActionSchema,
  EXECUTION_MANIFEST: ExecutionManifestSchema,
  COMPILED_ACTION: CompiledActionSchema,
  EFFECT_PREVIEW: EffectPreviewSchema,
  APPROVAL_DECISION: ApprovalDecisionSchema,
  RUN_EVENT: RunEventSchema,
  RUN_LOG: RunLogSchema,
  TOOL_RESULT: ToolResultSchema,
  EXECUTION_ATTESTATION: ExecutionAttestationSchema,
  MEMORY_RECORD: MemoryRecordSchema,
  RUN_EXPORT_BUNDLE: RunExportBundleSchema,
  PLANNER_PROVIDER_STATUS: PlannerProviderStatusSchema,
  PLANNER_PROVIDER_CONFIG: PlannerProviderConfigSchema,
  PLANNER_ASSISTANCE: PlannerAssistanceSchema,
  WORKFLOW_PROOF_RECORD: WorkflowProofRecordSchema,
  WORKFLOW_PROOF_SUMMARY: WorkflowProofSummarySchema,
  WORKFLOW_PROOF_GATE_STATUS: WorkflowProofGateStatusSchema,
  WORKFLOW_PROOF_REPORT: WorkflowProofReportSchema
} as const;

export type SchemaRegistry = typeof schemaRegistry;

export * from "./contracts";
