import path from "node:path";

import { describe, expect, it } from "vitest";

import { toolRegistry } from "../../src/core/tools/repo-file-tools";
import { createTempRepo } from "../support/temp-repo";

describe("typed repo/file tools", () => {
  it("lists directories and reads files through typed local tools", () => {
    const repo = createTempRepo({
      "package.json": JSON.stringify({ name: "phase-2-fixture", version: "1.0.0" }, null, 2),
      "docs/notes.txt": "phase 2\n"
    });

    try {
      const listResult = toolRegistry.list_directory.execute({ path: repo.root });
      const readResult = toolRegistry.read_text_file.execute({
        path: path.join(repo.root, "docs", "notes.txt")
      });

      expect(listResult.ok).toBe(true);
      expect((listResult.output as { entries: Array<{ name: string }> }).entries).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: "docs" })])
      );
      expect(readResult.ok).toBe(true);
      expect((readResult.output as { text: string }).text).toBe("phase 2\n");
    } finally {
      repo.cleanup();
    }
  });

  it("writes files and produces exact diff previews", () => {
    const repo = createTempRepo({
      "package.json": JSON.stringify({ name: "phase-2-fixture", version: "1.0.0" }, null, 2),
      "docs/notes.txt": "before\n"
    });

    try {
      const targetPath = path.join(repo.root, "docs", "notes.txt");
      const diffResult = toolRegistry.diff_file.execute({
        path: targetPath,
        next_content: "after\n"
      });
      const writeResult = toolRegistry.write_text_file.execute({
        path: targetPath,
        content: "after\n"
      });

      expect(diffResult.ok).toBe(true);
      expect((diffResult.output as { unified_diff: string }).unified_diff).toContain("-before");
      expect((diffResult.output as { unified_diff: string }).unified_diff).toContain("+after");
      expect(writeResult.ok).toBe(true);
      expect(repo.readRelativeFile("docs/notes.txt")).toBe("after\n");
    } finally {
      repo.cleanup();
    }
  });

  it("prefers typed git inspection for repo status and diff", () => {
    const repo = createTempRepo({
      "package.json": JSON.stringify({ name: "phase-2-fixture", version: "1.0.0" }, null, 2),
      "docs/notes.txt": "before\n"
    });

    try {
      repo.writeRelativeFile("docs/notes.txt", "after\n");

      const statusResult = toolRegistry.git_status.execute({ repository_path: repo.root });
      const diffResult = toolRegistry.git_diff.execute({ repository_path: repo.root });

      expect(statusResult.ok).toBe(true);
      expect((statusResult.output as { short_status: string }).short_status).toContain(
        "docs/notes.txt"
      );
      expect(diffResult.ok).toBe(true);
      expect((diffResult.output as { diff: string }).diff).toContain("-before");
      expect((diffResult.output as { diff: string }).diff).toContain("+after");
    } finally {
      repo.cleanup();
    }
  });
});
