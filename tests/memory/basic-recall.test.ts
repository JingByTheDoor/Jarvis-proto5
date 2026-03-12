import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { searchLocalRecall } from "../../src/core/memory/basic-recall";
import type { RunLogStore } from "../../src/core/events/run-log-store";
import type { RunLog } from "../../src/core/schemas";
import { ISO_LATER, validRunLog } from "../fixtures";
import { createTempRepo } from "../support/temp-repo";

class MemoryRunLogStore implements RunLogStore {
  public constructor(private readonly runLogs: readonly RunLog[]) {}

  writeRunLog(): string {
    throw new Error("Not used in recall tests.");
  }

  listRunLogs(): RunLog[] {
    return [...this.runLogs];
  }
}

describe("basic local recall", () => {
  it("returns recall entries with provenance, trust labels, and resume prompts", () => {
    const repo = createTempRepo({
      "notes/operator-note.md": "Remember the latest safe run."
    });

    try {
      const results = searchLocalRecall({
        request: {
          workspace_root: repo.root,
          query: "safe run",
          limit: 10
        },
        runLogStore: new MemoryRunLogStore([
          {
            ...validRunLog,
            finished_at: ISO_LATER
          }
        ])
      });

      expect(results.results.some((result) => result.source_kind === "run_log")).toBe(true);
      expect(results.results.some((result) => result.source_kind === "operator_note")).toBe(true);
      expect(results.results.find((result) => result.source_kind === "run_log")?.trust_label).toBe(
        "tool_confirmed"
      );
      expect(
        results.results.find((result) => result.source_kind === "run_log")?.resume_prompt
      ).toContain("Resume the previous task");
    } finally {
      repo.cleanup();
    }
  });

  it("redacts secrets before note content becomes searchable", () => {
    const repo = createTempRepo({});

    try {
      const notePath = path.join(repo.root, "notes", "secret-note.md");
      fs.mkdirSync(path.dirname(notePath), { recursive: true });
      fs.writeFileSync(notePath, "Provider key sk-secret-12345678 should never leak.", "utf8");

      const results = searchLocalRecall({
        request: {
          workspace_root: repo.root,
          query: "provider key",
          limit: 10
        },
        runLogStore: new MemoryRunLogStore([])
      });

      const noteResult = results.results.find((result) => result.source_kind === "operator_note");
      expect(noteResult?.excerpt).toContain("[REDACTED:");
      expect(noteResult?.excerpt).not.toContain("sk-secret-12345678");
      expect(noteResult?.searchable_text).not.toContain("sk-secret-12345678");
    } finally {
      repo.cleanup();
    }
  });
});
