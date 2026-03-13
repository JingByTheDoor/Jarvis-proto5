import type {
  Action,
  ApprovalDecision,
  CompiledAction,
  EffectPreview,
  ExecutionAttestation,
  ExecutionManifest,
  MemoryRecord,
  Plan,
  PolicySnapshot,
  RunEvent,
  RunLog,
  ToolResult,
  WorkflowProofGateStatus,
  WorkflowProofRecord
} from "../src/core/schemas";
import type {
  ApprovalDecisionResponse,
  ApprovalRequest,
  RecallSearchResponse,
  RunExecutionResponse,
  RunHistoryResponse,
  SimulationSummary,
  WorkflowProofSummaryResponse
} from "../src/shared/ipc";

export const ISO_NOW = "2026-03-11T18:00:00.000Z";
export const ISO_LATER = "2026-03-11T19:00:00.000Z";
export const ISO_EXPIRY = "2026-03-11T20:00:00.000Z";
export const ISO_APP_STARTED = "2026-03-11T17:59:59.500Z";

export const WORKSPACE_ROOT = "D:\\Jarvis-proto5 repo\\Jarvis-proto5";
export const README_PATH = `${WORKSPACE_ROOT}\\README.md`;
export const OUTPUT_PATH = `${WORKSPACE_ROOT}\\.tmp\\runs\\run-1.json`;

export const validPolicySnapshot: PolicySnapshot = {
  version: "phase-6-proof-gate",
  workflow: "PLAN -> COMPILE -> SIMULATE -> APPROVAL -> EXECUTE -> ATTEST -> REVIEW",
  routing_mode: "local_first_stubbed",
  generated_at: ISO_NOW
};

export const validAction: Action = {
  id: "action-1",
  type: "file_read",
  label: "Read README",
  description: "Read a project file in a local workspace",
  args: {
    path: README_PATH
  },
  expected_output: "text contents",
  risk: "SAFE",
  requires_approval: false,
  approval_scope_allowed: ["exact_action_only", "session_readonly_scope"],
  status: "pending"
};

export const validCompiledAction: CompiledAction = {
  action_id: "action-1",
  tool_name: "read_text_file",
  normalized_args: {
    path: README_PATH
  },
  workspace_scope: {
    roots: [WORKSPACE_ROOT]
  },
  path_scope: {
    roots: [WORKSPACE_ROOT],
    entries: [
      {
        path: README_PATH,
        access: "read",
        reason: "inspect target file"
      }
    ]
  },
  network_scope: {
    default_policy: "deny",
    allow: []
  },
  expected_side_effects: [
    {
      family: "readonly",
      target: README_PATH,
      detail: "read local file"
    }
  ],
  expected_artifacts: [
    {
      kind: "preview",
      location: OUTPUT_PATH,
      description: "preview receipt"
    }
  ],
  risk_level: "SAFE",
  requires_approval: false,
  approval_signature: "approval-signature-1",
  execution_hash: "execution-hash-1"
};

export const validPlan: Plan = {
  id: "plan-1",
  user_goal: "Inspect the repo safely",
  summary: "Read the README and prepare a safe next step",
  planning_notes: ["Use typed tools first", "Do not mutate files"],
  risk_summary: "Local read-only access only",
  requires_approval: false,
  actions: [validAction],
  created_at: ISO_NOW,
  policy_snapshot: validPolicySnapshot
};

export const validExecutionManifest: ExecutionManifest = {
  manifest_id: "manifest-1",
  plan_id: validPlan.id,
  run_id: "run-1",
  compiled_actions: [validCompiledAction],
  manifest_hash: "manifest-hash-1",
  policy_snapshot: validPolicySnapshot,
  created_at: ISO_NOW,
  expires_at: ISO_EXPIRY
};

