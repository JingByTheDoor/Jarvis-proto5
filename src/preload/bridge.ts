import { ApprovalDecisionSchema, RunEventSchema } from "../core/schemas";
import {
  PolicySnapshotRequestSchema,
  PolicySnapshotResponseSchema,
  TaskIntentRequestSchema,
  TaskIntentResponseSchema
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
    submitApprovalDecision(payload) {
      const parsedPayload = ApprovalDecisionSchema.parse(payload);
      ipcRenderer.send("approval.decision.submit", parsedPayload);
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
