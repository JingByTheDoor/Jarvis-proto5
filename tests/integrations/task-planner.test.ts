import { describe, expect, it } from "vitest";

import { TaskPlannerService } from "../../src/core/integrations/task-planner";
import { ISO_NOW } from "../fixtures";

describe("task planner service", () => {
  it("returns a deterministic null-adapter status when planner assistance is disabled", async () => {
    const planner = new TaskPlannerService({
      environment: {
        JARVIS_PLANNER_PROVIDER: "null_adapter"
      },
      now: () => ISO_NOW
    });

    const status = await planner.getStatus();
    const assistance = await planner.normalizeTask({
      task: "Update the README heading to JARVIS.",
      workspace_root: "D:\\Jarvis-proto5 repo\\Jarvis-proto5"
    });

    expect(status.mode).toBe("null_adapter");
    expect(assistance.status).toBe("null_adapter");
    expect(assistance.used_for_preview).toBe(false);
  });

  it("reports active local-ollama health when the selected model is installed", async () => {
    const planner = new TaskPlannerService({
      now: () => ISO_NOW,
      fetch: (async (input: string | URL) => {
        const url = String(input);

        if (!url.endsWith("/api/tags")) {
          throw new Error(`Unexpected request: ${url}`);
        }

        return new Response(
          JSON.stringify({
            models: [{ name: "qwen2.5:3b" }, { name: "qwen2.5:1.5b" }]
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        );
      }) as typeof fetch
    });

    const status = await planner.getStatus();

    expect(status.mode).toBe("active");
    expect(status.available_models).toContain("qwen2.5:3b");
    expect(status.write_available).toBe(true);
  });

  it("normalizes a natural-language edit into a deterministic supported task shape", async () => {
    const planner = new TaskPlannerService({
      now: () => ISO_NOW,
      fetch: (async (input: string | URL) => {
        const url = String(input);

        if (url.endsWith("/api/tags")) {
          return new Response(
            JSON.stringify({
              models: [{ name: "qwen2.5:3b" }]
            }),
            {
              status: 200,
              headers: {
                "content-type": "application/json"
              }
            }
          );
        }

        if (url.endsWith("/api/generate")) {
          return new Response(
            JSON.stringify({
              response: JSON.stringify({
                intent_kind: "edit_replace",
                confidence: "high",
                rationale: "The README snippet already shows the exact heading to replace.",
                target_path: "README.md",
                search_text: "hello",
                replacement_text: "hello jarvis",
                appended_text: null,
                shell_command: null,
                working_directory: null
              })
            }),
            {
              status: 200,
              headers: {
                "content-type": "application/json"
              }
            }
          );
        }

        throw new Error(`Unexpected request: ${url}`);
      }) as typeof fetch
    });

    const assistance = await planner.normalizeTask({
      task: "Update the README heading to JARVIS and show me the exact diff first.",
      workspace_root: "D:\\Jarvis-proto5 repo\\Jarvis-proto5"
    });

    expect(assistance.status).toBe("normalized");
    expect(assistance.route_hint).toBe("local_repo_file_tools");
    expect(assistance.normalized_task).toBe(
      'replace "hello" with "hello jarvis" in README.md'
    );
  });

  it("falls back deterministically when the local planner returns malformed output", async () => {
    const planner = new TaskPlannerService({
      now: () => ISO_NOW,
      fetch: (async (input: string | URL) => {
        const url = String(input);

        if (url.endsWith("/api/tags")) {
          return new Response(
            JSON.stringify({
              models: [{ name: "qwen2.5:3b" }]
            }),
            {
              status: 200,
              headers: {
                "content-type": "application/json"
              }
            }
          );
        }

        if (url.endsWith("/api/generate")) {
          return new Response(
            JSON.stringify({
              response: "{not-json"
            }),
            {
              status: 200,
              headers: {
                "content-type": "application/json"
              }
            }
          );
        }

        throw new Error(`Unexpected request: ${url}`);
      }) as typeof fetch
    });

    const assistance = await planner.normalizeTask({
      task: "Update the README heading to JARVIS and show me the exact diff first.",
      workspace_root: "D:\\Jarvis-proto5 repo\\Jarvis-proto5"
    });

    expect(assistance.status).toBe("fell_back");
    expect(assistance.used_for_preview).toBe(false);
    expect(assistance.normalized_task).toContain("Update the README heading");
  });
});
