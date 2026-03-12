import { describe, expect, it } from "vitest";

import {
  buildApprovalRequest,
  classifyRisk,
  createEffectPreview
} from "../../src/core/simulation/simulation-engine";
import type { CompiledAction, EffectPreview } from "../../src/core/schemas";
import {
  ISO_EXPIRY,
  README_PATH,
  WORKSPACE_ROOT,
  validApprovalRequest,
  validCompiledAction
} from "../fixtures";

function buildCompiledAction(overrides: Partial<CompiledAction> = {}): CompiledAction {
  return {
    ...validCompiledAction,
    ...overrides
  };
}

function buildEffectPreview(overrides: Partial<EffectPreview> = {}): EffectPreview {
  return {
    action_id: validCompiledAction.action_id,
    predicted_reads: [],
    predicted_writes: [],
    predicted_deletes: [],
    predicted_process_changes: [],
    predicted_remote_calls: [],
    predicted_system_changes: [],
    confidence: "high",
    notes: [],
    ...overrides
  };
}

describe("simulation engine", () => {
  it("builds exact effect previews for typed read-only tools", () => {
    const effectPreview = createEffectPreview(validCompiledAction);

    expect(effectPreview.predicted_reads).toEqual([README_PATH]);
    expect(effectPreview.predicted_writes).toEqual([]);
    expect(effectPreview.confidence).toBe("high");
  });

  it("classifies overwrite writes outside temp/output paths as DANGER", () => {
    const compiledAction = buildCompiledAction({
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
      requires_approval: true
    });
    const effectPreview = buildEffectPreview({
      action_id: compiledAction.action_id,
      predicted_reads: [README_PATH],
      predicted_writes: [README_PATH]
    });

    const riskAssessment = classifyRisk(compiledAction, effectPreview);

    expect(riskAssessment.risk_level).toBe("DANGER");
    expect(riskAssessment.allowed_scope_classes).toEqual([
      "exact_action_only",
      "never_session_approvable"
    ]);
    expect(riskAssessment.decision_options).toEqual(["deny", "approve_once"]);
  });

  it("keeps complexity and risk separate in the current typed workflow", () => {
    const compiledAction = buildCompiledAction({
      tool_name: "write_text_file",
      normalized_args: {
        path: README_PATH,
        content: "created"
      },
      path_scope: {
        roots: [WORKSPACE_ROOT],
        entries: [
          {
            path: `${WORKSPACE_ROOT}\\.tmp\\scratch.txt`,
            access: "write",
            reason: "create temp output"
          }
        ]
      },
      expected_side_effects: [
        {
          family: "workspace_write",
          target: `${WORKSPACE_ROOT}\\.tmp\\scratch.txt`,
          detail: "write temp file"
        }
      ],
      requires_approval: true
    });
    const effectPreview = buildEffectPreview({
      action_id: compiledAction.action_id,
      predicted_writes: [`${WORKSPACE_ROOT}\\.tmp\\scratch.txt`]
    });

    const riskAssessment = classifyRisk(compiledAction, effectPreview);

    expect(riskAssessment.risk_level).toBe("CAUTION");
    expect(riskAssessment.justification).toContain("approved workspace");
  });

  it("defaults proven read-only raw shell to CAUTION and low-confidence effects to DANGER", () => {
    const rawShellReadonly = buildCompiledAction({
      tool_name: "read_text_file",
      expected_side_effects: [
        {
          family: "raw_shell_readonly",
          target: README_PATH,
          detail: "read-only shell command"
        }
      ]
    });
    const readonlyPreview = buildEffectPreview({
      action_id: rawShellReadonly.action_id,
      predicted_reads: [README_PATH],
      confidence: "high"
    });
    const lowConfidenceWrite = buildEffectPreview({
      action_id: rawShellReadonly.action_id,
      predicted_writes: [README_PATH],
      confidence: "low"
    });

    expect(classifyRisk(rawShellReadonly, readonlyPreview).risk_level).toBe("CAUTION");
    expect(classifyRisk(rawShellReadonly, lowConfidenceWrite).risk_level).toBe("DANGER");
  });

  it("builds exact approval scope without hidden session widening", () => {
    const approvalRequest = buildApprovalRequest({
      compiled_action: {
        ...buildCompiledAction({
          action_id: validApprovalRequest.action_id,
          tool_name: "write_text_file",
          normalized_args: {
            path: README_PATH,
            content: "updated"
          },
          path_scope: validApprovalRequest.path_scope,
          network_scope: validApprovalRequest.network_scope,
          expected_side_effects: [
            {
              family: "workspace_write",
              target: README_PATH,
              detail: "write previewed text file"
            }
          ],
          approval_signature: validApprovalRequest.approval_signature,
          execution_hash: validApprovalRequest.execution_hash,
          requires_approval: true
        })
      },
      risk_assessment: {
        risk_level: "DANGER",
        requires_approval: true,
        allowed_scope_classes: ["exact_action_only", "never_session_approvable"],
        decision_options: ["deny", "approve_once"],
        justification: validApprovalRequest.justification
      },
      session_id: "session-1",
      expires_at: ISO_EXPIRY
    });

    expect(approvalRequest).toEqual(validApprovalRequest);
    expect(approvalRequest?.decision_options).not.toContain("approve_session");
  });
});
