import { spawnSync } from "node:child_process";

import { z } from "zod";

import { redactValue } from "../redaction/redactor";
import type { ToolResult } from "../schemas";

export const shellEnvironmentPolicies = ["inherit_process"] as const;
export type ShellEnvironmentPolicy = (typeof shellEnvironmentPolicies)[number];

export const GuardedShellArgsSchema = z
  .object({
    command_text: z.string().min(1),
    working_directory: z.string().min(1),
    environment_policy: z.enum(shellEnvironmentPolicies),
    timeout_ms: z.number().int().min(1000).max(30000)
  })
  .strict();

export interface ShellCommandClassification {
  readonly shell_kind: "readonly" | "mutating";
  readonly justification: string;
}

const mutatingShellPattern =
  /\b(set-content|add-content|out-file|copy-item|move-item|rename-item|remove-item|del|rm|mkdir|new-item|ni|git\s+commit|git\s+checkout|git\s+switch|git\s+merge|git\s+rebase|git\s+reset|npm\s+install|pnpm\s+install|yarn\s+install)\b|>>?|[|;]\s*(set-content|add-content|out-file|remove-item|del|rm)\b/i;
const networkShellPattern =
  /\b(curl|wget|invoke-webrequest|iwr|irm|start-bitstransfer|git\s+clone|scp|ssh)\b/i;

function buildObservedEffectDetail(commandText: string): string {
  return `guarded shell: ${commandText}`;
}

export function classifyShellCommand(commandText: string): ShellCommandClassification {
  if (mutatingShellPattern.test(commandText)) {
    return {
      shell_kind: "mutating",
      justification:
        "The command text includes write, delete, install, or other mutating shell operations, so it is classified as DANGER."
    };
  }

  return {
    shell_kind: "readonly",
    justification:
      "The command text does not match the mutating shell classifier, so it remains a guarded read-only escape hatch."
  };
}

export function hasNetworkShellTokens(commandText: string): boolean {
  return networkShellPattern.test(commandText);
}

function getEnvironment(
  environmentPolicy: ShellEnvironmentPolicy
): NodeJS.ProcessEnv {
  switch (environmentPolicy) {
    case "inherit_process":
    default:
      return { ...process.env };
  }
}

export function executeGuardedShell(
  args: z.infer<typeof GuardedShellArgsSchema>
): ToolResult {
  const startedAt = Date.now();
  const shellClassification = classifyShellCommand(args.command_text);
  const observedEffectFamily =
    shellClassification.shell_kind === "mutating"
      ? "raw_shell_mutating"
      : "raw_shell_readonly";

  try {
    const result = spawnSync(
      "powershell.exe",
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", args.command_text],
      {
        cwd: args.working_directory,
        env: getEnvironment(args.environment_policy),
        encoding: "utf8",
        timeout: args.timeout_ms,
        windowsHide: true
      }
    );

    const stdout = result.stdout ?? "";
    const stderr = result.stderr ?? "";
    const redactedStdout = redactValue(stdout);
    const redactedStderr = redactValue(stderr);
    const durationMs = Date.now() - startedAt;
    const exitCode = result.status ?? (result.error ? 1 : 0);
    const timedOut = result.signal === "SIGTERM" && durationMs >= args.timeout_ms;
    const ok = exitCode === 0 && !result.error;

    return {
      ok,
      summary: ok
        ? `Executed guarded shell command in ${args.working_directory}`
        : `Guarded shell command failed in ${args.working_directory}`,
      output: {
        stdout,
        stderr
      },
      redacted_output: {
        stdout: redactedStdout.redactedValue,
        stderr: redactedStderr.redactedValue
      },
      error:
        result.error instanceof Error
          ? result.error.message
          : ok
            ? null
            : stderr || "Guarded shell command exited with a non-zero status.",
      artifacts: [],
      structured_data: {
        command_text: args.command_text,
        working_directory: args.working_directory,
        environment_policy: args.environment_policy,
        timeout_ms: args.timeout_ms,
        exit_code: exitCode,
        timed_out: timedOut,
        duration_ms: durationMs,
        stdout_preview: redactedStdout.redactedValue,
        stderr_preview: redactedStderr.redactedValue
      },
      observed_effects: [
        {
          family: observedEffectFamily,
          target: args.working_directory,
          detail: buildObservedEffectDetail(args.command_text)
        }
      ]
    };
  } catch (error) {
    return {
      ok: false,
      summary: `Guarded shell command failed in ${args.working_directory}`,
      output: null,
      redacted_output: null,
      error: error instanceof Error ? error.message : "Unknown guarded shell error",
      artifacts: [],
      structured_data: {
        command_text: args.command_text,
        working_directory: args.working_directory,
        environment_policy: args.environment_policy,
        timeout_ms: args.timeout_ms,
        exit_code: 1,
        timed_out: false,
        duration_ms: Date.now() - startedAt,
        stdout_preview: "",
        stderr_preview: ""
      },
      observed_effects: [
        {
          family: observedEffectFamily,
          target: args.working_directory,
          detail: buildObservedEffectDetail(args.command_text)
        }
      ]
    };
  }
}
