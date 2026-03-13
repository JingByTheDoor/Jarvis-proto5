import fs from "node:fs";
import path from "node:path";

import {
  DefaultEncryptedAtRestProvider,
  type EncryptedAtRestProvider
} from "../persistence/encrypted-at-rest";
import { redactValue } from "../redaction/redactor";
import {
  RunExportBundleSchema,
  type RunExportBundle,
  type RunLog
} from "../schemas";

export interface RunLogDeleteResult {
  readonly run_id: string;
  readonly deleted: boolean;
  readonly deleted_paths: readonly string[];
}

export interface RunLogExportResult {
  readonly run_id: string;
  readonly staged_export_path: string;
  readonly bundle: RunExportBundle;
}

export interface RunLogStore {
  writeRunLog: (workspaceRoot: string, runLog: RunLog) => string;
  listRunLogs: (workspaceRoot: string, limit: number) => RunLog[];
  deleteRunLog: (workspaceRoot: string, runId: string) => RunLogDeleteResult;
  stageRunExport: (
    workspaceRoot: string,
    runId: string,
    exportedAt: string
  ) => RunLogExportResult;
}

function getRunLogDirectory(workspaceRoot: string): string {
  return path.join(workspaceRoot, ".tmp", "runs");
}

function getRunLogPath(workspaceRoot: string, runId: string): string {
  return path.join(getRunLogDirectory(workspaceRoot), `${runId}.json`);
}

function getExportDirectory(workspaceRoot: string): string {
  return path.join(workspaceRoot, ".tmp", "exports");
}

function getExportPath(workspaceRoot: string, runId: string): string {
  return path.join(getExportDirectory(workspaceRoot), `${runId}.json`);
}

function getKeyDirectory(workspaceRoot: string): string {
  return path.join(workspaceRoot, ".tmp", "cache", "keys");
}

function assertSafeRunStorageId(runId: string): void {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error(`Run id "${runId}" is not valid for storage operations.`);
  }
}

export class EncryptedRunLogStore implements RunLogStore {
  public constructor(
    private readonly encryptedAtRestProvider: EncryptedAtRestProvider = new DefaultEncryptedAtRestProvider()
  ) {}

  writeRunLog(workspaceRoot: string, runLog: RunLog): string {
    assertSafeRunStorageId(runLog.run_id);
    const runLogPath = getRunLogPath(workspaceRoot, runLog.run_id);

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

  deleteRunLog(workspaceRoot: string, runId: string): RunLogDeleteResult {
    assertSafeRunStorageId(runId);
    const candidatePaths = [
      getRunLogPath(workspaceRoot, runId),
      getExportPath(workspaceRoot, runId)
    ];
    const deletedPaths: string[] = [];

    for (const candidatePath of candidatePaths) {
      if (fs.existsSync(candidatePath)) {
        fs.rmSync(candidatePath, {
          force: true
        });
        deletedPaths.push(candidatePath);
      }
    }

    return {
      run_id: runId,
      deleted: deletedPaths.length > 0,
      deleted_paths: deletedPaths
    };
  }

  stageRunExport(
    workspaceRoot: string,
    runId: string,
    exportedAt: string
  ): RunLogExportResult {
    assertSafeRunStorageId(runId);
    const sourceRunPath = getRunLogPath(workspaceRoot, runId);

    if (!fs.existsSync(sourceRunPath)) {
      throw new Error(`No persisted run log exists for ${runId}.`);
    }

    const runLog = this.encryptedAtRestProvider.readEncryptedJson<RunLog>(
      sourceRunPath,
      "run_log",
      getKeyDirectory(workspaceRoot)
    );
    const redactedRunLog = redactValue(runLog);
    const bundle = RunExportBundleSchema.parse({
      version: 1,
      run_id: runId,
      workspace_root: path.resolve(workspaceRoot),
      source_run_path: sourceRunPath,
      exported_at: exportedAt,
      redaction_count: redactedRunLog.redactionCount,
      placeholders: redactedRunLog.placeholders,
      note: "Sanitized run export staged under encrypted-at-rest local storage.",
      run_log: redactedRunLog.redactedValue
    });
    const stagedExportPath = getExportPath(workspaceRoot, runId);

    this.encryptedAtRestProvider.writeEncryptedJson(
      stagedExportPath,
      "export_staging",
      bundle,
      getKeyDirectory(workspaceRoot)
    );

    return {
      run_id: runId,
      staged_export_path: stagedExportPath,
      bundle
    };
  }
}
