import { startTransition, useDeferredValue, useEffect, useState } from "react";

import type { PolicySnapshotResponse, TaskIntentResponse } from "../shared/ipc";
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
    summary: "Plan -> preview -> approve -> result"
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

export function JarvisApp() {
  const desktopApi = getJarvisDesktopApi();
  const [activePage, setActivePage] = useState<PageId>("command_center");
  const [composerValue, setComposerValue] = useState(
    "Inspect the repo, prepare a safe preview, and wait for explicit approval."
  );
  const [policySnapshot, setPolicySnapshot] = useState<PolicySnapshotResponse | null>(null);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [lastIntentResponse, setLastIntentResponse] = useState<TaskIntentResponse | null>(null);
  const [isDetailsRailOpen, setIsDetailsRailOpen] = useState(false);
  const deferredComposerValue = useDeferredValue(composerValue);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = desktopApi.subscribeToRunEvents(() => {});

    void desktopApi
      .getPolicySnapshot({
        session_id: "phase-1-shell"
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

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [desktopApi]);

  async function handlePreview(): Promise<void> {
    const response = await desktopApi.submitTaskIntent({
      task: composerValue,
      session_id: "phase-1-shell",
      workspace_roots: ["D:\\Jarvis-proto5 repo\\Jarvis-proto5"],
      requested_at: new Date().toISOString()
    });

    setLastIntentResponse(response);
  }

  function handlePageChange(nextPage: PageId): void {
    startTransition(() => {
      setActivePage(nextPage);
    });
  }

  function renderActivePage() {
    switch (activePage) {
      case "tasks_projects":
        return <TasksProjectsPage />;
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
            <p className="eyebrow">Phase 1</p>
            <h2>Thin shell + hardened frame</h2>
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
                "Local-first routing stub is active. Risky actions still require explicit approval."}
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
                  <p>Typed tool activity will appear here when execution exists.</p>
                </article>
                <article className="rail-card">
                  <h3>Live Event Feed</h3>
                  <p>Run events remain empty until planning and execution phases land.</p>
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
