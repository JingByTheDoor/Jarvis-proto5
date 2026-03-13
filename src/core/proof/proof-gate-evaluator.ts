import type {
  WorkflowProofGateStatus,
  WorkflowProofRecord
} from "../schemas";

const minimumGoldenWorkflowSamples = 3;
const minimumResumeWorkflowSamples = 1;
const comparisonWindowSize = 3;
const maximumRecentMedianWorkflowSteps = 4;
const maximumRecentMedianOperatorClicks = 5;

const proofGateAssumptionNote =
  "Assumption: proof-gate evaluation uses guided operator captures only. Candidate_ready requires at least 3 recent golden edit journeys, 1 resumed review_ready journey, 6 qualifying samples for trend checks, resumed task-to-preview speed no worse than the overall golden-workflow median, and recent medians at or below 4 workflow steps and 5 operator clicks.";

type WorkflowProofGateCriterion = WorkflowProofGateStatus["stability"];
type WorkflowProofGateCriterionInput = Pick<
  WorkflowProofGateCriterion,
  "status" | "detail"
> &
  Partial<
    Pick<
      WorkflowProofGateCriterion,
      | "sample_count"
      | "required_sample_count"
      | "satisfied_count"
      | "required_satisfied_count"
      | "recent_median"
      | "previous_median"
      | "threshold_median"
    >
  >;

function createCriterion(
  input: WorkflowProofGateCriterionInput
): WorkflowProofGateCriterion {
  return {
    status: input.status,
    detail: input.detail,
    sample_count: input.sample_count ?? null,
    required_sample_count: input.required_sample_count ?? null,
    satisfied_count: input.satisfied_count ?? null,
    required_satisfied_count: input.required_satisfied_count ?? null,
    recent_median: input.recent_median ?? null,
    previous_median: input.previous_median ?? null,
    threshold_median: input.threshold_median ?? null
  };
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sortedValues = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 1) {
    return sortedValues[midpoint] ?? null;
  }

  return Math.round(
    ((sortedValues[midpoint - 1] ?? 0) + (sortedValues[midpoint] ?? 0)) / 2
  );
}

function evaluateRecentSuccess(
  records: readonly WorkflowProofRecord[]
): WorkflowProofGateCriterion {
  const recentRecords = records.slice(0, comparisonWindowSize);
  const reviewReadyCount = recentRecords.filter(
    (record) => record.workflow_state === "review_ready"
  ).length;

  if (recentRecords.length < minimumGoldenWorkflowSamples) {
    return createCriterion({
      status: "not_enough_data",
      detail: "Need at least 3 recent golden edit journeys before stability can be judged.",
      sample_count: recentRecords.length,
      required_sample_count: minimumGoldenWorkflowSamples,
      satisfied_count: reviewReadyCount,
      required_satisfied_count: minimumGoldenWorkflowSamples
    });
  }

  if (reviewReadyCount === recentRecords.length) {
    return createCriterion({
      status: "on_track",
      detail: "The latest 3 golden edit journeys all reached review_ready.",
      sample_count: recentRecords.length,
      required_sample_count: minimumGoldenWorkflowSamples,
      satisfied_count: reviewReadyCount,
      required_satisfied_count: minimumGoldenWorkflowSamples
    });
  }

  return createCriterion({
    status: "attention_needed",
    detail: "One or more of the latest 3 golden edit journeys did not reach review_ready.",
    sample_count: recentRecords.length,
    required_sample_count: minimumGoldenWorkflowSamples,
    satisfied_count: reviewReadyCount,
    required_satisfied_count: minimumGoldenWorkflowSamples
  });
}

