import type { TaskRoute } from "../../shared/ipc";
import {
  classifyShellCommand,
  hasNetworkShellTokens
} from "../tools/guarded-shell-tool";

export interface ReplaceEditInstruction {
  readonly kind: "replace";
  readonly target_path: string;
  readonly search_text: string;
  readonly replacement_text: string;
}

export interface AppendEditInstruction {
  readonly kind: "append";
  readonly target_path: string;
  readonly appended_text: string;
}

export type SupportedEditInstruction = ReplaceEditInstruction | AppendEditInstruction;

export interface GuardedShellInstruction {
  readonly command_text: string;
  readonly working_directory: string | null;
}

const replaceInFilePattern =
  /replace\s+"(?<search>[\s\S]+?)"\s+with\s+"(?<replacement>[\s\S]+?)"\s+in\s+(?<path>.+)$/i;
const appendToFilePattern = /append\s+"(?<content>[\s\S]+?)"\s+to\s+(?<path>.+)$/i;
const guardedShellPattern =
  /^(?:run|execute|shell)\s+command\s+"(?<command>[\s\S]+?)"(?:\s+in\s+(?<path>.+))?$/i;
const dangerousIntentPattern =
  /\b(deploy|launch|start|stop|restart|delete|remove|publish|install|execute|run)\b/i;
const readonlyIntentPattern = /\b(inspect|review|summarize|status|list|read|repo)\b/i;
const typedGitStatusShellPattern = /^git\s+status$/i;
const typedGitDiffShellPattern = /^git\s+diff(?:\s+--\s+.+)?$/i;

export function parseSupportedEditInstruction(task: string): SupportedEditInstruction | null {
  const replaceMatch = replaceInFilePattern.exec(task.trim());
  if (replaceMatch?.groups) {
    return {
      kind: "replace",
      target_path: replaceMatch.groups.path.trim(),
      search_text: replaceMatch.groups.search,
      replacement_text: replaceMatch.groups.replacement
    };
  }

  const appendMatch = appendToFilePattern.exec(task.trim());
  if (appendMatch?.groups) {
    return {
      kind: "append",
      target_path: appendMatch.groups.path.trim(),
      appended_text: appendMatch.groups.content
    };
  }

  return null;
}

export function parseGuardedShellInstruction(task: string): GuardedShellInstruction | null {
  const shellMatch = guardedShellPattern.exec(task.trim());
  if (!shellMatch?.groups) {
    return null;
  }

  return {
    command_text: shellMatch.groups.command.trim(),
    working_directory: shellMatch.groups.path?.trim() ?? null
  };
}

export function shouldAttemptPlannerNormalization(task: string): boolean {
  const normalizedTask = task.trim();

  if (
    parseSupportedEditInstruction(normalizedTask) ||
    parseGuardedShellInstruction(normalizedTask) ||
    dangerousIntentPattern.test(normalizedTask)
  ) {
    return false;
  }

  return routeTaskIntent(normalizedTask).chosen_route === "manual_confirmation_required";
}

export function routeTaskIntent(task: string): TaskRoute {
  const normalizedTask = task.trim();
  const editInstruction = parseSupportedEditInstruction(normalizedTask);
  const shellInstruction = parseGuardedShellInstruction(normalizedTask);

  if (editInstruction) {
    return {
      task_level: 3,
      task_type: "repo_edit",
      risk_class: "CAUTION",
      chosen_route: "local_repo_file_tools",
      operator_explanation:
        "The request matches a supported local file-edit preview pattern, so JARVIS can stay on typed repo/file tools."
    };
  }

  if (shellInstruction) {
    if (
      typedGitStatusShellPattern.test(shellInstruction.command_text) ||
      typedGitDiffShellPattern.test(shellInstruction.command_text)
    ) {
      return {
        task_level: 2,
        task_type: "repo_inspection",
        risk_class: "SAFE",
        chosen_route: "local_read_tools",
        operator_explanation:
          "A sufficient typed git inspection path already exists, so JARVIS will not bypass it with raw shell."
      };
    }

    if (hasNetworkShellTokens(shellInstruction.command_text)) {
      return {
        task_level: 5,
        task_type: "unsupported",
        risk_class: "DANGER",
        chosen_route: "manual_confirmation_required",
        operator_explanation:
          "Phase 5 guarded shell stays local-only; commands with network tokens stop at manual confirmation."
      };
    }

    const shellClassification = classifyShellCommand(shellInstruction.command_text);
    const isMutating = shellClassification.shell_kind === "mutating";

    return {
      task_level: isMutating ? 5 : 4,
      task_type: "guarded_command",
      risk_class: isMutating ? "DANGER" : "CAUTION",
      chosen_route: "local_guarded_shell",
      operator_explanation:
        "The request uses the explicit guarded-shell escape hatch and no sufficient typed-tool path was selected, so JARVIS will compile an audited shell action."
    };
  }

  if (dangerousIntentPattern.test(normalizedTask)) {
    return {
      task_level: 4,
      task_type: "unsupported",
      risk_class: "DANGER",
      chosen_route: "manual_confirmation_required",
      operator_explanation:
        "The request includes actions outside the narrow read-only or typed file-edit slice, so JARVIS must stop at manual confirmation."
    };
  }

  if (readonlyIntentPattern.test(normalizedTask)) {
    return {
      task_level: 2,
      task_type: "repo_inspection",
      risk_class: "SAFE",
      chosen_route: "local_read_tools",
      operator_explanation:
        "The request is read-only repo inspection, so JARVIS can stay on local typed read tools."
    };
  }

  return {
    task_level: 4,
    task_type: "unsupported",
    risk_class: "DANGER",
    chosen_route: "manual_confirmation_required",
    operator_explanation:
      "The request is outside the narrow Phase 2 typed repo/file slice, so JARVIS must stop at manual confirmation."
  };
}