export const validApprovalDecision: ApprovalDecision = {
  manifest_id: validExecutionManifest.manifest_id,
  action_id: validCompiledAction.action_id,
  decision: "approve_once",
  approval_scope_class: "exact_action_only",
  approval_signature: "approval-signature-1",
  execution_hash: validCompiledAction.execution_hash,
  max_execution_count: 1,
  session_id: "session-1",
  expires_at: ISO_EXPIRY,
  decided_at: ISO_LATER,
  decided_by: "operator"
};

export const validEffectPreview: EffectPreview = {
  action_id: validCompiledAction.action_id,
  predicted_reads: [README_PATH],
  predicted_writes: [],
  predicted_deletes: [],
  predicted_process_changes: [],
  predicted_remote_calls: [],
  predicted_system_changes: [],
  confidence: "high",
  notes: ["Tier A exact simulation will read the approved text file only."]
};

export const validSimulationSummary: SimulationSummary = {
  highest_risk: "SAFE",
  approval_required: false,
  preview_count: 1,
  confidence_breakdown: {
    high: 1,
    medium: 0,
    low: 0
  },
  notes: [
    "Simulation runs after compile and before approval.",
    "No approval is required for the current simulated slice."
  ]
};

export const validApprovalRequest: ApprovalRequest = {
  action_id: "action-2",
  risk_level: "DANGER",
  decision_options: ["deny", "approve_once"],
  allowed_scope_classes: ["exact_action_only", "never_session_approvable"],
  approval_signature: "approval-signature-2",
  execution_hash: "execution-hash-2",
  max_execution_count: 1,
  session_id: "session-1",
  expires_at: ISO_EXPIRY,
  path_scope: {
    roots: [WORKSPACE_ROOT],
    entries: [
      {
        path: README_PATH,
        access: "write",
        reason: "apply previewed file update"
      }
    ]
  },
  network_scope: {
    default_policy: "deny",
    allow: []
  },
  side_effect_family: "workspace_write",
  justification:
    "The exact simulation preview shows an overwrite outside approved temp/output paths, which is classified as DANGER."
};

export const validApprovalDecisionResponse: ApprovalDecisionResponse = {
  accepted: true,
  manifest_id: validExecutionManifest.manifest_id,
  action_id: validCompiledAction.action_id,
  decision: "approve_once",
  approval_scope_class: "exact_action_only",
  approval_signature: validCompiledAction.approval_signature,
  execution_hash: validCompiledAction.execution_hash,
  max_execution_count: 1,
  session_id: "session-1",
  expires_at: ISO_EXPIRY,
  decided_at: ISO_LATER,
  decided_by: "operator",
  remaining_uses: 1,
  reusable_within_session: false,
  message: "Recorded approve_once for the exact compiled action."
};

export const validRunEvent: RunEvent = {
  run_id: validExecutionManifest.run_id,
  kind: {
    category: "PLAN",
    type: "plan_ready"
  },
  timestamp: ISO_NOW,
  payload: {
    plan_id: validPlan.id
  }
};

export const validToolResult: ToolResult = {
  ok: true,
  summary: "Read README successfully",
  output: {
    path: README_PATH,
    text: "local output"
  },
  redacted_output: {
    path: README_PATH,
    text: "local output"
  },
  error: null,
  artifacts: validCompiledAction.expected_artifacts,
  structured_data: {
    line_count: 10
  },
  observed_effects: validCompiledAction.expected_side_effects
};

export const validExecutionAttestation: ExecutionAttestation = {
  run_id: validExecutionManifest.run_id,
  action_id: validCompiledAction.action_id,
  approved_execution_hash: validCompiledAction.execution_hash,
  actual_execution_hash: validCompiledAction.execution_hash,
  matched: true,
  deviations: [],
  observed_effects: validCompiledAction.expected_side_effects,
  attested_at: ISO_LATER
};

export const validRunLog: RunLog = {
  run_id: validExecutionManifest.run_id,
  plan_id: validPlan.id,
  manifest_id: validExecutionManifest.manifest_id,
  manifest_hash: validExecutionManifest.manifest_hash,
  events: [validRunEvent],
  attestations: [validExecutionAttestation],
  final_result: {
    status: "review_ready",
    summary: "Safe read completed"
  },
  artifacts: validCompiledAction.expected_artifacts,
  started_at: ISO_NOW,
  finished_at: ISO_LATER,
  persistence_status: "review_ready"
};

