import path from "node:path";

import { z } from "zod";

import {
  actionStatuses,
  approvalDecisionKinds,
  approvalScopeClasses,
  contradictionStatuses,
  deviationClasses,
  eventCategories,
  eventTypes,
  memoryRecordClasses,
  networkAccessClasses,
  networkMethodFamilies,
  networkSchemes,
  persistenceStatuses,
  previewConfidenceLevels,
  proofGateCriterionStatuses,
  proofGateOverallStatuses,
  provenanceTypes,
  riskLevels,
  routeKinds,
  sideEffectFamilies,
  taskTypes,
  verificationStatuses,
  workflowSequence,
  workflowJourneyKinds,
  workflowStates
} from "../../shared/constants";

const IdentifierSchema = z.string().min(1);
const NonEmptyStringSchema = z.string().min(1);
const IsoDateTimeSchema = z.string().datetime({ offset: true });
const AbsolutePathSchema = z
  .string()
  .min(1)
  .refine(
    (value) => path.win32.isAbsolute(value) || path.posix.isAbsolute(value),
    "Expected an absolute path"
  );

export const RiskLevelSchema = z.enum(riskLevels);
export const WorkflowStateSchema = z.enum(workflowStates);
export const ApprovalDecisionKindSchema = z.enum(approvalDecisionKinds);
export const ApprovalScopeClassSchema = z.enum(approvalScopeClasses);
export const SideEffectFamilySchema = z.enum(sideEffectFamilies);
export const EventCategorySchema = z.enum(eventCategories);
export const EventTypeSchema = z.enum(eventTypes);
export const PersistenceStatusSchema = z.enum(persistenceStatuses);
export const MemoryRecordClassSchema = z.enum(memoryRecordClasses);
export const ProvenanceTypeSchema = z.enum(provenanceTypes);
export const VerificationStatusSchema = z.enum(verificationStatuses);
export const ContradictionStatusSchema = z.enum(contradictionStatuses);
export const PreviewConfidenceSchema = z.enum(previewConfidenceLevels);
export const DeviationClassSchema = z.enum(deviationClasses);
export const ActionStatusSchema = z.enum(actionStatuses);
export const NetworkSchemeSchema = z.enum(networkSchemes);
export const NetworkMethodFamilySchema = z.enum(networkMethodFamilies);
export const NetworkAccessClassSchema = z.enum(networkAccessClasses);
export const RouteKindSchema = z.enum(routeKinds);
export const TaskTypeSchema = z.enum(taskTypes);
export const WorkflowJourneyKindSchema = z.enum(workflowJourneyKinds);
export const ProofGateCriterionStatusSchema = z.enum(proofGateCriterionStatuses);
export const ProofGateOverallStatusSchema = z.enum(proofGateOverallStatuses);

export const NetworkScopeRuleSchema = z
  .object({
    scheme: NetworkSchemeSchema,
    host: z.string().min(1),
    port: z.number().int().min(1).max(65535),
    methodFamily: NetworkMethodFamilySchema,
    accessClass: NetworkAccessClassSchema
  })
  .strict();

export const NetworkScopeSchema = z
  .object({
    default_policy: z.literal("deny"),
    allow: z.array(NetworkScopeRuleSchema)
  })
  .strict();

export const WorkspaceScopeSchema = z
  .object({
    roots: z.array(AbsolutePathSchema).min(1)
  })
  .strict();

export const PathScopeEntrySchema = z
  .object({
    path: AbsolutePathSchema,
    access: z.enum(["read", "write", "read_write"]),
    reason: z.string().min(1).optional()
  })
  .strict();

export const PathScopeSchema = z
  .object({
    roots: z.array(AbsolutePathSchema).min(1),
    entries: z.array(PathScopeEntrySchema)
  })
  .strict();

export const PolicySnapshotSchema = z
  .object({
    version: z.string().min(1),
    workflow: z.literal(workflowSequence),
    routing_mode: z.literal("local_first_stubbed"),
    generated_at: IsoDateTimeSchema
  })
  .strict();

