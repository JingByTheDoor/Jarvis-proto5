import { startTransition, useDeferredValue, useEffect, useState } from "react";

import type { RunEvent, RunLog } from "../core/schemas";
import type {
  ApprovalDecisionResponse,
  ApprovalRequest,
  PolicySnapshotResponse,
  RunExecutionResponse,
  TaskIntentResponse
} from "../shared/ipc";
import type { ApprovalDecisionKind, ApprovalScopeClass } from "../shared/constants";
import { getJarvisDesktopApi } from "./desktop-api";
import { CommandCenterPage } from "./pages/command-center-page";
import { ConnectionsPage } from "./pages/connections-page";
import { SecondBrainPage } from "./pages/second-brain-page";
import { SettingsPage } from "./pages/settings-page";
import { TasksProjectsPage } from "./pages/tasks-projects-page";

type PageId =
  | "command_center"
  | "tasks_projects"
  | "second_brain"
  | "connections"
  | "settings";

interface PageNavigationItem {
  readonly id: PageId;
  readonly label: string;
  readonly summary: string;
}

const pageNavigationItems: readonly PageNavigationItem[] = [
  {
    id: "command_center",
    label: "Command Center",
    summary: "Plan -> preview -> approve -> execute -> review"
  },
  {
    id: "tasks_projects",
    label: "Tasks & Projects",
    summary: "Runs, tasks, approvals"
  },
  {
    id: "second_brain",
    label: "Second Brain",
    summary: "Memory, trust, contradictions"
  },
  {
    id: "connections",
    label: "Connections",
    summary: "Adapters, health, providers"
  },
  {
    id: "settings",
    label: "Settings",
    summary: "Approval, retention, session"
  }
] as const;

const SESSION_ID = "phase-4-execution";
const WORKSPACE_ROOT = "D:\\Jarvis-proto5 repo\\Jarvis-proto5";

function selectApprovalScopeClass(
  approvalRequest: ApprovalRequest,
  decision: ApprovalDecisionKind
): ApprovalScopeClass {
  if (decision !== "approve_session") {
    return "exact_action_only";
  }

  if (approvalRequest.allowed_scope_classes.includes("session_readonly_scope")) {
    return "session_readonly_scope";
  }

  if (approvalRequest.allowed_scope_classes.includes("session_same_scope")) {
    return "session_same_scope";
  }

  return approvalRequest.allowed_scope_classes[0] ?? "exact_action_only";
}

