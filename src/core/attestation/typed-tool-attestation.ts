import fs from "node:fs";

import { createExecutionHash } from "../approval/hashes";
import type { CompiledAction, ExecutionAttestation, ToolResult } from "../schemas";

function hasObservedScopeViolation(compiledAction: CompiledAction, toolResult: ToolResult): boolean {
  const approvedTargets = new Set(compiledAction.path_scope.entries.map((entry) => entry.path));

  return toolResult.observed_effects.some(
    (effect) => effect.target.length > 0 && !approvedTargets.has(effect.target)
  );
}

function getUniqueDeviations(
  deviations: ReadonlyArray<ExecutionAttestation["deviations"][number]>
): ExecutionAttestation["deviations"] {
  return [...new Set(deviations)];
}

function getActualNormalizedArgs(
  compiledAction: CompiledAction,
  toolResult: ToolResult
): Record<string, unknown> {
  if (
    compiledAction.tool_name === "shell_command_guarded" &&
    toolResult.structured_data &&
    typeof toolResult.structured_data === "object" &&
    typeof (toolResult.structured_data as Record<string, unknown>).command_text === "string" &&
    typeof (toolResult.structured_data as Record<string, unknown>).working_directory === "string" &&
    typeof (toolResult.structured_data as Record<string, unknown>).environment_policy === "string"
  ) {
    const receipt = toolResult.structured_data as Record<string, unknown>;

    return {
      command_text: receipt.command_text,
      working_directory: receipt.working_directory,
      environment_policy: receipt.environment_policy,
      timeout_ms:
        typeof receipt.timeout_ms === "number"
          ? receipt.timeout_ms
          : compiledAction.normalized_args.timeout_ms
    };
  }

  return compiledAction.normalized_args;
}

export function attestTypedToolExecution(input: {
  readonly run_id: string;
  readonly compiled_action: CompiledAction;
  readonly tool_result: ToolResult;
  readonly attested_at: string;
}): ExecutionAttestation {
  const deviations: ExecutionAttestation["deviations"] = [];
  const observedEffects = input.tool_result.observed_effects;
  const actualExecutionHash = createExecutionHash({
    tool_name: input.compiled_action.tool_name,
    normalized_args: getActualNormalizedArgs(input.compiled_action, input.tool_result),
    workspace_scope: input.compiled_action.workspace_scope,
    path_scope: input.compiled_action.path_scope,
    network_scope: input.compiled_action.network_scope,
    expected_side_effects: observedEffects
  });

  if (observedEffects.length === 0) {
    deviations.push("missing_observation");
  }

  if (actualExecutionHash !== input.compiled_action.execution_hash) {
    deviations.push("hash_changed");
  }

  if (hasObservedScopeViolation(input.compiled_action, input.tool_result)) {
    deviations.push("scope_exceeded");
  }

  if (
    input.compiled_action.tool_name === "write_text_file" &&
    typeof input.compiled_action.normalized_args.path === "string" &&
    typeof input.compiled_action.normalized_args.content === "string"
  ) {
    if (!fs.existsSync(input.compiled_action.normalized_args.path)) {
      deviations.push("unexpected_write");
    } else {
      const actualContents = fs.readFileSync(
        input.compiled_action.normalized_args.path,
        "utf8"
      );

      if (actualContents !== input.compiled_action.normalized_args.content) {
        deviations.push("unexpected_write");
      }
    }
  }

  return {
    run_id: input.run_id,
    action_id: input.compiled_action.action_id,
    approved_execution_hash: input.compiled_action.execution_hash,
    actual_execution_hash: actualExecutionHash,
    matched: deviations.length === 0,
    deviations: getUniqueDeviations(deviations),
    observed_effects: observedEffects,
    attested_at: input.attested_at
  };
}
