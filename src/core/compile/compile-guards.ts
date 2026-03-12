import type { SideEffectFamily } from "../../shared/constants";
import {
  getToolDefinition,
  type LocalRepoToolName
} from "../tools/repo-file-tools";

export function validateNormalizedToolArgs(
  toolName: LocalRepoToolName,
  normalizedArgs: unknown
): Record<string, unknown> {
  return getToolDefinition(toolName).arg_schema.parse(normalizedArgs) as Record<
    string,
    unknown
  >;
}

export function assertToolSideEffectFamily(
  toolName: LocalRepoToolName,
  sideEffectFamily: SideEffectFamily
): void {
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
