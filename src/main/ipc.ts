import { ApprovalDecisionSchema } from "../core/schemas";
import {
  PolicySnapshotRequestSchema,
  PolicySnapshotResponseSchema,
  TaskIntentRequestSchema,
  TaskIntentResponseSchema,
  type PolicySnapshotResponse,
  type TaskIntentResponse
} from "../shared/ipc";
import { workflowSequence } from "../shared/constants";
import { assertTrustedSenderFrame, type IpcSenderEventLike } from "./security";

export interface IpcMainLike {
  handle: (channel: string, listener: (event: unknown, payload: unknown) => unknown) => void;
  on: (channel: string, listener: (event: unknown, payload: unknown) => void) => void;
}

export interface ShellIpcOptions {
  readonly now: () => string;
}

export function handleTaskIntentSubmit(
  event: IpcSenderEventLike,
  payload: unknown
): TaskIntentResponse {
  assertTrustedSenderFrame(event);
  const request = TaskIntentRequestSchema.parse(payload);

  return TaskIntentResponseSchema.parse({
    accepted: true,
    workflow_state: "preparing_plan",
    message: `Command Center accepted "${request.task}" for ${request.workspace_roots.length} workspace root(s).`
  });
}

export function handlePolicySnapshotRequest(
  event: IpcSenderEventLike,
  payload: unknown,
  _options: ShellIpcOptions
): PolicySnapshotResponse {
  assertTrustedSenderFrame(event);
  PolicySnapshotRequestSchema.parse(payload);

  return PolicySnapshotResponseSchema.parse({
    version: "phase-1-shell",
    workflow: workflowSequence,
    local_first: true,
    approval_required_for_risky_actions: true
  });
}

export function handleApprovalDecisionSubmit(
  event: IpcSenderEventLike,
  payload: unknown
): void {
  assertTrustedSenderFrame(event);
  ApprovalDecisionSchema.parse(payload);
}

export function registerShellIpcHandlers(
  ipcMain: IpcMainLike,
  options: ShellIpcOptions
): void {
  ipcMain.handle("task.intent.submit", (event, payload) =>
    handleTaskIntentSubmit(event as IpcSenderEventLike, payload)
  );

  ipcMain.handle("policy.snapshot.get", (event, payload) =>
    handlePolicySnapshotRequest(event as IpcSenderEventLike, payload, options)
  );

  ipcMain.on("approval.decision.submit", (event, payload) =>
    handleApprovalDecisionSubmit(event as IpcSenderEventLike, payload)
  );
}
