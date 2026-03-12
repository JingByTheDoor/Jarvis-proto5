import type { RunLog } from "../../core/schemas";

export interface TasksProjectsPageProps {
  readonly runHistory: readonly RunLog[];
}

export function TasksProjectsPage(props: TasksProjectsPageProps) {
  const { runHistory } = props;
  const latestRun = runHistory[0] ?? null;

  return (
    <section className="page-section" aria-labelledby="tasks-projects-title">
      <div className="panel-header">
        <p className="eyebrow">Tasks &amp; Projects</p>
        <h1 id="tasks-projects-title">Operational history stays grouped by outcome</h1>
      </div>
      <div className="summary-grid">
        <article className="summary-card">
          <h3>Current Tasks</h3>
          <p>
            {latestRun
              ? `Latest run ${latestRun.run_id} is ${latestRun.final_result.status}.`
              : "No persisted runs yet."}
          </p>
        </article>
        <article className="summary-card">
          <h3>Previous Runs</h3>
          <p>
            {runHistory.length > 0
              ? `${runHistory.length} persisted run(s) available with approvals and attestations.`
              : "Run history, approvals, and attestation timelines will appear here after execution."}
          </p>
        </article>
      </div>
      <div className="summary-grid">
        {runHistory.length > 0 ? (
          runHistory.map((run) => (
            <article className="summary-card" key={run.run_id}>
              <h3>{run.run_id}</h3>
              <p>Status: {run.final_result.status}</p>
              <p>Approvals: {run.events.filter((event) => event.kind.type === "approval_recorded").length}</p>
              <p>Attestations: {run.attestations.length}</p>
              <p>Artifacts: {run.artifacts.length}</p>
              <p>Persistence: {run.persistence_status}</p>
              <p>{run.final_result.summary}</p>
            </article>
          ))
        ) : (
          <article className="summary-card summary-card-wide">
            <h3>No Run History Yet</h3>
            <p>Execute an approved manifest to populate previous runs, approvals, and attestation history.</p>
          </article>
        )}
      </div>
    </section>
  );
}
