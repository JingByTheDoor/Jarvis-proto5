import type { RunLog } from "../../core/schemas";
import type { RecallEntry } from "../../shared/ipc";

export interface TasksProjectsPageProps {
  readonly runHistory: readonly RunLog[];
  readonly recallQuery: string;
  readonly onRecallQueryChange: (nextValue: string) => void;
  readonly onRecallSearch: () => void;
  readonly recallResults: readonly RecallEntry[];
  readonly recallError: string | null;
  readonly isRecallSearching: boolean;
  readonly onResume: (resumePrompt: string, recallEntryId: string) => void;
}

export function TasksProjectsPage(props: TasksProjectsPageProps) {
  const {
    runHistory,
    recallQuery,
    onRecallQueryChange,
    onRecallSearch,
    recallResults,
    recallError,
    isRecallSearching,
    onResume
  } = props;
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
        <article className="summary-card summary-card-wide">
          <h3>Previous-task search</h3>
          <div className="inline-search">
            <input
              aria-label="Previous-task search"
              value={recallQuery}
              onChange={(event) => onRecallQueryChange(event.target.value)}
              placeholder="Search previous runs, plan IDs, manifest IDs, or note text."
            />
            <button type="button" className="decision-button" onClick={onRecallSearch}>
              {isRecallSearching ? "Searching..." : "Search history"}
            </button>
          </div>
          <p>
            Search stays local and redacted, with provenance and trust labels preserved on every result.
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
      <div className="summary-grid">
        {recallResults.length > 0 ? (
          recallResults.map((result) => (
            <article className="summary-card" key={result.id}>
              <h3>{result.title}</h3>
              <p>Source: {result.source_kind}</p>
              <p>Trust: {result.trust_label}</p>
              <p>Provenance: {result.provenance_label}</p>
              <p>{result.excerpt}</p>
              {result.resume_prompt ? (
                <button
                  type="button"
                  className="decision-button"
                  onClick={() => onResume(result.resume_prompt!, result.id)}
                >
                  Resume task
                </button>
              ) : null}
            </article>
          ))
        ) : (
          <article className="summary-card summary-card-wide">
            <h3>No Recall Results Yet</h3>
            <p>
              {recallError ??
                "Search previous runs and operator notes to resume work without opening a deeper memory tier."}
            </p>
          </article>
        )}
      </div>
    </section>
  );
}
