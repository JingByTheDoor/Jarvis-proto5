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
import { TaskPlannerService, type TaskPlanner } from "../core/integrations/task-planner";
import { searchLocalRecall } from "../core/memory/basic-recall";
import {
  EncryptedWorkflowProofStore,
  type WorkflowProofStore
} from "../core/proof/workflow-proof-store";
import {
  ApprovalDecisionResponseSchema,
  PlannerSettingsUpdateRequestSchema,
  PlannerSettingsUpdateResponseSchema,
  PlannerStatusRequestSchema,
  PlannerStatusResponseSchema,
  PolicySnapshotRequestSchema,
  PolicySnapshotResponseSchema,
  RecallSearchRequestSchema,
  RecallSearchResponseSchema,
  RunDeleteRequestSchema,
  RunDeleteResponseSchema,
  RunExportRequestSchema,
  RunExportResponseSchema,
  RunExecutionRequestSchema,
  RunExecutionResponseSchema,
  RunHistoryRequestSchema,
  RunHistoryResponseSchema,
  TaskIntentRequestSchema,
  TaskIntentResponseSchema,
  WorkflowProofSummaryRequestSchema,
  WorkflowProofReportRequestSchema,
  WorkflowProofReportResponseSchema,
  WorkflowProofSummaryResponseSchema,
  type ApprovalDecisionResponse,
  type PlannerSettingsUpdateResponse,
  type PlannerStatusResponse,
  type PolicySnapshotResponse,
  type RecallSearchResponse,
  type RunDeleteResponse,
  type RunExportResponse,
  type RunExecutionResponse,
  type RunHistoryResponse,
  type TaskIntentResponse,
  type WorkflowProofReportResponse,
  type WorkflowProofSummaryResponse
} from "../shared/ipc";
import {
  defaultRetentionPolicy,
  sensitiveSessionDefaults,
  workflowSequence
} from "../shared/constants";
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
  readonly planner?: TaskPlanner;
  readonly publishRunEvent?: (event: RunEvent) => void;
}

export async function handleTaskIntentSubmit(
  event: IpcSenderEventLike,
  payload: unknown,
  approvalRegistry: ApprovalRegistry,
  planner?: TaskPlanner
): Promise<TaskIntentResponse> {
  assertTrustedSenderFrame(event);
  const request = TaskIntentRequestSchema.parse(payload);
  const response = TaskIntentResponseSchema.parse(
    await createTaskPreview(request, {
      planner
    })
  );

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
    version: "phase-6-planner-assist",
    workflow: workflowSequence,
    local_first: true,
    approval_required_for_risky_actions: true,
    app_started_at: options.appStartedAt ?? options.now(),
    retention_policy: {
      ...defaultRetentionPolicy,
      export_staging_encrypted_at_rest: true
    },
    sensitive_session_defaults: sensitiveSessionDefaults
  });
}

export async function handlePlannerStatusRequest(
  event: IpcSenderEventLike,
  payload: unknown,
  planner: TaskPlanner
): Promise<PlannerStatusResponse> {
  assertTrustedSenderFrame(event);
  PlannerStatusRequestSchema.parse(payload);

  return PlannerStatusResponseSchema.parse(await planner.getStatus());
}

export async function handlePlannerSettingsUpdate(
  event: IpcSenderEventLike,
  payload: unknown,
  planner: TaskPlanner
): Promise<PlannerSettingsUpdateResponse> {
  assertTrustedSenderFrame(event);
  const request = PlannerSettingsUpdateRequestSchema.parse(payload);

  return PlannerSettingsUpdateResponseSchema.parse(
    await planner.updateSettings(request)
  );
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

export function handleRunDeleteRequest(
  event: IpcSenderEventLike,
  payload: unknown,
  runLogStore: RunLogStore
): RunDeleteResponse {
  assertTrustedSenderFrame(event);
  const request = RunDeleteRequestSchema.parse(payload);
  const result = runLogStore.deleteRunLog(request.workspace_root, request.run_id);

  return RunDeleteResponseSchema.parse({
    run_id: request.run_id,
    deleted: result.deleted,
    deleted_paths: result.deleted_paths,
    message: result.deleted
      ? `Deleted local review artifacts for ${request.run_id}.`
      : `No persisted run or staged export exists for ${request.run_id}.`
  });
}

export function handleRunExportRequest(
  event: IpcSenderEventLike,
  payload: unknown,
  runLogStore: RunLogStore,
  now: () => string
): RunExportResponse {
  assertTrustedSenderFrame(event);
  const request = RunExportRequestSchema.parse(payload);
  const result = runLogStore.stageRunExport(
    request.workspace_root,
    request.run_id,
    now()
  );

  return RunExportResponseSchema.parse({
    run_id: request.run_id,
    staged_export_path: result.staged_export_path,
    exported_at: result.bundle.exported_at,
    redaction_count: result.bundle.redaction_count,
    placeholders: result.bundle.placeholders,
    bundle: result.bundle,
    message: `Staged a sanitized encrypted export for ${request.run_id}.`
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

export function handleWorkflowProofReportRequest(
  event: IpcSenderEventLike,
  payload: unknown,
  workflowProofStore: WorkflowProofStore,
  now: () => string
): WorkflowProofReportResponse {
  assertTrustedSenderFrame(event);
  const request = WorkflowProofReportRequestSchema.parse(payload);

  return WorkflowProofReportResponseSchema.parse(
    workflowProofStore.getReport(request.workspace_root, request.limit, now())
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
  const planner = options.planner ?? new TaskPlannerService({
    now: options.now
  });
  const executionRuntime = new ManifestExecutionRuntime({
    approvalRegistry,
    capabilityTokenStore,
    runLogStore,
    now: options.now,
    publishRunEvent: options.publishRunEvent
  });

  ipcMain.handle("task.intent.submit", (event, payload) =>
    handleTaskIntentSubmit(
      event as IpcSenderEventLike,
      payload,
      approvalRegistry,
      planner
    )
  );

  ipcMain.handle("policy.snapshot.get", (event, payload) =>
    handlePolicySnapshotRequest(event as IpcSenderEventLike, payload, options)
  );

  ipcMain.handle("planner.status.get", (event, payload) =>
    handlePlannerStatusRequest(
      event as IpcSenderEventLike,
      payload,
      planner
    )
  );

  ipcMain.handle("planner.settings.update", (event, payload) =>
    handlePlannerSettingsUpdate(
      event as IpcSenderEventLike,
      payload,
      planner
    )
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

  ipcMain.handle("run.delete.request", (event, payload) =>
    handleRunDeleteRequest(event as IpcSenderEventLike, payload, runLogStore)
  );

  ipcMain.handle("run.export.request", (event, payload) =>
    handleRunExportRequest(
      event as IpcSenderEventLike,
      payload,
      runLogStore,
      options.now
    )
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

  ipcMain.handle("workflow.proof.report.get", (event, payload) =>
    handleWorkflowProofReportRequest(
      event as IpcSenderEventLike,
      payload,
      workflowProofStore,
      options.now
    )
  );
}