export const validRunExecutionResponse: RunExecutionResponse = {
  accepted: true,
  workflow_state: "review_ready",
  message: "Execution completed and attestation matched the approved manifest.",
  run_id: validExecutionManifest.run_id,
  persisted_run_path: `${WORKSPACE_ROOT}\\.tmp\\runs\\${validExecutionManifest.run_id}.json`,
  run_log: validRunLog,
  tool_results: [validToolResult],
  attestations: [validExecutionAttestation]
};

export const validRunHistoryResponse: RunHistoryResponse = {
  runs: [validRunLog]
};

export const validRecallSearchResponse: RecallSearchResponse = {
  results: [
    {
      id: "run:run-1",
      source_kind: "run_log",
      title: "run-1",
      excerpt: "run-1\nplan-1\nmanifest-1\nreview_ready\nSafe read completed",
      provenance_label: "run_log:run-1 / plan:plan-1 / manifest:manifest-1",
      trust_label: "tool_confirmed",
      updated_at: ISO_LATER,
      location: "run-1",
      resume_prompt:
        'Resume the previous task from run-1. Review the prior outcome "Safe read completed" and continue from the same workspace safely.',
      searchable_text: "run-1\nplan-1\nmanifest-1\nreview_ready\nSafe read completed"
    },
    {
      id: `note:${WORKSPACE_ROOT}\\notes\\operator-note.md`,
      source_kind: "operator_note",
      title: "operator-note.md",
      excerpt: "Remember to keep the write path narrow.",
      provenance_label: `${WORKSPACE_ROOT}\\notes\\operator-note.md`,
      trust_label: "user_confirmed",
      updated_at: ISO_LATER,
      location: `${WORKSPACE_ROOT}\\notes\\operator-note.md`,
      resume_prompt: null,
      searchable_text: "Remember to keep the write path narrow."
    }
  ]
};

export const validMemoryRecord: MemoryRecord = {
  id: "memory-1",
  tier: 1,
  category: "verified_fact",
  source: "run_log",
  content: "The repo is greenfield",
  metadata: {
    provenance_type: "run_log",
    source_run_id: validExecutionManifest.run_id,
    source_message_ids: ["msg-1"],
    confidence: "high",
    verification_status: "tool_confirmed",
    contradiction_status: "none",
    last_verified_at: ISO_LATER,
    retention_policy: "default_30d"
  },
  created_at: ISO_NOW,
  updated_at: ISO_LATER
};

export const validWorkflowProofRecord: WorkflowProofRecord = {
  journey_id: "journey-1",
  journey_kind: "golden_edit_workflow",
  session_id: "phase-6-proof-gate",
  workspace_root: WORKSPACE_ROOT,
  route_kind: "local_repo_file_tools",
  task_type: "repo_edit",
  risk_class: "DANGER",
  approval_required: true,
  resume_used: true,
  resumed_from_recall_id: "run:run-1",
  composer_ready_at: ISO_NOW,
  cold_start_to_composer_ms: 500,
  preview_requested_at: ISO_NOW,
  preview_ready_at: "2026-03-11T18:00:01.000Z",
  task_to_preview_ms: 1000,
  approval_recorded_at: "2026-03-11T18:00:03.000Z",
  preview_to_approval_ms: 2000,
  execute_requested_at: "2026-03-11T18:00:04.000Z",
  first_result_at: "2026-03-11T18:00:05.000Z",
  approval_to_first_result_ms: 2000,
  execute_to_first_result_ms: 1000,
  operator_click_count: 4,
  workflow_step_count: 4,
  manifest_id: "manifest-1",
  run_id: "run-1",
  workflow_state: "review_ready",
  updated_at: ISO_LATER
};

