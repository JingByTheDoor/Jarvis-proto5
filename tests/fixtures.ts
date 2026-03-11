import type {
  Action,
  ApprovalDecision,
  CompiledAction,
  ExecutionAttestation,
  ExecutionManifest,
  MemoryRecord,
  Plan,
  PolicySnapshot,
  RunEvent,
  RunLog,
  ToolResult
} from "../src/core/schemas";

export const ISO_NOW = "2026-03-11T18:00:00.000Z";
export const ISO_LATER = "2026-03-11T19:00:00.000Z";
export const ISO_EXPIRY = "2026-03-11T20:00:00.000Z";

export const WORKSPACE_ROOT = "D:\\Jarvis-proto5 repo\\Jarvis-proto5";
export const README_PATH = `${WORKSPACE_ROOT}\\README.md`;
export const OUTPUT_PATH = `${WORKSPACE_ROOT}\\.tmp\\runs\\run-1.json`;

export const validPolicySnapshot: PolicySnapshot = {
  version: "phase-0a",
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
  action_id: validCompiledAction.action_id,
  decision: "approve_once",
  approval_scope_class: "exact_action_only",
  approval_signature: "approval-signature-1",
  max_execution_count: 1,
  session_id: "session-1",
  expires_at: ISO_EXPIRY,
  decided_at: ISO_LATER,
  decided_by: "operator"
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
    workflow_state: "idle" as const,
    message: "Intent accepted"
  }
};

export const validApprovalEnvelope = {
  channel: "approval.decision.submit" as const,
  payload: validApprovalDecision
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
    version: "phase-0a",
    workflow: validPolicySnapshot.workflow,
    local_first: true as const,
    approval_required_for_risky_actions: true as const
  }
};

export const validRunEventEnvelope = {
  channel: "run.event.push" as const,
  payload: validRunEvent
};
