export function TasksProjectsPage() {
  return (
    <section className="page-section" aria-labelledby="tasks-projects-title">
      <div className="panel-header">
        <p className="eyebrow">Tasks &amp; Projects</p>
        <h1 id="tasks-projects-title">Operational history stays grouped by outcome</h1>
      </div>
      <div className="summary-grid">
        <article className="summary-card">
          <h3>Current Tasks</h3>
          <p>Live task grouping will land here once runs and manifests exist.</p>
        </article>
        <article className="summary-card">
          <h3>Previous Runs</h3>
          <p>Run history, approvals, and attestation timelines will appear in this rail-free view.</p>
        </article>
      </div>
    </section>
  );
}
