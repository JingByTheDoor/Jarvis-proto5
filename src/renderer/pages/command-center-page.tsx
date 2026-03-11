import type { TaskIntentResponse } from "../../shared/ipc";

export interface CommandCenterPageProps {
  readonly composerValue: string;
  readonly deferredComposerValue: string;
  readonly onComposerChange: (nextValue: string) => void;
  readonly onPreview: () => void;
  readonly lastIntentResponse: TaskIntentResponse | null;
}

const detailRailSections = [
  "Recent Tool Calls",
  "Live Event Feed",
  "Memory & Provider Snapshot",
  "Quick Actions"
] as const;

export function CommandCenterPage(props: CommandCenterPageProps) {
  const { composerValue, deferredComposerValue, lastIntentResponse, onComposerChange, onPreview } =
    props;

  return (
    <div className="workspace-grid">
      <section className="panel panel-hero" aria-labelledby="command-center-title">
        <div className="panel-header">
          <p className="eyebrow">Command Center</p>
          <h1 id="command-center-title">Shortest safe path from task to review</h1>
        </div>
        <p className="panel-copy">
          The shell is live, but planning, execution, and attestation are still placeholder
          surfaces until later phases wire the runtime.
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
          <button type="button" className="secondary-button" disabled>
            Execute (Phase 2)
          </button>
        </div>
        <div className="message-strip">
          <span className="status-dot" />
          <span>{lastIntentResponse?.message ?? "No task intent submitted yet."}</span>
        </div>
      </section>

      <section className="panel stack-panel" aria-labelledby="workflow-preview-title">
        <div className="panel-header">
          <p className="eyebrow">Workflow Spine</p>
          <h2 id="workflow-preview-title">Preview surfaces required for Phase 1</h2>
        </div>
        <div className="summary-grid">
          <article className="summary-card">
            <h3>Plan Summary</h3>
            <p>{deferredComposerValue || "Awaiting task input."}</p>
          </article>
          <article className="summary-card">
            <h3>Manifest Summary</h3>
            <p>Typed manifest inspection will appear here once compile starts in Phase 2.</p>
          </article>
          <article className="summary-card">
            <h3>Risk Summary</h3>
            <p>Current shell posture: local-first, explicit approval for risky actions.</p>
          </article>
          <article className="summary-card">
            <h3>Simulation Summary</h3>
            <p>No simulation yet. The layout reserves the exact review surface now.</p>
          </article>
          <article className="summary-card">
            <h3>Approval Region</h3>
            <p>Pending approvals will surface here with scope and route context.</p>
          </article>
          <article className="summary-card">
            <h3>Run Output / Result</h3>
            <p>Runtime output is not active yet; this panel anchors the future result stream.</p>
          </article>
          <article className="summary-card">
            <h3>Review / Attestation</h3>
            <p>Structured attestation remains blocked on execution in later phases.</p>
          </article>
        </div>
      </section>

      <section className="panel stack-panel" aria-labelledby="details-rail-surfaces">
        <div className="panel-header">
          <p className="eyebrow">Collapsed Detail Rail</p>
          <h2 id="details-rail-surfaces">Secondary operational surfaces</h2>
        </div>
        <div className="rail-preview-grid">
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
