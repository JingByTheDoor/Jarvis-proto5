import type { ApprovalDecision, CompiledAction, ExecutionManifest } from "../schemas";
import type { ApprovalDecisionResponse, ApprovalRequest } from "../../shared/ipc";
import type { SideEffectFamily } from "../../shared/constants";

const destructiveSideEffectFamilies = new Set<SideEffectFamily>([
  "workspace_delete",
  "process_terminate",
  "remote_write",
  "system_mutation",
  "credential_use",
  "raw_shell_mutating"
]);

interface RegisteredApprovalRequest {
  readonly manifest_id: string;
  readonly manifest_hash: string;
  readonly compiled_action: CompiledAction;
  readonly approval_request: ApprovalRequest;
}

interface StoredApprovalDecision extends ApprovalDecisionResponse {}

export interface ApprovalRegistry {
  registerManifestPreview(input: {
    readonly manifest: ExecutionManifest;
    readonly approval_requests: readonly ApprovalRequest[];
  }): void;
  getManifest: (manifestId: string) => ExecutionManifest | null;
  recordDecision(input: {
    readonly decision: ApprovalDecision;
    readonly now: string;
  }): ApprovalDecisionResponse;
  consumeApprovalForExecution: (input: {
    readonly manifest_id: string;
    readonly action_id: string;
    readonly session_id: string;
    readonly now: string;
  }) => ApprovalDecisionResponse | null;
  findReusableSessionApproval(input: {
    readonly session_id: string;
    readonly approval_signature: string;
    readonly execution_hash: string;
    readonly now: string;
  }): ApprovalDecisionResponse | null;
}

function buildPendingKey(manifestId: string, actionId: string): string {
  return `${manifestId}:${actionId}`;
}

function buildSessionCoverageKey(
  sessionId: string,
  approvalSignature: string,
  executionHash: string
): string {
  return `${sessionId}:${approvalSignature}:${executionHash}`;
}

function buildDecisionResponse(
  decision: ApprovalDecision,
  overrides: Partial<ApprovalDecisionResponse>
): ApprovalDecisionResponse {
  return {
    accepted: false,
    manifest_id: decision.manifest_id,
    action_id: decision.action_id,
    decision: decision.decision,
    approval_scope_class: decision.approval_scope_class,
    approval_signature: decision.approval_signature,
    execution_hash: decision.execution_hash,
    max_execution_count: decision.max_execution_count,
    session_id: decision.session_id,
    expires_at: decision.expires_at,
    decided_at: decision.decided_at,
    decided_by: decision.decided_by,
    remaining_uses: 0,
    reusable_within_session: false,
    message: "Approval decision was not recorded.",
    ...overrides
  };
}

function isExpired(expiresAt: string, now: string): boolean {
  return new Date(now).getTime() > new Date(expiresAt).getTime();
}

function getPrimarySideEffectFamily(compiledAction: CompiledAction): SideEffectFamily {
  return compiledAction.expected_side_effects[0]?.family ?? "readonly";
}

function rejectDecision(
  decision: ApprovalDecision,
  message: string
): ApprovalDecisionResponse {
  return buildDecisionResponse(decision, {
    accepted: false,
    message
  });
}

export class InMemoryApprovalRegistry implements ApprovalRegistry {
  private readonly manifests = new Map<string, ExecutionManifest>();
  private readonly pendingApprovals = new Map<string, RegisteredApprovalRequest>();
  private readonly sessionApprovals = new Map<string, StoredApprovalDecision>();
  private readonly recordedDecisions = new Map<string, StoredApprovalDecision>();

  registerManifestPreview(input: {
    readonly manifest: ExecutionManifest;
    readonly approval_requests: readonly ApprovalRequest[];
  }): void {
    this.manifests.set(input.manifest.manifest_id, input.manifest);

    for (const approvalRequest of input.approval_requests) {
      const compiledAction = input.manifest.compiled_actions.find(
        (action) => action.action_id === approvalRequest.action_id
      );

      if (!compiledAction) {
        throw new Error(
          `Approval request ${approvalRequest.action_id} does not match a compiled action in ${input.manifest.manifest_id}.`
        );
      }

      this.pendingApprovals.set(
        buildPendingKey(input.manifest.manifest_id, approvalRequest.action_id),
        {
          manifest_id: input.manifest.manifest_id,
          manifest_hash: input.manifest.manifest_hash,
          compiled_action: compiledAction,
          approval_request: approvalRequest
        }
      );
    }
  }

  getManifest(manifestId: string): ExecutionManifest | null {
    return this.manifests.get(manifestId) ?? null;
  }

