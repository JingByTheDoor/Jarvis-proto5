import type { ApprovalRegistry } from "../approval/approval-registry";
import { attestTypedToolExecution } from "../attestation/typed-tool-attestation";
import type { CapabilityTokenStore } from "../capabilities/capability-token-store";
import type {
  ExecutionAttestation,
  RunEvent,
  RunLog,
  ToolResult
} from "../schemas";
import type { RunLogStore } from "../events/run-log-store";
import { getToolDefinition } from "../tools/repo-file-tools";
import type { RunExecutionResponse } from "../../shared/ipc";

export interface ManifestExecutionRuntimeOptions {
  readonly approvalRegistry: ApprovalRegistry;
  readonly capabilityTokenStore: CapabilityTokenStore;
  readonly runLogStore: RunLogStore;
  readonly now: () => string;
  readonly publishRunEvent?: (event: RunEvent) => void;
}

function getWorkspaceRootFromManifest(manifestId: string, workspaceRoots: readonly string[]): string {
  const workspaceRoot = workspaceRoots[0];
  if (!workspaceRoot) {
    throw new Error(`Manifest ${manifestId} does not declare a workspace root.`);
  }

  return workspaceRoot;
}

function buildRunEvent(input: {
  readonly run_id: string;
  readonly category: RunEvent["kind"]["category"];
  readonly type: RunEvent["kind"]["type"];
  readonly timestamp: string;
  readonly payload: Record<string, unknown>;
}): RunEvent {
  return {
    run_id: input.run_id,
    kind: {
      category: input.category,
      type: input.type
    },
    timestamp: input.timestamp,
    payload: input.payload
  };
}

function buildRunLog(input: {
  readonly run_id: string;
  readonly plan_id: string;
  readonly manifest_id: string;
  readonly manifest_hash: string;
  readonly events: readonly RunEvent[];
  readonly attestations: readonly ExecutionAttestation[];
  readonly artifacts: ReadonlyArray<RunLog["artifacts"][number]>;
  readonly started_at: string;
  readonly finished_at: string;
  readonly summary: string;
  readonly status: RunLog["final_result"]["status"];
  readonly persistence_status: RunLog["persistence_status"];
}): RunLog {
  return {
    run_id: input.run_id,
    plan_id: input.plan_id,
    manifest_id: input.manifest_id,
    manifest_hash: input.manifest_hash,
    events: [...input.events],
    attestations: [...input.attestations],
    final_result: {
      status: input.status,
      summary: input.summary
    },
    artifacts: [...input.artifacts],
    started_at: input.started_at,
    finished_at: input.finished_at,
    persistence_status: input.persistence_status
  };
}

export class ManifestExecutionRuntime {
  private readonly publishRunEvent: (event: RunEvent) => void;

  public constructor(private readonly options: ManifestExecutionRuntimeOptions) {
    this.publishRunEvent = options.publishRunEvent ?? (() => {});
  }