function evaluateTrend(
  label: string,
  values: readonly number[],
  options?: {
    readonly maximumRecentMedian?: number;
  }
): WorkflowProofGateCriterion {
  const recentValues = values.slice(0, comparisonWindowSize);
  const previousValues = values.slice(comparisonWindowSize, comparisonWindowSize * 2);
  const thresholdMedian = options?.maximumRecentMedian ?? null;

  if (recentValues.length < comparisonWindowSize || previousValues.length < comparisonWindowSize) {
    return createCriterion({
      status: "not_enough_data",
      detail: `Need 6 ${label} samples before a local trend can be compared.`,
      sample_count: values.length,
      required_sample_count: comparisonWindowSize * 2,
      threshold_median: thresholdMedian
    });
  }

  const recentMedian = median(recentValues);
  const previousMedian = median(previousValues);

  if (recentMedian === null || previousMedian === null) {
    return createCriterion({
      status: "not_enough_data",
      detail: `Need 6 ${label} samples before a local trend can be compared.`,
      sample_count: values.length,
      required_sample_count: comparisonWindowSize * 2,
      threshold_median: thresholdMedian
    });
  }

  if (
    typeof options?.maximumRecentMedian === "number" &&
    recentMedian > options.maximumRecentMedian
  ) {
    return createCriterion({
      status: "attention_needed",
      detail: `Recent ${label} median (${recentMedian}) is above the local proof-gate threshold (${options.maximumRecentMedian}).`,
      sample_count: values.length,
      required_sample_count: comparisonWindowSize * 2,
      recent_median: recentMedian,
      previous_median: previousMedian,
      threshold_median: thresholdMedian
    });
  }

  if (recentMedian <= previousMedian) {
    return createCriterion({
      status: "on_track",
      detail: `Recent ${label} median (${recentMedian}) is no worse than the previous window (${previousMedian}).`,
      sample_count: values.length,
      required_sample_count: comparisonWindowSize * 2,
      recent_median: recentMedian,
      previous_median: previousMedian,
      threshold_median: thresholdMedian
    });
  }

  return createCriterion({
    status: "attention_needed",
    detail: `Recent ${label} median (${recentMedian}) regressed above the previous window (${previousMedian}).`,
    sample_count: values.length,
    required_sample_count: comparisonWindowSize * 2,
    recent_median: recentMedian,
    previous_median: previousMedian,
    threshold_median: thresholdMedian
  });
}

function evaluateRepeatTaskSpeed(
  records: readonly WorkflowProofRecord[]
): WorkflowProofGateCriterion {
  const resumedValues = records.flatMap((record) =>
    record.resume_used && typeof record.task_to_preview_ms === "number"
      ? [record.task_to_preview_ms]
      : []
  );
  const baselineValues = records.flatMap((record) =>
    typeof record.task_to_preview_ms === "number" ? [record.task_to_preview_ms] : []
  );

  if (resumedValues.length < minimumResumeWorkflowSamples || baselineValues.length === 0) {
    return createCriterion({
      status: "not_enough_data",
      detail: "Need at least 1 resumed golden edit journey before repeat-task speed can be judged.",
      sample_count: resumedValues.length,
      required_sample_count: minimumResumeWorkflowSamples
    });
  }

  const resumedMedian = median(resumedValues);
  const baselineMedian = median(baselineValues);

  if (resumedMedian === null || baselineMedian === null) {
    return createCriterion({
      status: "not_enough_data",
      detail: "Need at least 1 resumed golden edit journey before repeat-task speed can be judged.",
      sample_count: resumedValues.length,
      required_sample_count: minimumResumeWorkflowSamples
    });
  }

  if (resumedMedian <= baselineMedian) {
    return createCriterion({
      status: "on_track",
      detail: `Resumed task-to-preview median (${resumedMedian}) is no worse than the overall golden-workflow median (${baselineMedian}).`,
      sample_count: resumedValues.length,
      required_sample_count: minimumResumeWorkflowSamples,
      recent_median: resumedMedian,
      previous_median: baselineMedian
    });
  }

  return createCriterion({
    status: "attention_needed",
    detail: `Resumed task-to-preview median (${resumedMedian}) is slower than the overall golden-workflow median (${baselineMedian}).`,
    sample_count: resumedValues.length,
    required_sample_count: minimumResumeWorkflowSamples,
    recent_median: resumedMedian,
    previous_median: baselineMedian
  });
}

