import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { attestTypedToolExecution } from "../../src/core/attestation/typed-tool-attestation";
import { createExecutionHash } from "../../src/core/approval/hashes";
import type { CompiledAction, ToolResult } from "../../src/core/schemas";
import { ISO_LATER, ISO_NOW, validCompiledAction } from "../fixtures";
import { createTempRepo } from "../support/temp-repo";

describe("typed tool attestation", () => {
  it("matches an exact typed file write when the final file contents are correct", () => {
    const repo = createTempRepo({
      "docs/notes.txt": "hello world\n"
    });

    try {
      const targetPath = path.join(repo.root, "docs", "notes.txt");
      const compiledAction: CompiledAction = {
        ...validCompiledAction,
        action_id: "action-write",
        tool_name: "write_text_file",
        normalized_args: {
          path: targetPath,
          content: "hello jarvis\n"
        },
        workspace_scope: {
          roots: [repo.root]
        },
        path_scope: {
          roots: [repo.root],
          entries: [
            {
              path: targetPath,
              access: "write",
              reason: "apply previewed file update"
            }
          ]
        },
        expected_side_effects: [
          {
            family: "workspace_write",
            target: targetPath,
            detail: "write text file"
          }
        ],
        risk_level: "DANGER",
        requires_approval: true,
        execution_hash: ""
      };
      const executionHash = createExecutionHash({
        tool_name: compiledAction.tool_name,
        normalized_args: compiledAction.normalized_args,
        workspace_scope: compiledAction.workspace_scope,
        path_scope: compiledAction.path_scope,
        network_scope: compiledAction.network_scope,
        expected_side_effects: compiledAction.expected_side_effects
      });
      compiledAction.execution_hash = executionHash;
      fs.writeFileSync(targetPath, "hello jarvis\n", "utf8");
      const toolResult: ToolResult = {
        ok: true,
        summary: "Wrote file",
        output: {
          path: targetPath
        },
        redacted_output: {
          path: targetPath
        },
        error: null,
        artifacts: [],
        structured_data: {
          bytes_written: 13
        },
        observed_effects: [
          {
            family: "workspace_write",
            target: targetPath,
            detail: "write text file"
          }
        ]
      };

      const attestation = attestTypedToolExecution({
        run_id: "run-1",
        compiled_action: compiledAction,
        tool_result: toolResult,
        attested_at: ISO_LATER
      });

      expect(attestation.matched).toBe(true);
      expect(attestation.deviations).toEqual([]);
      expect(attestation.approved_execution_hash).toBe(attestation.actual_execution_hash);
    } finally {
      repo.cleanup();
    }
  });

  it("records deviations when observed effects exceed scope or the write result drifts", () => {
    const repo = createTempRepo({
      "docs/notes.txt": "hello world\n"
    });

    try {
      const targetPath = path.join(repo.root, "docs", "notes.txt");
      const outsidePath = path.join(repo.root, "README.md");
      const compiledAction: CompiledAction = {
        ...validCompiledAction,
        action_id: "action-write-drift",
        tool_name: "write_text_file",
        normalized_args: {
          path: targetPath,
          content: "expected content\n"
        },
        workspace_scope: {
          roots: [repo.root]
        },
        path_scope: {
          roots: [repo.root],
          entries: [
            {
              path: targetPath,
              access: "write",
              reason: "apply previewed file update"
            }
          ]
        },
        expected_side_effects: [
          {
            family: "workspace_write",
            target: targetPath,
            detail: "write text file"
          }
        ],
        risk_level: "DANGER",
        requires_approval: true
      };
      fs.writeFileSync(targetPath, "unexpected content\n", "utf8");
      const toolResult: ToolResult = {
        ok: true,
        summary: "Wrote file",
        output: {
          path: targetPath
        },
        redacted_output: {
          path: targetPath
        },
        error: null,
        artifacts: [],
        structured_data: null,
        observed_effects: [
          {
            family: "workspace_write",
            target: outsidePath,
            detail: "write text file"
          }
        ]
      };

      const attestation = attestTypedToolExecution({
        run_id: "run-1",
        compiled_action: compiledAction,
        tool_result: toolResult,
        attested_at: ISO_NOW
      });

      expect(attestation.matched).toBe(false);
      expect(attestation.deviations).toContain("scope_exceeded");
      expect(attestation.deviations).toContain("unexpected_write");
      expect(attestation.deviations).toContain("hash_changed");
    } finally {
      repo.cleanup();
    }
  });
});
