import type { RecallEntry } from "../../shared/ipc";

export interface SecondBrainPageProps {
  readonly recallQuery: string;
  readonly onRecallQueryChange: (nextValue: string) => void;
  readonly onRecallSearch: () => void;
  readonly recallResults: readonly RecallEntry[];
  readonly recallError: string | null;
  readonly isRecallSearching: boolean;
}

export function SecondBrainPage(props: SecondBrainPageProps) {
  const {
    recallQuery,
    onRecallQueryChange,
    onRecallSearch,
    recallResults,
    recallError,
    isRecallSearching
  } = props;
  const noteResults = recallResults.filter((result) => result.source_kind === "operator_note");

  return (
    <section className="page-section" aria-labelledby="second-brain-title">
      <div className="panel-header">
        <p className="eyebrow">Second Brain</p>
        <h1 id="second-brain-title">Local recall stays useful before full memory hardening</h1>
      </div>
      <div className="summary-grid">
        <article className="summary-card">
          <h3>Trust Classes</h3>
          <p>
            Phase 5 surfaces only tool-confirmed run history and user-authored notes, with trust labels preserved.
          </p>
        </article>
        <article className="summary-card">
          <h3>Ingestion Points</h3>
          <p>Searchable recall is limited to local run history plus operator notes; no Tier 2 or Tier 3 writes exist yet.</p>
        </article>
        <article className="summary-card summary-card-wide">
          <h3>Operator notes lookup</h3>
          <div className="inline-search">
            <input
              aria-label="Operator notes lookup"
              value={recallQuery}
              onChange={(event) => onRecallQueryChange(event.target.value)}
              placeholder="Search operator notes without indexing secrets."
            />
            <button type="button" className="decision-button" onClick={onRecallSearch}>
              {isRecallSearching ? "Searching..." : "Search notes"}
            </button>
          </div>
          <p>Search runs through redaction before note content becomes searchable.</p>
        </article>
      </div>
      <div className="summary-grid">
        {noteResults.length > 0 ? (
          noteResults.map((result) => (
            <article className="summary-card" key={result.id}>
              <h3>{result.title}</h3>
              <p>Trust: {result.trust_label}</p>
              <p>Provenance: {result.provenance_label}</p>
              <p>{result.excerpt}</p>
            </article>
          ))
        ) : (
          <article className="summary-card summary-card-wide">
            <h3>No Note Results Yet</h3>
            <p>{recallError ?? "Operator-note lookup results will appear here."}</p>
          </article>
        )}
      </div>
    </section>
  );
}
