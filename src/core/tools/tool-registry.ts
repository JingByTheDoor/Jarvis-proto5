import type { RiskLevel, SideEffectFamily } from "../../shared/constants";
import type { ToolResult } from "../schemas";
import {
  executeGuardedShell,
  GuardedShellArgsSchema
} from "./guarded-shell-tool";
import {
  getToolDefinition as getRepoToolDefinition,
  localRepoToolNames,
  toolRegistry as repoToolRegistry,
  type ToolDefinition
} from "./repo-file-tools";

export const supportedToolNames = [
  ...localRepoToolNames,
  "shell_command_guarded"
] as const;

export type SupportedToolName = (typeof supportedToolNames)[number];

const guardedShellToolDefinition = {
  tool_name: "shell_command_guarded",
  risk_floor: "CAUTION" as RiskLevel,
  side_effect_family: "raw_shell_readonly" as SideEffectFamily,
  supports_simulation: false,
  supports_attestation: true,
  arg_schema: GuardedShellArgsSchema,
  execute: executeGuardedShell
} satisfies ToolDefinition<any, "shell_command_guarded"> & {
  readonly execute: (args: any) => ToolResult;
};

export const toolRegistry = {
  ...repoToolRegistry,
  shell_command_guarded: guardedShellToolDefinition
} as const satisfies Record<SupportedToolName, ToolDefinition<any, string>>;

export function getToolDefinition(toolName: SupportedToolName): ToolDefinition<any, string> {
  if (toolName === "shell_command_guarded") {
    return guardedShellToolDefinition;
  }

  return getRepoToolDefinition(toolName);
}
