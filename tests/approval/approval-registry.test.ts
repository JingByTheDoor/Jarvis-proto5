import { describe, expect, it } from "vitest";

import { InMemoryApprovalRegistry } from "../../src/core/approval/approval-registry";
import type { CompiledAction, ExecutionManifest } from "../../src/core/schemas";
import type { ApprovalRequest } from "../../src/shared/ipc";
import {
  ISO_LATER,
  ISO_NOW,
  README_PATH,
  validApprovalRequest,
  validCompiledAction,
  validExecutionManifest
} from "../fixtures";

function buildManifest(
  compiledAction: CompiledAction,
  overrides: Partial<ExecutionManifest> = {}
): ExecutionManifest {
  return {
    ...validExecutionManifest,
    compiled_actions: [compiledAction],
    ...overrides
  };
}

function buildApprovalRequest(
  compiledAction: CompiledAction,
  overrides: Partial<ApprovalRequest> = {}
): ApprovalRequest {
  return {
    ...validApprovalRequest,
    action_id: compiledAction.action_id,
    approval_signature: compiledAction.approval_signature,
    execution_hash: compiledAction.execution_hash,
    path_scope: compiledAction.path_scope,
    network_scope: compiledAction.network_scope,
    side_effect_family: compiledAction.expected_side_effects[0]?.family ?? "readonly",
    ...overrides
  };
}