  public executeManifest(input: {
    readonly manifest_id: string;
    readonly session_id: string;
  }): RunExecutionResponse {
    const manifest = this.options.approvalRegistry.getManifest(input.manifest_id);

    if (!manifest) {
      return {
        accepted: false,
        workflow_state: "failed",
        message: "No compiled manifest is registered for execution.",
        run_id: null,
        persisted_run_path: null,
        run_log: null,
        tool_results: [],
        attestations: []
      };
    }

    const events: RunEvent[] = [];
    const toolResults: ToolResult[] = [];
    const attestations: ExecutionAttestation[] = [];
    const startedAt = this.options.now();

    const emit = (
      category: RunEvent["kind"]["category"],
      type: RunEvent["kind"]["type"],
      payload: Record<string, unknown>
    ): void => {
      const event = buildRunEvent({
        run_id: manifest.run_id,
        category,
        type,
        timestamp: this.options.now(),
        payload
      });

      events.push(event);
      this.publishRunEvent(event);
    };

    let failureMessage: string | null = null;

    for (const compiledAction of manifest.compiled_actions) {
      emit("STEP", "action_started", {
        action_id: compiledAction.action_id,
        tool_name: compiledAction.tool_name
      });

      if (compiledAction.requires_approval || compiledAction.risk_level !== "SAFE") {
        const consumedApproval = this.options.approvalRegistry.consumeApprovalForExecution({
          manifest_id: manifest.manifest_id,
          action_id: compiledAction.action_id,
          session_id: input.session_id,
          now: this.options.now()
        });

        if (!consumedApproval) {
          failureMessage = `No valid approval is available for ${compiledAction.action_id}.`;
          emit("ERROR", "run_error", {
            action_id: compiledAction.action_id,
            reason: failureMessage
          });
          break;
        }

        emit("APPROVAL", "approval_recorded", {
          action_id: compiledAction.action_id,
          decision: consumedApproval.decision,
          approval_signature: consumedApproval.approval_signature,
          remaining_uses: consumedApproval.remaining_uses
        });

        const token = this.options.capabilityTokenStore.issueToken({
          run_id: manifest.run_id,
          action_id: compiledAction.action_id,
          approval_signature: compiledAction.approval_signature,
          execution_hash: compiledAction.execution_hash,
          session_id: input.session_id,
          issued_at: this.options.now(),
          expires_at: consumedApproval.expires_at
        });

        try {
          this.options.capabilityTokenStore.consumeToken({
            token_id: token.token_id,
            run_id: manifest.run_id,
            action_id: compiledAction.action_id,
            approval_signature: compiledAction.approval_signature,
            execution_hash: compiledAction.execution_hash,
            session_id: input.session_id,
            now: this.options.now()
          });
        } catch (error) {
          failureMessage =
            error instanceof Error ? error.message : "Capability token consumption failed.";
          emit("ERROR", "run_error", {
            action_id: compiledAction.action_id,
            reason: failureMessage
          });
          break;
        }
      }

      const toolDefinition = getToolDefinition(compiledAction.tool_name as Parameters<typeof getToolDefinition>[0]);
      const toolResult = toolDefinition.execute(
        toolDefinition.arg_schema.parse(compiledAction.normalized_args)
      );
      toolResults.push(toolResult);

      emit("TOOL", "tool_output", {
        action_id: compiledAction.action_id,
        summary: toolResult.summary,
        output: toolResult.redacted_output
      });

      const attestation = attestTypedToolExecution({
        run_id: manifest.run_id,
        compiled_action: compiledAction,
        tool_result: toolResult,
        attested_at: this.options.now()
      });
      attestations.push(attestation);

      emit("ATTESTATION", "attestation_recorded", {
        action_id: compiledAction.action_id,
        matched: attestation.matched,
        deviations: attestation.deviations
      });

      emit("STEP", "action_completed", {
        action_id: compiledAction.action_id,
        ok: toolResult.ok,
        matched: attestation.matched
      });

      if (!toolResult.ok) {
        failureMessage =
          typeof toolResult.error === "string"
            ? toolResult.error
            : typeof toolResult.summary === "string"
              ? toolResult.summary
              : "Tool execution failed.";
        emit("ERROR", "run_error", {
          action_id: compiledAction.action_id,
          reason: failureMessage
        });
        break;
      }
    }

    const finishedAt = this.options.now();
    const matchedAllAttestations = attestations.every((attestation) => attestation.matched);
    const completedWithoutFailure = failureMessage === null;
    const desiredWorkflowState =
      completedWithoutFailure && matchedAllAttestations ? "review_ready" : "failed";
    let responseWorkflowState: RunExecutionResponse["workflow_state"] = desiredWorkflowState;
    let responseAccepted = desiredWorkflowState === "review_ready";
    let responseSummary =
      desiredWorkflowState === "review_ready"
        ? "Execution completed and attestation matched the approved manifest."
        : failureMessage ??
          "Execution completed, but one or more attestations deviated from the approved manifest.";

    emit("RESULT", "execution_complete", {
      status: completedWithoutFailure ? "completed" : "failed"
    });
    const workspaceRoot = getWorkspaceRootFromManifest(
      manifest.manifest_id,
      manifest.compiled_actions[0]?.workspace_scope.roots ?? []
    );
    const createResponseRunLog = (
      status: RunLog["final_result"]["status"],
      summary: string,
      persistenceStatus: RunLog["persistence_status"]
    ): RunLog =>
      buildRunLog({
        run_id: manifest.run_id,
        plan_id: manifest.plan_id,
        manifest_id: manifest.manifest_id,
        manifest_hash: manifest.manifest_hash,
        events,
        attestations,
        artifacts: toolResults.flatMap((toolResult) => toolResult.artifacts),
        started_at: startedAt,
        finished_at: finishedAt,
        summary,
        status,
        persistence_status: persistenceStatus
      });

    let persistedRunPath: string | null = null;

    try {
      const persistedRunLog = createResponseRunLog(
        desiredWorkflowState,
        responseSummary,
        "review_ready"
      );
      persistedRunPath = this.options.runLogStore.writeRunLog(workspaceRoot, persistedRunLog);

      if (desiredWorkflowState === "review_ready") {
        emit("RESULT", "review_ready", {
          attestations: attestations.length
        });
      }
    } catch (error) {
      const persistenceMessage =
        error instanceof Error ? error.message : "Run log persistence failed.";
      emit("ERROR", "run_error", {
        phase: "persistence",
        reason: persistenceMessage
      });

      responseWorkflowState =
        desiredWorkflowState === "review_ready" ? "execution_complete" : desiredWorkflowState;
      responseAccepted = desiredWorkflowState === "review_ready";
      responseSummary =
        desiredWorkflowState === "review_ready"
          ? `Execution completed and attestation matched the approved manifest, but run log persistence failed: ${persistenceMessage}`
          : `${responseSummary} Run log persistence failed: ${persistenceMessage}`;
    }

    const responseRunLog = createResponseRunLog(
      responseWorkflowState,
      responseSummary,
      persistedRunPath ? "review_ready" : "execution_complete"
    );

    return {
      accepted: responseAccepted,
      workflow_state: responseWorkflowState,
      message: responseSummary,
      run_id: manifest.run_id,
      persisted_run_path: persistedRunPath,
      run_log: responseRunLog,
      tool_results: toolResults,
      attestations
    };
  }
}
