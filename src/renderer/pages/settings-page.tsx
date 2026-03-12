import type { WorkflowProofSummaryResponse } from "../../shared/ipc";

export interface SettingsPageProps {
  readonly proofSummary: WorkflowProofSummaryResponse | null;
  readonly proofError: string | null;
}

function formatMetric(value: number | null, suffix: string): string {
  return value === null ? `Not enough local data yet` : `${value}${suffix}`;
}

export function SettingsPage(props: SettingsPageProps) {
  const { proofSummary, proofError } = props;
  const summary = proofSummary?.summary ?? null;
  const recentJourneys = proofSummary?.recent_journeys ?? [];

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
            {summary
              ? `${summary.golden_workflow_review_ready} of ${summary.golden_workflow_attempts} golden workflow attempt(s) reached review_ready.`
              : "Local proof remains empty until the workflow runs through preview and review."}
          </p>
        </article>
        <article className="summary-card">
          <h3>Latency</h3>
          <p>Task {"->"} preview median: {formatMetric(summary?.median_task_to_preview_ms ?? null, " ms")}</p>
          <p>
            Approval {"->"} first result median: {formatMetric(summary?.median_approval_to_first_result_ms ?? null, " ms")}
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
        </article>
      </div>
      <div className="summary-grid">
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
          <p>Retention and reduced-persistence controls stay explicit while the proof gate is being measured locally.</p>
        </article>
      </div>
    </section>
  );
}
