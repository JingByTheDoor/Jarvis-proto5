import { createHash } from "node:crypto";
import path from "node:path";

import type {
  Action,
  CompiledAction,
  ExecutionManifest,
  PlannerAssistance,
  Plan,
  PolicySnapshot,
  ToolResult
} from "../schemas";
import { DefaultCanonicalPathPolicy } from "../capabilities/canonical-path-policy";
import {
  createApprovalSignature,
  createExecutionHash,
  createManifestHash
} from "../approval/hashes";
import {
  assertToolSideEffectFamily,
  assertWorkspaceScope,
  validateNormalizedToolArgs
} from "./compile-guards";
import { simulateCompiledActions } from "../simulation/simulation-engine";
import type {
  DiffPreview,
  TaskIntentRequest,
  TaskIntentResponse,
  TaskRoute
} from "../../shared/ipc";
import {
  parseGuardedShellInstruction,
  parseSupportedEditInstruction,
  routeTaskIntent,
  shouldAttemptPlannerNormalization
} from "../planning/task-routing";
import {
  classifyShellCommand
} from "../tools/guarded-shell-tool";
import { toolRegistry, type SupportedToolName } from "../tools/tool-registry";
import type { TaskPlanner } from "../integrations/task-planner";

export interface TaskPreviewOptions {
  readonly planner?: TaskPlanner;
}

interface PreviewTaskContext {
  readonly originalTask: string;
  readonly effectiveTask: string;
  readonly plannerAssistance: PlannerAssistance;
}

function deterministicId(prefix: string, seed: string): string {
  return `${prefix}-${createHash("sha256").update(seed).digest("hex").slice(0, 12)}`;
}

function addMinutes(isoTimestamp: string, minutes: number): string {
  const timestamp = new Date(isoTimestamp);
  timestamp.setUTCMinutes(timestamp.getUTCMinutes() + minutes);
  return timestamp.toISOString();
}

function createPolicySnapshot(generatedAt: string): PolicySnapshot {
  return {
    version: "phase-6-planner-assist",
    workflow: "PLAN -> COMPILE -> SIMULATE -> APPROVAL -> EXECUTE -> ATTEST -> REVIEW",
    routing_mode: "local_first_stubbed",
    generated_at: generatedAt
  };
}

function createPlannerAssistance(
  input: PreviewTaskContext["plannerAssistance"]
): PlannerAssistance {
  return {
    ...input,
    notes: [...input.notes],
    provider_status: {
      ...input.provider_status,
      available_models: [...input.provider_status.available_models],
      notes: [...input.provider_status.notes]
    }
  };
}

function createNotRequestedPlannerAssistance(
  task: string,
  planner?: TaskPlanner
): PlannerAssistance {
  const providerStatus =
    planner?.getCachedStatus() ?? {
      adapter_name: "planner.null_adapter",
      provider_kind: "null_adapter",
      configured: false,
      reachable: false,
      last_check_at: null,
      mode: "null_adapter",
      read_available: false,
      write_available: false,
      model_name: null,
      endpoint_url: null,
      available_models: [],
      notes: [
        "Planner assistance is unavailable in this path, so deterministic routing stays in control."
      ],
      source: "built_in_default"
    };

  return {
    status: providerStatus.mode === "null_adapter" ? "null_adapter" : "not_requested",
    original_task: task,
    normalized_task: task,
    used_for_preview: false,
    confidence: null,
    rationale:
      "JARVIS kept the original task text because the deterministic v1 route was already sufficient or planner assistance was not requested.",
    route_hint: null,
    task_type_hint: null,
    notes: [
      "Deterministic routing stays authoritative for explicit supported patterns.",
      ...providerStatus.notes
    ],
    provider_status: providerStatus
  };
}

