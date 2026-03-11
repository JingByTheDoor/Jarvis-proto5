import type { UntrustedSourceKind } from "../../shared/constants";

export interface UntrustedContentContext {
  readonly sourceKind: UntrustedSourceKind;
  readonly instructionLikeContentPresent: boolean;
  readonly explicitUserIntent: boolean;
  readonly deterministicPolicySatisfied: boolean;
  readonly leastPrivilegeSatisfied: boolean;
  readonly approvalGranted: boolean;
  readonly highRisk: boolean;
}

export interface UntrustedContentDecision {
  readonly sourceKind: UntrustedSourceKind;
  readonly dataOnly: true;
  readonly canAlterPolicy: false;
  readonly canAlterSystemInstructions: false;
  readonly canAlterRouting: false;
  readonly canAuthorizeToolCall: boolean;
  readonly requiresExplicitHumanApproval: boolean;
  readonly reasons: readonly string[];
}

export function evaluateUntrustedContentBoundary(
  context: UntrustedContentContext
): UntrustedContentDecision {
  const reasons = [
    `${context.sourceKind} is always treated as untrusted data`,
    "instruction-like content inside untrusted sources is never authority"
  ];

  const hasExecutionAuthority =
    context.explicitUserIntent &&
    context.deterministicPolicySatisfied &&
    context.leastPrivilegeSatisfied &&
    (!context.highRisk || context.approvalGranted);

  if (!context.explicitUserIntent) {
    reasons.push("explicit user intent is required before any tool call may proceed");
  }

  if (context.highRisk && !context.approvalGranted) {
    reasons.push("high-risk actions influenced by untrusted content require approval");
  }

  return {
    sourceKind: context.sourceKind,
    dataOnly: true,
    canAlterPolicy: false,
    canAlterSystemInstructions: false,
    canAlterRouting: false,
    canAuthorizeToolCall: hasExecutionAuthority,
    requiresExplicitHumanApproval: context.highRisk,
    reasons
  };
}