export const ExpectedSideEffectSchema = z
  .object({
    family: SideEffectFamilySchema,
    target: z.string().min(1),
    detail: z.string().optional()
  })
  .strict();

export const ArtifactSchema = z
  .object({
    kind: z.enum(["file", "log", "record", "preview"]),
    location: z.string().min(1),
    description: z.string().optional()
  })
  .strict();

export const ActionSchema = z
  .object({
    id: IdentifierSchema,
    type: NonEmptyStringSchema,
    label: NonEmptyStringSchema,
    description: NonEmptyStringSchema,
    args: z.record(z.string(), z.unknown()),
    expected_output: NonEmptyStringSchema,
    risk: RiskLevelSchema,
    requires_approval: z.boolean(),
    approval_scope_allowed: z.array(ApprovalScopeClassSchema).min(1),
    status: ActionStatusSchema
  })
  .strict();

export const PlanSchema = z
  .object({
    id: IdentifierSchema,
    user_goal: NonEmptyStringSchema,
    summary: NonEmptyStringSchema,
    planning_notes: z.array(z.string()),
    risk_summary: NonEmptyStringSchema,
    requires_approval: z.boolean(),
    actions: z.array(ActionSchema),
    created_at: IsoDateTimeSchema,
    policy_snapshot: PolicySnapshotSchema
  })
  .strict();

export const CompiledActionSchema = z
  .object({
    action_id: IdentifierSchema,
    tool_name: NonEmptyStringSchema,
    normalized_args: z.record(z.string(), z.unknown()),
    workspace_scope: WorkspaceScopeSchema,
    path_scope: PathScopeSchema,
    network_scope: NetworkScopeSchema,
    expected_side_effects: z.array(ExpectedSideEffectSchema),
    expected_artifacts: z.array(ArtifactSchema),
    risk_level: RiskLevelSchema,
    requires_approval: z.boolean(),
    approval_signature: z.string().min(1),
    execution_hash: z.string().min(1)
  })
  .strict();

export const ExecutionManifestSchema = z
  .object({
    manifest_id: IdentifierSchema,
    plan_id: IdentifierSchema,
    run_id: IdentifierSchema,
    compiled_actions: z.array(CompiledActionSchema),
    manifest_hash: z.string().min(1),
    policy_snapshot: PolicySnapshotSchema,
    created_at: IsoDateTimeSchema,
    expires_at: IsoDateTimeSchema
  })
  .strict();

export const EffectPreviewSchema = z
  .object({
    action_id: IdentifierSchema,
    predicted_reads: z.array(z.string()),
    predicted_writes: z.array(z.string()),
    predicted_deletes: z.array(z.string()),
    predicted_process_changes: z.array(z.string()),
    predicted_remote_calls: z.array(z.string()),
    predicted_system_changes: z.array(z.string()),
    confidence: PreviewConfidenceSchema,
    notes: z.array(z.string())
  })
  .strict();

export const ApprovalDecisionSchema = z
  .object({
    manifest_id: IdentifierSchema,
    action_id: IdentifierSchema,
    decision: ApprovalDecisionKindSchema,
    approval_scope_class: ApprovalScopeClassSchema,
    approval_signature: z.string().min(1),
    execution_hash: z.string().min(1),
    max_execution_count: z.number().int().min(1),
    session_id: z.string().min(1),
    expires_at: IsoDateTimeSchema,
    decided_at: IsoDateTimeSchema,
    decided_by: z.string().min(1)
  })
  .strict();

export const RunEventKindSchema = z
  .object({
    category: EventCategorySchema,
    type: EventTypeSchema
  })
  .strict();

export const RunEventSchema = z
  .object({
    run_id: IdentifierSchema,
    kind: RunEventKindSchema,
    timestamp: IsoDateTimeSchema,
    payload: z.record(z.string(), z.unknown())
  })
  .strict();

