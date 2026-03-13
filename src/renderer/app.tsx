import {
  startTransition,
  useDeferredValue,
  useEffect,
  useRef,
  useState
} from "react";

import type { RunEvent, RunLog, WorkflowProofRecord } from "../core/schemas";
import type {
  ApprovalDecisionResponse,
  ApprovalRequest,
  PlannerSettingsUpdateRequest,
  PlannerStatusResponse,
  PolicySnapshotResponse,
  RecallEntry,
  RunExecutionResponse,
  TaskIntentResponse,
  WorkflowProofReportResponse,
  WorkflowProofSummaryResponse
} from "../shared/ipc";
import type {
  ApprovalDecisionKind,
  ApprovalScopeClass,
  WorkflowJourneyKind,
  WorkflowProofEvidenceOrigin
} from "../shared/constants";
import { getJarvisDesktopApi } from "./desktop-api";
import { CommandCenterPage } from "./pages/command-center-page";
import { ConnectionsPage } from "./pages/connections-page";
import { SecondBrainPage } from "./pages/second-brain-page";
import { SettingsPage } from "./pages/settings-page";
import { TasksProjectsPage } from "./pages/tasks-projects-page";

type PageId =
  | "command_center"
  | "tasks_projects"
  | "second_brain"
  | "connections"
  | "settings";

interface PageNavigationItem {
  readonly id: PageId;
  readonly label: string;
  readonly summary: string;
}

type RunActionKind = "delete" | "export";
type GuidedCaptureStatus = "idle" | "armed" | "in_progress" | "completed";

interface GuidedCaptureState {
  readonly armed: boolean;
  readonly draftLabel: string;
  readonly activeLabel: string | null;
  readonly status: GuidedCaptureStatus;
  readonly message: string;
}

const pageNavigationItems: readonly PageNavigationItem[] = [
  {
    id: "command_center",
    label: "Command Center",
    summary: "Plan -> preview -> approve -> execute -> review"
  },
  {
    id: "tasks_projects",
    label: "Tasks & Projects",
    summary: "Runs, tasks, approvals"
  },
  {
    id: "second_brain",
    label: "Second Brain",
    summary: "Memory, trust, contradictions"
  },
  {
    id: "connections",
    label: "Connections",
    summary: "Adapters, health, providers"
  },
  {
    id: "settings",
    label: "Settings",
    summary: "Approval, retention, session"
  }
] as const;

const SESSION_ID = "phase-6-proof-gate";
const WORKSPACE_ROOT = "D:\\Jarvis-proto5 repo\\Jarvis-proto5";
const DEFAULT_GUIDED_CAPTURE_LABEL = "planner-assisted-golden-edit";
const DEFAULT_PLANNER_DRAFT: PlannerSettingsUpdateRequest = {
  provider_kind: "local_ollama",
  model_name: "qwen2.5:3b",
  endpoint_url: "http://127.0.0.1:11434"
};

const DEFAULT_GUIDED_CAPTURE_STATE: GuidedCaptureState = {
  armed: false,
  draftLabel: DEFAULT_GUIDED_CAPTURE_LABEL,
  activeLabel: null,
  status: "idle",
  message:
    "Arm guided capture before the next natural-language planner-assisted safe edit journey if you want it to count toward the proof gate."
};

function selectApprovalScopeClass(
  approvalRequest: ApprovalRequest,
  decision: ApprovalDecisionKind
): ApprovalScopeClass {
  if (decision !== "approve_session") {
    return "exact_action_only";
  }

  if (approvalRequest.allowed_scope_classes.includes("session_readonly_scope")) {
    return "session_readonly_scope";
  }

  if (approvalRequest.allowed_scope_classes.includes("session_same_scope")) {
    return "session_same_scope";
  }

  return approvalRequest.allowed_scope_classes[0] ?? "exact_action_only";
}