function applyPlannerAssistanceToRoute(
  route: TaskRoute,
  plannerAssistance: PlannerAssistance
): TaskRoute {
  if (!plannerAssistance.used_for_preview) {
    return route;
  }

  return {
    ...route,
    operator_explanation:
      route.chosen_route === "local_guarded_shell"
        ? "The local planner reduced the request into the explicit guarded-shell escape hatch, and JARVIS still kept the audited compile, simulate, approval, execute, attestation, and review workflow intact."
        : "The local planner reduced the natural-language request into a supported v1 typed-tool shape, and JARVIS kept the route on the cheapest sufficient local path."
  };
}

function appendPlannerNote(
  notes: readonly string[],
  plannerAssistance: PlannerAssistance
): string[] {
  if (!plannerAssistance.used_for_preview) {
    return [...notes];
  }

  return [
    ...notes,
    `Planner normalization: ${plannerAssistance.original_task} -> ${plannerAssistance.normalized_task}`
  ];
}

function createFailureResponse(
  request: TaskIntentRequest,
  route: TaskRoute,
  workflowState: TaskIntentResponse["workflow_state"],
  message: string,
  plannerAssistance: PlannerAssistance
): TaskIntentResponse {
  return {
    accepted: false,
    workflow_state: workflowState,
    state_trace: workflowState === "idle" ? ["idle"] : ["preparing_plan", workflowState],
    message,
    route,
    plan: null,
    manifest: null,
    effect_previews: [],
    approval_requests: [],
    simulation_summary: null,
    diff_previews: [],
    planner_assistance: createPlannerAssistance(plannerAssistance),
    preview_generated_at: request.requested_at
  };
}

function createAction(input: {
  readonly id: string;
  readonly type: string;
  readonly label: string;
  readonly description: string;
  readonly args: Record<string, unknown>;
  readonly expected_output: string;
  readonly risk: Action["risk"];
  readonly requires_approval: boolean;
  readonly approval_scope_allowed: Action["approval_scope_allowed"];
}): Action {
  return {
    ...input,
    status: "compiled"
  };
}

function compileAction(input: {
  readonly action: Action;
  readonly tool_name: SupportedToolName;
  readonly normalized_args: Record<string, unknown>;
  readonly workspace_root: string;
  readonly path_access: "read" | "write" | "read_write";
  readonly path_reason: string;
  readonly effect_family: CompiledAction["expected_side_effects"][number]["family"];
  readonly effect_detail: string;
  readonly risk_level: CompiledAction["risk_level"];
  readonly requires_approval: boolean;
  readonly session_id: string;
  readonly expires_at: string;
}): CompiledAction {
  assertWorkspaceScope(input.workspace_root, [input.workspace_root]);
  const parsedArgs = validateNormalizedToolArgs(input.tool_name, input.normalized_args);
  assertToolSideEffectFamily(input.tool_name, input.effect_family);
  const targetPath =
    String(
      parsedArgs.path ??
        parsedArgs.repository_path ??
        parsedArgs.working_directory ??
        input.workspace_root
    );
  const workspace_scope: CompiledAction["workspace_scope"] = {
    roots: [input.workspace_root]
  };
  const path_scope: CompiledAction["path_scope"] = {
    roots: [input.workspace_root],
    entries: [
      {
        path: targetPath,
        access: input.path_access,
        reason: input.path_reason
      }
    ]
  };
  const network_scope: CompiledAction["network_scope"] = {
    default_policy: "deny",
    allow: []
  };
  const expected_side_effects = [
    {
      family: input.effect_family,
      target: targetPath,
      detail: input.effect_detail
    }
  ] as const;

  return {
    action_id: input.action.id,
    tool_name: input.tool_name,
    normalized_args: parsedArgs,
    workspace_scope,
    path_scope,
    network_scope,
    expected_side_effects: [...expected_side_effects],
    expected_artifacts:
      input.tool_name === "diff_file"
        ? [
            {
              kind: "preview",
              location: targetPath,
              description: "exact diff preview"
            }
          ]
        : [],
    risk_level: input.risk_level,
    requires_approval: input.requires_approval,
    approval_signature: createApprovalSignature({
      tool_name: input.tool_name,
      normalized_args: parsedArgs,
      side_effect_family: input.effect_family,
      workspace_scope,
      path_scope,
      network_scope,
      max_execution_count: 1,
      session_id: input.session_id,
      expires_at: input.expires_at
    }),
    execution_hash: createExecutionHash({
      tool_name: input.tool_name,
      normalized_args: parsedArgs,
      workspace_scope,
      path_scope,
      network_scope,
      expected_side_effects: [...expected_side_effects]
    })
  };
}

