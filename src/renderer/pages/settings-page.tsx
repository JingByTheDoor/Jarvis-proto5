import type {
  PlannerSettingsUpdateRequest,
  PlannerStatusResponse,
  PolicySnapshotResponse,
  WorkflowProofReportResponse,
  WorkflowProofSummaryResponse
} from "../../shared/ipc";

export interface SettingsPageProps {
  readonly policySnapshot: PolicySnapshotResponse | null;
  readonly policyError: string | null;
  readonly proofSummary: WorkflowProofSummaryResponse | null;
  readonly proofError: string | null;
  readonly proofReport: WorkflowProofReportResponse | null;
  readonly proofReportError: string | null;
  readonly plannerStatus: PlannerStatusResponse | null;
  readonly plannerError: string | null;
  readonly plannerDraft: PlannerSettingsUpdateRequest;
  readonly plannerSaveMessage: string | null;
  readonly onPlannerDraftChange: (
    patch: Partial<PlannerSettingsUpdateRequest>
  ) => void;
  readonly onPlannerSettingsApply: () => void;
}

type WorkflowProofGateCriterion = WorkflowProofSummaryResponse["gate_status"]["stability"];

function formatMetric(value: number | null, suffix: string): string {
  return value === null ? `Not enough local data yet` : `${value}${suffix}`;
}

function formatStatusLabel(value: string): string {
  return value.replaceAll("_", " ");
}

function formatCountLine(
  label: string,
  observedCount: number | null | undefined,
  requiredCount: number | null | undefined
): string | null {
  if (typeof observedCount !== "number" || typeof requiredCount !== "number") {
    return null;
  }

  return `${label}: ${observedCount} / ${requiredCount}`;
}

function formatMedianLine(criterion: WorkflowProofGateCriterion): string | null {
  const medianSegments: string[] = [];

  if (typeof criterion.recent_median === "number") {
    medianSegments.push(`Recent median: ${criterion.recent_median} ms`);
  }

  if (typeof criterion.previous_median === "number") {
    medianSegments.push(`Previous median: ${criterion.previous_median} ms`);
  }

  if (typeof criterion.threshold_median === "number") {
    medianSegments.push(`Threshold: <= ${criterion.threshold_median}`);
  }

  return medianSegments.length > 0 ? medianSegments.join(" | ") : null;
}

