import path from "node:path";

import type {
  ApprovalDecisionKind,
  ApprovalScopeClass,
  PreviewConfidence,
  RiskLevel,
  SideEffectFamily
} from "../../shared/constants";
import type { ApprovalRequest, DiffPreview, SimulationSummary } from "../../shared/ipc";
import type { CompiledAction, EffectPreview } from "../schemas";

export interface RiskAssessment {
  readonly risk_level: RiskLevel;
  readonly requires_approval: boolean;
  readonly allowed_scope_classes: ApprovalScopeClass[];
  readonly decision_options: ApprovalDecisionKind[];
  readonly justification: string;
}

export interface SimulationBundle {
  readonly compiled_actions: CompiledAction[];
  readonly effect_previews: EffectPreview[];
  readonly approval_requests: ApprovalRequest[];
  readonly simulation_summary: SimulationSummary;
}

function getPrimaryPath(compiledAction: CompiledAction): string {
  return (
    compiledAction.path_scope.entries[0]?.path ??
    String(
      compiledAction.normalized_args.path ??
        compiledAction.normalized_args.repository_path ??
        compiledAction.workspace_scope.roots[0]
    )
  );
}

function getPrimarySideEffectFamily(compiledAction: CompiledAction): SideEffectFamily {
  return compiledAction.expected_side_effects[0]?.family ?? "readonly";
}

function hasNonReadOnlyEffects(effectPreview: EffectPreview): boolean {
  return (
    effectPreview.predicted_writes.length > 0 ||
    effectPreview.predicted_deletes.length > 0 ||
    effectPreview.predicted_process_changes.length > 0 ||
    effectPreview.predicted_remote_calls.length > 0 ||
    effectPreview.predicted_system_changes.length > 0
  );
}

