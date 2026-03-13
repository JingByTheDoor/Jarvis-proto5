import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { InMemoryApprovalRegistry } from "../../src/core/approval/approval-registry";
import { InMemoryCapabilityTokenStore } from "../../src/core/capabilities/capability-token-store";
import { createTaskPreview } from "../../src/core/compile/task-preview";
import { ManifestExecutionRuntime } from "../../src/core/execution/manifest-executor";
import type {
  RunLogDeleteResult,
  RunLogExportResult,
  RunLogStore
} from "../../src/core/events/run-log-store";
import type { RunLog, RunEvent } from "../../src/core/schemas";
import { ISO_NOW } from "../fixtures";
import { createTempRepo } from "../support/temp-repo";

class MemoryRunLogStore implements RunLogStore {
  public readonly runLogs: RunLog[] = [];

  writeRunLog(workspaceRoot: string, runLog: RunLog): string {
    this.runLogs.push(runLog);
    return path.join(workspaceRoot, ".tmp", "runs", `${runLog.run_id}.json`);
  }

  listRunLogs(_workspaceRoot: string, limit: number): RunLog[] {
    return this.runLogs.slice(0, limit);
  }

  deleteRunLog(_workspaceRoot: string, runId: string): RunLogDeleteResult {
    return {
      run_id: runId,
      deleted: false,
      deleted_paths: []
    };
  }

  stageRunExport(_workspaceRoot: string, runId: string, exportedAt: string): RunLogExportResult {
    return {
      run_id: runId,
      staged_export_path: `D:\\unused\\${runId}.json`,
      bundle: {
        version: 1,
        run_id: runId,
        workspace_root: "D:\\unused",
        source_run_path: `D:\\unused\\${runId}.json`,
        exported_at: exportedAt,
        redaction_count: 0,
        placeholders: [],
        note: "Not used in manifest execution tests.",
        run_log: this.runLogs[0] ?? {
          run_id: runId,
          plan_id: "plan-unused",
          manifest_id: "manifest-unused",
          manifest_hash: "manifest-unused",
          events: [],
          attestations: [],
          final_result: {
            status: "failed",
            summary: "Not used in manifest execution tests."
          },
          artifacts: [],
          started_at: ISO_NOW,
          finished_at: ISO_NOW,
          persistence_status: "execution_complete"
        }
      }
    };
  }
}

class ThrowingRunLogStore implements RunLogStore {
  writeRunLog(): string {
    throw new Error("Disk is unavailable.");
  }

  listRunLogs(): RunLog[] {
    return [];
  }

  deleteRunLog(_workspaceRoot: string, runId: string): RunLogDeleteResult {
    return {
      run_id: runId,
      deleted: false,
      deleted_paths: []
    };
  }

  stageRunExport(_workspaceRoot: string, runId: string, exportedAt: string): RunLogExportResult {
    return {
      run_id: runId,
      staged_export_path: `D:\\unused\\${runId}.json`,
      bundle: {
        version: 1,
        run_id: runId,
        workspace_root: "D:\\unused",
        source_run_path: `D:\\unused\\${runId}.json`,
        exported_at: exportedAt,
        redaction_count: 0,
        placeholders: [],
        note: "Not used in manifest execution tests.",
        run_log: {
          run_id: runId,
          plan_id: "plan-unused",
          manifest_id: "manifest-unused",
          manifest_hash: "manifest-unused",
          events: [],
          attestations: [],
          final_result: {
            status: "failed",
            summary: "Not used in manifest execution tests."
          },
          artifacts: [],
          started_at: ISO_NOW,
          finished_at: ISO_NOW,
          persistence_status: "execution_complete"
        }
      }
    };
  }
}