export const validWorkflowProofGateStatus: WorkflowProofGateStatus = {
  overall_status: "collecting_evidence",
  blocking_reasons: [
    "Need at least 3 recent golden edit journeys before stability can be judged.",
    "Need 6 task-to-preview samples before a local trend can be compared.",
    "Need 6 preview-to-approval samples before a local trend can be compared.",
    "Need 6 approval-to-first-result samples before a local trend can be compared.",
    "Need 6 workflow-step samples before a local trend can be compared.",
    "Need 6 operator-click samples before a local trend can be compared."
  ],
  stability: {
    status: "not_enough_data",
    detail: "Need at least 3 recent golden edit journeys before stability can be judged.",
    sample_count: 1,
    required_sample_count: 3,
    satisfied_count: 1,
    required_satisfied_count: 3,
    recent_median: null,
    previous_median: null,
    threshold_median: null
  },
  task_to_preview_trend: {
    status: "not_enough_data",
    detail: "Need 6 task-to-preview samples before a local trend can be compared.",
    sample_count: 1,
    required_sample_count: 6,
    satisfied_count: null,
    required_satisfied_count: null,
    recent_median: null,
    previous_median: null,
    threshold_median: null
  },
  preview_to_approval_trend: {
    status: "not_enough_data",
    detail: "Need 6 preview-to-approval samples before a local trend can be compared.",
    sample_count: 1,
    required_sample_count: 6,
    satisfied_count: null,
    required_satisfied_count: null,
    recent_median: null,
    previous_median: null,
    threshold_median: null
  },
  approval_to_first_result_trend: {
    status: "not_enough_data",
    detail: "Need 6 approval-to-first-result samples before a local trend can be compared.",
    sample_count: 1,
    required_sample_count: 6,
    satisfied_count: null,
    required_satisfied_count: null,
    recent_median: null,
    previous_median: null,
    threshold_median: null
  },
  step_count_trend: {
    status: "not_enough_data",
    detail: "Need 6 workflow-step samples before a local trend can be compared.",
    sample_count: 1,
    required_sample_count: 6,
    satisfied_count: null,
    required_satisfied_count: null,
    recent_median: null,
    previous_median: null,
    threshold_median: 4
  },
  click_count_trend: {
    status: "not_enough_data",
    detail: "Need 6 operator-click samples before a local trend can be compared.",
    sample_count: 1,
    required_sample_count: 6,
    satisfied_count: null,
    required_satisfied_count: null,
    recent_median: null,
    previous_median: null,
    threshold_median: 5
  },
  repeat_task_speed: {
    status: "on_track",
    detail: "Resumed task-to-preview median (1000) is no worse than the overall golden-workflow median (1000).",
    sample_count: 1,
    required_sample_count: 1,
    satisfied_count: null,
    required_satisfied_count: null,
    recent_median: 1000,
    previous_median: 1000,
    threshold_median: null
  },
  resume_helpfulness: {
    status: "on_track",
    detail: "At least one resumed journey reached review_ready.",
    sample_count: 1,
    required_sample_count: 1,
    satisfied_count: 1,
    required_satisfied_count: 1,
    recent_median: null,
    previous_median: null,
    threshold_median: null
  },
  assumption_note:
    "Assumption: candidate_ready requires at least 3 recent golden edit journeys, 1 resumed review_ready journey, 6 qualifying samples for trend checks, resumed task-to-preview speed no worse than the overall golden-workflow median, and recent medians at or below 4 workflow steps and 5 operator clicks."
};

export const validWorkflowProofSummaryResponse: WorkflowProofSummaryResponse = {
  summary: {
    golden_workflow_attempts: 1,
    golden_workflow_review_ready: 1,
    golden_workflow_stability_rate: 1,
    median_cold_start_to_composer_ms: 500,
    median_task_to_preview_ms: 1000,
    median_preview_to_approval_ms: 2000,
    median_approval_to_first_result_ms: 2000,
    median_execute_to_first_result_ms: 1000,
    median_workflow_step_count: 4,
    median_operator_click_count: 4,
    median_repeat_task_to_preview_ms: 1000,
    resume_journeys: 1,
    resume_review_ready: 1,
    latest_updated_at: ISO_LATER
  },
  gate_status: validWorkflowProofGateStatus,
  recent_journeys: [validWorkflowProofRecord]
};

