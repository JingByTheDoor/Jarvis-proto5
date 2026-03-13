import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { EncryptedRunLogStore } from "../../src/core/events/run-log-store";
import type { EncryptedAtRestProvider } from "../../src/core/persistence/encrypted-at-rest";
import { validRunLog } from "../fixtures";
import { createTempRepo } from "../support/temp-repo";

class TestEncryptedAtRestProvider implements EncryptedAtRestProvider {
  writeEncryptedJson<T>(filePath: string, _purpose: any, value: T): any {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
    return {
      version: 1,
      format: "jarvis.encrypted-file",
      algorithm: "aes-256-gcm",
      key_id: "test-key",
      purpose: "run_log",
      iv: "iv",
      ciphertext: "ciphertext",
      tag: "tag",
      created_at: validRunLog.finished_at
    };
  }

  readEncryptedJson<T>(filePath: string): T {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  }

  loadOrCreateContentKey(): any {
    throw new Error("Not used in test provider.");
  }
}

describe("run log store", () => {
  it("persists run logs under .tmp/runs and lists the newest runs first", () => {
    const repo = createTempRepo({
      "package.json": JSON.stringify({ name: "phase-4-store", version: "1.0.0" }, null, 2)
    });

    try {
      const runLogStore = new EncryptedRunLogStore(new TestEncryptedAtRestProvider());
      const olderRunLog = {
        ...validRunLog,
        run_id: "run-older",
        finished_at: "2026-03-11T17:00:00.000Z"
      };
      const newerRunLog = {
        ...validRunLog,
        run_id: "run-newer",
        finished_at: "2026-03-11T18:00:00.000Z"
      };

      const persistedPath = runLogStore.writeRunLog(repo.root, olderRunLog);
      runLogStore.writeRunLog(repo.root, newerRunLog);

      expect(persistedPath).toContain(".tmp");
      expect(persistedPath).toContain("run-older.json");
      expect(runLogStore.listRunLogs(repo.root, 10).map((run) => run.run_id)).toEqual([
        "run-newer",
        "run-older"
      ]);
    } finally {
      repo.cleanup();
    }
  });

  it("deletes persisted run logs and any staged export for the same run id", () => {
    const repo = createTempRepo({
      "package.json": JSON.stringify({ name: "phase-6-delete", version: "1.0.0" }, null, 2)
    });

    try {
      const runLogStore = new EncryptedRunLogStore(new TestEncryptedAtRestProvider());
      runLogStore.writeRunLog(repo.root, validRunLog);
      runLogStore.stageRunExport(repo.root, validRunLog.run_id, validRunLog.finished_at);

      const deleteResult = runLogStore.deleteRunLog(repo.root, validRunLog.run_id);

      expect(deleteResult.deleted).toBe(true);
      expect(deleteResult.deleted_paths).toHaveLength(2);
      expect(runLogStore.listRunLogs(repo.root, 10)).toEqual([]);
    } finally {
      repo.cleanup();
    }
  });

  it("stages a sanitized encrypted export bundle under .tmp/exports", () => {
    const repo = createTempRepo({
      "package.json": JSON.stringify({ name: "phase-6-export", version: "1.0.0" }, null, 2)
    });

    try {
      const runLogStore = new EncryptedRunLogStore(new TestEncryptedAtRestProvider());
      runLogStore.writeRunLog(repo.root, {
        ...validRunLog,
        final_result: {
          ...validRunLog.final_result,
          summary: "Cookie: session=sk-ABCDEFGH12345678"
        }
      });

      const exportResult = runLogStore.stageRunExport(
        repo.root,
        validRunLog.run_id,
        validRunLog.finished_at
      );

      expect(exportResult.staged_export_path).toContain(".tmp");
      expect(exportResult.staged_export_path).toContain("exports");
      expect(exportResult.bundle.run_log.final_result.summary).toContain("[REDACTED:");
      expect(exportResult.bundle.redaction_count).toBeGreaterThan(0);
      expect(exportResult.bundle.note).toContain("encrypted-at-rest");
    } finally {
      repo.cleanup();
    }
  });
});