export const ToolResultSchema = z
  .object({
    ok: z.boolean(),
    summary: z.unknown(),
    output: z.unknown(),
    redacted_output: z.unknown(),
    error: z.unknown(),
    artifacts: z.array(ArtifactSchema),
    structured_data: z.unknown(),
    observed_effects: z.array(ExpectedSideEffectSchema)
  })
  .strict();

export const ExecutionAttestationSchema = z
  .object({
    run_id: IdentifierSchema,
    action_id: IdentifierSchema,
    approved_execution_hash: z.string().min(1),
    actual_execution_hash: z.string().min(1),
    matched: z.boolean(),
    deviations: z.array(DeviationClassSchema),
    observed_effects: z.array(ExpectedSideEffectSchema),
    attested_at: IsoDateTimeSchema
  })
  .strict();

export const RunFinalResultSchema = z
  .object({
    status: WorkflowStateSchema,
    summary: z.string().min(1)
  })
  .strict();

export const RunLogSchema = z
  .object({
    run_id: IdentifierSchema,
    plan_id: IdentifierSchema,
    manifest_id: IdentifierSchema,
    manifest_hash: z.string().min(1),
    events: z.array(RunEventSchema),
    attestations: z.array(ExecutionAttestationSchema),
    final_result: RunFinalResultSchema,
    artifacts: z.array(ArtifactSchema),
    started_at: IsoDateTimeSchema,
    finished_at: IsoDateTimeSchema,
    persistence_status: PersistenceStatusSchema
  })
  .strict();

export const MemoryMetadataSchema = z
  .object({
    provenance_type: ProvenanceTypeSchema,
    source_run_id: z.string().min(1),
    source_message_ids: z.array(z.string()),
    confidence: PreviewConfidenceSchema,
    verification_status: VerificationStatusSchema,
    contradiction_status: ContradictionStatusSchema,
    last_verified_at: IsoDateTimeSchema.nullable(),
    retention_policy: z.string().min(1)
  })
  .strict();

export const MemoryRecordSchema = z
  .object({
    id: IdentifierSchema,
    tier: z.number().int().min(1).max(3),
    category: MemoryRecordClassSchema,
    source: z.string().min(1),
    content: z.string().min(1),
    metadata: MemoryMetadataSchema,
    created_at: IsoDateTimeSchema,
    updated_at: IsoDateTimeSchema
  })
  .strict();

export const WorkflowProofRecordSchema = z
  .object({
    journey_id: IdentifierSchema,
    journey_kind: WorkflowJourneyKindSchema,
    session_id: z.string().min(1),
    workspace_root: AbsolutePathSchema,
    route_kind: RouteKindSchema.nullable(),
    task_type: TaskTypeSchema.nullable(),
    risk_class: RiskLevelSchema.nullable(),
    approval_required: z.boolean(),
    resume_used: z.boolean(),
    resumed_from_recall_id: z.string().min(1).nullable(),
    composer_ready_at: IsoDateTimeSchema.nullable(),
    cold_start_to_composer_ms: z.number().int().min(0).nullable(),
    preview_requested_at: IsoDateTimeSchema,
    preview_ready_at: IsoDateTimeSchema.nullable(),
    task_to_preview_ms: z.number().int().min(0).nullable(),
    approval_recorded_at: IsoDateTimeSchema.nullable(),
    preview_to_approval_ms: z.number().int().min(0).nullable(),
    execute_requested_at: IsoDateTimeSchema.nullable(),
    first_result_at: IsoDateTimeSchema.nullable(),
    approval_to_first_result_ms: z.number().int().min(0).nullable(),
    execute_to_first_result_ms: z.number().int().min(0).nullable(),
    operator_click_count: z.number().int().min(0),
    workflow_step_count: z.number().int().min(0),
    manifest_id: z.string().min(1).nullable(),
    run_id: z.string().min(1).nullable(),
    workflow_state: WorkflowStateSchema.nullable(),
    updated_at: IsoDateTimeSchema
  })
  .strict();