function evaluateResumeHelpfulness(
  records: readonly WorkflowProofRecord[]
): WorkflowProofGateCriterion {
  const resumedJourneys = records.filter((record) => record.resume_used);
  const resumedReviewReadyCount = resumedJourneys.filter(
    (record) => record.workflow_state === "review_ready"
  ).length;

  if (resumedJourneys.length < minimumResumeWorkflowSamples) {
    return createCriterion({
      status: "not_enough_data",
      detail: "Need at least 1 resumed journey before helpfulness can be judged.",
      sample_count: resumedJourneys.length,
      required_sample_count: minimumResumeWorkflowSamples,
      satisfied_count: resumedReviewReadyCount,
      required_satisfied_count: minimumResumeWorkflowSamples
    });
  }

  if (resumedReviewReadyCount > 0) {
    return createCriterion({
      status: "on_track",
      detail: "At least one resumed journey reached review_ready.",
      sample_count: resumedJourneys.length,
      required_sample_count: minimumResumeWorkflowSamples,
      satisfied_count: resumedReviewReadyCount,
      required_satisfied_count: minimumResumeWorkflowSamples
    });
  }

  return createCriterion({
    status: "attention_needed",
    detail: "Resume has been used, but none of the resumed journeys reached review_ready yet.",
    sample_count: resumedJourneys.length,
    required_sample_count: minimumResumeWorkflowSamples,
    satisfied_count: resumedReviewReadyCount,
    required_satisfied_count: minimumResumeWorkflowSamples
  });
}

export function evaluateWorkflowProofGate(
  records: readonly WorkflowProofRecord[]
): WorkflowProofGateStatus {
  const goldenRecords = records.filter(
    (record) => record.journey_kind === "golden_edit_workflow"
  );
  const stability = evaluateRecentSuccess(goldenRecords);
  const taskToPreviewTrend = evaluateTrend(
    "task-to-preview",
    goldenRecords.flatMap((record) =>
      typeof record.task_to_preview_ms === "number" ? [record.task_to_preview_ms] : []
    )
  );
  const previewToApprovalTrend = evaluateTrend(
    "preview-to-approval",
    goldenRecords.flatMap((record) =>
      typeof record.preview_to_approval_ms === "number" ? [record.preview_to_approval_ms] : []
    )
  );
  const approvalToFirstResultTrend = evaluateTrend(
    "approval-to-first-result",
    goldenRecords.flatMap((record) =>
      typeof record.approval_to_first_result_ms === "number"
        ? [record.approval_to_first_result_ms]
          : []
    )
  );
  const stepCountTrend = evaluateTrend(
    "workflow-step",
    goldenRecords.map((record) => record.workflow_step_count),
    {
      maximumRecentMedian: maximumRecentMedianWorkflowSteps
    }
  );
  const clickCountTrend = evaluateTrend(
    "operator-click",
    goldenRecords.map((record) => record.operator_click_count),
    {
      maximumRecentMedian: maximumRecentMedianOperatorClicks
    }
  );
  const repeatTaskSpeed = evaluateRepeatTaskSpeed(goldenRecords);
  const resumeHelpfulness = evaluateResumeHelpfulness(records);
  const criteria = [
    stability,
    taskToPreviewTrend,
    previewToApprovalTrend,
    approvalToFirstResultTrend,
    stepCountTrend,
    clickCountTrend,
    repeatTaskSpeed,
    resumeHelpfulness
  ];
  const blockingReasons = criteria
    .filter((criterion) => criterion.status !== "on_track")
    .map((criterion) => criterion.detail);

  const allCriteriaOnTrack =
    stability.status === "on_track" &&
    taskToPreviewTrend.status === "on_track" &&
    previewToApprovalTrend.status === "on_track" &&
    approvalToFirstResultTrend.status === "on_track" &&
    stepCountTrend.status === "on_track" &&
    clickCountTrend.status === "on_track" &&
    repeatTaskSpeed.status === "on_track" &&
    resumeHelpfulness.status === "on_track";

  return {
    overall_status: criteria.some((criterion) => criterion.status === "attention_needed")
      ? "blocked"
      : allCriteriaOnTrack
        ? "candidate_ready"
        : "collecting_evidence",
    blocking_reasons: blockingReasons,
    stability,
    task_to_preview_trend: taskToPreviewTrend,
    preview_to_approval_trend: previewToApprovalTrend,
    approval_to_first_result_trend: approvalToFirstResultTrend,
    step_count_trend: stepCountTrend,
    click_count_trend: clickCountTrend,
    repeat_task_speed: repeatTaskSpeed,
    resume_helpfulness: resumeHelpfulness,
    assumption_note: proofGateAssumptionNote
  };
}
