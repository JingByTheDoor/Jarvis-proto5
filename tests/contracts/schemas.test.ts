import { describe, expect, it } from "vitest";

import { schemaRegistry } from "../../src/core/schemas";
import {
  validAction,
  validApprovalDecision,
  validCompiledAction,
  validExecutionAttestation,
  validExecutionManifest,
  validMemoryRecord,
  validPlan,
  validRunEvent,
  validRunLog,
  validToolResult,
  validWorkflowProofRecord,
  validWorkflowProofSummaryResponse
} from "../fixtures";

const examples = {
  PLAN: validPlan,
  ACTION: validAction,
  EXECUTION_MANIFEST: validExecutionManifest,
  COMPILED_ACTION: validCompiledAction,
  EFFECT_PREVIEW: {
    action_id: "action-1",
    predicted_reads: ["D:\\Jarvis-proto5 repo\\Jarvis-proto5\\README.md"],
    predicted_writes: [],
    predicted_deletes: [],
    predicted_process_changes: [],
    predicted_remote_calls: [],
    predicted_system_changes: [],
    confidence: "high",
    notes: ["deterministic local read"]
  },
  APPROVAL_DECISION: validApprovalDecision,
  RUN_EVENT: validRunEvent,
  RUN_LOG: validRunLog,
  TOOL_RESULT: validToolResult,
  EXECUTION_ATTESTATION: validExecutionAttestation,
  MEMORY_RECORD: validMemoryRecord,
  WORKFLOW_PROOF_RECORD: validWorkflowProofRecord,
  WORKFLOW_PROOF_SUMMARY: validWorkflowProofSummaryResponse.summary
} as const;

const invalidExamples = {
  PLAN: {
    ...validPlan,
    created_at: "not-a-date"
  },
  ACTION: {
    ...validAction,
    approval_scope_allowed: []
  },
  EXECUTION_MANIFEST: {
    ...validExecutionManifest,
    expires_at: "never"
  },
  COMPILED_ACTION: {
    ...validCompiledAction,
    workspace_scope: {
      roots: ["relative\\path"]
    }
  },
  EFFECT_PREVIEW: {
    action_id: "action-1",
    predicted_reads: [],
    predicted_writes: [],
    predicted_deletes: [],
    predicted_process_changes: [],
    predicted_remote_calls: [],
    predicted_system_changes: [],
    confidence: "certain",
    notes: []
  },
  APPROVAL_DECISION: {
    ...validApprovalDecision,
    decision: "approve"
  },
  RUN_EVENT: {
    ...validRunEvent,
    kind: {
      category: "UNKNOWN",
      type: "plan_ready"
    }
  },
  RUN_LOG: {
    ...validRunLog,
    persistence_status: "saved"
  },
  TOOL_RESULT: {
    ...validToolResult,
    observed_effects: "not-an-array"
  },
  EXECUTION_ATTESTATION: {
    ...validExecutionAttestation,
    deviations: ["not-a-real-deviation"]
  },
  MEMORY_RECORD: {
    ...validMemoryRecord,
    metadata: {
      ...validMemoryRecord.metadata,
      verification_status: "verified"
    }
  },
  WORKFLOW_PROOF_RECORD: {
    ...validWorkflowProofRecord,
    journey_kind: "not-a-real-kind"
  },
  WORKFLOW_PROOF_SUMMARY: {
    ...validWorkflowProofSummaryResponse.summary,
    golden_workflow_stability_rate: 2
  }
} as const;

describe("schema registry", () => {
  it("exports the expected core contracts", () => {
    expect(Object.keys(schemaRegistry)).toEqual([
      "PLAN",
      "ACTION",
      "EXECUTION_MANIFEST",
      "COMPILED_ACTION",
      "EFFECT_PREVIEW",
      "APPROVAL_DECISION",
      "RUN_EVENT",
      "RUN_LOG",
      "TOOL_RESULT",
      "EXECUTION_ATTESTATION",
      "MEMORY_RECORD",
      "WORKFLOW_PROOF_RECORD",
      "WORKFLOW_PROOF_SUMMARY"
    ]);
  });

  for (const [name, schema] of Object.entries(schemaRegistry)) {
    it(`accepts a valid ${name} example`, () => {
      expect(schema.safeParse(examples[name as keyof typeof examples]).success).toBe(true);
    });

    it(`rejects the primary failure case for ${name}`, () => {
      expect(schema.safeParse(invalidExamples[name as keyof typeof invalidExamples]).success).toBe(
        false
      );
    });
  }
});
