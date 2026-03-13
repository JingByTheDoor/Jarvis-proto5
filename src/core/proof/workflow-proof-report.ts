import type {
  WorkflowProofGateStatus,
  WorkflowProofRecord,
  WorkflowProofReport,
  WorkflowProofSummary
} from "../schemas";
import { WorkflowProofReportSchema } from "../schemas";

interface WorkflowProofReportInput {
  readonly workspace_root: string;
  readonly generated_at: string;
  readonly summary: WorkflowProofSummary;
  readonly gate_status: WorkflowProofGateStatus;
  readonly recent_journeys: readonly WorkflowProofRecord[];
}

function formatMetric(value: number | null, suffix: string): string {
  return value === null ? "not enough local data yet" : `${value}${suffix}`;
}

function formatCountLine(
  label: string,
  observedCount: number | null,
  requiredCount: number | null
): string | null {
  if (typeof observedCount !== "number" || typeof requiredCount !== "number") {
    return null;
  }

  return `- ${label}: ${observedCount} / ${requiredCount}`;
}

function renderCriterionSection(
  label: string,
  criterion: WorkflowProofGateStatus["stability"],
  options?: {
    readonly sampleLabel?: string;
    readonly satisfiedLabel?: string;
  }
): string[] {
  const lines = [
    `### ${label}`,
    `- Status: ${criterion.status}`,
    `- Detail: ${criterion.detail}`
  ];
  const sampleLine = formatCountLine(
    options?.sampleLabel ?? "Samples",
    criterion.sample_count,
    criterion.required_sample_count
  );
  const satisfiedLine = formatCountLine(
    options?.satisfiedLabel ?? "Satisfied",
    criterion.satisfied_count,
    criterion.required_satisfied_count
  );

  if (sampleLine) {
    lines.push(sampleLine);
  }

  if (satisfiedLine) {
    lines.push(satisfiedLine);
  }

  if (typeof criterion.recent_median === "number") {
    lines.push(`- Recent median: ${criterion.recent_median} ms`);
  }

  if (typeof criterion.previous_median === "number") {
    lines.push(`- Previous median: ${criterion.previous_median} ms`);
  }

  if (typeof criterion.threshold_median === "number") {
    lines.push(`- Threshold median: <= ${criterion.threshold_median}`);
  }

  return lines;
}

function renderRecentJourneys(journeys: readonly WorkflowProofRecord[]): string[] {
  if (journeys.length === 0) {
    return ["## Recent Journeys", "- No local proof journeys have been recorded yet."];
  }

  const lines = ["## Recent Journeys"];

  for (const journey of journeys) {
    lines.push(`### ${journey.journey_id}`);
    lines.push(`- Kind: ${journey.journey_kind}`);
    lines.push(`- State: ${journey.workflow_state ?? "collecting"}`);
    lines.push(`- Route: ${journey.route_kind ?? "pending"}`);
    lines.push(`- Resume used: ${journey.resume_used ? "yes" : "no"}`);
    lines.push(
      `- Steps / Clicks: ${journey.workflow_step_count} / ${journey.operator_click_count}`
    );
    lines.push(`- Updated at: ${journey.updated_at}`);
  }

  return lines;
}

export function createWorkflowProofReport(
  input: WorkflowProofReportInput
): WorkflowProofReport {
  const { workspace_root, generated_at, summary, gate_status, recent_journeys } = input;
  const reportSections = [
    "# Workflow Proof Report",
    `- Generated at: ${generated_at}`,
    `- Workspace: ${workspace_root}`,
    `- Overall gate: ${gate_status.overall_status}`,
    "",
    "## Summary",
    `- Golden workflow review_ready: ${summary.golden_workflow_review_ready} / ${summary.golden_workflow_attempts}`,
    `- Stability rate: ${summary.golden_workflow_stability_rate}`,
    `- Cold start -> composer median: ${formatMetric(summary.median_cold_start_to_composer_ms, " ms")}`,
    `- Task -> preview median: ${formatMetric(summary.median_task_to_preview_ms, " ms")}`,
    `- Preview -> approval median: ${formatMetric(summary.median_preview_to_approval_ms, " ms")}`,
    `- Approval -> first result median: ${formatMetric(summary.median_approval_to_first_result_ms, " ms")}`,
    `- Execute -> first result median: ${formatMetric(summary.median_execute_to_first_result_ms, " ms")}`,
    `- Workflow steps median: ${formatMetric(summary.median_workflow_step_count, "")}`,
    `- Operator clicks median: ${formatMetric(summary.median_operator_click_count, "")}`,
    `- Repeat task -> preview median: ${formatMetric(summary.median_repeat_task_to_preview_ms, " ms")}`,
    `- Resumed journeys reaching review_ready: ${summary.resume_review_ready} / ${summary.resume_journeys}`,
    "",
    "## Gate Criteria",
    ...renderCriterionSection("Stability", gate_status.stability, {
      sampleLabel: "Window samples",
      satisfiedLabel: "Review-ready in window"
    }),
    ...renderCriterionSection("Task -> Preview", gate_status.task_to_preview_trend, {
      sampleLabel: "Trend samples"
    }),
    ...renderCriterionSection(
      "Preview -> Approval",
      gate_status.preview_to_approval_trend,
      {
        sampleLabel: "Trend samples"
      }
    ),
    ...renderCriterionSection(
      "Approval -> First Result",
      gate_status.approval_to_first_result_trend,
      {
        sampleLabel: "Trend samples"
      }
    ),
    ...renderCriterionSection("Workflow Steps", gate_status.step_count_trend, {
      sampleLabel: "Trend samples"
    }),
    ...renderCriterionSection("Operator Clicks", gate_status.click_count_trend, {
      sampleLabel: "Trend samples"
    }),
    ...renderCriterionSection("Repeat-task Speed", gate_status.repeat_task_speed, {
      sampleLabel: "Resumed samples"
    }),
    ...renderCriterionSection(
      "Resume Helpfulness",
      gate_status.resume_helpfulness,
      {
        sampleLabel: "Resumed journeys",
        satisfiedLabel: "Review-ready resumed journeys"
      }
    ),
    "",
    "## Blocking Reasons",
    ...(gate_status.blocking_reasons.length > 0
      ? gate_status.blocking_reasons.map((reason) => `- ${reason}`)
      : ["- None recorded."]),
    "",
    ...renderRecentJourneys(recent_journeys),
    "",
    "## Assumption Note",
    gate_status.assumption_note
  ];

  return WorkflowProofReportSchema.parse({
    workspace_root,
    generated_at,
    summary,
    gate_status,
    recent_journeys,
    report_markdown: reportSections.join("\n")
  });
}