function createManifest(input: {
  readonly request: TaskIntentRequest;
  readonly plan: Plan;
  readonly compiled_actions: readonly CompiledAction[];
  readonly policy_snapshot: PolicySnapshot;
  readonly expires_at: string;
}): ExecutionManifest {
  const run_id = deterministicId(
    "run",
    `${input.request.session_id}:${input.request.task}:${input.request.requested_at}`
  );
  const manifest_hash = createManifestHash({
    plan_id: input.plan.id,
    run_id,
    compiled_actions: input.compiled_actions,
    policy_snapshot: input.policy_snapshot,
    expires_at: input.expires_at
  });

  return {
    manifest_id: deterministicId("manifest", `${run_id}:${input.plan.id}`),
    plan_id: input.plan.id,
    run_id,
    compiled_actions: [...input.compiled_actions],
    manifest_hash,
    policy_snapshot: input.policy_snapshot,
    created_at: input.request.requested_at,
    expires_at: input.expires_at
  };
}

function applySimulationRiskSummary(
  plan: Plan,
  simulationSummary: NonNullable<TaskIntentResponse["simulation_summary"]>
): Plan {
  return {
    ...plan,
    risk_summary:
      simulationSummary.highest_risk === "SAFE"
        ? "Simulation confirmed a SAFE typed preview with exact read-only effects."
        : `Simulation classified the preview as ${simulationSummary.highest_risk} before approval.`
  };
}

