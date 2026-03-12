import type { TaskRoute } from "../../shared/ipc";

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

const replaceInFilePattern =
  /replace\s+"(?<search>[\s\S]+?)"\s+with\s+"(?<replacement>[\s\S]+?)"\s+in\s+(?<path>.+)$/i;
const appendToFilePattern = /append\s+"(?<content>[\s\S]+?)"\s+to\s+(?<path>.+)$/i;
const dangerousIntentPattern =
  /\b(deploy|launch|start|stop|restart|delete|remove|publish|install|execute|run)\b/i;
const readonlyIntentPattern = /\b(inspect|review|summarize|status|list|read|repo)\b/i;

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

export function routeTaskIntent(task: string): TaskRoute {
  const normalizedTask = task.trim();
  const editInstruction = parseSupportedEditInstruction(normalizedTask);

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
