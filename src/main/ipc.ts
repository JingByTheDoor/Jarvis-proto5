import { InMemoryApprovalRegistry, type ApprovalRegistry } from "../core/approval/approval-registry";
import {
  InMemoryCapabilityTokenStore,
  type CapabilityTokenStore
} from "../core/capabilities/capability-token-store";
import { ApprovalDecisionSchema, type RunEvent } from "../core/schemas";
import { createTaskPreview } from "../core/compile/task-preview";
import { ManifestExecutionRuntime } from "../core/execution/manifest-executor";
import { EncryptedRunLogStore, type RunLogStore } from "../core/events/run-log-store";
import {
  ApprovalDecisionResponseSchema,
  PolicySnapshotRequestSchema,
  PolicySnapshotResponseSchema,
  RunExecutionRequestSchema,
  RunExecutionResponseSchema,
  RunHistoryRequestSchema,
  RunHistoryResponseSchema,
  TaskIntentRequestSchema,
  TaskIntentResponseSchema,
  type ApprovalDecisionResponse,
  type PolicySnapshotResponse,
  type RunExecutionResponse,
  type RunHistoryResponse,
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
  readonly approvalRegistry?: ApprovalRegistry;
  readonly capabilityTokenStore?: CapabilityTokenStore;
  readonly runLogStore?: RunLogStore;
  readonly publishRunEvent?: (event: RunEvent) => void;
}

export function handleTaskIntentSubmit(
  event: IpcSenderEventLike,
  payload: unknown,
  approvalRegistry: ApprovalRegistry
): TaskIntentResponse {
  assertTrustedSenderFrame(event);
  const request = TaskIntentRequestSchema.parse(payload);
  const response = TaskIntentResponseSchema.parse(createTaskPreview(request));

  if (response.manifest) {
    approvalRegistry.registerManifestPreview({
      manifest: response.manifest,
      approval_requests: response.approval_requests
    });
  }

  return response;
}

export function handlePolicySnapshotRequest(
  event: IpcSenderEventLike,
  payload: unknown,
  _options: ShellIpcOptions
): PolicySnapshotResponse {
  assertTrustedSenderFrame(event);
  PolicySnapshotRequestSchema.parse(payload);

  return PolicySnapshotResponseSchema.parse({
    version: "phase-4-execution",
    workflow: workflowSequence,
    local_first: true,
    approval_required_for_risky_actions: true
  });
}

export function handleApprovalDecisionSubmit(
  event: IpcSenderEventLike,
  payload: unknown,
  approvalRegistry: ApprovalRegistry,
  now: () => string
): ApprovalDecisionResponse {
  assertTrustedSenderFrame(event);
  const decision = ApprovalDecisionSchema.parse(payload);

  return ApprovalDecisionResponseSchema.parse(
    approvalRegistry.recordDecision({
      decision,
      now: now()
    })
  );
}

export function handleRunExecutionSubmit(
  event: IpcSenderEventLike,
  payload: unknown,
  executionRuntime: ManifestExecutionRuntime
): RunExecutionResponse {
  assertTrustedSenderFrame(event);
  const request = RunExecutionRequestSchema.parse(payload);

  return RunExecutionResponseSchema.parse(
    executionRuntime.executeManifest({
      manifest_id: request.manifest_id,
      session_id: request.session_id
    })
  );
}

export function handleRunHistoryRequest(
  event: IpcSenderEventLike,
  payload: unknown,
  runLogStore: RunLogStore
): RunHistoryResponse {
  assertTrustedSenderFrame(event);
  const request = RunHistoryRequestSchema.parse(payload);

  return RunHistoryResponseSchema.parse({
    runs: runLogStore.listRunLogs(request.workspace_root, request.limit)
  });
}

export function registerShellIpcHandlers(
  ipcMain: IpcMainLike,
  options: ShellIpcOptions
): void {
  const approvalRegistry = options.approvalRegistry ?? new InMemoryApprovalRegistry();
  const capabilityTokenStore =
    options.capabilityTokenStore ?? new InMemoryCapabilityTokenStore();
  const runLogStore = options.runLogStore ?? new EncryptedRunLogStore();
  const executionRuntime = new ManifestExecutionRuntime({
    approvalRegistry,
    capabilityTokenStore,
    runLogStore,
    now: options.now,
    publishRunEvent: options.publishRunEvent
  });

  ipcMain.handle("task.intent.submit", (event, payload) =>
    handleTaskIntentSubmit(event as IpcSenderEventLike, payload, approvalRegistry)
  );

  ipcMain.handle("policy.snapshot.get", (event, payload) =>
    handlePolicySnapshotRequest(event as IpcSenderEventLike, payload, options)
  );

  ipcMain.handle("approval.decision.submit", (event, payload) =>
    handleApprovalDecisionSubmit(
      event as IpcSenderEventLike,
      payload,
      approvalRegistry,
      options.now
    )
  );

  ipcMain.handle("run.execution.submit", (event, payload) =>
    handleRunExecutionSubmit(
      event as IpcSenderEventLike,
      payload,
      executionRuntime
    )
  );

  ipcMain.handle("run.history.list", (event, payload) =>
    handleRunHistoryRequest(event as IpcSenderEventLike, payload, runLogStore)
  );
}
