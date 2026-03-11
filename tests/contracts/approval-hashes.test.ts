import { describe, expect, it } from "vitest";

import {
  createApprovalSignature,
  createExecutionHash,
  type ApprovalHashInput
} from "../../src/core/approval/hashes";
import { validCompiledAction } from "../fixtures";

function buildApprovalHashInput(): ApprovalHashInput {
  return {
    tool_name: validCompiledAction.tool_name,
    normalized_args: validCompiledAction.normalized_args,
    side_effect_family: "readonly",
    workspace_scope: validCompiledAction.workspace_scope,
    path_scope: validCompiledAction.path_scope,
    network_scope: validCompiledAction.network_scope,
    max_execution_count: 1,
    session_id: "session-1",
    expires_at: "2026-03-11T20:00:00.000Z"
  };
}

describe("approval signature hashing", () => {
  it("is stable for identical inputs", () => {
    const input = buildApprovalHashInput();
    expect(createApprovalSignature(input)).toBe(createApprovalSignature(input));
  });

  it("changes when any covered field changes", () => {
    const base = buildApprovalHashInput();
    const original = createApprovalSignature(base);

    const variants: ApprovalHashInput[] = [
      { ...base, tool_name: "write_text_file" },
      { ...base, normalized_args: { path: "D:\\Jarvis-proto5 repo\\Jarvis-proto5\\README2.md" } },
      { ...base, side_effect_family: "workspace_write" },
      { ...base, workspace_scope: { roots: ["D:\\AnotherWorkspace"] } },
      {
        ...base,
        path_scope: {
          roots: ["D:\\Jarvis-proto5 repo\\Jarvis-proto5"],
          entries: [
            {
              path: "D:\\Jarvis-proto5 repo\\Jarvis-proto5\\docs\\constitution.md",
              access: "read"
            }
          ]
        }
      },
      {
        ...base,
        network_scope: {
          default_policy: "deny",
          allow: [
            {
              scheme: "https",
              host: "example.com",
              port: 443,
              methodFamily: "read_methods",
              accessClass: "read"
            }
          ]
        }
      },
      { ...base, max_execution_count: 2 },
      { ...base, session_id: "session-2" },
      { ...base, expires_at: "2026-03-11T21:00:00.000Z" }
    ];

    for (const variant of variants) {
      expect(createApprovalSignature(variant)).not.toBe(original);
    }
  });

  it("changes execution hashes when execution scope changes", () => {
    const base = createExecutionHash({
      tool_name: validCompiledAction.tool_name,
      normalized_args: validCompiledAction.normalized_args,
      workspace_scope: validCompiledAction.workspace_scope,
      path_scope: validCompiledAction.path_scope,
      network_scope: validCompiledAction.network_scope,
      expected_side_effects: validCompiledAction.expected_side_effects
    });

    const changed = createExecutionHash({
      tool_name: validCompiledAction.tool_name,
      normalized_args: {
        path: "D:\\Jarvis-proto5 repo\\Jarvis-proto5\\docs\\constitution.md"
      },
      workspace_scope: validCompiledAction.workspace_scope,
      path_scope: validCompiledAction.path_scope,
      network_scope: validCompiledAction.network_scope,
      expected_side_effects: validCompiledAction.expected_side_effects
    });

    expect(changed).not.toBe(base);
  });
});