export function SettingsPage(props: SettingsPageProps) {
  const {
    policySnapshot,
    policyError,
    proofSummary,
    proofError,
    proofReport,
    proofReportError,
    plannerStatus,
    plannerError,
    plannerDraft,
    plannerSaveMessage,
    onPlannerDraftChange,
    onPlannerSettingsApply
  } = props;
  const summary = proofSummary?.summary ?? null;
  const gateStatus = proofSummary?.gate_status ?? null;
  const recentJourneys = proofSummary?.recent_journeys ?? [];
  const retentionPolicy = policySnapshot?.retention_policy ?? null;
  const sensitiveSessionDefaults = policySnapshot?.sensitive_session_defaults ?? null;
  const criterionCards = gateStatus
    ? [
        {
          label: "Stability",
          criterion: gateStatus.stability,
          sampleLabel: "Window samples",
          satisfiedLabel: "Review-ready in window"
        },
        {
          label: "Task -> Preview",
          criterion: gateStatus.task_to_preview_trend,
          sampleLabel: "Trend samples"
        },
        {
          label: "Preview -> Approval",
          criterion: gateStatus.preview_to_approval_trend,
          sampleLabel: "Trend samples"
        },
        {
          label: "Approval -> First Result",
          criterion: gateStatus.approval_to_first_result_trend,
          sampleLabel: "Trend samples"
        },
        {
          label: "Workflow Steps",
          criterion: gateStatus.step_count_trend,
          sampleLabel: "Trend samples"
        },
        {
          label: "Operator Clicks",
          criterion: gateStatus.click_count_trend,
          sampleLabel: "Trend samples"
        },
        {
          label: "Repeat-task Speed",
          criterion: gateStatus.repeat_task_speed,
          sampleLabel: "Resumed samples"
        },
        {
          label: "Resume Helpfulness",
          criterion: gateStatus.resume_helpfulness,
          sampleLabel: "Resumed journeys",
          satisfiedLabel: "Review-ready resumed journeys"
        }
      ]
    : [];

  return (
    <section className="page-section" aria-labelledby="settings-title">
      <div className="panel-header">
        <p className="eyebrow">Settings</p>
        <h1 id="settings-title">Retention, approval, and session posture stay explicit</h1>
      </div>
      <div className="summary-grid">
        <article className="summary-card">
          <h3>Phase 6 Proof Gate</h3>
          <p>
            {gateStatus
              ? `Status: ${formatStatusLabel(gateStatus.overall_status)}.`
              : "Local proof remains empty until the workflow runs through preview and review."}
          </p>
          <p>
            {summary
              ? `${summary.golden_workflow_review_ready} of ${summary.golden_workflow_attempts} golden workflow attempt(s) reached review_ready.`
              : "Golden workflow stability will appear after the first local proof samples land."}
          </p>
          <p>Gate evaluation currently uses guided operator captures only.</p>
        </article>
        <article className="summary-card">
          <h3>Latency</h3>
          <p>
            Cold start {"->"} composer median:{" "}
            {formatMetric(summary?.median_cold_start_to_composer_ms ?? null, " ms")}
          </p>
          <p>Task {"->"} preview median: {formatMetric(summary?.median_task_to_preview_ms ?? null, " ms")}</p>
          <p>
            Preview {"->"} approval median:{" "}
            {formatMetric(summary?.median_preview_to_approval_ms ?? null, " ms")}
          </p>
          <p>
            Approval {"->"} first result median: {formatMetric(summary?.median_approval_to_first_result_ms ?? null, " ms")}
          </p>
        </article>
        <article className="summary-card">
          <h3>Planner Provider</h3>
          <p>
            {plannerStatus
              ? `${plannerStatus.provider_kind} / ${plannerStatus.model_name ?? "no model"}`
              : "Planner provider visibility loads here."}
          </p>
          <p>
            {plannerError ??
              plannerStatus?.notes[0] ??
              "Local planner configuration stays optional and non-blocking."}
          </p>
        </article>
        <article className="summary-card">
          <h3>Operator Friction</h3>
          <p>Median steps: {formatMetric(summary?.median_workflow_step_count ?? null, "")}</p>
          <p>Median clicks: {formatMetric(summary?.median_operator_click_count ?? null, "")}</p>
        </article>
        <article className="summary-card">
          <h3>Resume Helpfulness</h3>
          <p>
            {summary
              ? `${summary.resume_review_ready} of ${summary.resume_journeys} resumed journey/journeys reached review_ready.`
              : "Resume usefulness will appear after local recall is used in the golden workflow."}
          </p>
          <p>
            Repeat task {"->"} preview median:{" "}
            {formatMetric(summary?.median_repeat_task_to_preview_ms ?? null, " ms")}
          </p>
        </article>
        <article className="summary-card">
          <h3>Retention Defaults</h3>
          <p>
            {retentionPolicy
              ? `.tmp/runs: ${retentionPolicy.run_history_days} days | .tmp/logs: ${retentionPolicy.event_logs_days} days`
              : "Retention defaults load from the policy snapshot."}
          </p>
          <p>
            {retentionPolicy
              ? `.tmp/cache: ${retentionPolicy.cache_days} days | sensitive session cache: ${retentionPolicy.sensitive_session_cache_hours} hours`
              : policyError ?? "Retention stays visible in Settings before optional storage tiers broaden."}
          </p>
          <p>
            {retentionPolicy?.export_staging_encrypted_at_rest
              ? "Run exports are staged under encrypted-at-rest local storage before the operator moves them elsewhere."
              : "Export staging posture is unavailable."}
          </p>
        </article>
      </div>
      <div className="summary-grid">
        {criterionCards.length > 0 ? (
          criterionCards.map((item) => (
            <article className="summary-card" key={item.label}>
              <h3>{item.label}</h3>
              <p>Status: {formatStatusLabel(item.criterion.status)}</p>
              <p>{item.criterion.detail}</p>
              {formatCountLine(
                item.sampleLabel,
                item.criterion.sample_count,
                item.criterion.required_sample_count
              ) ? (
                <p>
                  {formatCountLine(
                    item.sampleLabel,
                    item.criterion.sample_count,
                    item.criterion.required_sample_count
                  )}
                </p>
              ) : null}
              {item.satisfiedLabel &&
              formatCountLine(
                item.satisfiedLabel,
                item.criterion.satisfied_count,
                item.criterion.required_satisfied_count
              ) ? (
                <p>
                  {formatCountLine(
                    item.satisfiedLabel,
                    item.criterion.satisfied_count,
                    item.criterion.required_satisfied_count
                  )}
                </p>
              ) : null}
              {formatMedianLine(item.criterion) ? <p>{formatMedianLine(item.criterion)}</p> : null}
            </article>
          ))
        ) : (
          <article className="summary-card summary-card-wide">
            <h3>Proof Gate Criteria</h3>
            <p>Local proof details will appear once a proof summary is available.</p>
          </article>
        )}
        <article className="summary-card summary-card-wide">
          <h3>Planner Selection</h3>
          <label className="settings-field" htmlFor="planner-provider-kind">
            <span>Provider</span>
            <select
              id="planner-provider-kind"
              value={plannerDraft.provider_kind}
              onChange={(event) =>
                onPlannerDraftChange({
                  provider_kind: event.target.value as PlannerSettingsUpdateRequest["provider_kind"]
                })
              }
            >
              <option value="local_ollama">local_ollama</option>
              <option value="null_adapter">null_adapter</option>
            </select>
          </label>
          <label className="settings-field" htmlFor="planner-model-name">
            <span>Model</span>
            <input
              id="planner-model-name"
              type="text"
              value={plannerDraft.model_name ?? ""}
              disabled={plannerDraft.provider_kind === "null_adapter"}
              onChange={(event) =>
                onPlannerDraftChange({
                  model_name: event.target.value
                })
              }
            />
          </label>
          <label className="settings-field" htmlFor="planner-endpoint-url">
            <span>Endpoint</span>
            <input
              id="planner-endpoint-url"
              type="text"
              value={plannerDraft.endpoint_url ?? ""}
              disabled={plannerDraft.provider_kind === "null_adapter"}
              onChange={(event) =>
                onPlannerDraftChange({
                  endpoint_url: event.target.value
                })
              }
            />
          </label>
          <div className="action-row">
            <button type="button" className="secondary-button" onClick={onPlannerSettingsApply}>
              Apply planner config
            </button>
          </div>
          <p>
            {plannerSaveMessage ??
              "Planner settings are session-local in this slice; restart falls back to env or built-in defaults."}
          </p>
        </article>
        <article className="summary-card summary-card-wide">
          <h3>Blocking Reasons</h3>
          <p>
            {(gateStatus?.blocking_reasons.length ?? 0) > 0
              ? gateStatus?.blocking_reasons.join(" ")
              : "No blocking reasons are recorded once every local proof criterion is on track."}
          </p>
          <p>
            {gateStatus?.assumption_note ??
              "Assumptions stay explicit whenever the local proof gate adds conservative readiness thresholds."}
          </p>
        </article>
        <article className="summary-card summary-card-wide">
          <h3>Local Proof Report</h3>
          <p>
            {proofReport
              ? `Generated at ${proofReport.generated_at} for ${proofReport.workspace_root}.`
              : "The local proof report will appear once proof data can be summarized."}
          </p>
          <pre className="report-code" aria-label="Local proof report">
            {proofReport?.report_markdown ??
              proofReportError ??
              "No typed proof report is available yet."}
          </pre>
        </article>
        {recentJourneys.length > 0 ? (
          recentJourneys.map((journey) => (
            <article className="summary-card" key={journey.journey_id}>
              <h3>{journey.journey_kind}</h3>
              <p>State: {journey.workflow_state ?? "collecting"}</p>
              <p>Route: {journey.route_kind ?? "pending"}</p>
              <p>Steps / Clicks: {journey.workflow_step_count} / {journey.operator_click_count}</p>
              <p>Resume used: {journey.resume_used ? "yes" : "no"}</p>
            </article>
          ))
        ) : (
          <article className="summary-card summary-card-wide">
            <h3>No Proof Samples Yet</h3>
            <p>
              {proofError ??
                "Advanced routing, durable memory, and optional systems remain deferred until local proof shows the current workflow is stable and low-friction."}
            </p>
          </article>
        )}
        <article className="summary-card">
          <h3>Sensitive Session</h3>
          <p>
            {sensitiveSessionDefaults
              ? `Reduced logging: ${sensitiveSessionDefaults.reduced_logging ? "on" : "off"} | minimal summaries only: ${sensitiveSessionDefaults.minimal_summaries_only ? "yes" : "no"}`
              : "Sensitive-session defaults load from the local policy snapshot."}
          </p>
          <p>
            {sensitiveSessionDefaults
              ? `Tier 2 memory writes: ${sensitiveSessionDefaults.tier2_memory_writes_enabled ? "enabled" : "disabled"} | Tier 3 analytics writes: ${sensitiveSessionDefaults.tier3_analytics_writes_enabled ? "enabled" : "disabled"}`
              : "Reduced-persistence controls stay explicit while the proof gate is being measured locally."}
          </p>
        </article>
      </div>
    </section>
  );
}
