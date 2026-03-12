import type { SideEffectFamily } from "../../shared/constants";
import {
  getToolDefinition,
  type SupportedToolName
} from "../tools/tool-registry";

export function validateNormalizedToolArgs(
  toolName: SupportedToolName,
  normalizedArgs: unknown
): Record<string, unknown> {
  return getToolDefinition(toolName).arg_schema.parse(normalizedArgs) as Record<
    string,
    unknown
  >;
}

export function assertToolSideEffectFamily(
  toolName: SupportedToolName,
  sideEffectFamily: SideEffectFamily
): void {
  if (
    toolName === "shell_command_guarded" &&
    (sideEffectFamily === "raw_shell_readonly" ||
      sideEffectFamily === "raw_shell_mutating")
  ) {
    return;
  }

  const toolDefinition = getToolDefinition(toolName);
  if (toolDefinition.side_effect_family !== sideEffectFamily) {
    throw new Error(
      `Tool ${toolName} does not allow side-effect family ${sideEffectFamily}.`
    );
  }
}

export function assertWorkspaceScope(
  workspaceRoot: string,
  workspaceRoots: readonly string[]
): void {
  if (!workspaceRoots.includes(workspaceRoot)) {
    throw new Error(`Workspace scope does not include ${workspaceRoot}.`);
  }
}