function normalizeTargetPath(workspaceRoot: string, targetPath: string): string {
  if (path.win32.isAbsolute(targetPath) || path.posix.isAbsolute(targetPath)) {
    return path.win32.normalize(targetPath);
  }

  return path.win32.resolve(workspaceRoot, targetPath.replace(/\//g, "\\"));
}

function requireOkToolResult(result: ToolResult, fallbackMessage: string): ToolResult {
  if (!result.ok) {
    throw new Error(typeof result.error === "string" ? result.error : fallbackMessage);
  }

  return result;
}

function selectInspectionTarget(workspaceRoot: string): string {
  const candidates = [
    path.join(workspaceRoot, "README.md"),
    path.join(workspaceRoot, "package.json"),
    path.join(workspaceRoot, "docs", "task_plan.md")
  ];

  for (const candidate of candidates) {
    if (toolRegistry.read_text_file.execute({ path: candidate }).ok) {
      return candidate;
    }
  }

  return path.join(workspaceRoot, "package.json");
}

function buildInspectionPreview(
  request: TaskIntentRequest,
  route: TaskRoute,
  context: PreviewTaskContext
): TaskIntentResponse {
  const workspaceRoot = request.workspace_roots[0];
  const expires_at = addMinutes(request.requested_at, 15);
  const policy_snapshot = createPolicySnapshot(request.requested_at);
  const canonicalPolicy = new DefaultCanonicalPathPolicy();
  const workspaceResolution = canonicalPolicy.authorizePath(workspaceRoot, [workspaceRoot]);
  const targetResolution = canonicalPolicy.authorizePath(
    selectInspectionTarget(workspaceRoot),
    [workspaceRoot]
  );

  const actions = [
    createAction({
      id: deterministicId("action", `${request.task}:list`),
      type: "repo_list_directory",
      label: "List workspace root",
      description: "Inspect the top-level workspace layout.",
      args: { path: workspaceResolution.canonicalPath },
      expected_output: "workspace root entries",
      risk: "SAFE",
      requires_approval: false,
      approval_scope_allowed: ["exact_action_only", "session_readonly_scope"]
    }),
    createAction({
      id: deterministicId("action", `${request.task}:git-status`),
      type: "repo_git_status",
      label: "Read git status",
      description: "Inspect the current branch and working tree state.",
      args: { repository_path: workspaceResolution.canonicalPath },
      expected_output: "branch and working tree summary",
      risk: "SAFE",
      requires_approval: false,
      approval_scope_allowed: ["exact_action_only", "session_readonly_scope"]
    }),
    createAction({
      id: deterministicId("action", `${request.task}:git-diff`),
      type: "repo_git_diff",
      label: "Read git diff",
      description: "Inspect any existing uncommitted repo diff.",
      args: { repository_path: workspaceResolution.canonicalPath },
      expected_output: "repo diff summary",
      risk: "SAFE",
      requires_approval: false,
      approval_scope_allowed: ["exact_action_only", "session_readonly_scope"]
    }),
    createAction({
      id: deterministicId("action", `${request.task}:read`),
      type: "repo_read_text_file",
      label: "Read primary project file",
      description: "Read the deterministic file chosen for inspection preview.",
      args: { path: targetResolution.canonicalPath },
      expected_output: "text contents",
      risk: "SAFE",
      requires_approval: false,
      approval_scope_allowed: ["exact_action_only", "session_readonly_scope"]
    })
  ] as const;

  const plan: Plan = {
    id: deterministicId("plan", `${request.task}:${request.requested_at}`),
    user_goal: context.originalTask,
    summary: `Inspect the workspace root, current git state, and ${path.win32.basename(
      targetResolution.canonicalPath
    )} before proposing a change.`,
    planning_notes: appendPlannerNote([
      "Use typed tools first.",
      "Keep the preview read-only.",
      "Compile every preview step into a typed manifest."
    ], context.plannerAssistance),
    risk_summary: "Read-only repo inspection through typed local tools.",
    requires_approval: false,
    actions: [...actions],
    created_at: request.requested_at,
    policy_snapshot
  };

  const compiled_actions = [
    compileAction({
      action: actions[0],
      tool_name: "list_directory",
      normalized_args: { path: workspaceResolution.canonicalPath },
      workspace_root: workspaceRoot,
      path_access: "read",
      path_reason: "inspect workspace root",
      effect_family: "readonly",
      effect_detail: "list directory",
      risk_level: "SAFE",
      requires_approval: false,
      session_id: request.session_id,
      expires_at
    }),
    compileAction({
      action: actions[1],
      tool_name: "git_status",
      normalized_args: { repository_path: workspaceResolution.canonicalPath },
      workspace_root: workspaceRoot,
      path_access: "read",
      path_reason: "inspect git status",
      effect_family: "readonly",
      effect_detail: "git status",
      risk_level: "SAFE",
      requires_approval: false,
      session_id: request.session_id,
      expires_at
    }),
    compileAction({
      action: actions[2],
      tool_name: "git_diff",
      normalized_args: { repository_path: workspaceResolution.canonicalPath },
      workspace_root: workspaceRoot,
      path_access: "read",
      path_reason: "inspect existing git diff",
      effect_family: "readonly",
      effect_detail: "git diff",
      risk_level: "SAFE",
      requires_approval: false,
      session_id: request.session_id,
      expires_at
    }),
    compileAction({
      action: actions[3],
      tool_name: "read_text_file",
      normalized_args: { path: targetResolution.canonicalPath },
      workspace_root: workspaceRoot,
      path_access: "read",
      path_reason: "inspect primary project file",
      effect_family: "readonly",
      effect_detail: "read text file",
      risk_level: "SAFE",
      requires_approval: false,
      session_id: request.session_id,
      expires_at
    })
  ] as const;
  const simulationBundle = simulateCompiledActions({
    compiled_actions,
    session_id: request.session_id,
    expires_at
  });
  const routeWithRisk: TaskRoute = {
    ...route,
    risk_class: simulationBundle.simulation_summary.highest_risk
  };
  const evaluatedRoute = applyPlannerAssistanceToRoute(
    routeWithRisk,
    context.plannerAssistance
  );
  const evaluatedPlan = applySimulationRiskSummary(plan, simulationBundle.simulation_summary);

  return {
    accepted: true,
    workflow_state: "simulation_ready",
    state_trace: [
      "preparing_plan",
      "plan_ready",
      "compiling_manifest",
      "manifest_ready",
      "simulating_effects",
      "simulation_ready"
    ],
    message: "Prepared a read-only repo inspection preview and simulation summary.",
    route: evaluatedRoute,
    plan: evaluatedPlan,
    manifest: createManifest({
      request,
      plan: evaluatedPlan,
      compiled_actions: simulationBundle.compiled_actions,
      policy_snapshot,
      expires_at
    }),
    effect_previews: simulationBundle.effect_previews,
    approval_requests: simulationBundle.approval_requests,
    simulation_summary: simulationBundle.simulation_summary,
    diff_previews: [],
    planner_assistance: createPlannerAssistance(context.plannerAssistance),
    preview_generated_at: request.requested_at
  };
}

function deriveEditedContent(currentText: string, task: string): { nextContent: string; targetPath: string } {
  const editInstruction = parseSupportedEditInstruction(task);
  if (!editInstruction) {
    throw new Error(
      'Phase 2 edit preview currently supports only `replace "old" with "new" in <path>` and `append "text" to <path>`.'
    );
  }

  if (editInstruction.kind === "append") {
    const separator = currentText.length === 0 || currentText.endsWith("\n") ? "" : "\n";
    return {
      nextContent: `${currentText}${separator}${editInstruction.appended_text}`,
      targetPath: editInstruction.target_path
    };
  }

  if (!currentText.includes(editInstruction.search_text)) {
    throw new Error(`Could not find "${editInstruction.search_text}" in the target file.`);
  }

  return {
    nextContent: currentText.replace(
      editInstruction.search_text,
      editInstruction.replacement_text
    ),
    targetPath: editInstruction.target_path
  };
}

function buildEditPreview(
  request: TaskIntentRequest,
  route: TaskRoute,
  context: PreviewTaskContext
): TaskIntentResponse {
  const workspaceRoot = request.workspace_roots[0];
  const expires_at = addMinutes(request.requested_at, 15);
  const policy_snapshot = createPolicySnapshot(request.requested_at);
  const canonicalPolicy = new DefaultCanonicalPathPolicy();
  const editInstruction = parseSupportedEditInstruction(context.effectiveTask);
  if (!editInstruction) {
    throw new Error(
      'Phase 2 edit preview currently supports only `replace "old" with "new" in <path>` and `append "text" to <path>`.'
    );
  }
  const targetResolution = canonicalPolicy.authorizePath(
    normalizeTargetPath(workspaceRoot, editInstruction.target_path),
    [workspaceRoot]
  );
  const workspaceResolution = canonicalPolicy.authorizePath(workspaceRoot, [workspaceRoot]);
  const readResult = requireOkToolResult(
    toolRegistry.read_text_file.execute({
      path: targetResolution.canonicalPath
    }),
    "Failed to read the target file for preview."
  );
  const currentText = String((readResult.output as { text: string }).text);
  const { nextContent } = deriveEditedContent(currentText, context.effectiveTask);
  const diffResult = requireOkToolResult(
    toolRegistry.diff_file.execute({
      path: targetResolution.canonicalPath,
      next_content: nextContent
    }),
    "Failed to build the exact diff preview."
  );

  const actions = [
    createAction({
      id: deterministicId("action", `${request.task}:git-status`),
      type: "repo_git_status",
      label: "Read git status",
      description: "Inspect repo state before any later write approval.",
      args: { repository_path: workspaceResolution.canonicalPath },
      expected_output: "branch and working tree summary",
      risk: "SAFE",
      requires_approval: false,
      approval_scope_allowed: ["exact_action_only", "session_readonly_scope"]
    }),
    createAction({
      id: deterministicId("action", `${request.task}:read`),
      type: "repo_read_text_file",
      label: "Read target file",
      description: "Read the current target file contents before previewing a change.",
      args: { path: targetResolution.canonicalPath },
      expected_output: "current text contents",
      risk: "SAFE",
      requires_approval: false,
      approval_scope_allowed: ["exact_action_only", "session_readonly_scope"]
    }),
    createAction({
      id: deterministicId("action", `${request.task}:diff`),
      type: "repo_diff_file",
      label: "Preview exact diff",
      description: "Generate the exact line-level diff for the proposed update.",
      args: {
        path: targetResolution.canonicalPath,
        next_content: nextContent
      },
      expected_output: "unified diff preview",
      risk: "SAFE",
      requires_approval: false,
      approval_scope_allowed: ["exact_action_only", "session_readonly_scope"]
    }),
    createAction({
      id: deterministicId("action", `${request.task}:write`),
      type: "repo_write_text_file",
      label: "Apply typed file write",
      description: "Write the exact previewed contents after a later approval step.",
      args: {
        path: targetResolution.canonicalPath,
        content: nextContent
      },
      expected_output: "write receipt",
      risk: "CAUTION",
      requires_approval: true,
      approval_scope_allowed: ["exact_action_only", "never_session_approvable"]
    })
  ] as const;

  const plan: Plan = {
    id: deterministicId("plan", `${request.task}:${request.requested_at}`),
    user_goal: context.originalTask,
    summary: `Read ${path.win32.basename(
      targetResolution.canonicalPath
    )}, preview the exact diff, and compile a single typed write action for approval.`,
    planning_notes: appendPlannerNote([
      "Use typed tools first.",
      "Do not execute the write during preview.",
      "Require exact diff inspection before any later approval."
    ], context.plannerAssistance),
    risk_summary: "Local workspace write remains approval-gated; preview stays deterministic and local.",
    requires_approval: true,
    actions: [...actions],
    created_at: request.requested_at,
    policy_snapshot
  };

  const compiled_actions = [
    compileAction({
      action: actions[0],
      tool_name: "git_status",
      normalized_args: { repository_path: workspaceResolution.canonicalPath },
      workspace_root: workspaceRoot,
      path_access: "read",
      path_reason: "inspect current repo status",
      effect_family: "readonly",
      effect_detail: "git status",
      risk_level: "SAFE",
      requires_approval: false,
      session_id: request.session_id,
      expires_at
    }),
    compileAction({
      action: actions[1],
      tool_name: "read_text_file",
      normalized_args: { path: targetResolution.canonicalPath },
      workspace_root: workspaceRoot,
      path_access: "read",
      path_reason: "read target file",
      effect_family: "readonly",
      effect_detail: "read text file",
      risk_level: "SAFE",
      requires_approval: false,
      session_id: request.session_id,
      expires_at
    }),
    compileAction({
      action: actions[2],
      tool_name: "diff_file",
      normalized_args: {
        path: targetResolution.canonicalPath,
        next_content: nextContent
      },
      workspace_root: workspaceRoot,
      path_access: "read",
      path_reason: "preview exact file diff",
      effect_family: "readonly",
      effect_detail: "compute file diff preview",
      risk_level: "SAFE",
      requires_approval: false,
      session_id: request.session_id,
      expires_at
    }),
    compileAction({
      action: actions[3],
      tool_name: "write_text_file",
      normalized_args: {
        path: targetResolution.canonicalPath,
        content: nextContent
      },
      workspace_root: workspaceRoot,
      path_access: "write",
      path_reason: "apply previewed file update",
      effect_family: "workspace_write",
      effect_detail: "write text file",
      risk_level: "CAUTION",
      requires_approval: true,
      session_id: request.session_id,
      expires_at
    })
  ] as const;
  const diffPreviews = [diffResult.output as DiffPreview] as const;
  const simulationBundle = simulateCompiledActions({
    compiled_actions,
    diff_previews: diffPreviews,
    session_id: request.session_id,
    expires_at
  });
  const routeWithRisk: TaskRoute = {
    ...route,
    risk_class: simulationBundle.simulation_summary.highest_risk
  };
  const evaluatedRoute = applyPlannerAssistanceToRoute(
    routeWithRisk,
    context.plannerAssistance
  );
  const evaluatedPlan = applySimulationRiskSummary(plan, simulationBundle.simulation_summary);

  return {
    accepted: true,
    workflow_state: "awaiting_approval",
    state_trace: [
      "preparing_plan",
      "plan_ready",
      "compiling_manifest",
      "manifest_ready",
      "simulating_effects",
      "simulation_ready",
      "awaiting_approval"
    ],
    message: `Prepared an exact diff preview, simulation summary, and approval scope for ${targetResolution.canonicalPath}.`,
    route: evaluatedRoute,
    plan: evaluatedPlan,
    manifest: createManifest({
      request,
      plan: evaluatedPlan,
      compiled_actions: simulationBundle.compiled_actions,
      policy_snapshot,
      expires_at
    }),
    effect_previews: simulationBundle.effect_previews,
    approval_requests: simulationBundle.approval_requests,
    simulation_summary: simulationBundle.simulation_summary,
    diff_previews: [...diffPreviews],
    planner_assistance: createPlannerAssistance(context.plannerAssistance),
    preview_generated_at: request.requested_at
  };
}

function buildGuardedShellPreview(
  request: TaskIntentRequest,
  route: TaskRoute,
  context: PreviewTaskContext
): TaskIntentResponse {
  const workspaceRoot = request.workspace_roots[0];
  const expires_at = addMinutes(request.requested_at, 10);
  const policy_snapshot = createPolicySnapshot(request.requested_at);
  const canonicalPolicy = new DefaultCanonicalPathPolicy();
  const shellInstruction = parseGuardedShellInstruction(context.effectiveTask);

  if (!shellInstruction) {
    throw new Error(
      'Phase 5 guarded shell currently supports only `run command "..."` with an optional `in <path>` clause.'
    );
  }

  const workingDirectory = canonicalPolicy.authorizePath(
    normalizeTargetPath(workspaceRoot, shellInstruction.working_directory ?? workspaceRoot),
    [workspaceRoot]
  );
  const shellClassification = classifyShellCommand(shellInstruction.command_text);
  const isMutating = shellClassification.shell_kind === "mutating";
  const normalizedShellArgs = {
    command_text: shellInstruction.command_text,
    working_directory: workingDirectory.canonicalPath,
    environment_policy: "inherit_process",
    timeout_ms: 15000
  } as const;

  const actions = [
    createAction({
      id: deterministicId("action", `${request.task}:guarded-shell`),
      type: "guarded_shell_command",
      label: "Execute guarded shell command",
      description:
        "Run the explicit local shell escape hatch with an audited receipt and explicit approval scope.",
      args: normalizedShellArgs,
      expected_output: "structured shell receipt",
      risk: isMutating ? "DANGER" : "CAUTION",
      requires_approval: true,
      approval_scope_allowed: isMutating
        ? ["exact_action_only", "never_session_approvable"]
        : ["exact_action_only"],
    })
  ] as const;

  const plan: Plan = {
    id: deterministicId("plan", `${request.task}:${request.requested_at}`),
    user_goal: context.originalTask,
    summary: `Compile the explicit guarded shell command for ${workingDirectory.canonicalPath}, require approval, and keep the receipt reviewable.`,
    planning_notes: appendPlannerNote([
      "Use guarded shell only as an escape hatch.",
      "Do not bypass a sufficient typed tool path.",
      "Capture a structured receipt for review and attestation."
    ], context.plannerAssistance),
    risk_summary: isMutating
      ? "The guarded shell command is mutating and will remain DANGER plus approve-once only."
      : "The guarded shell command is read-only but broader than typed tools, so it remains CAUTION and approval-gated.",
    requires_approval: true,
    actions: [...actions],
    created_at: request.requested_at,
    policy_snapshot
  };

  const compiled_actions = [
    compileAction({
      action: actions[0],
      tool_name: "shell_command_guarded",
      normalized_args: normalizedShellArgs,
      workspace_root: workspaceRoot,
      path_access: isMutating ? "read_write" : "read",
      path_reason: "execute explicit guarded shell command",
      effect_family: isMutating ? "raw_shell_mutating" : "raw_shell_readonly",
      effect_detail: `guarded shell: ${shellInstruction.command_text}`,
      risk_level: isMutating ? "DANGER" : "CAUTION",
      requires_approval: true,
      session_id: request.session_id,
      expires_at
    })
  ] as const;
  const simulationBundle = simulateCompiledActions({
    compiled_actions,
    session_id: request.session_id,
    expires_at
  });
  const routeWithRisk: TaskRoute = {
    ...route,
    risk_class: simulationBundle.simulation_summary.highest_risk
  };
  const evaluatedRoute = applyPlannerAssistanceToRoute(
    routeWithRisk,
    context.plannerAssistance
  );
  const evaluatedPlan = applySimulationRiskSummary(plan, simulationBundle.simulation_summary);

  return {
    accepted: true,
    workflow_state: "awaiting_approval",
    state_trace: [
      "preparing_plan",
      "plan_ready",
      "compiling_manifest",
      "manifest_ready",
      "simulating_effects",
      "simulation_ready",
      "awaiting_approval"
    ],
    message: `Prepared an audited guarded-shell preview for ${workingDirectory.canonicalPath}.`,
    route: evaluatedRoute,
    plan: evaluatedPlan,
    manifest: createManifest({
      request,
      plan: evaluatedPlan,
      compiled_actions: simulationBundle.compiled_actions,
      policy_snapshot,
      expires_at
    }),
    effect_previews: simulationBundle.effect_previews,
    approval_requests: simulationBundle.approval_requests,
    simulation_summary: simulationBundle.simulation_summary,
    diff_previews: [],
    planner_assistance: createPlannerAssistance(context.plannerAssistance),
    preview_generated_at: request.requested_at
  };
}

async function createPreviewTaskContext(
  request: TaskIntentRequest,
  options: TaskPreviewOptions
): Promise<{
  readonly route: TaskRoute;
  readonly context: PreviewTaskContext;
}> {
  let plannerAssistance = createNotRequestedPlannerAssistance(request.task, options.planner);
  let effectiveTask = request.task;
  let route = routeTaskIntent(effectiveTask);

  if (options.planner && shouldAttemptPlannerNormalization(request.task)) {
    plannerAssistance = await options.planner.normalizeTask({
      task: request.task,
      workspace_root: request.workspace_roots[0]
    });

    if (plannerAssistance.used_for_preview) {
      effectiveTask = plannerAssistance.normalized_task;
      route = routeTaskIntent(effectiveTask);
    }
  }

  return {
    route,
    context: {
      originalTask: request.task,
      effectiveTask,
      plannerAssistance
    }
  };
}

export async function createTaskPreview(
  request: TaskIntentRequest,
  options: TaskPreviewOptions = {}
): Promise<TaskIntentResponse> {
  const { route, context } = await createPreviewTaskContext(request, options);

  try {
    switch (route.chosen_route) {
      case "local_read_tools":
        return buildInspectionPreview(request, route, context);
      case "local_repo_file_tools":
        return buildEditPreview(request, route, context);
      case "local_guarded_shell":
        return buildGuardedShellPreview(request, route, context);
      case "manual_confirmation_required":
      default:
        return createFailureResponse(
          request,
          route,
          "idle",
          "The current deterministic slice supports repo inspection, exact replace/append edit previews, and the explicit guarded-shell escape hatch only.",
          context.plannerAssistance
        );
    }
  } catch (error) {
    return createFailureResponse(
      request,
      route,
      "failed",
      error instanceof Error ? error.message : "Failed to prepare the preview.",
      context.plannerAssistance
    );
  }
}
