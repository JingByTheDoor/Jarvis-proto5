export const workflowStates = [
  "idle",
  "preparing_plan",
  "plan_ready",
  "compiling_manifest",
  "manifest_ready",
  "simulating_effects",
  "simulation_ready",
  "awaiting_approval",
  "executing",
  "execution_complete",
  "attesting",
  "review_ready",
  "partial",
  "failed",
  "aborted"
] as const;

export type WorkflowState = (typeof workflowStates)[number];

export const riskLevels = ["SAFE", "CAUTION", "DANGER"] as const;
export type RiskLevel = (typeof riskLevels)[number];

export const approvalDecisionKinds = [
  "pending",
  "approve_once",
  "approve_session",
  "deny"
] as const;

export type ApprovalDecisionKind = (typeof approvalDecisionKinds)[number];

export const approvalScopeClasses = [
  "exact_action_only",
  "session_same_scope",
  "session_readonly_scope",
  "never_session_approvable"
] as const;

export type ApprovalScopeClass = (typeof approvalScopeClasses)[number];

export const sideEffectFamilies = [
  "readonly",
  "workspace_write",
  "workspace_delete",
  "process_launch",
  "process_terminate",
  "remote_read",
  "remote_write",
  "system_mutation",
  "credential_use",
  "raw_shell_readonly",
  "raw_shell_mutating"
] as const;

export type SideEffectFamily = (typeof sideEffectFamilies)[number];

export const eventCategories = [
  "USER",
  "AGENT",
  "PLAN",
  "COMPILE",
  "SIMULATION",
  "STEP",
  "TOOL",
  "APPROVAL",
  "ATTESTATION",
  "WARNING",
  "ERROR",
  "TASK",
  "RESULT",
  "MEMORY",
  "SYSTEM"
] as const;

export type EventCategory = (typeof eventCategories)[number];

export const eventTypes = [
  "plan_ready",
  "manifest_compiled",
  "simulation_ready",
  "approval_needed",
  "approval_recorded",
  "action_started",
  "action_event",
  "tool_output",
  "tool_redacted_output",
  "action_completed",
  "attestation_recorded",
  "memory_read",
  "memory_write",
  "execution_complete",
  "memory_sync_pending",
  "memory_sync_complete",
  "analytics_sync_pending",
  "analytics_sync_failed",
  "review_ready",
  "run_error"
] as const;

export type EventType = (typeof eventTypes)[number];

export const persistenceStatuses = [
  "execution_complete",
  "memory_sync_pending",
  "memory_sync_complete",
  "analytics_sync_pending",
  "analytics_sync_failed",
  "review_ready"
] as const;

export type PersistenceStatus = (typeof persistenceStatuses)[number];

export const memoryRecordClasses = [
  "operator_pinned_fact",
  "extracted_fact_unverified",
  "system_observation",
  "derived_summary",
  "retrieved_context",
  "verified_fact"
] as const;

export type MemoryRecordClass = (typeof memoryRecordClasses)[number];

export const provenanceTypes = [
  "user_input",
  "tool_result",
  "run_log",
  "summary",
  "retrieval",
  "system_event"
] as const;

export type ProvenanceType = (typeof provenanceTypes)[number];

export const verificationStatuses = [
  "unverified",
  "user_confirmed",
  "tool_confirmed",
  "policy_confirmed",
  "disputed"
] as const;

export type VerificationStatus = (typeof verificationStatuses)[number];

export const contradictionStatuses = [
  "none",
  "possible_conflict",
  "confirmed_conflict"
] as const;

export type ContradictionStatus = (typeof contradictionStatuses)[number];

export const previewConfidenceLevels = ["high", "medium", "low"] as const;
export type PreviewConfidence = (typeof previewConfidenceLevels)[number];

export const deviationClasses = [
  "hash_changed",
  "scope_exceeded",
  "unexpected_write",
  "unexpected_delete",
  "unexpected_remote_call",
  "unexpected_process_change",
  "unexpected_system_change",
  "missing_observation"
] as const;

export type DeviationClass = (typeof deviationClasses)[number];

export const actionStatuses = [
  "pending",
  "compiled",
  "simulated",
  "approved",
  "executed",
  "attested",
  "blocked",
  "failed"
] as const;

export type ActionStatus = (typeof actionStatuses)[number];

export const networkSchemes = ["http", "https"] as const;
export type NetworkScheme = (typeof networkSchemes)[number];

export const networkMethodFamilies = ["read_methods", "write_methods"] as const;
export type NetworkMethodFamily = (typeof networkMethodFamilies)[number];

export const networkAccessClasses = ["read", "write"] as const;
export type NetworkAccessClass = (typeof networkAccessClasses)[number];

export const untrustedSourceKinds = [
  "file",
  "url",
  "webpage",
  "note",
  "email",
  "ocr_text",
  "code_comment",
  "issue_body",
  "commit_message",
  "dom_content",
  "retrieved_memory"
] as const;

export type UntrustedSourceKind = (typeof untrustedSourceKinds)[number];

export const capabilityTokenStatuses = [
  "active",
  "consumed",
  "revoked",
  "expired"
] as const;

export type CapabilityTokenStatus = (typeof capabilityTokenStatuses)[number];

export const capabilityRevocationReasons = [
  "session_end",
  "manual_lock",
  "approval_expired",
  "crash_recovery",
  "app_restart",
  "policy_violation"
] as const;

export type CapabilityRevocationReason =
  (typeof capabilityRevocationReasons)[number];

export const workflowSequence =
  "PLAN -> COMPILE -> SIMULATE -> APPROVAL -> EXECUTE -> ATTEST -> REVIEW";

export const taskTypes = [
  "repo_inspection",
  "repo_edit",
  "guarded_command",
  "unsupported"
] as const;
export type TaskType = (typeof taskTypes)[number];

export const routeKinds = [
  "local_read_tools",
  "local_repo_file_tools",
  "local_guarded_shell",
  "manual_confirmation_required"
] as const;
export type RouteKind = (typeof routeKinds)[number];

export const workflowJourneyKinds = [
  "golden_edit_workflow",
  "inspection_only",
  "guarded_shell_workflow",
  "unsupported_workflow"
] as const;
export type WorkflowJourneyKind = (typeof workflowJourneyKinds)[number];

export const proofGateCriterionStatuses = [
  "not_enough_data",
  "on_track",
  "attention_needed"
] as const;
export type ProofGateCriterionStatus = (typeof proofGateCriterionStatuses)[number];

export const proofGateOverallStatuses = [
  "collecting_evidence",
  "blocked",
  "candidate_ready"
] as const;
export type ProofGateOverallStatus = (typeof proofGateOverallStatuses)[number];
