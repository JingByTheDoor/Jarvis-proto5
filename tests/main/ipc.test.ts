import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { InMemoryApprovalRegistry } from "../../src/core/approval/approval-registry";
import { EncryptedRunLogStore } from "../../src/core/events/run-log-store";
import { EncryptedWorkflowProofStore } from "../../src/core/proof/workflow-proof-store";
import type { EncryptedAtRestProvider } from "../../src/core/persistence/encrypted-at-rest";
import {
  handleApprovalDecisionSubmit,
  handlePlannerSettingsUpdate,
  handlePlannerStatusRequest,
  handlePolicySnapshotRequest,
  handleRunDeleteRequest,
  handleRunExportRequest,
  handleTaskIntentSubmit,
  handleWorkflowProofRecord,
  handleWorkflowProofReportRequest,
  handleWorkflowProofSummaryRequest
} from "../../src/main/ipc";
import { TaskPlannerService } from "../../src/core/integrations/task-planner";
import { getJarvisAppUrl } from "../../src/main/protocol";
import {
  ISO_LATER,
  ISO_NOW,
  validPlannerSettingsUpdateRequest,
  validRunLog,
  validWorkflowProofRecord
} from "../fixtures";
import { createTempRepo } from "../support/temp-repo";

class TestEncryptedAtRestProvider implements EncryptedAtRestProvider {
  writeEncryptedJson<T>(filePath: string, _purpose: any, value: T): any {
    fs.mkdirSync(path.dirname(filePath), {
      recursive: true
    });
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
    return {
      version: 1,
      format: "jarvis.encrypted-file",
      algorithm: "aes-256-gcm",
      key_id: "test-key",
      purpose: "cache_entry",
      iv: "iv",
      ciphertext: "ciphertext",
      tag: "tag",
      created_at: ISO_NOW
    };
  }

  readEncryptedJson<T>(filePath: string): T {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  }

  loadOrCreateContentKey(): any {
    throw new Error("Not used in test provider.");
  }
}

const trustedEvent = {
  senderFrame: {
    url: getJarvisAppUrl("/index.html")
  }
};
const ISO_WITHIN_APPROVAL_TTL = "2026-03-11T18:05:00.000Z";

