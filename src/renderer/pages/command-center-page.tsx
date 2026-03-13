import type {
  ApprovalDecisionResponse,
  ApprovalRequest,
  PlannerStatusResponse,
  RunExecutionResponse,
  TaskIntentResponse
} from "../../shared/ipc";
import type { ApprovalDecisionKind } from "../../shared/constants";
import type { RunEvent } from "../../core/schemas";

export interface CommandCenterPageProps {
  readonly composerValue: string;
  readonly deferredComposerValue: string;
  readonly onComposerChange: (nextValue: string) => void;
  readonly onPreview: () => void;
  readonly onExecute: () => void;
  readonly canExecute: boolean;
  readonly onSubmitApprovalDecision: (
    approvalRequest: ApprovalRequest,
    decision: ApprovalDecisionKind
  ) => void;
  readonly approvalReceipts: Record<string, ApprovalDecisionResponse>;
  readonly approvalError: string | null;
  readonly pendingApprovalActionId: string | null;
  readonly executionResponse: RunExecutionResponse | null;
  readonly runEvents: readonly RunEvent[];
  readonly lastIntentResponse: TaskIntentResponse | null;
  readonly plannerStatus: PlannerStatusResponse | null;
  readonly guidedCapture: {
    armed: boolean;
    draftLabel: string;
    activeLabel: string | null;
    status: "idle" | "armed" | "in_progress" | "completed";
    message: string;
    previewRecorded: boolean;
    plannerAssistanceUsed: boolean;
    goldenRouteReady: boolean;
    approvalRecorded: boolean;
    reviewReady: boolean;
    countsTowardGate: boolean;
  };
  readonly onGuidedCaptureLabelChange: (nextValue: string) => void;
  readonly onToggleGuidedCapture: () => void;
}

const detailRailSections = [
  "Recent Tool Calls",
  "Live Event Feed",
  "Memory & Provider Snapshot",
  "Quick Actions"
] as const;

function getShellReceipt(structuredData: unknown): Record<string, unknown> | null {
  if (!structuredData || typeof structuredData !== "object") {
    return null;
  }

  return structuredData as Record<string, unknown>;
}