export const WorkflowProofSummarySchema = z
  .object({
    golden_workflow_attempts: z.number().int().min(0),
    golden_workflow_review_ready: z.number().int().min(0),
    golden_workflow_stability_rate: z.number().min(0).max(1),
    median_cold_start_to_composer_ms: z.number().int().min(0).nullable(),
    median_task_to_preview_ms: z.number().int().min(0).nullable(),
    median_preview_to_approval_ms: z.number().int().min(0).nullable(),
    median_approval_to_first_result_ms: z.number().int().min(0).nullable(),
    median_execute_to_first_result_ms: z.number().int().min(0).nullable(),
    median_workflow_step_count: z.number().int().min(0).nullable(),
    median_operator_click_count: z.number().int().min(0).nullable(),
    median_repeat_task_to_preview_ms: z.number().int().min(0).nullable(),
    resume_journeys: z.number().int().min(0),
    resume_review_ready: z.number().int().min(0),
    latest_updated_at: IsoDateTimeSchema.nullable()
  })
  .strict();

export const WorkflowProofGateCriterionSchema = z
  .object({
    status: ProofGateCriterionStatusSchema,
    detail: z.string().min(1),
    sample_count: z.number().int().min(0).nullable(),
    required_sample_count: z.number().int().min(1).nullable(),
    satisfied_count: z.number().int().min(0).nullable(),
    required_satisfied_count: z.number().int().min(1).nullable(),
    recent_median: z.number().int().min(0).nullable(),
    previous_median: z.number().int().min(0).nullable(),
    threshold_median: z.number().int().min(0).nullable()
  })
  .strict();

export const WorkflowProofGateStatusSchema = z
  .object({
    overall_status: ProofGateOverallStatusSchema,
    blocking_reasons: z.array(z.string()),
    stability: WorkflowProofGateCriterionSchema,
    task_to_preview_trend: WorkflowProofGateCriterionSchema,
    preview_to_approval_trend: WorkflowProofGateCriterionSchema,
    approval_to_first_result_trend: WorkflowProofGateCriterionSchema,
    step_count_trend: WorkflowProofGateCriterionSchema,
    click_count_trend: WorkflowProofGateCriterionSchema,
    repeat_task_speed: WorkflowProofGateCriterionSchema,
    resume_helpfulness: WorkflowProofGateCriterionSchema,
    assumption_note: z.string().min(1)
  })
  .strict();

export type NetworkScopeRule = z.infer<typeof NetworkScopeRuleSchema>;
export type NetworkScope = z.infer<typeof NetworkScopeSchema>;
export type WorkspaceScope = z.infer<typeof WorkspaceScopeSchema>;
export type PathScope = z.infer<typeof PathScopeSchema>;
export type PolicySnapshot = z.infer<typeof PolicySnapshotSchema>;
export type ExpectedSideEffect = z.infer<typeof ExpectedSideEffectSchema>;
export type Artifact = z.infer<typeof ArtifactSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type CompiledAction = z.infer<typeof CompiledActionSchema>;
export type ExecutionManifest = z.infer<typeof ExecutionManifestSchema>;
export type EffectPreview = z.infer<typeof EffectPreviewSchema>;
export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;
export type RunEvent = z.infer<typeof RunEventSchema>;
export type ToolResult = z.infer<typeof ToolResultSchema>;
export type ExecutionAttestation = z.infer<typeof ExecutionAttestationSchema>;
export type RunLog = z.infer<typeof RunLogSchema>;
export type MemoryMetadata = z.infer<typeof MemoryMetadataSchema>;
export type MemoryRecord = z.infer<typeof MemoryRecordSchema>;
export type WorkflowProofRecord = z.infer<typeof WorkflowProofRecordSchema>;
export type WorkflowProofSummary = z.infer<typeof WorkflowProofSummarySchema>;
export type WorkflowProofGateStatus = z.infer<typeof WorkflowProofGateStatusSchema>;
