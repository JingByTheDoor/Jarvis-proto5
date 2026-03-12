import type { ApprovalDecision, RunEvent } from "../core/schemas";
import type {
  ApprovalDecisionResponse,
  PolicySnapshotRequest,
  PolicySnapshotResponse,
  RunExecutionRequest,
  RunExecutionResponse,
  RunHistoryRequest,
  RunHistoryResponse,
  TaskIntentRequest,
  TaskIntentResponse
} from "./ipc";

export const jarvisDesktopApiKey = "jarvisDesktop";

export interface JarvisDesktopApi {
  readonly submitTaskIntent: (
    payload: TaskIntentRequest
  ) => Promise<TaskIntentResponse>;
  readonly submitApprovalDecision: (
    payload: ApprovalDecision
  ) => Promise<ApprovalDecisionResponse>;
  readonly executeManifest: (
    payload: RunExecutionRequest
  ) => Promise<RunExecutionResponse>;
  readonly listRunHistory: (
    payload: RunHistoryRequest
  ) => Promise<RunHistoryResponse>;
  readonly getPolicySnapshot: (
    payload: PolicySnapshotRequest
  ) => Promise<PolicySnapshotResponse>;
  readonly subscribeToRunEvents: (
    listener: (event: RunEvent) => void
  ) => (() => void);
}
