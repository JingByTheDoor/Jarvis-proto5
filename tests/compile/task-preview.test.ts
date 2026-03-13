import path from "node:path";

import { describe, expect, it } from "vitest";

import { createTaskPreview } from "../../src/core/compile/task-preview";
import type { TaskPlanner } from "../../src/core/integrations/task-planner";
import { localRepoToolNames } from "../../src/core/tools/repo-file-tools";
import {
  ISO_NOW,
  validPlannerAssistance,
  validPlannerProviderStatus
} from "../fixtures";
import { createTempRepo } from "../support/temp-repo";

const typedToolNames = new Set<string>(localRepoToolNames);

describe("task preview compiler", () => {
  it("builds a real read-only inspection manifest from typed tools", async () => {
    const repo = createTempRepo({
      "package.json": JSON.stringify({ name: "phase-2-fixture", version: "1.0.0" }, null, 2)
    });

    try {
      const response = await createTaskPreview({
        task: "Inspect the repo and summarize the current status",
        session_id: "session-inspect",
        workspace_roots: [repo.root],
        requested_at: ISO_NOW
      });

      expect(response.accepted).toBe(true);
      expect(response.workflow_state).toBe("simulation_ready");
      expect(response.route.chosen_route).toBe("local_read_tools");
      expect(response.route.risk_class).toBe("SAFE");
      expect(response.plan?.actions).toHaveLength(4);
      expect(response.manifest?.compiled_actions).toHaveLength(4);
      expect(response.effect_previews).toHaveLength(4);
      expect(response.simulation_summary?.highest_risk).toBe("SAFE");
      expect(response.approval_requests).toEqual([]);
      expect(response.manifest?.compiled_actions.map((action) => action.tool_name)).toEqual([
        "list_directory",
        "git_status",
        "git_diff",
        "read_text_file"
      ]);
      expect(
        response.manifest?.compiled_actions.every((action) => typedToolNames.has(action.tool_name))
      ).toBe(true);
      expect(response.diff_previews).toEqual([]);
      expect(response.planner_assistance.status).toBe("null_adapter");
    } finally {
      repo.cleanup();
    }
  });

  it("builds an exact diff preview and approval-gated write action for supported edits", async () => {
    const repo = createTempRepo({
      "package.json": JSON.stringify({ name: "phase-2-fixture", version: "1.0.0" }, null, 2),
      "docs/notes.txt": "hello world\n"
    });

    try {
      const response = await createTaskPreview({
        task: 'replace "world" with "JARVIS" in docs/notes.txt',
        session_id: "session-edit",
        workspace_roots: [repo.root],
        requested_at: ISO_NOW
      });

      expect(response.accepted).toBe(true);
      expect(response.workflow_state).toBe("awaiting_approval");
      expect(response.route.chosen_route).toBe("local_repo_file_tools");
      expect(response.route.task_level).toBe(3);
      expect(response.route.risk_class).toBe("DANGER");
      expect(response.plan?.requires_approval).toBe(true);
      expect(response.simulation_summary?.highest_risk).toBe("DANGER");
      expect(response.approval_requests).toHaveLength(1);
      expect(response.approval_requests[0]?.decision_options).toEqual([
        "deny",
        "approve_once"
      ]);
      expect(response.manifest?.compiled_actions.map((action) => action.tool_name)).toEqual([
        "git_status",
        "read_text_file",
        "diff_file",
        "write_text_file"
      ]);

      const writeAction = response.manifest?.compiled_actions.at(-1);
      expect(writeAction?.requires_approval).toBe(true);
      expect(writeAction?.risk_level).toBe("DANGER");
      expect(writeAction?.path_scope.entries[0]?.path).toBe(
        path.join(repo.root, "docs", "notes.txt")
      );

      expect(response.diff_previews).toHaveLength(1);
      expect(response.diff_previews[0]?.unified_diff).toContain("-hello world");
      expect(response.diff_previews[0]?.unified_diff).toContain("+hello JARVIS");
      expect(response.planner_assistance.used_for_preview).toBe(false);
    } finally {
      repo.cleanup();
    }
  });

  it("stops unsupported requests at manual confirmation", async () => {
    const repo = createTempRepo({
      "package.json": JSON.stringify({ name: "phase-2-fixture", version: "1.0.0" }, null, 2)
    });

    try {
      const response = await createTaskPreview({
        task: "Launch a browser and deploy this repo",
        session_id: "session-unsupported",
        workspace_roots: [repo.root],
        requested_at: ISO_NOW
      });

      expect(response.accepted).toBe(false);
      expect(response.workflow_state).toBe("idle");
      expect(response.route.chosen_route).toBe("manual_confirmation_required");
      expect(response.plan).toBeNull();
      expect(response.manifest).toBeNull();
      expect(response.effect_previews).toEqual([]);
      expect(response.approval_requests).toEqual([]);
      expect(response.planner_assistance.status).toBe("null_adapter");
    } finally {
      repo.cleanup();
    }
  });

  it("fails the preview if a replace target does not exist in the file", async () => {
    const repo = createTempRepo({
      "package.json": JSON.stringify({ name: "phase-2-fixture", version: "1.0.0" }, null, 2),
      "docs/notes.txt": "hello world\n"
    });

    try {
      const response = await createTaskPreview({
        task: 'replace "missing" with "JARVIS" in docs/notes.txt',
        session_id: "session-missing",
        workspace_roots: [repo.root],
        requested_at: ISO_NOW
      });

      expect(response.accepted).toBe(false);
      expect(response.workflow_state).toBe("failed");
      expect(response.message).toContain('Could not find "missing"');
      expect(response.manifest).toBeNull();
      expect(response.simulation_summary).toBeNull();
    } finally {
      repo.cleanup();
    }
  });

  it("builds an approval-gated guarded shell preview when no sufficient typed path exists", async () => {
    const repo = createTempRepo({
      "package.json": JSON.stringify({ name: "phase-5-fixture", version: "1.0.0" }, null, 2)
    });

    try {
      const response = await createTaskPreview({
        task: `run command "Get-ChildItem -Name ." in ${repo.root}`,
        session_id: "session-shell",
        workspace_roots: [repo.root],
        requested_at: ISO_NOW
      });

      expect(response.accepted).toBe(true);
      expect(response.workflow_state).toBe("awaiting_approval");
      expect(response.route.chosen_route).toBe("local_guarded_shell");
      expect(response.route.task_type).toBe("guarded_command");
      expect(response.simulation_summary?.highest_risk).toBe("CAUTION");
      expect(response.manifest?.compiled_actions.map((action) => action.tool_name)).toEqual([
        "shell_command_guarded"
      ]);
      expect(response.approval_requests[0]?.side_effect_family).toBe("raw_shell_readonly");
    } finally {
      repo.cleanup();
    }
  });

  it("keeps typed-tool precedence when a raw shell request maps to git status", async () => {
    const repo = createTempRepo({
      "package.json": JSON.stringify({ name: "phase-5-fixture", version: "1.0.0" }, null, 2)
    });

    try {
      const response = await createTaskPreview({
        task: `run command "git status" in ${repo.root}`,
        session_id: "session-git-status",
        workspace_roots: [repo.root],
        requested_at: ISO_NOW
      });

      expect(response.accepted).toBe(true);
      expect(response.route.chosen_route).toBe("local_read_tools");
      expect(response.manifest?.compiled_actions.some((action) => action.tool_name === "shell_command_guarded")).toBe(false);
    } finally {
      repo.cleanup();
    }
  });

  it("uses planner normalization to turn a natural-language edit into the typed repo-file route", async () => {
    const repo = createTempRepo({
      "README.md": "hello\n",
      "package.json": JSON.stringify({ name: "phase-6-planner", version: "1.0.0" }, null, 2)
    });
    const planner: TaskPlanner = {
      getStatus: async () => validPlannerProviderStatus,
      getCachedStatus: () => validPlannerProviderStatus,
      getConfig: () => ({
        provider_kind: "local_ollama",
        model_name: "qwen2.5:3b",
        endpoint_url: "http://127.0.0.1:11434",
        source: "session_override"
      }),
      updateSettings: async () => validPlannerProviderStatus,
      normalizeTask: async () => validPlannerAssistance
    };

    try {
      const response = await createTaskPreview(
        {
          task: validPlannerAssistance.original_task,
          session_id: "session-planner-edit",
          workspace_roots: [repo.root],
          requested_at: ISO_NOW
        },
        {
          planner
        }
      );

      expect(response.accepted).toBe(true);
      expect(response.route.chosen_route).toBe("local_repo_file_tools");
      expect(response.planner_assistance.status).toBe("normalized");
      expect(response.planner_assistance.used_for_preview).toBe(true);
      expect(response.plan?.planning_notes.at(-1)).toContain("Planner normalization:");
      expect(response.diff_previews[0]?.unified_diff).toContain("+hello jarvis");
    } finally {
      repo.cleanup();
    }
  });
});
