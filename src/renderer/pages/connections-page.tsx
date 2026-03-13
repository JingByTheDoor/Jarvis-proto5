import type { PlannerStatusResponse } from "../../shared/ipc";

export interface ConnectionsPageProps {
  readonly plannerStatus: PlannerStatusResponse | null;
  readonly plannerError: string | null;
}

function formatStatusLabel(value: string): string {
  return value.replaceAll("_", " ");
}

export function ConnectionsPage(props: ConnectionsPageProps) {
  const { plannerStatus, plannerError } = props;

  return (
    <section className="page-section" aria-labelledby="connections-title">
      <div className="panel-header">
        <p className="eyebrow">Connections</p>
        <h1 id="connections-title">Adapters stay visible even when unavailable</h1>
      </div>
      <div className="summary-grid">
        <article className="summary-card">
          <h3>Planner Provider</h3>
          <p>
            {plannerStatus
              ? `${plannerStatus.provider_kind} (${formatStatusLabel(plannerStatus.mode)})`
              : "Planner provider health has not loaded yet."}
          </p>
          <p>
            {plannerStatus
              ? `Configured: ${plannerStatus.configured ? "yes" : "no"} | Reachable: ${plannerStatus.reachable ? "yes" : "no"}`
              : plannerError ?? "Connections remain non-blocking when optional adapters are unavailable."}
          </p>
        </article>
        <article className="summary-card">
          <h3>Configuration Awareness</h3>
          <p>
            {plannerStatus?.model_name
              ? `Model: ${plannerStatus.model_name}`
              : "No model is selected while the null adapter is active."}
          </p>
          <p>
            {plannerStatus?.endpoint_url
              ? `Endpoint: ${plannerStatus.endpoint_url}`
              : "Local planner endpoint visibility appears here when a provider is configured."}
          </p>
        </article>
        <article className="summary-card summary-card-wide">
          <h3>Health Payload</h3>
          <p>
            Adapter: {plannerStatus?.adapter_name ?? "pending"} | Last check:{" "}
            {plannerStatus?.last_check_at ?? "not checked yet"}
          </p>
          <p>
            Read available: {plannerStatus?.read_available ? "yes" : "no"} | Write available:{" "}
            {plannerStatus?.write_available ? "yes" : "no"}
          </p>
          <p>
            Available models:{" "}
            {plannerStatus?.available_models.length
              ? plannerStatus.available_models.join(", ")
              : "none discovered"}
          </p>
        </article>
        <article className="summary-card summary-card-wide">
          <h3>Null Adapter State</h3>
          <p>
            {plannerStatus?.mode === "null_adapter"
              ? "The null adapter is active. Base workflows still run through deterministic typed tools."
              : "Optional planner assistance stays visible but non-blocking; core workflows do not depend on it."}
          </p>
          <p>
            {plannerStatus?.notes.join(" ") ??
              "Adapter notes will appear here once a planner health snapshot is available."}
          </p>
        </article>
      </div>
    </section>
  );
}