export function CommandCenterPage(props: CommandCenterPageProps) {
  const {
    composerValue,
    deferredComposerValue,
    lastIntentResponse,
    onComposerChange,
    onPreview,
    onExecute,
    canExecute,
    onSubmitApprovalDecision,
    approvalReceipts,
    approvalError,
    pendingApprovalActionId,
    executionResponse,
    runEvents,
    plannerStatus,
    guidedCapture,
    onGuidedCaptureLabelChange,
    onToggleGuidedCapture
  } = props;
  const compiledActions = lastIntentResponse?.manifest?.compiled_actions ?? [];
  const approvalCount = compiledActions.filter((action) => action.requires_approval).length;
  const effectPreviews = lastIntentResponse?.effect_previews ?? [];
  const approvalRequests = lastIntentResponse?.approval_requests ?? [];
  const simulationSummary = lastIntentResponse?.simulation_summary ?? null;
  const primaryDiffPreview = lastIntentResponse?.diff_previews[0] ?? null;
  const routeSummary = lastIntentResponse?.route ?? null;
  const plannerAssistance = lastIntentResponse?.planner_assistance ?? null;
  const visiblePlannerStatus = plannerAssistance?.provider_status ?? plannerStatus;
  const stateTrace = lastIntentResponse?.state_trace.join(" -> ") ?? "PLAN -> COMPILE -> SIMULATE";
  const planSummary =
    (lastIntentResponse?.plan?.summary ?? deferredComposerValue) || "Awaiting task input.";
  const runArtifacts = executionResponse?.run_log?.artifacts ?? [];

  return (
    <div className="workspace-grid">
      <section className="panel panel-hero" aria-labelledby="command-center-title">
        <div className="panel-header">
          <p className="eyebrow">Command Center</p>
          <h1 id="command-center-title">Shortest safe path from task to review</h1>
        </div>
        <p className="panel-copy">
          The first golden workflow stays local and typed through plan, compile, simulation,
          approval, execution, attestation, and review. Phase 6 starts by measuring whether that
          workflow is actually stable and low-friction before routing, memory, or optional systems
          broaden.
        </p>
        <label className="composer" htmlFor="task-composer">
          <span>Task composer / input</span>
          <textarea
            id="task-composer"
            value={composerValue}
            onChange={(event) => onComposerChange(event.target.value)}
            placeholder="Inspect the repo, prepare a diff preview, and wait for approval."
          />
        </label>
        <div className="action-row">
          <button type="button" className="primary-button" onClick={onPreview}>
            Preview
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={!canExecute}
            onClick={onExecute}
          >
            Execute
          </button>
        </div>
        <div className="message-strip">
          <span className="status-dot" />
          <span>
            {executionResponse?.message ??
              lastIntentResponse?.message ??
              "No typed preview has been generated yet."}
          </span>
        </div>
        <div className="summary-grid capture-grid">
          <article className="summary-card summary-card-wide">
            <h3>Guided Evidence Capture</h3>
            <p>
              Arm a guided capture before the next natural-language planner-assisted golden edit
              journey if you want that journey to count toward the proof gate.
            </p>
            <label className="settings-field" htmlFor="guided-capture-label">
              <span>Capture label</span>
              <input
                id="guided-capture-label"
                type="text"
                value={guidedCapture.draftLabel}
                onChange={(event) => onGuidedCaptureLabelChange(event.target.value)}
                placeholder="planner-assisted-golden-edit"
              />
            </label>
            <div className="action-row">
              <button
                type="button"
                className="secondary-button"
                onClick={onToggleGuidedCapture}
              >
                {guidedCapture.armed ? "Disarm guided capture" : "Arm guided capture"}
              </button>
            </div>
            <p>{guidedCapture.message}</p>
            <div className="summary-grid">
              <article className="summary-card">
                <h3>Capture Status</h3>
                <p>{guidedCapture.status}</p>
              </article>
              <article className="summary-card">
                <h3>Active Label</h3>
                <p>{guidedCapture.activeLabel ?? "none"}</p>
              </article>
              <article className="summary-card">
                <h3>Counts Toward Gate</h3>
                <p>{guidedCapture.countsTowardGate ? "yes" : "no"}</p>
              </article>
            </div>
            <div className="capture-checklist" aria-label="Guided capture checklist">
              <p>Preview recorded: {guidedCapture.previewRecorded ? "yes" : "no"}</p>
              <p>Planner assist used: {guidedCapture.plannerAssistanceUsed ? "yes" : "no"}</p>
              <p>Golden edit route: {guidedCapture.goldenRouteReady ? "yes" : "no"}</p>
              <p>Approval recorded: {guidedCapture.approvalRecorded ? "yes" : "no"}</p>
              <p>Review ready: {guidedCapture.reviewReady ? "yes" : "no"}</p>
            </div>
          </article>
        </div>
      </section>

      <section className="panel stack-panel" aria-labelledby="route-preview-title">
        <div className="panel-header">
          <p className="eyebrow">Route Explanation</p>
          <h2 id="route-preview-title">Lean route explanation visible by default</h2>
        </div>
        <div className="summary-grid">
          <article className="summary-card">
            <h3>Task Level</h3>
            <p>{routeSummary?.task_level ?? "Awaiting preview."}</p>
          </article>
          <article className="summary-card">
            <h3>Task Type</h3>
            <p>{routeSummary?.task_type ?? "Awaiting preview."}</p>
          </article>
          <article className="summary-card">
            <h3>Risk Class</h3>
            <p>{routeSummary?.risk_class ?? "Awaiting preview."}</p>
          </article>
          <article className="summary-card">
            <h3>Chosen Route</h3>
            <p>{routeSummary?.chosen_route ?? "Awaiting preview."}</p>
          </article>
          <article className="summary-card summary-card-wide">
            <h3>Why This Route Was Chosen</h3>
            <p>
              {routeSummary?.operator_explanation ??
                "The route explanation appears here after the preview compiler classifies the task."}
            </p>
          </article>
        </div>
      </section>

      <section className="panel stack-panel" aria-labelledby="workflow-preview-title">
        <div className="panel-header">
          <p className="eyebrow">Workflow Spine</p>
          <h2 id="workflow-preview-title">Plan and manifest inspection</h2>
        </div>
        <div className="summary-grid">
          <article className="summary-card">
            <h3>Plan Summary</h3>
            <p>{planSummary}</p>
          </article>
          <article className="summary-card">
            <h3>Manifest Summary</h3>
            <p>
              {lastIntentResponse?.manifest
                ? `${compiledActions.length} compiled action(s) ready for inspection.`
                : "No manifest compiled yet."}
            </p>
          </article>
          <article className="summary-card">
            <h3>Simulation Summary</h3>
            <p>
              {simulationSummary
                ? `${simulationSummary.preview_count} preview(s), highest risk ${simulationSummary.highest_risk}, ${approvalCount} approval-gated action(s).`
                : "Simulation runs after compile and before approval."}
            </p>
          </article>
          <article className="summary-card">
            <h3>State Trace</h3>
            <p>{stateTrace}</p>
          </article>
          <article className="summary-card">
            <h3>Review State</h3>
            <p>{executionResponse?.workflow_state ?? "Awaiting execution."}</p>
          </article>
          <article className="summary-card">
            <h3>Planner Assist</h3>
            <p>{plannerAssistance?.status ?? visiblePlannerStatus?.mode ?? "not loaded"}</p>
            <p>{plannerAssistance?.rationale ?? visiblePlannerStatus?.notes[0] ?? "Provider visibility appears here before optional systems broaden."}</p>
          </article>
        </div>
      </section>

      <section className="panel stack-panel" aria-labelledby="compiled-actions-title">
        <div className="panel-header">
          <p className="eyebrow">Compiled Actions</p>
          <h2 id="compiled-actions-title">Typed action inspection</h2>
        </div>
        <div className="summary-grid">
          {compiledActions.length > 0 ? (
            compiledActions.map((action) => (
              <article className="summary-card" key={action.action_id}>
                <h3>{action.tool_name}</h3>
                <p>Risk: {action.risk_level}</p>
                <p>Approval: {action.requires_approval ? "required" : "not required"}</p>
                <p>Path: {action.path_scope.entries[0]?.path ?? "n/a"}</p>
                <p>Effect: {action.expected_side_effects[0]?.detail ?? "n/a"}</p>
                {typeof action.normalized_args.command_text === "string" ? (
                  <p>Command: {action.normalized_args.command_text}</p>
                ) : null}
                {typeof action.normalized_args.working_directory === "string" ? (
                  <p>Working directory: {action.normalized_args.working_directory}</p>
                ) : null}
              </article>
            ))
          ) : (
            <article className="summary-card summary-card-wide">
              <h3>No Compiled Actions Yet</h3>
              <p>Typed tools appear here after the preview compiler builds the manifest.</p>
            </article>
          )}
        </div>
      </section>

      <section className="panel stack-panel" aria-labelledby="event-feed-title">
        <div className="panel-header">
          <p className="eyebrow">Live Activity</p>
          <h2 id="event-feed-title">Event feed</h2>
        </div>
        <div className="summary-grid">
          {runEvents.length > 0 ? (
            runEvents.map((event) => (
              <article className="summary-card" key={`${event.timestamp}:${event.kind.type}`}>
                <h3>{event.kind.type}</h3>
                <p>Category: {event.kind.category}</p>
                <p>{event.timestamp}</p>
              </article>
            ))
          ) : (
            <article className="summary-card summary-card-wide">
              <h3>No Live Events Yet</h3>
              <p>Execution events stream here once an approved manifest starts running.</p>
            </article>
          )}
        </div>
      </section>

      <section className="panel stack-panel" aria-labelledby="run-output-title">
        <div className="panel-header">
          <p className="eyebrow">Results</p>
          <h2 id="run-output-title">Run output and result</h2>
        </div>
        <div className="summary-grid">
          {executionResponse ? (
            <>
              <article className="summary-card">
                <h3>{executionResponse.run_id ?? "Pending run"}</h3>
                <p>Review state: {executionResponse.workflow_state}</p>
                <p>
                  Persistence: {executionResponse.run_log?.persistence_status ?? "not persisted"}
                </p>
                <p>{executionResponse.persisted_run_path ?? "No persisted run-log path returned."}</p>
              </article>
              {executionResponse.tool_results.length ? (
                executionResponse.tool_results.map((toolResult, index) => {
                  const shellReceipt = getShellReceipt(toolResult.structured_data);

                  return (
                    <article className="summary-card" key={`${index}:${String(toolResult.summary)}`}>
                      <h3>
                        {typeof toolResult.summary === "string"
                          ? toolResult.summary
                          : `Tool ${index + 1}`}
                      </h3>
                      <p>OK: {toolResult.ok ? "yes" : "no"}</p>
                      <p>
                        {typeof toolResult.error === "string"
                          ? toolResult.error
                          : "Structured output is available for review."}
                      </p>
                      {shellReceipt && typeof shellReceipt.command_text === "string" ? (
                        <>
                          <p>Command: {shellReceipt.command_text}</p>
                          <p>CWD: {String(shellReceipt.working_directory ?? "n/a")}</p>
                          <p>Exit code: {String(shellReceipt.exit_code ?? "n/a")}</p>
                        </>
                      ) : null}
                    </article>
                  );
                })
              ) : (
                <article className="summary-card">
                  <h3>No Tool Output</h3>
                  <p>Execution completed without any typed tool result payloads.</p>
                </article>
              )}
              <article className="summary-card summary-card-wide">
                <h3>{`Artifacts (${runArtifacts.length})`}</h3>
                {runArtifacts.length > 0 ? (
                  <div className="artifact-list">
                    {runArtifacts.map((artifact, index) => (
                      <p key={`${artifact.location}:${index}`}>
                        {artifact.kind}: {artifact.location}
                        {artifact.description ? ` (${artifact.description})` : ""}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p>No artifacts were recorded for this run.</p>
                )}
              </article>
            </>
          ) : (
            <article className="summary-card summary-card-wide">
              <h3>No Run Output Yet</h3>
              <p>Tool results appear here after execution completes.</p>
            </article>
          )}
        </div>
      </section>

      <section className="panel stack-panel" aria-labelledby="attestation-title">
        <div className="panel-header">
          <p className="eyebrow">Attestation</p>
          <h2 id="attestation-title">Attestation results</h2>
        </div>
        <div className="summary-grid">
          {executionResponse?.attestations.length ? (
            executionResponse.attestations.map((attestation) => (
              <article className="summary-card" key={attestation.action_id}>
                <h3>{attestation.action_id}</h3>
                <p>Matched: {attestation.matched ? "yes" : "no"}</p>
                <p>Approved hash: {attestation.approved_execution_hash}</p>
                <p>Actual hash: {attestation.actual_execution_hash}</p>
                <p>
                  Deviations:{" "}
                  {attestation.deviations.length > 0
                    ? attestation.deviations.join(", ")
                    : "none"}
                </p>
              </article>
            ))
          ) : (
            <article className="summary-card summary-card-wide">
              <h3>No Attestations Yet</h3>
              <p>Attestation results appear here after execution records structured observations.</p>
            </article>
          )}
        </div>
      </section>

      <section className="panel stack-panel" aria-labelledby="effect-preview-title">
        <div className="panel-header">
          <p className="eyebrow">Simulation</p>
          <h2 id="effect-preview-title">Effect previews</h2>
        </div>
        <div className="summary-grid">
          {effectPreviews.length > 0 ? (
            effectPreviews.map((preview) => (
              <article className="summary-card" key={preview.action_id}>
                <h3>{preview.action_id}</h3>
                <p>Confidence: {preview.confidence}</p>
                <p>Reads: {preview.predicted_reads.length}</p>
                <p>Writes: {preview.predicted_writes.length}</p>
                <p>Deletes: {preview.predicted_deletes.length}</p>
                <p>{preview.notes[0] ?? "No simulation notes."}</p>
              </article>
            ))
          ) : (
            <article className="summary-card summary-card-wide">
              <h3>No Effect Previews Yet</h3>
              <p>Simulation previews appear here once the compiled manifest is analyzed.</p>
            </article>
          )}
        </div>
      </section>

      <section className="panel stack-panel" aria-labelledby="approval-scope-title">
        <div className="panel-header">
          <p className="eyebrow">Approval</p>
          <h2 id="approval-scope-title">Exact approval scope</h2>
        </div>
        <div className="summary-grid">
          {approvalRequests.length > 0 ? (
            approvalRequests.map((request) => (
              <article className="summary-card" key={request.action_id}>
                <h3>{request.action_id}</h3>
                <p>Risk: {request.risk_level}</p>
                <p>Decisions: {request.decision_options.join(", ")}</p>
                <p>Expiry: {request.expires_at}</p>
                <p>Session: {request.session_id}</p>
                <p>Max executions: {request.max_execution_count}</p>
                <p>Approval signature: {request.approval_signature}</p>
                <p>Execution hash: {request.execution_hash}</p>
                <p>Side effect family: {request.side_effect_family}</p>
                <p>Path scope: {request.path_scope.entries[0]?.path ?? "n/a"}</p>
                <p>
                  Network scope:{" "}
                  {request.network_scope.allow.length > 0
                    ? `${request.network_scope.allow.length} allowed endpoint(s)`
                    : "default deny"}
                </p>
                <div className="approval-action-row">
                  {request.decision_options.map((decision) => (
                    <button
                      key={decision}
                      type="button"
                      className="decision-button"
                      disabled={pendingApprovalActionId === request.action_id}
                      onClick={() => onSubmitApprovalDecision(request, decision)}
                    >
                      {decision === "approve_once"
                        ? "Approve once"
                        : decision === "approve_session"
                          ? "Approve session"
                          : "Deny"}
                    </button>
                  ))}
                </div>
                {approvalReceipts[request.action_id] ? (
                  <p
                    className={
                      approvalReceipts[request.action_id].accepted
                        ? "approval-receipt approval-receipt-accepted"
                        : "approval-receipt approval-receipt-rejected"
                    }
                  >
                    {approvalReceipts[request.action_id].message}
                  </p>
                ) : null}
              </article>
            ))
          ) : (
            <article className="summary-card summary-card-wide">
              <h3>No Approval Scope Yet</h3>
              <p>Approval scope appears here only for actions that remain gated after simulation.</p>
            </article>
          )}
        </div>
        {approvalError ? (
          <p className="approval-receipt approval-receipt-rejected">{approvalError}</p>
        ) : null}
      </section>

      <section className="panel stack-panel" aria-labelledby="diff-preview-title">
        <div className="panel-header">
          <p className="eyebrow">Exact Diff Preview</p>
          <h2 id="diff-preview-title">File-level preview for typed edits</h2>
        </div>
        {primaryDiffPreview ? (
          <div className="diff-preview">
            <div className="summary-grid">
              <article className="summary-card">
                <h3>Target Path</h3>
                <p>{primaryDiffPreview.path}</p>
              </article>
              <article className="summary-card">
                <h3>Status</h3>
                <p>{primaryDiffPreview.status}</p>
              </article>
            </div>
            <pre aria-label="Unified diff preview" className="diff-code">
              {primaryDiffPreview.unified_diff}
            </pre>
          </div>
        ) : (
          <article className="summary-card summary-card-wide">
            <h3>No Diff Preview Yet</h3>
            <p>Exact diff preview appears here for supported typed file changes.</p>
          </article>
        )}
      </section>

      <section className="panel stack-panel" aria-labelledby="details-rail-surfaces">
        <div className="panel-header">
          <p className="eyebrow">Collapsed Detail Rail</p>
          <h2 id="details-rail-surfaces">Secondary operational surfaces</h2>
        </div>
        <div className="rail-preview-grid">
          <article className="rail-preview-card">
            <h3>Current Model / Provider Snapshot</h3>
            <p>
              {visiblePlannerStatus
                ? `${visiblePlannerStatus.provider_kind} / ${visiblePlannerStatus.model_name ?? "no model"} / ${visiblePlannerStatus.mode}`
                : "Planner provider health has not loaded yet."}
            </p>
          </article>
          {detailRailSections.map((title) => (
            <article className="rail-preview-card" key={title}>
              <h3>{title}</h3>
              <p>Available through the detail rail without cluttering the default workspace.</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
