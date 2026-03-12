import fs from "node:fs";
import path from "node:path";

import type { RunLogStore } from "../events/run-log-store";
import { redactValue } from "../redaction/redactor";
import type { VerificationStatus } from "../../shared/constants";
import type { RecallEntry, RecallSearchResponse } from "../../shared/ipc";

export interface BasicRecallSearchInput {
  readonly workspace_root: string;
  readonly query: string;
  readonly limit: number;
}

function buildExcerpt(text: string): string {
  return text.length > 220 ? `${text.slice(0, 217)}...` : text;
}

function buildRunRecallEntry(runLog: {
  readonly run_id: string;
  readonly plan_id: string;
  readonly manifest_id: string;
  readonly final_result: { readonly status: string; readonly summary: string };
  readonly finished_at: string;
  readonly artifacts: ReadonlyArray<{ readonly location: string }>;
  readonly attestations: ReadonlyArray<{ readonly matched: boolean }>;
}): RecallEntry {
  const rawSearchableText = [
    runLog.run_id,
    runLog.plan_id,
    runLog.manifest_id,
    runLog.final_result.status,
    runLog.final_result.summary,
    ...runLog.artifacts.map((artifact) => artifact.location)
  ].join("\n");
  const redacted = redactValue(rawSearchableText);

  return {
    id: `run:${runLog.run_id}`,
    source_kind: "run_log",
    title: runLog.run_id,
    excerpt: buildExcerpt(redacted.redactedValue),
    provenance_label: `run_log:${runLog.run_id} / plan:${runLog.plan_id} / manifest:${runLog.manifest_id}`,
    trust_label: "tool_confirmed",
    updated_at: runLog.finished_at,
    location: runLog.run_id,
    resume_prompt:
      `Resume the previous task from ${runLog.run_id}. ` +
      `Review the prior outcome "${runLog.final_result.summary}" and continue from the same workspace safely.`,
    searchable_text: redacted.redactedValue
  };
}

function isNoteFile(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  if (extension !== ".md" && extension !== ".txt") {
    return false;
  }

  const normalized = filePath.replace(/\//g, "\\").toLowerCase();
  return normalized.includes("\\notes\\") || path.basename(normalized).includes("note");
}

function collectNoteFiles(rootDirectory: string): string[] {
  if (!fs.existsSync(rootDirectory)) {
    return [];
  }

  const discovered: string[] = [];
  const pendingDirectories = [rootDirectory];

  while (pendingDirectories.length > 0) {
    const directory = pendingDirectories.pop()!;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        pendingDirectories.push(entryPath);
        continue;
      }

      if (isNoteFile(entryPath)) {
        discovered.push(entryPath);
      }
    }
  }

  return discovered;
}

function buildNoteRecallEntry(filePath: string): RecallEntry {
  const contents = fs.readFileSync(filePath, "utf8");
  const stats = fs.statSync(filePath);
  const redacted = redactValue(contents);

  return {
    id: `note:${filePath}`,
    source_kind: "operator_note",
    title: path.basename(filePath),
    excerpt: buildExcerpt(redacted.redactedValue),
    provenance_label: filePath,
    trust_label: "user_confirmed",
    updated_at: stats.mtime.toISOString(),
    location: filePath,
    resume_prompt: null,
    searchable_text: redacted.redactedValue
  };
}

function includesQuery(value: string, query: string): boolean {
  const normalizedValue = value.toLowerCase();
  const queryTokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 0);

  if (queryTokens.length === 0) {
    return true;
  }

  return queryTokens.every((token) => normalizedValue.includes(token));
}

function rankRecallEntry(entry: RecallEntry, query: string): number {
  if (query.length === 0) {
    return Date.parse(entry.updated_at);
  }

  const searchable = `${entry.title}\n${entry.excerpt}\n${entry.provenance_label}\n${entry.searchable_text}`;
  const exactTitle = includesQuery(entry.title, query) ? 400 : 0;
  const excerptMatch = includesQuery(entry.excerpt, query) ? 200 : 0;
  const provenanceMatch = includesQuery(entry.provenance_label, query) ? 100 : 0;
  const searchableMatch = includesQuery(searchable, query) ? 50 : 0;
  return exactTitle + excerptMatch + provenanceMatch + searchableMatch + Date.parse(entry.updated_at);
}

function filterTrustLabel(
  trustLabel: VerificationStatus
): VerificationStatus {
  return trustLabel;
}

export function searchLocalRecall(input: {
  readonly request: BasicRecallSearchInput;
  readonly runLogStore: RunLogStore;
}): RecallSearchResponse {
  const runEntries = input.runLogStore
    .listRunLogs(input.request.workspace_root, input.request.limit * 2)
    .map((runLog) => buildRunRecallEntry(runLog));
  const noteEntries = [
    ...collectNoteFiles(path.join(input.request.workspace_root, "notes")),
    ...collectNoteFiles(path.join(input.request.workspace_root, "docs"))
  ].map((filePath) => buildNoteRecallEntry(filePath));

  const query = input.request.query.trim();
  const results = [...runEntries, ...noteEntries]
    .filter((entry) => {
      if (query.length === 0) {
        return true;
      }

      return includesQuery(
        `${entry.title}\n${entry.excerpt}\n${entry.provenance_label}\n${entry.searchable_text}`,
        query
      );
    })
    .sort((left, right) => rankRecallEntry(right, query) - rankRecallEntry(left, query))
    .slice(0, input.request.limit)
    .map((entry) => ({
      ...entry,
      trust_label: filterTrustLabel(entry.trust_label)
    }));

  return {
    results
  };
}
