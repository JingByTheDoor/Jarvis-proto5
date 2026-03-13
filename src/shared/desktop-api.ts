import type {
  ApprovalDecision,
  RunEvent,
  WorkflowProofRecord
} from "../core/schemas";
import type {
  ApprovalDecisionResponse,
  PlannerSettingsUpdateRequest,
  PlannerSettingsUpdateResponse,
  PlannerStatusRequest,
  PlannerStatusResponse,
  PolicySnapshotRequest,
  PolicySnapshotResponse,
  RecallSearchRequest,
  RecallSearchResponse,
  RunExecutionRequest,
  RunExecutionResponse,
  RunDeleteRequest,
  RunDeleteResponse,
  RunExportRequest,
  RunExportResponse,
  RunHistoryRequest,
  RunHistoryResponse,
  TaskIntentRequest,
  TaskIntentResponse,
  WorkflowProofReportRequest,
  WorkflowProofReportResponse,
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
  readonly deleteRunHistoryEntry: (
    payload: RunDeleteRequest
  ) => Promise<RunDeleteResponse>;
  readonly exportRunHistoryEntry: (
    payload: RunExportRequest
  ) => Promise<RunExportResponse>;
  readonly searchLocalRecall: (
    payload: RecallSearchRequest
  ) => Promise<RecallSearchResponse>;
  readonly recordWorkflowProof: (
    payload: WorkflowProofRecord
  ) => Promise<WorkflowProofRecord>;
  readonly getWorkflowProofSummary: (
    payload: WorkflowProofSummaryRequest
  ) => Promise<WorkflowProofSummaryResponse>;
  readonly getWorkflowProofReport: (
    payload: WorkflowProofReportRequest
  ) => Promise<WorkflowProofReportResponse>;
  readonly getPolicySnapshot: (
    payload: PolicySnapshotRequest
  ) => Promise<PolicySnapshotResponse>;
  readonly getPlannerStatus: (
    payload: PlannerStatusRequest
  ) => Promise<PlannerStatusResponse>;
  readonly updatePlannerSettings: (
    payload: PlannerSettingsUpdateRequest
  ) => Promise<PlannerSettingsUpdateResponse>;
  readonly subscribeToRunEvents: (
    listener: (event: RunEvent) => void
  ) => (() => void);
}