  recordDecision(input: {
    readonly decision: ApprovalDecision;
    readonly now: string;
  }): ApprovalDecisionResponse {
    const pendingApproval = this.pendingApprovals.get(
      buildPendingKey(input.decision.manifest_id, input.decision.action_id)
    );

    if (!pendingApproval) {
      return rejectDecision(
        input.decision,
        "No matching compiled manifest approval request is registered for this action."
      );
    }

    const { approval_request: approvalRequest, compiled_action: compiledAction } =
      pendingApproval;

    if (approvalRequest.session_id !== input.decision.session_id) {
      return rejectDecision(
        input.decision,
        "Approval decision session does not match the registered approval request."
      );
    }

    if (approvalRequest.approval_signature !== input.decision.approval_signature) {
      return rejectDecision(
        input.decision,
        "Approval signature changed after simulation; silent widening is not allowed."
      );
    }

    if (compiledAction.execution_hash !== input.decision.execution_hash) {
      return rejectDecision(
        input.decision,
        "Execution hash changed after simulation; silent widening is not allowed."
      );
    }

    if (approvalRequest.expires_at !== input.decision.expires_at) {
      return rejectDecision(
        input.decision,
        "Approval expiry changed after simulation; silent widening is not allowed."
      );
    }

    if (approvalRequest.max_execution_count !== input.decision.max_execution_count) {
      return rejectDecision(
        input.decision,
        "Approval execution count changed after simulation; silent widening is not allowed."
      );
    }

    if (isExpired(input.decision.expires_at, input.now)) {
      return rejectDecision(input.decision, "Approval request has expired.");
    }

    if (!approvalRequest.decision_options.includes(input.decision.decision)) {
      return rejectDecision(
        input.decision,
        "The requested decision kind is not allowed for this approval scope."
      );
    }

    if (!approvalRequest.allowed_scope_classes.includes(input.decision.approval_scope_class)) {
      return rejectDecision(
        input.decision,
        "The requested approval scope class is not allowed for this compiled action."
      );
    }

    if (
      input.decision.decision === "approve_once" &&
      input.decision.approval_scope_class !== "exact_action_only"
    ) {
      return rejectDecision(
        input.decision,
        "approve_once must stay bound to exact_action_only."
      );
    }

    if (input.decision.decision === "approve_session") {
      const sideEffectFamily = getPrimarySideEffectFamily(compiledAction);

      if (approvalRequest.allowed_scope_classes.includes("never_session_approvable")) {
        return rejectDecision(
          input.decision,
          "This compiled action is never session-approvable."
        );
      }

      if (destructiveSideEffectFamilies.has(sideEffectFamily)) {
        return rejectDecision(
          input.decision,
          "Destructive or mutating raw-shell actions are never session-approvable."
        );
      }

      if (
        input.decision.approval_scope_class === "exact_action_only" ||
        input.decision.approval_scope_class === "never_session_approvable"
      ) {
        return rejectDecision(
          input.decision,
          "approve_session requires a session scope class instead of an exact-action scope."
        );
      }

      if (input.decision.max_execution_count <= 1) {
        return rejectDecision(
          input.decision,
          "approve_session must allow more than one execution within the session."
        );
      }
    }

    const remainingUses =
      input.decision.decision === "approve_session"
        ? input.decision.max_execution_count
        : input.decision.decision === "approve_once"
          ? 1
          : 0;

    const recordedDecision = buildDecisionResponse(input.decision, {
      accepted: true,
      remaining_uses: remainingUses,
      reusable_within_session: input.decision.decision === "approve_session",
      message:
        input.decision.decision === "deny"
          ? "Recorded deny for the exact compiled action."
          : input.decision.decision === "approve_session"
            ? "Recorded approve_session for identical approval_signature plus execution_hash only."
            : "Recorded approve_once for the exact compiled action."
    });

    this.recordedDecisions.set(
      buildPendingKey(input.decision.manifest_id, input.decision.action_id),
      recordedDecision
    );

    if (recordedDecision.reusable_within_session) {
      this.sessionApprovals.set(
        buildSessionCoverageKey(
          input.decision.session_id,
          input.decision.approval_signature,
          input.decision.execution_hash
        ),
        recordedDecision
      );
    }

    return recordedDecision;
  }

  consumeApprovalForExecution(input: {
    readonly manifest_id: string;
    readonly action_id: string;
    readonly session_id: string;
    readonly now: string;
  }): ApprovalDecisionResponse | null {
    const decisionKey = buildPendingKey(input.manifest_id, input.action_id);
    const recordedDecision = this.recordedDecisions.get(decisionKey);

    if (!recordedDecision || !recordedDecision.accepted) {
      return null;
    }

    if (recordedDecision.session_id !== input.session_id) {
      return null;
    }

    if (isExpired(recordedDecision.expires_at, input.now) || recordedDecision.remaining_uses < 1) {
      return null;
    }

    const updatedDecision = {
      ...recordedDecision,
      remaining_uses: recordedDecision.remaining_uses - 1
    } satisfies ApprovalDecisionResponse;

    this.recordedDecisions.set(decisionKey, updatedDecision);

    if (updatedDecision.reusable_within_session) {
      this.sessionApprovals.set(
        buildSessionCoverageKey(
          updatedDecision.session_id,
          updatedDecision.approval_signature,
          updatedDecision.execution_hash
        ),
        updatedDecision
      );
    }

    return updatedDecision;
  }

  findReusableSessionApproval(input: {
    readonly session_id: string;
    readonly approval_signature: string;
    readonly execution_hash: string;
    readonly now: string;
  }): ApprovalDecisionResponse | null {
    const matchingApproval = this.sessionApprovals.get(
      buildSessionCoverageKey(
        input.session_id,
        input.approval_signature,
        input.execution_hash
      )
    );

    if (!matchingApproval) {
      return null;
    }

    if (isExpired(matchingApproval.expires_at, input.now) || matchingApproval.remaining_uses < 1) {
      return null;
    }

    return matchingApproval;
  }
}
