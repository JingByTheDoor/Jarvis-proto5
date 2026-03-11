import type { ApprovalDecision, RunEvent } from "../core/schemas";
import type {
  PolicySnapshotRequest,
  PolicySnapshotResponse,
  TaskIntentRequest,
  TaskIntentResponse
} from "./ipc";

export const jarvisDesktopApiKey = "jarvisDesktop";

export interface JarvisDesktopApi {
  readonly submitTaskIntent: (
    payload: TaskIntentRequest
  ) => Promise<TaskIntentResponse>;
  readonly submitApprovalDecision: (payload: ApprovalDecision) => void;
  readonly getPolicySnapshot: (
    payload: PolicySnapshotRequest
  ) => Promise<PolicySnapshotResponse>;
  readonly subscribeToRunEvents: (
    listener: (event: RunEvent) => void
  ) => (() => void);
}
