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
  ToolResult
} from "../src/core/schemas";
import type {
  ApprovalDecisionResponse,
  ApprovalRequest,
  RunExecutionResponse,
  RunHistoryResponse,
  SimulationSummary
} from "../src/shared/ipc";

export const ISO_NOW = "2026-03-11T18:00:00.000Z";
export const ISO_LATER = "2026-03-11T19:00:00.000Z";
export const ISO_EXPIRY = "2026-03-11T20:00:00.000Z";

export const WORKSPACE_ROOT = "D:\\Jarvis-proto5 repo\\Jarvis-proto5";
export const README_PATH = `${WORKSPACE_ROOT}\\README.md`;
export const OUTPUT_PATH = `${WORKSPACE_ROOT}\\.tmp\\runs\\run-1.json`;

export const validPolicySnapshot: PolicySnapshot = {
  version: "phase-4-execution",
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
    version: "phase-4-execution",
    workflow: validPolicySnapshot.workflow,
    local_first: true as const,
    approval_required_for_risky_actions: true as const
  }
};

export const validRunEventEnvelope = {
  channel: "run.event.push" as const,
  payload: validRunEvent
};
