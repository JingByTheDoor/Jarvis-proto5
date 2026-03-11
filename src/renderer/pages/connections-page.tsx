export function ConnectionsPage() {
  return (
    <section className="page-section" aria-labelledby="connections-title">
      <div className="panel-header">
        <p className="eyebrow">Connections</p>
        <h1 id="connections-title">Adapters stay visible even when unavailable</h1>
      </div>
      <div className="summary-grid">
        <article className="summary-card">
          <h3>Provider Health</h3>
          <p>Null-adapter and degraded-state health cards will occupy this page.</p>
        </article>
        <article className="summary-card">
          <h3>Configuration Awareness</h3>
          <p>Optional integrations remain non-blocking until later phases attach real adapters.</p>
        </article>
      </div>
    </section>
  );
}
