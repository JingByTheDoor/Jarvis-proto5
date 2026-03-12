import fs from "node:fs";
import path from "node:path";

import {
  DefaultEncryptedAtRestProvider,
  type EncryptedAtRestProvider
} from "../persistence/encrypted-at-rest";
import type { RunLog } from "../schemas";

export interface RunLogStore {
  writeRunLog: (workspaceRoot: string, runLog: RunLog) => string;
  listRunLogs: (workspaceRoot: string, limit: number) => RunLog[];
}

function getRunLogDirectory(workspaceRoot: string): string {
  return path.join(workspaceRoot, ".tmp", "runs");
}

function getKeyDirectory(workspaceRoot: string): string {
  return path.join(workspaceRoot, ".tmp", "cache", "keys");
}

export class EncryptedRunLogStore implements RunLogStore {
  public constructor(
    private readonly encryptedAtRestProvider: EncryptedAtRestProvider = new DefaultEncryptedAtRestProvider()
  ) {}

  writeRunLog(workspaceRoot: string, runLog: RunLog): string {
    const runLogPath = path.join(getRunLogDirectory(workspaceRoot), `${runLog.run_id}.json`);

    this.encryptedAtRestProvider.writeEncryptedJson(
      runLogPath,
      "run_log",
      runLog,
      getKeyDirectory(workspaceRoot)
    );

    return runLogPath;
  }

  listRunLogs(workspaceRoot: string, limit: number): RunLog[] {
    const runLogDirectory = getRunLogDirectory(workspaceRoot);
    if (!fs.existsSync(runLogDirectory)) {
      return [];
    }

    return fs
      .readdirSync(runLogDirectory)
      .filter((entry) => entry.endsWith(".json"))
      .map((entry) =>
        this.encryptedAtRestProvider.readEncryptedJson<RunLog>(
          path.join(runLogDirectory, entry),
          "run_log",
          getKeyDirectory(workspaceRoot)
        )
      )
      .sort((left, right) => right.finished_at.localeCompare(left.finished_at))
      .slice(0, limit);
  }
}
