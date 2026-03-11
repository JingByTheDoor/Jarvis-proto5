export function SecondBrainPage() {
  return (
    <section className="page-section" aria-labelledby="second-brain-title">
      <div className="panel-header">
        <p className="eyebrow">Second Brain</p>
        <h1 id="second-brain-title">Memory visibility without memory writes yet</h1>
      </div>
      <div className="summary-grid">
        <article className="summary-card">
          <h3>Trust Classes</h3>
          <p>Verified facts, summaries, and contradictions will surface here in later phases.</p>
        </article>
        <article className="summary-card">
          <h3>Ingestion Points</h3>
          <p>Note, file, and URL ingestion remain blocked until memory hardening is built.</p>
        </article>
      </div>
    </section>
  );
}