describe("approval registry", () => {
  it("records an exact approve_once decision for a registered compiled manifest", () => {
    const approvalRegistry = new InMemoryApprovalRegistry();
    const compiledAction: CompiledAction = {
      ...validCompiledAction,
      action_id: "action-approve-once",
      tool_name: "write_text_file",
      normalized_args: {
        path: README_PATH,
        content: "updated"
      },
      expected_side_effects: [
        {
          family: "workspace_write",
          target: README_PATH,
          detail: "write previewed text file"
        }
      ],
      risk_level: "DANGER",
      requires_approval: true,
      approval_signature: "approval-signature-approve-once",
      execution_hash: "execution-hash-approve-once"
    };
    const manifest = buildManifest(compiledAction, {
      manifest_id: "manifest-approve-once"
    });
    const approvalRequest = buildApprovalRequest(compiledAction, {
      action_id: compiledAction.action_id,
      decision_options: ["deny", "approve_once"],
      allowed_scope_classes: ["exact_action_only", "never_session_approvable"],
      max_execution_count: 1
    });

    approvalRegistry.registerManifestPreview({
      manifest,
      approval_requests: [approvalRequest]
    });

    const result = approvalRegistry.recordDecision({
      decision: {
        manifest_id: manifest.manifest_id,
        action_id: compiledAction.action_id,
        decision: "approve_once",
        approval_scope_class: "exact_action_only",
        approval_signature: approvalRequest.approval_signature,
        execution_hash: approvalRequest.execution_hash,
        max_execution_count: approvalRequest.max_execution_count,
        session_id: approvalRequest.session_id,
        expires_at: approvalRequest.expires_at,
        decided_at: ISO_LATER,
        decided_by: "operator"
      },
      now: ISO_LATER
    });

    expect(result.accepted).toBe(true);
    expect(result.remaining_uses).toBe(1);
    expect(result.message).toContain("approve_once");
  });

  it("rejects approve_session for never_session_approvable write actions", () => {
    const approvalRegistry = new InMemoryApprovalRegistry();
    const compiledAction: CompiledAction = {
      ...validCompiledAction,
      action_id: "action-no-session",
      tool_name: "write_text_file",
      normalized_args: {
        path: README_PATH,
        content: "updated"
      },
      expected_side_effects: [
        {
          family: "workspace_write",
          target: README_PATH,
          detail: "write previewed text file"
        }
      ],
      risk_level: "DANGER",
      requires_approval: true,
      approval_signature: "approval-signature-no-session",
      execution_hash: "execution-hash-no-session"
    };
    const manifest = buildManifest(compiledAction, {
      manifest_id: "manifest-no-session"
    });
    const approvalRequest = buildApprovalRequest(compiledAction, {
      decision_options: ["deny", "approve_once", "approve_session"],
      allowed_scope_classes: ["exact_action_only", "never_session_approvable"],
      max_execution_count: 3
    });

    approvalRegistry.registerManifestPreview({
      manifest,
      approval_requests: [approvalRequest]
    });

    const result = approvalRegistry.recordDecision({
      decision: {
        manifest_id: manifest.manifest_id,
        action_id: compiledAction.action_id,
        decision: "approve_session",
        approval_scope_class: "never_session_approvable",
        approval_signature: approvalRequest.approval_signature,
        execution_hash: approvalRequest.execution_hash,
        max_execution_count: approvalRequest.max_execution_count,
        session_id: approvalRequest.session_id,
        expires_at: approvalRequest.expires_at,
        decided_at: ISO_LATER,
        decided_by: "operator"
      },
      now: ISO_LATER
    });

    expect(result.accepted).toBe(false);
    expect(result.message).toContain("never session-approvable");
  });

  it("matches session approvals only when both approval_signature and execution_hash stay identical", () => {
    const approvalRegistry = new InMemoryApprovalRegistry();
    const compiledAction: CompiledAction = {
      ...validCompiledAction,
      action_id: "action-session",
      expected_side_effects: [
        {
          family: "raw_shell_readonly",
          target: README_PATH,
          detail: "read-only shell command"
        }
      ],
      risk_level: "CAUTION",
      requires_approval: true,
      approval_signature: "approval-signature-session",
      execution_hash: "execution-hash-session"
    };
    const manifest = buildManifest(compiledAction, {
      manifest_id: "manifest-session"
    });
    const approvalRequest = buildApprovalRequest(compiledAction, {
      risk_level: "CAUTION",
      decision_options: ["deny", "approve_session"],
      allowed_scope_classes: ["session_same_scope"],
      max_execution_count: 3
    });

    approvalRegistry.registerManifestPreview({
      manifest,
      approval_requests: [approvalRequest]
    });

    const recordedApproval = approvalRegistry.recordDecision({
      decision: {
        manifest_id: manifest.manifest_id,
        action_id: compiledAction.action_id,
        decision: "approve_session",
        approval_scope_class: "session_same_scope",
        approval_signature: approvalRequest.approval_signature,
        execution_hash: approvalRequest.execution_hash,
        max_execution_count: approvalRequest.max_execution_count,
        session_id: approvalRequest.session_id,
        expires_at: approvalRequest.expires_at,
        decided_at: ISO_LATER,
        decided_by: "operator"
      },
      now: ISO_LATER
    });

    expect(recordedApproval.accepted).toBe(true);
    expect(recordedApproval.reusable_within_session).toBe(true);
    expect(recordedApproval.remaining_uses).toBe(3);
    expect(
      approvalRegistry.findReusableSessionApproval({
        session_id: approvalRequest.session_id,
        approval_signature: approvalRequest.approval_signature,
        execution_hash: approvalRequest.execution_hash,
        now: ISO_LATER
      })
    ).toEqual(recordedApproval);
    expect(
      approvalRegistry.findReusableSessionApproval({
        session_id: approvalRequest.session_id,
        approval_signature: approvalRequest.approval_signature,
        execution_hash: "execution-hash-changed",
        now: ISO_LATER
      })
    ).toBeNull();
    expect(
      approvalRegistry.findReusableSessionApproval({
        session_id: approvalRequest.session_id,
        approval_signature: "approval-signature-changed",
        execution_hash: approvalRequest.execution_hash,
        now: ISO_LATER
      })
    ).toBeNull();
  });

  it("rejects silent widening when the execution hash changes after simulation", () => {
    const approvalRegistry = new InMemoryApprovalRegistry();
    const compiledAction: CompiledAction = {
      ...validCompiledAction,
      action_id: "action-hash-mismatch",
      approval_signature: "approval-signature-hash-mismatch",
      execution_hash: "execution-hash-registered"
    };
    const manifest = buildManifest(compiledAction, {
      manifest_id: "manifest-hash-mismatch"
    });
    const approvalRequest = buildApprovalRequest(compiledAction, {
      decision_options: ["deny", "approve_once"],
      allowed_scope_classes: ["exact_action_only"]
    });

    approvalRegistry.registerManifestPreview({
      manifest,
      approval_requests: [approvalRequest]
    });

    const result = approvalRegistry.recordDecision({
      decision: {
        manifest_id: manifest.manifest_id,
        action_id: compiledAction.action_id,
        decision: "approve_once",
        approval_scope_class: "exact_action_only",
        approval_signature: approvalRequest.approval_signature,
        execution_hash: "execution-hash-widened",
        max_execution_count: approvalRequest.max_execution_count,
        session_id: approvalRequest.session_id,
        expires_at: approvalRequest.expires_at,
        decided_at: ISO_LATER,
        decided_by: "operator"
      },
      now: ISO_NOW
    });

    expect(result.accepted).toBe(false);
    expect(result.message).toContain("Execution hash changed");
  });
});
