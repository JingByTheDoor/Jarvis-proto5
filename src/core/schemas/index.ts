import {
  ActionSchema,
  ApprovalDecisionSchema,
  CompiledActionSchema,
  EffectPreviewSchema,
  ExecutionAttestationSchema,
  ExecutionManifestSchema,
  MemoryRecordSchema,
  PlanSchema,
  RunEventSchema,
  RunLogSchema,
  ToolResultSchema
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
  MEMORY_RECORD: MemoryRecordSchema
} as const;

export type SchemaRegistry = typeof schemaRegistry;

export * from "./contracts";