function createWorkflowJourneyId(): string {
  return `journey-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createGuidedCaptureLabel(): string {
  return `guided-capture-${Date.now().toString(36)}`;
}

function diffMilliseconds(startAt: string | null, endAt: string | null): number | null {
  if (!startAt || !endAt) {
    return null;
  }

  return Math.max(0, Date.parse(endAt) - Date.parse(startAt));
}

function deriveJourneyKind(response: TaskIntentResponse): WorkflowJourneyKind {
  if (
    response.route.task_type === "repo_edit" &&
    response.route.chosen_route === "local_repo_file_tools"
  ) {
    return "golden_edit_workflow";
  }

  if (
    response.route.task_type === "repo_inspection" &&
    response.route.chosen_route === "local_read_tools"
  ) {
    return "inspection_only";
  }

  if (
    response.route.task_type === "guarded_command" &&
    response.route.chosen_route === "local_guarded_shell"
  ) {
    return "guarded_shell_workflow";
  }

  return "unsupported_workflow";
}

function deriveWorkflowStepCount(record: WorkflowProofRecord): number {
  let count = 0;

  if (record.preview_ready_at) {
    count += 1;
  }

  if (record.approval_required && record.approval_recorded_at) {
    count += 1;
  }

  if (record.execute_requested_at) {
    count += 1;
  }

  if (
    record.workflow_state === "review_ready" ||
    record.workflow_state === "execution_complete" ||
    record.workflow_state === "failed" ||
    record.workflow_state === "aborted"
  ) {
    count += 1;
  }

  return count;
}

function createWorkflowProofRecord(input: {
  readonly journeyId: string;
  readonly sessionId: string;
  readonly workspaceRoot: string;
  readonly evidenceOrigin: WorkflowProofEvidenceOrigin;
  readonly captureLabel: string | null;
  readonly composerReadyAt: string | null;
  readonly coldStartToComposerMs: number | null;
  readonly previewRequestedAt: string;
  readonly resumeUsed: boolean;
  readonly resumedFromRecallId: string | null;
}): WorkflowProofRecord {
  return {
    journey_id: input.journeyId,
    journey_kind: "unsupported_workflow",
    session_id: input.sessionId,
    workspace_root: input.workspaceRoot,
    evidence_origin: input.evidenceOrigin,
    capture_label: input.captureLabel,
    counts_toward_gate: false,
    planner_assistance_used: false,
    route_kind: null,
    task_type: null,
    risk_class: null,
    approval_required: false,
    resume_used: input.resumeUsed,
    resumed_from_recall_id: input.resumedFromRecallId,
    composer_ready_at: input.composerReadyAt,
    cold_start_to_composer_ms: input.coldStartToComposerMs,
    preview_requested_at: input.previewRequestedAt,
    preview_ready_at: null,
    task_to_preview_ms: null,
    approval_recorded_at: null,
    preview_to_approval_ms: null,
    execute_requested_at: null,
    first_result_at: null,
    approval_to_first_result_ms: null,
    execute_to_first_result_ms: null,
    operator_click_count: 1,
    workflow_step_count: 0,
    manifest_id: null,
    run_id: null,
    workflow_state: null,
    updated_at: input.previewRequestedAt
  };
}

function mergeWorkflowProofRecord(
  currentRecord: WorkflowProofRecord,
  patch: Partial<WorkflowProofRecord>
): WorkflowProofRecord {
  const nextRecord: WorkflowProofRecord = {
    ...currentRecord,
    ...patch
  };

  nextRecord.approval_to_first_result_ms = diffMilliseconds(
    nextRecord.approval_recorded_at,
    nextRecord.first_result_at
  );
  nextRecord.preview_to_approval_ms = diffMilliseconds(
    nextRecord.preview_ready_at,
    nextRecord.approval_recorded_at
  );
  nextRecord.execute_to_first_result_ms = diffMilliseconds(
    nextRecord.execute_requested_at,
    nextRecord.first_result_at
  );
  nextRecord.workflow_step_count = deriveWorkflowStepCount(nextRecord);

  return nextRecord;
}

function createGuidedCaptureMessage(input: {
  readonly armed: boolean;
  readonly captureLabel: string | null;
  readonly workflowRecord: WorkflowProofRecord | null;
}): string {
  if (!input.armed && !input.captureLabel && !input.workflowRecord) {
    return DEFAULT_GUIDED_CAPTURE_STATE.message;
  }

  if (input.armed && !input.workflowRecord) {
    return `Armed: the next preview will tag a guided capture as "${input.captureLabel ?? DEFAULT_GUIDED_CAPTURE_LABEL}".`;
  }

  if (!input.workflowRecord) {
    return "Guided capture is preparing the next proof record.";
  }

  if (!input.workflowRecord.counts_toward_gate) {
    if (input.workflowRecord.journey_kind !== "golden_edit_workflow") {
      return "Captured this journey, but it does not count toward the proof gate because it did not stay on the golden edit route.";
    }

    if (!input.workflowRecord.planner_assistance_used) {
      return "Captured this journey, but it does not count toward the proof gate because planner assistance was not used for preview.";
    }
  }

  if (input.workflowRecord.workflow_state === "review_ready") {
    return `Capture "${input.workflowRecord.capture_label ?? "guided"}" completed and counts toward the proof gate.`;
  }

  if (input.workflowRecord.workflow_state === "failed" || input.workflowRecord.workflow_state === "aborted") {
    return `Capture "${input.workflowRecord.capture_label ?? "guided"}" completed, but it did not reach review_ready.`;
  }

  if (input.workflowRecord.approval_required && !input.workflowRecord.approval_recorded_at) {
    return `Capture "${input.workflowRecord.capture_label ?? "guided"}" is gate-eligible so far. Record approval and finish review to count it fully.`;
  }

  if (input.workflowRecord.execute_requested_at === null) {
    return `Capture "${input.workflowRecord.capture_label ?? "guided"}" is tracking a planner-assisted golden edit journey. Execute and review it to finish the evidence sample.`;
  }

  return `Capture "${input.workflowRecord.capture_label ?? "guided"}" is in progress. Wait for review state to finish the sample.`;
}

export function JarvisApp() {
  const desktopApi = getJarvisDesktopApi();
  const [activePage, setActivePage] = useState<PageId>("command_center");
  const [composerValue, setComposerValue] = useState(
    "Inspect the repo, prepare a safe preview, and wait for explicit approval."
  );
  const [policySnapshot, setPolicySnapshot] = useState<PolicySnapshotResponse | null>(null);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [plannerStatus, setPlannerStatus] = useState<PlannerStatusResponse | null>(null);
  const [plannerError, setPlannerError] = useState<string | null>(null);
  const [plannerDraft, setPlannerDraft] =
    useState<PlannerSettingsUpdateRequest>(DEFAULT_PLANNER_DRAFT);
  const [plannerSaveMessage, setPlannerSaveMessage] = useState<string | null>(null);
  const [guidedCapture, setGuidedCapture] =
    useState<GuidedCaptureState>(DEFAULT_GUIDED_CAPTURE_STATE);
  const [lastIntentResponse, setLastIntentResponse] = useState<TaskIntentResponse | null>(null);
  const [approvalReceipts, setApprovalReceipts] = useState<
    Record<string, ApprovalDecisionResponse>
  >({});
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [pendingApprovalActionId, setPendingApprovalActionId] = useState<string | null>(null);
  const [lastExecutionResponse, setLastExecutionResponse] =
    useState<RunExecutionResponse | null>(null);
  const [runEvents, setRunEvents] = useState<RunEvent[]>([]);
  const [runHistory, setRunHistory] = useState<RunLog[]>([]);
  const [runHistoryActionMessage, setRunHistoryActionMessage] = useState<string | null>(null);
  const [pendingRunAction, setPendingRunAction] = useState<{
    runId: string;
    kind: RunActionKind;
  } | null>(null);
  const [recallQuery, setRecallQuery] = useState("");
  const [recallResults, setRecallResults] = useState<RecallEntry[]>([]);
  const [recallError, setRecallError] = useState<string | null>(null);
  const [isRecallSearching, setIsRecallSearching] = useState(false);
  const [proofSummary, setProofSummary] = useState<WorkflowProofSummaryResponse | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);
  const [proofReport, setProofReport] = useState<WorkflowProofReportResponse | null>(null);
  const [proofReportError, setProofReportError] = useState<string | null>(null);
  const [currentWorkflowJourney, setCurrentWorkflowJourney] =
    useState<WorkflowProofRecord | null>(null);
  const [pendingResumeRecallId, setPendingResumeRecallId] = useState<string | null>(null);
  const [isDetailsRailOpen, setIsDetailsRailOpen] = useState(false);
  const workflowJourneyRef = useRef<WorkflowProofRecord | null>(null);
  const composerReadyAtRef = useRef<string>(new Date().toISOString());
  const deferredComposerValue = useDeferredValue(composerValue);
  const pendingApprovalRequests = lastIntentResponse?.approval_requests ?? [];
  const guidedCaptureRecord =
    currentWorkflowJourney?.evidence_origin === "guided_operator_capture"
      ? currentWorkflowJourney
      : null;
  const guidedCaptureProgress = {
    armed: guidedCapture.armed,
    draftLabel: guidedCapture.draftLabel,
    activeLabel: guidedCapture.activeLabel,
    status: guidedCapture.status,
    message: guidedCapture.message,
    previewRecorded: Boolean(guidedCaptureRecord?.preview_ready_at),
    plannerAssistanceUsed: guidedCaptureRecord?.planner_assistance_used ?? false,
    goldenRouteReady: guidedCaptureRecord?.journey_kind === "golden_edit_workflow",
    approvalRecorded: Boolean(guidedCaptureRecord?.approval_recorded_at),
    reviewReady: guidedCaptureRecord?.workflow_state === "review_ready",
    countsTowardGate: guidedCaptureRecord?.counts_toward_gate ?? false
  };
  const canExecute =
    Boolean(lastIntentResponse?.manifest) &&
    (pendingApprovalRequests.length === 0 ||
      pendingApprovalRequests.every(
        (request) =>
          approvalReceipts[request.action_id]?.accepted &&
          approvalReceipts[request.action_id]?.decision !== "deny"
      ));

  async function refreshRunHistory(): Promise<void> {
    const response = await desktopApi.listRunHistory({
      workspace_root: WORKSPACE_ROOT,
      limit: 10
    });
    setRunHistory(response.runs);
  }

  async function refreshWorkflowProofSummary(): Promise<void> {
    try {
      const response = await desktopApi.getWorkflowProofSummary({
        workspace_root: WORKSPACE_ROOT,
        limit: 6
      });
      setProofSummary(response);
      setProofError(null);
    } catch (error) {
      setProofError(
        error instanceof Error ? error.message : "Failed to load the workflow proof summary."
      );
    }
  }

  async function refreshWorkflowProofReport(): Promise<void> {
    try {
      const response = await desktopApi.getWorkflowProofReport({
        workspace_root: WORKSPACE_ROOT,
        limit: 6
      });
      setProofReport(response);
      setProofReportError(null);
    } catch (error) {
      setProofReportError(
        error instanceof Error ? error.message : "Failed to load the workflow proof report."
      );
    }
  }

  function syncPlannerDraftFromStatus(status: PlannerStatusResponse): void {
    setPlannerDraft({
      provider_kind: status.provider_kind,
      model_name:
        status.provider_kind === "null_adapter"
          ? null
          : status.model_name ?? DEFAULT_PLANNER_DRAFT.model_name,
      endpoint_url:
        status.provider_kind === "null_adapter"
          ? null
          : status.endpoint_url ?? DEFAULT_PLANNER_DRAFT.endpoint_url
    });
  }

  async function refreshPlannerStatus(): Promise<void> {
    try {
      const response = await desktopApi.getPlannerStatus({
        session_id: SESSION_ID
      });
      setPlannerStatus(response);
      syncPlannerDraftFromStatus(response);
      setPlannerError(null);
    } catch (error) {
      setPlannerError(
        error instanceof Error ? error.message : "Failed to load planner provider status."
      );
    }
  }

  function persistWorkflowJourney(nextRecord: WorkflowProofRecord): void {
    workflowJourneyRef.current = nextRecord;
    setCurrentWorkflowJourney(nextRecord);

    void desktopApi
      .recordWorkflowProof(nextRecord)
      .then(async () => {
        await refreshWorkflowProofSummary();
        await refreshWorkflowProofReport();
      })
      .catch((error: unknown) => {
        setProofError(
          error instanceof Error ? error.message : "Failed to persist the workflow proof record."
        );
      });
  }

  async function handleRecallSearch(nextQuery: string = recallQuery): Promise<void> {
    setIsRecallSearching(true);
    setRecallError(null);

    try {
      const response = await desktopApi.searchLocalRecall({
        workspace_root: WORKSPACE_ROOT,
        query: nextQuery,
        limit: 12
      });
      setRecallResults(response.results);
    } catch (error) {
      setRecallError(error instanceof Error ? error.message : "Failed to search local recall.");
    } finally {
      setIsRecallSearching(false);
    }
  }

  async function handlePlannerSettingsApply(): Promise<void> {
    try {
      const response = await desktopApi.updatePlannerSettings(plannerDraft);
      setPlannerStatus(response);
      syncPlannerDraftFromStatus(response);
      setPlannerSaveMessage(
        `Applied ${response.provider_kind} / ${response.model_name ?? "no model"} for this session.`
      );
      setPlannerError(null);
    } catch (error) {
      setPlannerSaveMessage(null);
      setPlannerError(
        error instanceof Error ? error.message : "Failed to update planner settings."
      );
    }
  }

  function handleToggleGuidedCapture(): void {
    setGuidedCapture((currentState) => {
      if (currentState.armed) {
        return {
          ...currentState,
          armed: false,
          activeLabel: null,
          status: "idle",
          message:
            "Guided capture is disarmed. Background workflow measurements remain stored, but they do not count toward the proof gate."
        };
      }

      const nextLabel =
        currentState.draftLabel.trim() || createGuidedCaptureLabel();

      return {
        ...currentState,
        armed: true,
        activeLabel: nextLabel,
        status: "armed",
        message: `Armed guided capture "${nextLabel}". The next planner-assisted golden edit journey will be tagged for the proof gate.`
      };
    });
  }

  async function handleDeleteRun(runId: string): Promise<void> {
    setPendingRunAction({
      runId,
      kind: "delete"
    });

    try {
      const response = await desktopApi.deleteRunHistoryEntry({
        workspace_root: WORKSPACE_ROOT,
        run_id: runId
      });
      setRunHistoryActionMessage(response.message);
      await refreshRunHistory();
      await handleRecallSearch(recallQuery);
    } catch (error) {
      setRunHistoryActionMessage(
        error instanceof Error ? error.message : `Failed to delete ${runId}.`
      );
    } finally {
      setPendingRunAction(null);
    }
  }

  async function handleExportRun(runId: string): Promise<void> {
    setPendingRunAction({
      runId,
      kind: "export"
    });

    try {
      const response = await desktopApi.exportRunHistoryEntry({
        workspace_root: WORKSPACE_ROOT,
        run_id: runId
      });
      setRunHistoryActionMessage(
        `${response.message} Staged at ${response.staged_export_path} with ${response.redaction_count} redaction(s).`
      );
    } catch (error) {
      setRunHistoryActionMessage(
        error instanceof Error ? error.message : `Failed to stage an export for ${runId}.`
      );
    } finally {
      setPendingRunAction(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = desktopApi.subscribeToRunEvents((event) => {
      if (!cancelled) {
        setRunEvents((currentEvents) => [event, ...currentEvents].slice(0, 20));
      }

      const activeJourney = workflowJourneyRef.current;
      if (
        !cancelled &&
        activeJourney &&
        activeJourney.execute_requested_at &&
        activeJourney.first_result_at === null
      ) {
        const updatedJourney = mergeWorkflowProofRecord(activeJourney, {
          first_result_at: event.timestamp,
          updated_at: event.timestamp
        });

        persistWorkflowJourney(updatedJourney);
        if (updatedJourney.evidence_origin === "guided_operator_capture") {
          setGuidedCapture((currentState) => ({
            ...currentState,
            status: "in_progress",
            message: createGuidedCaptureMessage({
              armed: false,
              captureLabel: updatedJourney.capture_label,
              workflowRecord: updatedJourney
            })
          }));
        }
      }
    });

    void desktopApi
      .getPolicySnapshot({
        session_id: SESSION_ID
      })
      .then((snapshot) => {
        if (!cancelled) {
          setPolicySnapshot(snapshot);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setPolicyError(error instanceof Error ? error.message : "Failed to load policy snapshot.");
        }
      });

    void refreshRunHistory().catch(() => {});
    void handleRecallSearch("").catch(() => {});
    void refreshWorkflowProofSummary().catch(() => {});
    void refreshWorkflowProofReport().catch(() => {});
    void refreshPlannerStatus().catch(() => {});

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [desktopApi]);

  async function handlePreview(): Promise<void> {
    setApprovalReceipts({});
    setApprovalError(null);
    setLastExecutionResponse(null);
    setRunEvents([]);
    const captureWasArmed = guidedCapture.armed;
    const normalizedCaptureLabel = guidedCapture.draftLabel.trim();
    const captureLabel = captureWasArmed
      ? guidedCapture.activeLabel ??
        (normalizedCaptureLabel.length > 0
          ? normalizedCaptureLabel
          : createGuidedCaptureLabel())
      : null;
    const previewRequestedAt = new Date().toISOString();
    const previewStartedAt = Date.now();
    const initialJourney = createWorkflowProofRecord({
      journeyId: createWorkflowJourneyId(),
      sessionId: SESSION_ID,
      workspaceRoot: WORKSPACE_ROOT,
      evidenceOrigin: captureWasArmed ? "guided_operator_capture" : "background_measurement",
      captureLabel,
      composerReadyAt: composerReadyAtRef.current,
      coldStartToComposerMs: diffMilliseconds(
        policySnapshot?.app_started_at ?? null,
        composerReadyAtRef.current
      ),
      previewRequestedAt,
      resumeUsed: pendingResumeRecallId !== null,
      resumedFromRecallId: pendingResumeRecallId
    });
    if (captureWasArmed) {
      setGuidedCapture((currentState) => ({
        ...currentState,
        armed: false,
        activeLabel: captureLabel,
        status: "in_progress",
        message: `Capture "${captureLabel}" started. JARVIS is recording the next journey for proof-gate review.`
      }));
    }
    persistWorkflowJourney(initialJourney);
    const response = await desktopApi.submitTaskIntent({
      task: composerValue,
      session_id: SESSION_ID,
      workspace_roots: [WORKSPACE_ROOT],
      requested_at: previewRequestedAt
    });

    setLastIntentResponse(response);
    setPlannerStatus(response.planner_assistance.provider_status);
    syncPlannerDraftFromStatus(response.planner_assistance.provider_status);
    setPlannerError(null);
    setPendingResumeRecallId(null);

    const previewReadyAt = new Date().toISOString();
    const updatedJourney = mergeWorkflowProofRecord(initialJourney, {
      journey_kind: deriveJourneyKind(response),
      route_kind: response.route.chosen_route,
      task_type: response.route.task_type,
      risk_class: response.route.risk_class,
      planner_assistance_used: response.planner_assistance.used_for_preview,
      counts_toward_gate:
        captureWasArmed &&
        deriveJourneyKind(response) === "golden_edit_workflow" &&
        response.planner_assistance.used_for_preview,
      approval_required: response.approval_requests.length > 0,
      preview_ready_at: previewReadyAt,
      task_to_preview_ms: Math.max(0, Date.now() - previewStartedAt),
      manifest_id: response.manifest?.manifest_id ?? null,
      run_id: response.manifest?.run_id ?? null,
      workflow_state: response.workflow_state,
      updated_at: previewReadyAt
    });

    persistWorkflowJourney(
      updatedJourney
    );
    setGuidedCapture((currentState) => ({
      ...currentState,
      activeLabel: captureLabel,
      status: captureWasArmed ? "in_progress" : currentState.status,
      message: createGuidedCaptureMessage({
        armed: captureWasArmed,
        captureLabel,
        workflowRecord: updatedJourney
      })
    }));
  }

  async function handleApprovalDecision(
    approvalRequest: ApprovalRequest,
    decision: ApprovalDecisionKind
  ): Promise<void> {
    if (!lastIntentResponse?.manifest) {
      setApprovalError("No compiled manifest is available for approval.");
      return;
    }

    setPendingApprovalActionId(approvalRequest.action_id);
    setApprovalError(null);

    try {
      const approvalReceipt = await desktopApi.submitApprovalDecision({
        manifest_id: lastIntentResponse.manifest.manifest_id,
        action_id: approvalRequest.action_id,
        decision,
        approval_scope_class: selectApprovalScopeClass(approvalRequest, decision),
        approval_signature: approvalRequest.approval_signature,
        execution_hash: approvalRequest.execution_hash,
        max_execution_count: approvalRequest.max_execution_count,
        session_id: approvalRequest.session_id,
        expires_at: approvalRequest.expires_at,
        decided_at: new Date().toISOString(),
        decided_by: "operator"
      });

      setApprovalReceipts((currentReceipts) => ({
        ...currentReceipts,
        [approvalRequest.action_id]: approvalReceipt
      }));

      const activeJourney = workflowJourneyRef.current;
      if (activeJourney) {
        const updatedJourney = mergeWorkflowProofRecord(activeJourney, {
          approval_recorded_at: approvalReceipt.accepted ? approvalReceipt.decided_at : activeJourney.approval_recorded_at,
          operator_click_count: activeJourney.operator_click_count + 1,
          workflow_state:
            approvalReceipt.accepted && decision === "deny"
              ? "aborted"
              : activeJourney.workflow_state,
          updated_at: approvalReceipt.decided_at
        });

        persistWorkflowJourney(updatedJourney);
        if (updatedJourney.evidence_origin === "guided_operator_capture") {
          setGuidedCapture((currentState) => ({
            ...currentState,
            status:
              updatedJourney.workflow_state === "aborted"
                ? "completed"
                : "in_progress",
            message: createGuidedCaptureMessage({
              armed: false,
              captureLabel: updatedJourney.capture_label,
              workflowRecord: updatedJourney
            })
          }));
        }
      }
    } catch (error) {
      setApprovalError(
        error instanceof Error ? error.message : "Failed to submit the approval decision."
      );
    } finally {
      setPendingApprovalActionId(null);
    }
  }

  async function handleExecute(): Promise<void> {
    if (!lastIntentResponse?.manifest) {
      return;
    }

    const executeRequestedAt = new Date().toISOString();
    const activeJourney = workflowJourneyRef.current;
    if (activeJourney) {
      const updatedJourney = mergeWorkflowProofRecord(activeJourney, {
        execute_requested_at: executeRequestedAt,
        operator_click_count: activeJourney.operator_click_count + 1,
        workflow_state: "executing",
        updated_at: executeRequestedAt
      });

      persistWorkflowJourney(updatedJourney);
      if (updatedJourney.evidence_origin === "guided_operator_capture") {
        setGuidedCapture((currentState) => ({
          ...currentState,
          status: "in_progress",
          message: createGuidedCaptureMessage({
            armed: false,
            captureLabel: updatedJourney.capture_label,
            workflowRecord: updatedJourney
          })
        }));
      }
    }

    setLastExecutionResponse(null);
    setRunEvents([]);

    const executionResponse = await desktopApi.executeManifest({
      manifest_id: lastIntentResponse.manifest.manifest_id,
      session_id: SESSION_ID
    });

    setLastExecutionResponse(executionResponse);
    const completedAt = new Date().toISOString();
    const latestJourney = workflowJourneyRef.current;
    if (latestJourney) {
      const updatedJourney = mergeWorkflowProofRecord(latestJourney, {
        run_id: executionResponse.run_id ?? latestJourney.run_id,
        manifest_id: lastIntentResponse.manifest.manifest_id,
        first_result_at: latestJourney.first_result_at ?? completedAt,
        workflow_state: executionResponse.workflow_state,
        updated_at: completedAt
      });

      persistWorkflowJourney(updatedJourney);
      if (updatedJourney.evidence_origin === "guided_operator_capture") {
        setGuidedCapture((currentState) => ({
          ...currentState,
          status: "completed",
          message: createGuidedCaptureMessage({
            armed: false,
            captureLabel: updatedJourney.capture_label,
            workflowRecord: updatedJourney
          })
        }));
      }
    }
    await refreshRunHistory();
    await handleRecallSearch(recallQuery);
  }

  function handleResumePrompt(resumePrompt: string, recallEntryId: string): void {
    setPendingResumeRecallId(recallEntryId);
    setComposerValue(resumePrompt);
    setActivePage("command_center");
  }

  function handlePageChange(nextPage: PageId): void {
    startTransition(() => {
      setActivePage(nextPage);
    });
  }

  function renderActivePage() {
    switch (activePage) {
      case "tasks_projects":
        return (
          <TasksProjectsPage
            runHistory={runHistory}
            runHistoryActionMessage={runHistoryActionMessage}
            pendingRunAction={pendingRunAction}
            onDeleteRun={(runId) => {
              void handleDeleteRun(runId);
            }}
            onExportRun={(runId) => {
              void handleExportRun(runId);
            }}
            recallQuery={recallQuery}
            onRecallQueryChange={setRecallQuery}
            onRecallSearch={() => {
              void handleRecallSearch();
            }}
            recallResults={recallResults}
            recallError={recallError}
            isRecallSearching={isRecallSearching}
            onResume={handleResumePrompt}
          />
        );
      case "second_brain":
        return (
          <SecondBrainPage
            recallQuery={recallQuery}
            onRecallQueryChange={setRecallQuery}
            onRecallSearch={() => {
              void handleRecallSearch();
            }}
            recallResults={recallResults}
            recallError={recallError}
            isRecallSearching={isRecallSearching}
          />
        );
      case "connections":
        return (
          <ConnectionsPage
            plannerStatus={plannerStatus}
            plannerError={plannerError}
          />
        );
      case "settings":
        return (
          <SettingsPage
            policySnapshot={policySnapshot}
            policyError={policyError}
            proofSummary={proofSummary}
            proofError={proofError}
            proofReport={proofReport}
            proofReportError={proofReportError}
            plannerStatus={plannerStatus}
            plannerError={plannerError}
            plannerDraft={plannerDraft}
            plannerSaveMessage={plannerSaveMessage}
            onPlannerDraftChange={(patch) => {
              setPlannerDraft((currentDraft) => ({
                ...currentDraft,
                ...patch
              }));
              setPlannerSaveMessage(null);
            }}
            onPlannerSettingsApply={() => {
              void handlePlannerSettingsApply();
            }}
          />
        );
      case "command_center":
      default:
        return (
          <CommandCenterPage
            composerValue={composerValue}
            deferredComposerValue={deferredComposerValue}
            onComposerChange={setComposerValue}
            onPreview={() => {
              void handlePreview();
            }}
            onSubmitApprovalDecision={(approvalRequest, decision) => {
              void handleApprovalDecision(approvalRequest, decision);
            }}
            approvalReceipts={approvalReceipts}
            approvalError={approvalError}
            pendingApprovalActionId={pendingApprovalActionId}
            onExecute={() => {
              void handleExecute();
            }}
            canExecute={canExecute}
            executionResponse={lastExecutionResponse}
            runEvents={runEvents}
            lastIntentResponse={lastIntentResponse}
            plannerStatus={plannerStatus}
            guidedCapture={guidedCaptureProgress}
            onGuidedCaptureLabelChange={(nextValue) => {
              setGuidedCapture((currentState) => ({
                ...currentState,
                draftLabel: nextValue
              }));
            }}
            onToggleGuidedCapture={handleToggleGuidedCapture}
          />
        );
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand-panel">
          <p className="brand-kicker">Local-first operator console</p>
          <h1>JARVIS</h1>
        </div>
        <nav className="nav-list">
          {pageNavigationItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === activePage ? "nav-item nav-item-active" : "nav-item"}
              onClick={() => handlePageChange(item.id)}
            >
              <span>{item.label}</span>
              <small>{item.summary}</small>
            </button>
          ))}
        </nav>
      </aside>

      <div className="app-frame">
        <header className="top-bar">
          <div>
            <p className="eyebrow">Phase 6</p>
            <h2>Proof gate with local planner assist</h2>
          </div>
          <div className="status-cluster">
            <span className="status-pill">
              {policySnapshot?.version ?? "loading policy"}
            </span>
            <span className="status-pill">approval-gated</span>
            <button
              type="button"
              className="rail-toggle"
              onClick={() => setIsDetailsRailOpen((currentValue) => !currentValue)}
            >
              {isDetailsRailOpen ? "Hide details" : "Show details"}
            </button>
          </div>
        </header>

        <section className="status-banner" aria-label="Session status">
          <div>
            <strong>Workflow</strong>
            <span>
              {policySnapshot?.workflow ??
                "PLAN -> COMPILE -> SIMULATE -> APPROVAL -> EXECUTE -> ATTEST -> REVIEW"}
            </span>
          </div>
          <div>
            <strong>Policy</strong>
            <span>
              {policyError ??
                "Advanced routing and optional systems stay deferred; local planner assist may help task intake, but deterministic compile, simulation, approval, execution, attestation, and review still stay authoritative."}
            </span>
          </div>
        </section>

        <main className={isDetailsRailOpen ? "content-shell rail-open" : "content-shell"}>
          <section className="workspace">{renderActivePage()}</section>
          {isDetailsRailOpen ? (
            <aside className="detail-rail" aria-label="Detail rail">
              <div className="panel-header">
                <p className="eyebrow">Detail Rail</p>
                <h2>Progressive disclosure surfaces</h2>
              </div>
              <div className="rail-stack">
                <article className="rail-card">
                  <h3>Recent Tool Calls</h3>
                  <p>Compiled typed tools are visible in the preview. Live execution output lands later.</p>
                </article>
                <article className="rail-card">
                  <h3>Live Event Feed</h3>
                  <p>Execution and attestation events stay visible here while the run is active.</p>
                </article>
                <article className="rail-card">
                  <h3>Memory &amp; Provider Snapshot</h3>
                  <p>Local planner provider health is visible now; durable memory and broader optional providers stay deferred behind the measured gate.</p>
                </article>
                <article className="rail-card">
                  <h3>Quick Actions</h3>
                  <p>Preview, approvals, execute, and resume now also feed local proof metrics for the golden workflow.</p>
                </article>
              </div>
            </aside>
          ) : null}
        </main>

        <footer className="telemetry-strip">
          <span>Protocol: app://jarvis</span>
          <span>Renderer: sandboxed</span>
          <span>IPC: typed only</span>
          <span>Navigation: default deny</span>
        </footer>
      </div>
    </div>
  );
}
