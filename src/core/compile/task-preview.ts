import { createHash } from "node:crypto";
import path from "node:path";

import type {
  Action,
  CompiledAction,
  ExecutionManifest,
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
import { parseSupportedEditInstruction, routeTaskIntent } from "../planning/task-routing";
import { toolRegistry, type LocalRepoToolName } from "../tools/repo-file-tools";

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
    version: "phase-4-execution",
    workflow: "PLAN -> COMPILE -> SIMULATE -> APPROVAL -> EXECUTE -> ATTEST -> REVIEW",
    routing_mode: "local_first_stubbed",
    generated_at: generatedAt
  };
}

function createFailureResponse(
  request: TaskIntentRequest,
  route: TaskRoute,
  workflowState: TaskIntentResponse["workflow_state"],
  message: string
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
  readonly tool_name: LocalRepoToolName;
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
    String(parsedArgs.path ?? parsedArgs.repository_path ?? input.workspace_root);
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

function buildInspectionPreview(request: TaskIntentRequest, route: TaskRoute): TaskIntentResponse {
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
    user_goal: request.task,
    summary: `Inspect the workspace root, current git state, and ${path.win32.basename(
      targetResolution.canonicalPath
    )} before proposing a change.`,
    planning_notes: [
      "Use typed tools first.",
      "Keep the preview read-only.",
      "Compile every preview step into a typed manifest."
    ],
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
  const evaluatedRoute = {
    ...route,
    risk_class: simulationBundle.simulation_summary.highest_risk
  } satisfies TaskRoute;
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

function buildEditPreview(request: TaskIntentRequest, route: TaskRoute): TaskIntentResponse {
  const workspaceRoot = request.workspace_roots[0];
  const expires_at = addMinutes(request.requested_at, 15);
  const policy_snapshot = createPolicySnapshot(request.requested_at);
  const canonicalPolicy = new DefaultCanonicalPathPolicy();
  const editInstruction = parseSupportedEditInstruction(request.task);
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
  const { nextContent } = deriveEditedContent(currentText, request.task);
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
    user_goal: request.task,
    summary: `Read ${path.win32.basename(
      targetResolution.canonicalPath
    )}, preview the exact diff, and compile a single typed write action for approval.`,
    planning_notes: [
      "Use typed tools first.",
      "Do not execute the write during preview.",
      "Require exact diff inspection before any later approval."
    ],
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
  const evaluatedRoute = {
    ...route,
    risk_class: simulationBundle.simulation_summary.highest_risk
  } satisfies TaskRoute;
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
    preview_generated_at: request.requested_at
  };
}

export function createTaskPreview(request: TaskIntentRequest): TaskIntentResponse {
  const route = routeTaskIntent(request.task);

  try {
    switch (route.chosen_route) {
      case "local_read_tools":
        return buildInspectionPreview(request, route);
      case "local_repo_file_tools":
        return buildEditPreview(request, route);
      case "manual_confirmation_required":
      default:
        return createFailureResponse(
          request,
          route,
          "idle",
          "Phase 2 supports repo inspection plus explicit replace/append edit previews only."
        );
    }
  } catch (error) {
    return createFailureResponse(
      request,
      route,
      "failed",
      error instanceof Error ? error.message : "Failed to prepare the preview."
    );
  }
}
