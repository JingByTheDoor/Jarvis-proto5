import {
  ApprovalDecisionSchema,
  RunEventSchema,
  WorkflowProofRecordSchema
} from "../core/schemas";
import {
  ApprovalDecisionResponseSchema,
  PolicySnapshotRequestSchema,
  PolicySnapshotResponseSchema,
  RecallSearchRequestSchema,
  RecallSearchResponseSchema,
  RunExecutionRequestSchema,
  RunExecutionResponseSchema,
  RunHistoryRequestSchema,
  RunHistoryResponseSchema,
  TaskIntentRequestSchema,
  TaskIntentResponseSchema,
  WorkflowProofSummaryRequestSchema,
  WorkflowProofSummaryResponseSchema
} from "../shared/ipc";
import type { JarvisDesktopApi } from "../shared/desktop-api";

export interface IpcRendererLike {
  invoke: (channel: string, payload: unknown) => Promise<unknown>;
  send: (channel: string, payload: unknown) => void;
  on: (
    channel: string,
    listener: (event: unknown, payload: unknown) => void
  ) => void;
  removeListener: (
    channel: string,
    listener: (event: unknown, payload: unknown) => void
  ) => void;
}

export function createJarvisDesktopApi(ipcRenderer: IpcRendererLike): JarvisDesktopApi {
  return {
    async submitTaskIntent(payload) {
      const parsedPayload = TaskIntentRequestSchema.parse(payload);
      const response = await ipcRenderer.invoke("task.intent.submit", parsedPayload);
      return TaskIntentResponseSchema.parse(response);
    },
    async submitApprovalDecision(payload) {
      const parsedPayload = ApprovalDecisionSchema.parse(payload);
      const response = await ipcRenderer.invoke("approval.decision.submit", parsedPayload);
      return ApprovalDecisionResponseSchema.parse(response);
    },
    async executeManifest(payload) {
      const parsedPayload = RunExecutionRequestSchema.parse(payload);
      const response = await ipcRenderer.invoke("run.execution.submit", parsedPayload);
      return RunExecutionResponseSchema.parse(response);
    },
    async listRunHistory(payload) {
      const parsedPayload = RunHistoryRequestSchema.parse(payload);
      const response = await ipcRenderer.invoke("run.history.list", parsedPayload);
      return RunHistoryResponseSchema.parse(response);
    },
    async searchLocalRecall(payload) {
      const parsedPayload = RecallSearchRequestSchema.parse(payload);
      const response = await ipcRenderer.invoke("recall.search.query", parsedPayload);
      return RecallSearchResponseSchema.parse(response);
    },
    async recordWorkflowProof(payload) {
      const parsedPayload = WorkflowProofRecordSchema.parse(payload);
      const response = await ipcRenderer.invoke("workflow.proof.record", parsedPayload);
      return WorkflowProofRecordSchema.parse(response);
    },
    async getWorkflowProofSummary(payload) {
      const parsedPayload = WorkflowProofSummaryRequestSchema.parse(payload);
      const response = await ipcRenderer.invoke("workflow.proof.summary.get", parsedPayload);
      return WorkflowProofSummaryResponseSchema.parse(response);
    },
    async getPolicySnapshot(payload) {
      const parsedPayload = PolicySnapshotRequestSchema.parse(payload);
      const response = await ipcRenderer.invoke("policy.snapshot.get", parsedPayload);
      return PolicySnapshotResponseSchema.parse(response);
    },
    subscribeToRunEvents(listener) {
      const wrappedListener = (_event: unknown, payload: unknown) => {
        const parsedEvent = RunEventSchema.safeParse(payload);
        if (parsedEvent.success) {
          listener(parsedEvent.data);
        }
      };

      ipcRenderer.on("run.event.push", wrappedListener);
      return () => {
        ipcRenderer.removeListener("run.event.push", wrappedListener);
      };
    }
  };
}
