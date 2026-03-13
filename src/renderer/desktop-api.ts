import type {
  ApprovalDecision,
  RunEvent,
  WorkflowProofRecord
} from "../core/schemas";
import type {
  ApprovalDecisionResponse,
  PolicySnapshotRequest,
  PolicySnapshotResponse,
  RecallSearchRequest,
  RecallSearchResponse,
  RunExecutionRequest,
  RunExecutionResponse,
  RunHistoryRequest,
  RunHistoryResponse,
  TaskIntentRequest,
  TaskIntentResponse,
  WorkflowProofSummaryRequest,
  WorkflowProofSummaryResponse
} from "../shared/ipc";
import { jarvisDesktopApiKey, type JarvisDesktopApi } from "../shared/desktop-api";
import { workflowSequence } from "../shared/constants";

export const fallbackJarvisDesktopApi: JarvisDesktopApi = {
  async submitTaskIntent(payload: TaskIntentRequest): Promise<TaskIntentResponse> {
    return {
      accepted: false,
      workflow_state: "failed",
      state_trace: ["preparing_plan", "failed"],
      message: `Fallback preview cannot compile "${payload.task}" outside the desktop shell.`,
      route: {
        task_level: 4,
        task_type: "unsupported",
        risk_class: "DANGER",
        chosen_route: "manual_confirmation_required",
        operator_explanation:
          "The typed preview compiler is only available through the hardened desktop shell."
      },
      plan: null,
      manifest: null,
      effect_previews: [],
      approval_requests: [],
      simulation_summary: null,
      diff_previews: [],
      preview_generated_at: payload.requested_at
    };
  },
  async submitApprovalDecision(
    payload: ApprovalDecision
  ): Promise<ApprovalDecisionResponse> {
    return {
      accepted: false,
      manifest_id: payload.manifest_id,
      action_id: payload.action_id,
      decision: payload.decision,
      approval_scope_class: payload.approval_scope_class,
      approval_signature: payload.approval_signature,
      execution_hash: payload.execution_hash,
      max_execution_count: payload.max_execution_count,
      session_id: payload.session_id,
      expires_at: payload.expires_at,
      decided_at: payload.decided_at,
      decided_by: payload.decided_by,
      remaining_uses: 0,
      reusable_within_session: false,
      message: "Approval submission is only available through the hardened desktop shell."
    };
  },
  async executeManifest(
    payload: RunExecutionRequest
  ): Promise<RunExecutionResponse> {
    return {
      accepted: false,
      workflow_state: "failed",
      message: `Execution cannot start for ${payload.manifest_id} outside the desktop shell.`,
      run_id: null,
      persisted_run_path: null,
      run_log: null,
      tool_results: [],
      attestations: []
    };
  },
  async listRunHistory(
    _payload: RunHistoryRequest
  ): Promise<RunHistoryResponse> {
    return {
      runs: []
    };
  },
  async searchLocalRecall(
    _payload: RecallSearchRequest
  ): Promise<RecallSearchResponse> {
    return {
      results: []
    };
  },
  async recordWorkflowProof(
    payload: WorkflowProofRecord
  ): Promise<WorkflowProofRecord> {
    return payload;
  },
  async getWorkflowProofSummary(
    _payload: WorkflowProofSummaryRequest
  ): Promise<WorkflowProofSummaryResponse> {
    return {
      summary: {
        golden_workflow_attempts: 0,
        golden_workflow_review_ready: 0,
        golden_workflow_stability_rate: 0,
        median_cold_start_to_composer_ms: null,
        median_task_to_preview_ms: null,
        median_preview_to_approval_ms: null,
        median_approval_to_first_result_ms: null,
        median_execute_to_first_result_ms: null,
        median_workflow_step_count: null,
        median_operator_click_count: null,
        median_repeat_task_to_preview_ms: null,
        resume_journeys: 0,
        resume_review_ready: 0,
        latest_updated_at: null
      },
      gate_status: {
        overall_status: "collecting_evidence",
        blocking_reasons: [
          "Need at least 3 recent golden edit journeys before stability can be judged.",
          "Need 6 task-to-preview samples before a local trend can be compared.",
          "Need 6 preview-to-approval samples before a local trend can be compared.",
          "Need 6 approval-to-first-result samples before a local trend can be compared.",
          "Need 6 workflow-step samples before a local trend can be compared.",
          "Need 6 operator-click samples before a local trend can be compared.",
          "Need at least 1 resumed golden edit journey before repeat-task speed can be judged.",
          "Need at least 1 resumed journey before helpfulness can be judged."
        ],
        stability: {
          status: "not_enough_data",
          detail: "Need at least 3 recent golden edit journeys before stability can be judged.",
          sample_count: 0,
          required_sample_count: 3,
          satisfied_count: 0,
          required_satisfied_count: 3,
          recent_median: null,
          previous_median: null,
          threshold_median: null
        },
        task_to_preview_trend: {
          status: "not_enough_data",
          detail: "Need 6 task-to-preview samples before a local trend can be compared.",
          sample_count: 0,
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
          sample_count: 0,
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
          sample_count: 0,
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
          sample_count: 0,
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
          sample_count: 0,
          required_sample_count: 6,
          satisfied_count: null,
          required_satisfied_count: null,
          recent_median: null,
          previous_median: null,
          threshold_median: 5
        },
        repeat_task_speed: {
          status: "not_enough_data",
          detail: "Need at least 1 resumed golden edit journey before repeat-task speed can be judged.",
          sample_count: 0,
          required_sample_count: 1,
          satisfied_count: null,
          required_satisfied_count: null,
          recent_median: null,
          previous_median: null,
          threshold_median: null
        },
        resume_helpfulness: {
          status: "not_enough_data",
          detail: "Need at least 1 resumed journey before helpfulness can be judged.",
          sample_count: 0,
          required_sample_count: 1,
          satisfied_count: 0,
          required_satisfied_count: 1,
          recent_median: null,
          previous_median: null,
          threshold_median: null
        },
        assumption_note:
          "Assumption: candidate_ready requires at least 3 recent golden edit journeys, 1 resumed review_ready journey, 6 qualifying samples for trend checks, resumed task-to-preview speed no worse than the overall golden-workflow median, and recent medians at or below 4 workflow steps and 5 operator clicks."
      },
      recent_journeys: []
    };
  },
  async getPolicySnapshot(
    _payload: PolicySnapshotRequest
  ): Promise<PolicySnapshotResponse> {
    return {
      version: "phase-6-proof-gate",
      workflow: workflowSequence,
      local_first: true,
      approval_required_for_risky_actions: true,
      app_started_at: "2026-03-11T17:59:59.500Z"
    };
  },
  subscribeToRunEvents(_listener: (event: RunEvent) => void): () => void {
    return () => {};
  }
};

export function getJarvisDesktopApi(
  windowObject: Window & typeof globalThis = window
): JarvisDesktopApi {
  return windowObject[jarvisDesktopApiKey] ?? fallbackJarvisDesktopApi;
}
