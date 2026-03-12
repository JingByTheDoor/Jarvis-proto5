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
  readonly searchLocalRecall: (
    payload: RecallSearchRequest
  ) => Promise<RecallSearchResponse>;
  readonly recordWorkflowProof: (
    payload: WorkflowProofRecord
  ) => Promise<WorkflowProofRecord>;
  readonly getWorkflowProofSummary: (
    payload: WorkflowProofSummaryRequest
  ) => Promise<WorkflowProofSummaryResponse>;
  readonly getPolicySnapshot: (
    payload: PolicySnapshotRequest
  ) => Promise<PolicySnapshotResponse>;
  readonly subscribeToRunEvents: (
    listener: (event: RunEvent) => void
  ) => (() => void);
}
