import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { InMemoryApprovalRegistry } from "../../src/core/approval/approval-registry";
import { EncryptedWorkflowProofStore } from "../../src/core/proof/workflow-proof-store";
import type { EncryptedAtRestProvider } from "../../src/core/persistence/encrypted-at-rest";
import {
  handleApprovalDecisionSubmit,
  handlePolicySnapshotRequest,
  handleTaskIntentSubmit,
  handleWorkflowProofRecord,
  handleWorkflowProofSummaryRequest
} from "../../src/main/ipc";
import { getJarvisAppUrl } from "../../src/main/protocol";
import {
  ISO_LATER,
  ISO_NOW,
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
  it("registers preview approvals and records an exact approve_once decision", () => {
    const repo = createTempRepo({
      "package.json": JSON.stringify({ name: "phase-3-fixture", version: "1.0.0" }, null, 2),
      "docs/notes.txt": "hello world\n"
    });
    const approvalRegistry = new InMemoryApprovalRegistry();

    try {
      const previewResponse = handleTaskIntentSubmit(
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

  it("rejects approval submissions when the signature changes after preview", () => {
    const repo = createTempRepo({
      "package.json": JSON.stringify({ name: "phase-3-fixture", version: "1.0.0" }, null, 2),
      "docs/notes.txt": "hello world\n"
    });
    const approvalRegistry = new InMemoryApprovalRegistry();

    try {
      const previewResponse = handleTaskIntentSubmit(
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

      expect(recorded.workspace_root).toBe(repo.root);
      expect(summary.summary.golden_workflow_attempts).toBe(1);
      expect(summary.summary.golden_workflow_review_ready).toBe(1);
      expect(summary.gate_status.overall_status).toBe("collecting_evidence");
      expect(summary.recent_journeys[0]?.journey_id).toBe(recorded.journey_id);
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

    expect(response.version).toBe("phase-6-proof-gate");
    expect(response.app_started_at).toBe("2026-03-11T17:59:59.500Z");
  });
});