export const validTaskIntentEnvelope = {
  channel: "task.intent.submit" as const,
  payload: {
    task: "Inspect the repo",
    session_id: "session-1",
    workspace_roots: [WORKSPACE_ROOT],
    requested_at: ISO_NOW
  }
};

export const validTaskIntentResponseEnvelope = {
  channel: "task.intent.response" as const,
  payload: {
    accepted: true,
    workflow_state: "simulation_ready" as const,
    state_trace: [
      "preparing_plan",
      "plan_ready",
      "compiling_manifest",
      "manifest_ready",
      "simulating_effects",
      "simulation_ready"
    ] as const,
    message: "Prepared a read-only repo inspection preview and simulation summary.",
    route: {
      task_level: 2,
      task_type: "repo_inspection" as const,
      risk_class: "SAFE" as const,
      chosen_route: "local_read_tools" as const,
      operator_explanation:
        "The request is read-only repo inspection, so JARVIS can stay on local typed read tools."
    },
    plan: validPlan,
    manifest: validExecutionManifest,
    effect_previews: [validEffectPreview],
    approval_requests: [],
    simulation_summary: validSimulationSummary,
    diff_previews: [],
    preview_generated_at: ISO_NOW
  }
};

export const validApprovalEnvelope = {
  channel: "approval.decision.submit" as const,
  payload: validApprovalDecision
};

export const validApprovalDecisionResponseEnvelope = {
  channel: "approval.decision.response" as const,
  payload: validApprovalDecisionResponse
};

export const validRunExecutionRequestEnvelope = {
  channel: "run.execution.submit" as const,
  payload: {
    manifest_id: validExecutionManifest.manifest_id,
    session_id: "session-1"
  }
};

export const validRunExecutionResponseEnvelope = {
  channel: "run.execution.response" as const,
  payload: validRunExecutionResponse
};

export const validRunHistoryRequestEnvelope = {
  channel: "run.history.list" as const,
  payload: {
    workspace_root: WORKSPACE_ROOT,
    limit: 10
  }
};

export const validRunHistoryResponseEnvelope = {
  channel: "run.history.response" as const,
  payload: validRunHistoryResponse
};

export const validPolicySnapshotRequestEnvelope = {
  channel: "policy.snapshot.get" as const,
  payload: {
    session_id: "session-1"
  }
};

export const validPolicySnapshotResponseEnvelope = {
  channel: "policy.snapshot.response" as const,
  payload: {
    version: "phase-6-proof-gate",
    workflow: validPolicySnapshot.workflow,
    local_first: true as const,
    approval_required_for_risky_actions: true as const,
    app_started_at: ISO_APP_STARTED
  }
};

export const validRecallSearchRequestEnvelope = {
  channel: "recall.search.query" as const,
  payload: {
    workspace_root: WORKSPACE_ROOT,
    query: "resume",
    limit: 10
  }
};

export const validRecallSearchResponseEnvelope = {
  channel: "recall.search.response" as const,
  payload: validRecallSearchResponse
};

export const validWorkflowProofRecordEnvelope = {
  channel: "workflow.proof.recorded" as const,
  payload: validWorkflowProofRecord
};

export const validWorkflowProofSummaryRequestEnvelope = {
  channel: "workflow.proof.summary.get" as const,
  payload: {
    workspace_root: WORKSPACE_ROOT,
    limit: 5
  }
};

export const validWorkflowProofSummaryResponseEnvelope = {
  channel: "workflow.proof.summary.response" as const,
  payload: validWorkflowProofSummaryResponse
};

export const validRunEventEnvelope = {
  channel: "run.event.push" as const,
  payload: validRunEvent
};