function isApprovedOutputPath(
  targetPath: string,
  workspaceRoots: readonly string[]
): boolean {
  const normalizedTarget = targetPath.replace(/\//g, "\\");

  return workspaceRoots.some((workspaceRoot) => {
    const relativePath = path.win32.relative(workspaceRoot, normalizedTarget);
    if (
      relativePath === "" ||
      relativePath.startsWith("..") ||
      path.win32.isAbsolute(relativePath)
    ) {
      return false;
    }

    const normalizedRelativePath = relativePath.toLowerCase().replace(/\//g, "\\");
    return /(^|\\)(\.tmp|dist|build|out|output)(\\|$)/.test(normalizedRelativePath);
  });
}

export function createEffectPreview(
  compiledAction: CompiledAction,
  diffPreviews: readonly DiffPreview[] = []
): EffectPreview {
  const targetPath = getPrimaryPath(compiledAction);
  const sideEffectFamily = getPrimarySideEffectFamily(compiledAction);
  const matchingDiffPreview = diffPreviews.find((preview) => preview.path === targetPath);

  switch (compiledAction.tool_name) {
    case "list_directory":
      return {
        action_id: compiledAction.action_id,
        predicted_reads: [targetPath],
        predicted_writes: [],
        predicted_deletes: [],
        predicted_process_changes: [],
        predicted_remote_calls: [],
        predicted_system_changes: [],
        confidence: "high",
        notes: ["Tier A exact simulation will read the approved workspace directory listing."]
      };
    case "read_text_file":
      return {
        action_id: compiledAction.action_id,
        predicted_reads: [targetPath],
        predicted_writes: [],
        predicted_deletes: [],
        predicted_process_changes: [],
        predicted_remote_calls: [],
        predicted_system_changes: [],
        confidence: "high",
        notes: ["Tier A exact simulation will read the approved text file only."]
      };
    case "git_status":
    case "git_diff":
      return {
        action_id: compiledAction.action_id,
        predicted_reads: [String(compiledAction.normalized_args.repository_path ?? targetPath)],
        predicted_writes: [],
        predicted_deletes: [],
        predicted_process_changes: [],
        predicted_remote_calls: [],
        predicted_system_changes: [],
        confidence: "high",
        notes: ["Tier A exact simulation stays read-only and inspects local git metadata."]
      };
    case "diff_file":
      return {
        action_id: compiledAction.action_id,
        predicted_reads: [targetPath],
        predicted_writes: [],
        predicted_deletes: [],
        predicted_process_changes: [],
        predicted_remote_calls: [],
        predicted_system_changes: [],
        confidence: "high",
        notes: ["Tier A exact simulation generates a deterministic diff preview without writing."]
      };
    case "write_text_file":
      return {
        action_id: compiledAction.action_id,
        predicted_reads: matchingDiffPreview?.status === "modified" ? [targetPath] : [],
        predicted_writes: [targetPath],
        predicted_deletes: [],
        predicted_process_changes: [],
        predicted_remote_calls: [],
        predicted_system_changes: [],
        confidence: matchingDiffPreview ? "high" : "medium",
        notes: matchingDiffPreview
          ? [
              `Exact diff preview available (${matchingDiffPreview.status}).`,
              matchingDiffPreview.status === "modified"
                ? "Simulation predicts an overwrite of an existing file."
                : "Simulation predicts file creation in the approved workspace."
            ]
          : [
              "Simulation inferred the write target from compiled args without an exact diff preview."
            ]
      };
    default:
      return {
        action_id: compiledAction.action_id,
        predicted_reads: sideEffectFamily === "readonly" ? [targetPath] : [],
        predicted_writes: sideEffectFamily === "workspace_write" ? [targetPath] : [],
        predicted_deletes: sideEffectFamily === "workspace_delete" ? [targetPath] : [],
        predicted_process_changes:
          sideEffectFamily === "process_launch" || sideEffectFamily === "process_terminate"
            ? [targetPath]
            : [],
        predicted_remote_calls:
          sideEffectFamily === "remote_read" || sideEffectFamily === "remote_write"
            ? [targetPath]
            : [],
        predicted_system_changes: sideEffectFamily === "system_mutation" ? [targetPath] : [],
        confidence: "low",
        notes: ["Simulation coverage for this tool is not implemented yet."]
      };
  }
}

export function classifyRisk(
  compiledAction: CompiledAction,
  effectPreview: EffectPreview
): RiskAssessment {
  const sideEffectFamily = getPrimarySideEffectFamily(compiledAction);
  const writeTarget = effectPreview.predicted_writes[0];
  const isOverwrite = effectPreview.predicted_reads.includes(writeTarget ?? "");

  if (effectPreview.confidence === "low" && hasNonReadOnlyEffects(effectPreview)) {
    return {
      risk_level: "DANGER",
      requires_approval: true,
      allowed_scope_classes: ["exact_action_only", "never_session_approvable"],
      decision_options: ["deny", "approve_once"],
      justification:
        "Simulation confidence is low while non-read-only effects remain possible, so the action must escalate to DANGER."
    };
  }

  switch (sideEffectFamily) {
    case "readonly":
      return {
        risk_level: "SAFE",
        requires_approval: false,
        allowed_scope_classes: ["exact_action_only", "session_readonly_scope"],
        decision_options: ["deny", "approve_session"],
        justification:
          "The compiled action is read-only and the simulation preview is exact, so the action remains SAFE."
      };
    case "workspace_write":
      if (
        isOverwrite &&
        !isApprovedOutputPath(writeTarget ?? "", compiledAction.workspace_scope.roots)
      ) {
        return {
          risk_level: "DANGER",
          requires_approval: true,
          allowed_scope_classes: ["exact_action_only", "never_session_approvable"],
          decision_options: ["deny", "approve_once"],
          justification:
            "The exact simulation preview shows an overwrite outside approved temp/output paths, which is classified as DANGER."
        };
      }

      return {
        risk_level: "CAUTION",
        requires_approval: true,
        allowed_scope_classes: ["exact_action_only"],
        decision_options: ["deny", "approve_once"],
        justification:
          "The action writes within the approved workspace and the simulation preview is bounded, so it remains CAUTION."
      };
    case "workspace_delete":
    case "process_terminate":
    case "system_mutation":
    case "credential_use":
    case "remote_write":
    case "raw_shell_mutating":
      return {
        risk_level: "DANGER",
        requires_approval: true,
        allowed_scope_classes: ["exact_action_only", "never_session_approvable"],
        decision_options: ["deny", "approve_once"],
        justification:
          "The compiled action belongs to a destructive or high-impact side-effect family, so it is classified as DANGER."
      };
    case "raw_shell_readonly":
    case "remote_read":
    case "process_launch":
      return {
        risk_level: "CAUTION",
        requires_approval: true,
        allowed_scope_classes: ["exact_action_only"],
        decision_options: ["deny", "approve_once"],
        justification:
          "The compiled action is non-destructive but still broader than local read-only typed tools, so it remains CAUTION."
      };
    default:
      return {
        risk_level: "CAUTION",
        requires_approval: true,
        allowed_scope_classes: ["exact_action_only"],
        decision_options: ["deny", "approve_once"],
        justification:
          "The compiled action is not yet covered by an exact low-risk simulation rule, so it defaults to CAUTION."
      };
  }
}

export function buildApprovalRequest(input: {
  readonly compiled_action: CompiledAction;
  readonly risk_assessment: RiskAssessment;
  readonly session_id: string;
  readonly expires_at: string;
}): ApprovalRequest | null {
  if (!input.risk_assessment.requires_approval) {
    return null;
  }

  return {
    action_id: input.compiled_action.action_id,
    risk_level: input.risk_assessment.risk_level,
    decision_options: input.risk_assessment.decision_options,
    allowed_scope_classes: input.risk_assessment.allowed_scope_classes,
    approval_signature: input.compiled_action.approval_signature,
    execution_hash: input.compiled_action.execution_hash,
    max_execution_count: 1,
    session_id: input.session_id,
    expires_at: input.expires_at,
    path_scope: input.compiled_action.path_scope,
    network_scope: input.compiled_action.network_scope,
    side_effect_family: getPrimarySideEffectFamily(input.compiled_action),
    justification: input.risk_assessment.justification
  };
}

export function buildSimulationSummary(input: {
  readonly effect_previews: readonly EffectPreview[];
  readonly approval_requests: readonly ApprovalRequest[];
  readonly compiled_actions: readonly CompiledAction[];
}): SimulationSummary {
  const highest_risk =
    input.compiled_actions.find((action) => action.risk_level === "DANGER")?.risk_level ??
    input.compiled_actions.find((action) => action.risk_level === "CAUTION")?.risk_level ??
    "SAFE";

  const confidenceBreakdown = input.effect_previews.reduce(
    (totals, preview) => {
      totals[preview.confidence] += 1;
      return totals;
    },
    { high: 0, medium: 0, low: 0 } as Record<PreviewConfidence, number>
  );

  return {
    highest_risk,
    approval_required: input.approval_requests.length > 0,
    preview_count: input.effect_previews.length,
    confidence_breakdown: confidenceBreakdown,
    notes: [
      "Simulation runs after compile and before approval.",
      input.approval_requests.length > 0
        ? `${input.approval_requests.length} action(s) require explicit approval.`
        : "No approval is required for the current simulated slice."
    ]
  };
}

export function simulateCompiledActions(input: {
  readonly compiled_actions: readonly CompiledAction[];
  readonly diff_previews?: readonly DiffPreview[];
  readonly session_id: string;
  readonly expires_at: string;
}): SimulationBundle {
  const effect_previews = input.compiled_actions.map((compiledAction) =>
    createEffectPreview(compiledAction, input.diff_previews)
  );

  const compiled_actions = input.compiled_actions.map((compiledAction, index) => {
    const riskAssessment = classifyRisk(compiledAction, effect_previews[index]);
    return {
      ...compiledAction,
      risk_level: riskAssessment.risk_level,
      requires_approval: riskAssessment.requires_approval
    };
  });

  const approval_requests = compiled_actions
    .map((compiledAction, index) =>
      buildApprovalRequest({
        compiled_action: compiledAction,
        risk_assessment: classifyRisk(compiledAction, effect_previews[index]),
        session_id: input.session_id,
        expires_at: input.expires_at
      })
    )
    .filter((request): request is ApprovalRequest => request !== null);

  return {
    compiled_actions,
    effect_previews,
    approval_requests,
    simulation_summary: buildSimulationSummary({
      effect_previews,
      approval_requests,
      compiled_actions
    })
  };
}
