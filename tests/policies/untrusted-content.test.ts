import { describe, expect, it } from "vitest";

import { evaluateUntrustedContentBoundary } from "../../src/core/planning/untrusted-content";

describe("untrusted-content boundaries", () => {
  it("treats untrusted sources as data-only and blocks authority escalation", () => {
    for (const sourceKind of ["file", "url", "note", "code_comment"] as const) {
      const decision = evaluateUntrustedContentBoundary({
        sourceKind,
        instructionLikeContentPresent: true,
        explicitUserIntent: false,
        deterministicPolicySatisfied: true,
        leastPrivilegeSatisfied: true,
        approvalGranted: false,
        highRisk: true
      });

      expect(decision.dataOnly).toBe(true);
      expect(decision.canAlterPolicy).toBe(false);
      expect(decision.canAlterSystemInstructions).toBe(false);
      expect(decision.canAlterRouting).toBe(false);
      expect(decision.canAuthorizeToolCall).toBe(false);
    }
  });

  it("still refuses to alter policy even when the action is otherwise allowed", () => {
    const decision = evaluateUntrustedContentBoundary({
      sourceKind: "file",
      instructionLikeContentPresent: true,
      explicitUserIntent: true,
      deterministicPolicySatisfied: true,
      leastPrivilegeSatisfied: true,
      approvalGranted: true,
      highRisk: true
    });

    expect(decision.canAuthorizeToolCall).toBe(true);
    expect(decision.canAlterPolicy).toBe(false);
    expect(decision.canAlterSystemInstructions).toBe(false);
    expect(decision.canAlterRouting).toBe(false);
  });
});