describe("main IPC approval flow", () => {
  it("registers preview approvals and records an exact approve_once decision", async () => {
    const repo = createTempRepo({
      "package.json": JSON.stringify({ name: "phase-3-fixture", version: "1.0.0" }, null, 2),
      "docs/notes.txt": "hello world\n"
    });
    const approvalRegistry = new InMemoryApprovalRegistry();

    try {
      const previewResponse = await handleTaskIntentSubmit(
        trustedEvent,
        {
          task: 'replace "world" with "JARVIS" in docs/notes.txt',
          session_id: "session-main-approve",
          workspace_roots: [repo.root],
          requested_at: ISO_NOW
        },
        approvalRegistry
      );

      const approvalRequest = previewResponse.approval_requests[0];
      const manifest = previewResponse.manifest;

      expect(approvalRequest).toBeDefined();
      expect(manifest).not.toBeNull();

      const approvalResult = handleApprovalDecisionSubmit(
        trustedEvent,
        {
          manifest_id: manifest!.manifest_id,
          action_id: approvalRequest!.action_id,
          decision: "approve_once",
          approval_scope_class: "exact_action_only",
          approval_signature: approvalRequest!.approval_signature,
          execution_hash: approvalRequest!.execution_hash,
          max_execution_count: approvalRequest!.max_execution_count,
          session_id: approvalRequest!.session_id,
          expires_at: approvalRequest!.expires_at,
          decided_at: ISO_WITHIN_APPROVAL_TTL,
          decided_by: "operator"
        },
        approvalRegistry,
        () => ISO_WITHIN_APPROVAL_TTL
      );

      expect(approvalResult.accepted).toBe(true);
      expect(approvalResult.remaining_uses).toBe(1);
      expect(approvalResult.message).toContain("approve_once");
    } finally {
      repo.cleanup();
    }
  });

  it("rejects approval submissions when the signature changes after preview", async () => {
    const repo = createTempRepo({
      "package.json": JSON.stringify({ name: "phase-3-fixture", version: "1.0.0" }, null, 2),
      "docs/notes.txt": "hello world\n"
    });
    const approvalRegistry = new InMemoryApprovalRegistry();

    try {
      const previewResponse = await handleTaskIntentSubmit(
        trustedEvent,
        {
          task: 'replace "world" with "JARVIS" in docs/notes.txt',
          session_id: "session-main-reject",
          workspace_roots: [repo.root],
          requested_at: ISO_NOW
        },
        approvalRegistry
      );

      const approvalRequest = previewResponse.approval_requests[0];
      const manifest = previewResponse.manifest;

      const approvalResult = handleApprovalDecisionSubmit(
        trustedEvent,
        {
          manifest_id: manifest!.manifest_id,
          action_id: approvalRequest!.action_id,
          decision: "approve_once",
          approval_scope_class: "exact_action_only",
          approval_signature: "approval-signature-changed",
          execution_hash: approvalRequest!.execution_hash,
          max_execution_count: approvalRequest!.max_execution_count,
          session_id: approvalRequest!.session_id,
          expires_at: approvalRequest!.expires_at,
          decided_at: ISO_LATER,
          decided_by: "operator"
        },
        approvalRegistry,
        () => ISO_LATER
      );

      expect(approvalResult.accepted).toBe(false);
      expect(approvalResult.message).toContain("Approval signature changed");
    } finally {
      repo.cleanup();
    }
  });

  it("records workflow proof samples and returns a local proof summary", () => {
    const repo = createTempRepo({
      "package.json": JSON.stringify({ name: "phase-6-proof-ipc", version: "1.0.0" }, null, 2)
    });
    const workflowProofStore = new EncryptedWorkflowProofStore(new TestEncryptedAtRestProvider());

    try {
      const recorded = handleWorkflowProofRecord(
        trustedEvent,
        {
          ...validWorkflowProofRecord,
          workspace_root: repo.root
        },
        workflowProofStore
      );
      const summary = handleWorkflowProofSummaryRequest(
        trustedEvent,
        {
          workspace_root: repo.root,
          limit: 5
        },
        workflowProofStore
      );
      const report = handleWorkflowProofReportRequest(
        trustedEvent,
        {
          workspace_root: repo.root,
          limit: 5
        },
        workflowProofStore,
        () => ISO_LATER
      );

      expect(recorded.workspace_root).toBe(repo.root);
      expect(summary.summary.golden_workflow_attempts).toBe(1);
      expect(summary.summary.golden_workflow_review_ready).toBe(1);
      expect(summary.gate_status.overall_status).toBe("collecting_evidence");
      expect(summary.recent_journeys[0]?.journey_id).toBe(recorded.journey_id);
      expect(report.generated_at).toBe(ISO_LATER);
      expect(report.report_markdown).toContain("# Workflow Proof Report");
      expect(report.report_markdown).toContain("Overall gate: collecting_evidence");
    } finally {
      repo.cleanup();
    }
  });

  it("returns the app startup timestamp in the policy snapshot", () => {
    const response = handlePolicySnapshotRequest(
      trustedEvent,
      {
        session_id: "phase-6-proof-gate"
      },
      {
        now: () => ISO_LATER,
        appStartedAt: "2026-03-11T17:59:59.500Z"
      }
    );

    expect(response.version).toBe("phase-6-planner-assist");
    expect(response.app_started_at).toBe("2026-03-11T17:59:59.500Z");
    expect(response.retention_policy.run_history_days).toBe(30);
    expect(response.retention_policy.export_staging_encrypted_at_rest).toBe(true);
    expect(response.sensitive_session_defaults.reduced_logging).toBe(true);
  });

  it("deletes persisted run logs and staged exports through typed IPC", () => {
    const repo = createTempRepo({
      "package.json": JSON.stringify({ name: "phase-6-run-controls", version: "1.0.0" }, null, 2)
    });
    const runLogStore = new EncryptedRunLogStore(new TestEncryptedAtRestProvider());

    try {
      runLogStore.writeRunLog(repo.root, validRunLog);
      runLogStore.stageRunExport(repo.root, validRunLog.run_id, ISO_NOW);

      const response = handleRunDeleteRequest(
        trustedEvent,
        {
          workspace_root: repo.root,
          run_id: validRunLog.run_id
        },
        runLogStore
      );

      expect(response.deleted).toBe(true);
      expect(response.deleted_paths).toHaveLength(2);
      expect(response.message).toContain("Deleted local review artifacts");
    } finally {
      repo.cleanup();
    }
  });

  it("stages a sanitized encrypted run export through typed IPC", () => {
    const repo = createTempRepo({
      "package.json": JSON.stringify({ name: "phase-6-run-export", version: "1.0.0" }, null, 2)
    });
    const runLogStore = new EncryptedRunLogStore(new TestEncryptedAtRestProvider());

    try {
      runLogStore.writeRunLog(repo.root, {
        ...validRunLog,
        final_result: {
          ...validRunLog.final_result,
          summary: "Authorization: Bearer sk-ABCDEFGH12345678"
        }
      });

      const response = handleRunExportRequest(
        trustedEvent,
        {
          workspace_root: repo.root,
          run_id: validRunLog.run_id
        },
        runLogStore,
        () => ISO_LATER
      );

      expect(response.staged_export_path).toContain(".tmp\\exports\\run-1.json");
      expect(response.bundle.run_log.final_result.summary).toContain("[REDACTED:");
      expect(response.redaction_count).toBeGreaterThan(0);
      expect(response.message).toContain("sanitized encrypted export");
    } finally {
      repo.cleanup();
    }
  });

  it("reports planner provider health and allows session-local settings updates", async () => {
    const planner = new TaskPlannerService({
      now: () => ISO_NOW,
      fetch: (async (input: string | URL, init?: RequestInit) => {
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
                intent_kind: "inspect_repo",
                confidence: "high",
                rationale: "Read-only inspection is sufficient.",
                target_path: null,
                search_text: null,
                replacement_text: null,
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

        throw new Error(`Unexpected planner request: ${url}`);
      }) as typeof fetch
    });

    const statusResponse = await handlePlannerStatusRequest(
      trustedEvent,
      {
        session_id: "phase-6-proof-gate"
      },
      planner
    );

    expect(statusResponse.mode).toBe("active");
    expect(statusResponse.model_name).toBe("qwen2.5:3b");

    const updatedResponse = await handlePlannerSettingsUpdate(
      trustedEvent,
      validPlannerSettingsUpdateRequest,
      planner
    );

    expect(updatedResponse.source).toBe("session_override");
    expect(updatedResponse.endpoint_url).toBe("http://127.0.0.1:11434");
  });
});
