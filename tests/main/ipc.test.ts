import { describe, expect, it } from "vitest";

import { InMemoryApprovalRegistry } from "../../src/core/approval/approval-registry";
import {
  handleApprovalDecisionSubmit,
  handleTaskIntentSubmit
} from "../../src/main/ipc";
import { getJarvisAppUrl } from "../../src/main/protocol";
import { ISO_LATER, ISO_NOW } from "../fixtures";
import { createTempRepo } from "../support/temp-repo";

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
});