describe("manifest execution runtime", () => {
  it("executes an approved typed manifest, emits structured events, and records attestations", async () => {
    const repo = createTempRepo({
      "package.json": JSON.stringify({ name: "phase-4-fixture", version: "1.0.0" }, null, 2),
      "docs/notes.txt": "hello world\n"
    });
    const approvalRegistry = new InMemoryApprovalRegistry();
    const runLogStore = new MemoryRunLogStore();
    const emittedEvents: RunEvent[] = [];
    const runtime = new ManifestExecutionRuntime({
      approvalRegistry,
      capabilityTokenStore: new InMemoryCapabilityTokenStore(),
      runLogStore,
      now: () => ISO_NOW,
      publishRunEvent: (event) => {
        emittedEvents.push(event);
      }
    });

    try {
      const previewResponse = await createTaskPreview({
        task: 'replace "world" with "JARVIS" in docs/notes.txt',
        session_id: "phase-4-execution",
        workspace_roots: [repo.root],
        requested_at: ISO_NOW
      });

      approvalRegistry.registerManifestPreview({
        manifest: previewResponse.manifest!,
        approval_requests: previewResponse.approval_requests
      });
      approvalRegistry.recordDecision({
        decision: {
          manifest_id: previewResponse.manifest!.manifest_id,
          action_id: previewResponse.approval_requests[0]!.action_id,
          decision: "approve_once",
          approval_scope_class: "exact_action_only",
          approval_signature: previewResponse.approval_requests[0]!.approval_signature,
          execution_hash: previewResponse.approval_requests[0]!.execution_hash,
          max_execution_count: previewResponse.approval_requests[0]!.max_execution_count,
          session_id: previewResponse.approval_requests[0]!.session_id,
          expires_at: previewResponse.approval_requests[0]!.expires_at,
          decided_at: ISO_NOW,
          decided_by: "operator"
        },
        now: ISO_NOW
      });

      const executionResponse = runtime.executeManifest({
        manifest_id: previewResponse.manifest!.manifest_id,
        session_id: "phase-4-execution"
      });

      expect(executionResponse.accepted).toBe(true);
      expect(executionResponse.workflow_state).toBe("review_ready");
      expect(executionResponse.run_log?.final_result.status).toBe("review_ready");
      expect(executionResponse.attestations.every((attestation) => attestation.matched)).toBe(
        true
      );
      expect(repo.readRelativeFile("docs/notes.txt")).toContain("JARVIS");
      expect(emittedEvents.map((event) => event.kind.type)).toContain("tool_output");
      expect(emittedEvents.map((event) => event.kind.type)).toContain("attestation_recorded");
      expect(emittedEvents.map((event) => event.kind.type)).toContain("review_ready");
      expect(runLogStore.runLogs).toHaveLength(1);
    } finally {
      repo.cleanup();
    }
  });

  it("fails safely before the non-trivial write when no valid approval is available", async () => {
    const repo = createTempRepo({
      "package.json": JSON.stringify({ name: "phase-4-fixture", version: "1.0.0" }, null, 2),
      "docs/notes.txt": "hello world\n"
    });
    const approvalRegistry = new InMemoryApprovalRegistry();
    const runLogStore = new MemoryRunLogStore();
    const runtime = new ManifestExecutionRuntime({
      approvalRegistry,
      capabilityTokenStore: new InMemoryCapabilityTokenStore(),
      runLogStore,
      now: () => ISO_NOW
    });

    try {
      const previewResponse = await createTaskPreview({
        task: 'replace "world" with "JARVIS" in docs/notes.txt',
        session_id: "phase-4-execution",
        workspace_roots: [repo.root],
        requested_at: ISO_NOW
      });

      approvalRegistry.registerManifestPreview({
        manifest: previewResponse.manifest!,
        approval_requests: previewResponse.approval_requests
      });

      const executionResponse = runtime.executeManifest({
        manifest_id: previewResponse.manifest!.manifest_id,
        session_id: "phase-4-execution"
      });

      expect(executionResponse.accepted).toBe(false);
      expect(executionResponse.workflow_state).toBe("failed");
      expect(executionResponse.message).toContain("No valid approval");
      expect(repo.readRelativeFile("docs/notes.txt")).toBe("hello world\n");
      expect(runLogStore.runLogs).toHaveLength(1);
    } finally {
      repo.cleanup();
    }
  });

  it("keeps execution visible when run-log persistence fails after attestation", async () => {
    const repo = createTempRepo({
      "package.json": JSON.stringify({ name: "phase-4-fixture", version: "1.0.0" }, null, 2),
      "docs/notes.txt": "hello world\n"
    });
    const approvalRegistry = new InMemoryApprovalRegistry();
    const emittedEvents: RunEvent[] = [];
    const runtime = new ManifestExecutionRuntime({
      approvalRegistry,
      capabilityTokenStore: new InMemoryCapabilityTokenStore(),
      runLogStore: new ThrowingRunLogStore(),
      now: () => ISO_NOW,
      publishRunEvent: (event) => {
        emittedEvents.push(event);
      }
    });

    try {
      const previewResponse = await createTaskPreview({
        task: 'replace "world" with "JARVIS" in docs/notes.txt',
        session_id: "phase-4-execution",
        workspace_roots: [repo.root],
        requested_at: ISO_NOW
      });

      approvalRegistry.registerManifestPreview({
        manifest: previewResponse.manifest!,
        approval_requests: previewResponse.approval_requests
      });
      approvalRegistry.recordDecision({
        decision: {
          manifest_id: previewResponse.manifest!.manifest_id,
          action_id: previewResponse.approval_requests[0]!.action_id,
          decision: "approve_once",
          approval_scope_class: "exact_action_only",
          approval_signature: previewResponse.approval_requests[0]!.approval_signature,
          execution_hash: previewResponse.approval_requests[0]!.execution_hash,
          max_execution_count: previewResponse.approval_requests[0]!.max_execution_count,
          session_id: previewResponse.approval_requests[0]!.session_id,
          expires_at: previewResponse.approval_requests[0]!.expires_at,
          decided_at: ISO_NOW,
          decided_by: "operator"
        },
        now: ISO_NOW
      });

      const executionResponse = runtime.executeManifest({
        manifest_id: previewResponse.manifest!.manifest_id,
        session_id: "phase-4-execution"
      });

      expect(executionResponse.accepted).toBe(true);
      expect(executionResponse.workflow_state).toBe("execution_complete");
      expect(executionResponse.persisted_run_path).toBeNull();
      expect(executionResponse.message).toContain("run log persistence failed");
      expect(executionResponse.run_log?.persistence_status).toBe("execution_complete");
      expect(executionResponse.attestations.every((attestation) => attestation.matched)).toBe(
        true
      );
      expect(repo.readRelativeFile("docs/notes.txt")).toContain("JARVIS");
      expect(emittedEvents.map((event) => event.kind.type)).not.toContain("review_ready");
      expect(emittedEvents.map((event) => event.kind.type)).toContain("run_error");
    } finally {
      repo.cleanup();
    }
  });
});