export function JarvisApp() {
  const desktopApi = getJarvisDesktopApi();
  const [activePage, setActivePage] = useState<PageId>("command_center");
  const [composerValue, setComposerValue] = useState(
    "Inspect the repo, prepare a safe preview, and wait for explicit approval."
  );
  const [policySnapshot, setPolicySnapshot] = useState<PolicySnapshotResponse | null>(null);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [lastIntentResponse, setLastIntentResponse] = useState<TaskIntentResponse | null>(null);
  const [approvalReceipts, setApprovalReceipts] = useState<
    Record<string, ApprovalDecisionResponse>
  >({});
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [pendingApprovalActionId, setPendingApprovalActionId] = useState<string | null>(null);
  const [lastExecutionResponse, setLastExecutionResponse] =
    useState<RunExecutionResponse | null>(null);
  const [runEvents, setRunEvents] = useState<RunEvent[]>([]);
  const [runHistory, setRunHistory] = useState<RunLog[]>([]);
  const [isDetailsRailOpen, setIsDetailsRailOpen] = useState(false);
  const deferredComposerValue = useDeferredValue(composerValue);
  const pendingApprovalRequests = lastIntentResponse?.approval_requests ?? [];
  const canExecute =
    Boolean(lastIntentResponse?.manifest) &&
    (pendingApprovalRequests.length === 0 ||
      pendingApprovalRequests.every(
        (request) => approvalReceipts[request.action_id]?.accepted
      ));

  async function refreshRunHistory(): Promise<void> {
    const response = await desktopApi.listRunHistory({
      workspace_root: WORKSPACE_ROOT,
      limit: 10
    });
    setRunHistory(response.runs);
  }

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = desktopApi.subscribeToRunEvents((event) => {
      if (!cancelled) {
        setRunEvents((currentEvents) => [event, ...currentEvents].slice(0, 20));
      }
    });

    void desktopApi
      .getPolicySnapshot({
        session_id: SESSION_ID
      })
      .then((snapshot) => {
        if (!cancelled) {
          setPolicySnapshot(snapshot);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setPolicyError(error instanceof Error ? error.message : "Failed to load policy snapshot.");
        }
      });

    void refreshRunHistory().catch(() => {});

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [desktopApi]);

  async function handlePreview(): Promise<void> {
    setApprovalReceipts({});
    setApprovalError(null);
    setLastExecutionResponse(null);
    setRunEvents([]);
    const response = await desktopApi.submitTaskIntent({
      task: composerValue,
      session_id: SESSION_ID,
      workspace_roots: [WORKSPACE_ROOT],
      requested_at: new Date().toISOString()
    });

    setLastIntentResponse(response);
  }

  async function handleApprovalDecision(
    approvalRequest: ApprovalRequest,
    decision: ApprovalDecisionKind
  ): Promise<void> {
    if (!lastIntentResponse?.manifest) {
      setApprovalError("No compiled manifest is available for approval.");
      return;
    }

    setPendingApprovalActionId(approvalRequest.action_id);
    setApprovalError(null);

    try {
      const approvalReceipt = await desktopApi.submitApprovalDecision({
        manifest_id: lastIntentResponse.manifest.manifest_id,
        action_id: approvalRequest.action_id,
        decision,
        approval_scope_class: selectApprovalScopeClass(approvalRequest, decision),
        approval_signature: approvalRequest.approval_signature,
        execution_hash: approvalRequest.execution_hash,
        max_execution_count: approvalRequest.max_execution_count,
        session_id: approvalRequest.session_id,
        expires_at: approvalRequest.expires_at,
        decided_at: new Date().toISOString(),
        decided_by: "operator"
      });

      setApprovalReceipts((currentReceipts) => ({
        ...currentReceipts,
        [approvalRequest.action_id]: approvalReceipt
      }));
    } catch (error) {
      setApprovalError(
        error instanceof Error ? error.message : "Failed to submit the approval decision."
      );
    } finally {
      setPendingApprovalActionId(null);
    }
  }

  async function handleExecute(): Promise<void> {
    if (!lastIntentResponse?.manifest) {
      return;
    }

    setLastExecutionResponse(null);
    setRunEvents([]);

    const executionResponse = await desktopApi.executeManifest({
      manifest_id: lastIntentResponse.manifest.manifest_id,
      session_id: SESSION_ID
    });

    setLastExecutionResponse(executionResponse);
    await refreshRunHistory();
  }

  function handlePageChange(nextPage: PageId): void {
    startTransition(() => {
      setActivePage(nextPage);
    });
  }

  function renderActivePage() {
    switch (activePage) {
      case "tasks_projects":
        return <TasksProjectsPage runHistory={runHistory} />;
      case "second_brain":
        return <SecondBrainPage />;
      case "connections":
        return <ConnectionsPage />;
      case "settings":
        return <SettingsPage />;
      case "command_center":
      default:
        return (
          <CommandCenterPage
            composerValue={composerValue}
            deferredComposerValue={deferredComposerValue}
            onComposerChange={setComposerValue}
            onPreview={() => {
              void handlePreview();
            }}
            onSubmitApprovalDecision={(approvalRequest, decision) => {
              void handleApprovalDecision(approvalRequest, decision);
            }}
            approvalReceipts={approvalReceipts}
            approvalError={approvalError}
            pendingApprovalActionId={pendingApprovalActionId}
            onExecute={() => {
              void handleExecute();
            }}
            canExecute={canExecute}
            executionResponse={lastExecutionResponse}
            runEvents={runEvents}
            lastIntentResponse={lastIntentResponse}
          />
        );
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand-panel">
          <p className="brand-kicker">Local-first operator console</p>
          <h1>JARVIS</h1>
        </div>
        <nav className="nav-list">
          {pageNavigationItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === activePage ? "nav-item nav-item-active" : "nav-item"}
              onClick={() => handlePageChange(item.id)}
            >
              <span>{item.label}</span>
              <small>{item.summary}</small>
            </button>
          ))}
        </nav>
      </aside>

      <div className="app-frame">
        <header className="top-bar">
          <div>
            <p className="eyebrow">Phase 4</p>
            <h2>Execution, attestation, and review</h2>
          </div>
          <div className="status-cluster">
            <span className="status-pill">
              {policySnapshot?.version ?? "loading policy"}
            </span>
            <span className="status-pill">approval-gated</span>
            <button
              type="button"
              className="rail-toggle"
              onClick={() => setIsDetailsRailOpen((currentValue) => !currentValue)}
            >
              {isDetailsRailOpen ? "Hide details" : "Show details"}
            </button>
          </div>
        </header>

        <section className="status-banner" aria-label="Session status">
          <div>
            <strong>Workflow</strong>
            <span>
              {policySnapshot?.workflow ??
                "PLAN -> COMPILE -> SIMULATE -> APPROVAL -> EXECUTE -> ATTEST -> REVIEW"}
            </span>
          </div>
          <div>
            <strong>Policy</strong>
            <span>
              {policyError ??
                "Typed local execution is approval-gated. Runs emit live events, persist logs, and stay reviewable."}
            </span>
          </div>
        </section>

        <main className={isDetailsRailOpen ? "content-shell rail-open" : "content-shell"}>
          <section className="workspace">{renderActivePage()}</section>
          {isDetailsRailOpen ? (
            <aside className="detail-rail" aria-label="Detail rail">
              <div className="panel-header">
                <p className="eyebrow">Detail Rail</p>
                <h2>Progressive disclosure surfaces</h2>
              </div>
              <div className="rail-stack">
                <article className="rail-card">
                  <h3>Recent Tool Calls</h3>
                  <p>Compiled typed tools are visible in the preview. Live execution output lands later.</p>
                </article>
                <article className="rail-card">
                  <h3>Live Event Feed</h3>
                  <p>Execution and attestation events stay visible here while the run is active.</p>
                </article>
                <article className="rail-card">
                  <h3>Memory &amp; Provider Snapshot</h3>
                  <p>Second Brain and connection health surfaces stay visible but non-blocking.</p>
                </article>
                <article className="rail-card">
                  <h3>Quick Actions</h3>
                  <p>Shortcuts for preview, approvals, and run cleanup will anchor here.</p>
                </article>
              </div>
            </aside>
          ) : null}
        </main>

        <footer className="telemetry-strip">
          <span>Protocol: app://jarvis</span>
          <span>Renderer: sandboxed</span>
          <span>IPC: typed only</span>
          <span>Navigation: default deny</span>
        </footer>
      </div>
    </div>
  );
}
