import type { ApprovalDecision, RunEvent } from "../core/schemas";
import type {
  PolicySnapshotRequest,
  PolicySnapshotResponse,
  TaskIntentRequest,
  TaskIntentResponse
} from "../shared/ipc";
import { jarvisDesktopApiKey, type JarvisDesktopApi } from "../shared/desktop-api";
import { workflowSequence } from "../shared/constants";

export const fallbackJarvisDesktopApi: JarvisDesktopApi = {
  async submitTaskIntent(payload: TaskIntentRequest): Promise<TaskIntentResponse> {
    return {
      accepted: true,
      workflow_state: "preparing_plan",
      message: `Preview shell accepted "${payload.task}".`
    };
  },
  submitApprovalDecision(_payload: ApprovalDecision): void {},
  async getPolicySnapshot(
    _payload: PolicySnapshotRequest
  ): Promise<PolicySnapshotResponse> {
    return {
      version: "phase-1-shell",
      workflow: workflowSequence,
      local_first: true,
      approval_required_for_risky_actions: true
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
