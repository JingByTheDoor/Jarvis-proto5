import { InMemoryApprovalRegistry, type ApprovalRegistry } from "../core/approval/approval-registry";
import {
  InMemoryCapabilityTokenStore,
  type CapabilityTokenStore
} from "../core/capabilities/capability-token-store";
import {
  ApprovalDecisionSchema,
  WorkflowProofRecordSchema,
  type RunEvent
} from "../core/schemas";
import { createTaskPreview } from "../core/compile/task-preview";
import { ManifestExecutionRuntime } from "../core/execution/manifest-executor";
import { EncryptedRunLogStore, type RunLogStore } from "../core/events/run-log-store";
import { searchLocalRecall } from "../core/memory/basic-recall";
import {
  EncryptedWorkflowProofStore,
  type WorkflowProofStore
} from "../core/proof/workflow-proof-store";
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
  WorkflowProofSummaryResponseSchema,
  type ApprovalDecisionResponse,
  type PolicySnapshotResponse,
  type RecallSearchResponse,
  type RunExecutionResponse,
  type RunHistoryResponse,
  type TaskIntentResponse,
  type WorkflowProofSummaryResponse
} from "../shared/ipc";
import { workflowSequence } from "../shared/constants";
import { assertTrustedSenderFrame, type IpcSenderEventLike } from "./security";

export interface IpcMainLike {
  handle: (channel: string, listener: (event: unknown, payload: unknown) => unknown) => void;
  on: (channel: string, listener: (event: unknown, payload: unknown) => void) => void;
}

export interface ShellIpcOptions {
  readonly now: () => string;
  readonly appStartedAt?: string;
  readonly approvalRegistry?: ApprovalRegistry;
  readonly capabilityTokenStore?: CapabilityTokenStore;
  readonly runLogStore?: RunLogStore;
  readonly workflowProofStore?: WorkflowProofStore;
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
  options: ShellIpcOptions
): PolicySnapshotResponse {
  assertTrustedSenderFrame(event);
  PolicySnapshotRequestSchema.parse(payload);

  return PolicySnapshotResponseSchema.parse({
    version: "phase-6-proof-gate",
    workflow: workflowSequence,
    local_first: true,
    approval_required_for_risky_actions: true,
    app_started_at: options.appStartedAt ?? options.now()
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

export function handleRecallSearchRequest(
  event: IpcSenderEventLike,
  payload: unknown,
  runLogStore: RunLogStore
): RecallSearchResponse {
  assertTrustedSenderFrame(event);
  const request = RecallSearchRequestSchema.parse(payload);

  return RecallSearchResponseSchema.parse(
    searchLocalRecall({
      request,
      runLogStore
    })
  );
}

export function handleWorkflowProofRecord(
  event: IpcSenderEventLike,
  payload: unknown,
  workflowProofStore: WorkflowProofStore
) {
  assertTrustedSenderFrame(event);
  const record = WorkflowProofRecordSchema.parse(payload);

  return WorkflowProofRecordSchema.parse(
    workflowProofStore.upsertRecord(record.workspace_root, record)
  );
}

export function handleWorkflowProofSummaryRequest(
  event: IpcSenderEventLike,
  payload: unknown,
  workflowProofStore: WorkflowProofStore
): WorkflowProofSummaryResponse {
  assertTrustedSenderFrame(event);
  const request = WorkflowProofSummaryRequestSchema.parse(payload);

  return WorkflowProofSummaryResponseSchema.parse(
    workflowProofStore.getSummary(request.workspace_root, request.limit)
  );
}

export function registerShellIpcHandlers(
  ipcMain: IpcMainLike,
  options: ShellIpcOptions
): void {
  const approvalRegistry = options.approvalRegistry ?? new InMemoryApprovalRegistry();
  const capabilityTokenStore =
    options.capabilityTokenStore ?? new InMemoryCapabilityTokenStore();
  const runLogStore = options.runLogStore ?? new EncryptedRunLogStore();
  const workflowProofStore =
    options.workflowProofStore ?? new EncryptedWorkflowProofStore();
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

  ipcMain.handle("recall.search.query", (event, payload) =>
    handleRecallSearchRequest(event as IpcSenderEventLike, payload, runLogStore)
  );

  ipcMain.handle("workflow.proof.record", (event, payload) =>
    handleWorkflowProofRecord(
      event as IpcSenderEventLike,
      payload,
      workflowProofStore
    )
  );

  ipcMain.handle("workflow.proof.summary.get", (event, payload) =>
    handleWorkflowProofSummaryRequest(
      event as IpcSenderEventLike,
      payload,
      workflowProofStore
    )
  );
}
