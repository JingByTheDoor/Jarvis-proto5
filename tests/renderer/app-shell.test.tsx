// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JarvisApp } from "../../src/renderer/app";
import type { JarvisDesktopApi } from "../../src/shared/desktop-api";
import { workflowSequence } from "../../src/shared/constants";
import {
  validApprovalDecisionResponse,
  ISO_APP_STARTED,
  validPlannerAssistance,
  validPlannerProviderStatus,
  validRecallSearchResponse,
  validRunDeleteResponse,
  validRunEvent,
  validRunExecutionResponse,
  validRunExportResponse,
  validRunHistoryResponse,
  validTaskIntentResponseEnvelope,
  validWorkflowProofReportResponse,
  validWorkflowProofSummaryResponse
} from "../fixtures";

function createDesktopApiStub(): JarvisDesktopApi {
  const submitTaskIntent = vi.fn(
    async () => validTaskIntentResponseEnvelope.payload
  ) as unknown as JarvisDesktopApi["submitTaskIntent"];
  const getPolicySnapshot = vi.fn(async () => ({
    version: "phase-6-planner-assist",
    workflow: workflowSequence,
    local_first: true as const,
    approval_required_for_risky_actions: true as const,
    app_started_at: ISO_APP_STARTED,
    retention_policy: {
      run_history_days: 30,
      event_logs_days: 7,
      cache_days: 3,
      sensitive_session_cache_hours: 24,
      export_staging_encrypted_at_rest: true as const
    },
    sensitive_session_defaults: {
      reduced_logging: true as const,
      tier2_memory_writes_enabled: false as const,
      tier3_analytics_writes_enabled: false as const,
      minimal_summaries_only: true as const
    }
  })) as unknown as JarvisDesktopApi["getPolicySnapshot"];

  return {
    submitTaskIntent,
    submitApprovalDecision: vi.fn(async () => validApprovalDecisionResponse),
    executeManifest: vi.fn(async () => validRunExecutionResponse),
    listRunHistory: vi.fn(async () => validRunHistoryResponse),
    deleteRunHistoryEntry: vi.fn(async () => validRunDeleteResponse),
    exportRunHistoryEntry: vi.fn(async () => validRunExportResponse),
    searchLocalRecall: vi.fn(async () => validRecallSearchResponse),
    recordWorkflowProof: vi.fn(async (payload) => payload),
    getWorkflowProofSummary: vi.fn(async () => validWorkflowProofSummaryResponse),
    getWorkflowProofReport: vi.fn(async () => validWorkflowProofReportResponse),
    getPlannerStatus: vi.fn(async () => validPlannerProviderStatus),
    updatePlannerSettings: vi.fn(async () => validPlannerProviderStatus),
    getPolicySnapshot,
    subscribeToRunEvents: vi.fn(() => () => {})
  };
}

function createEditDesktopApiStub(): JarvisDesktopApi {
  const submitTaskIntent = vi.fn(async () => ({
    accepted: true,
    workflow_state: "awaiting_approval" as const,
    state_trace: [
      "preparing_plan",
      "plan_ready",
      "compiling_manifest",
      "manifest_ready",
      "simulating_effects",
      "simulation_ready",
      "awaiting_approval"
    ] as const,
    message:
      "Prepared an exact diff preview, simulation summary, and approval scope for D:\\Jarvis-proto5 repo\\Jarvis-proto5\\README.md.",
    route: {
      task_level: 3,
      task_type: "repo_edit" as const,
      risk_class: "DANGER" as const,
      chosen_route: "local_repo_file_tools" as const,
      operator_explanation:
        "The request matches a supported local file-edit preview pattern, so JARVIS can stay on typed repo/file tools."
    },
    plan: {
      ...validTaskIntentResponseEnvelope.payload.plan!,
      requires_approval: true
    },
    manifest: {
      ...validTaskIntentResponseEnvelope.payload.manifest!,
      compiled_actions: [
        {
          ...validTaskIntentResponseEnvelope.payload.manifest!.compiled_actions[0],
          tool_name: "write_text_file",
          risk_level: "DANGER" as const,
          requires_approval: true
        }
      ]
    },
    effect_previews: [
      {
        action_id: "action-1",
        predicted_reads: ["D:\\Jarvis-proto5 repo\\Jarvis-proto5\\README.md"],
        predicted_writes: ["D:\\Jarvis-proto5 repo\\Jarvis-proto5\\README.md"],
        predicted_deletes: [],
        predicted_process_changes: [],
        predicted_remote_calls: [],
        predicted_system_changes: [],
        confidence: "high" as const,
        notes: [
          "Exact diff preview available (modified).",
          "Simulation predicts an overwrite of an existing file."
        ]
      }
    ],
    approval_requests: [
      {
        action_id: "action-1",
        risk_level: "DANGER" as const,
        decision_options: ["deny", "approve_once"] as const,
        allowed_scope_classes: ["exact_action_only", "never_session_approvable"] as const,
        approval_signature: "approval-signature-1",
        execution_hash: "execution-hash-1",
        max_execution_count: 1,
        session_id: "phase-6-proof-gate",
        expires_at: "2026-03-11T20:00:00.000Z",
        path_scope: {
          roots: ["D:\\Jarvis-proto5 repo\\Jarvis-proto5"],
          entries: [
            {
              path: "D:\\Jarvis-proto5 repo\\Jarvis-proto5\\README.md",
              access: "write" as const,
              reason: "apply previewed file update"
            }
          ]
        },
        network_scope: {
          default_policy: "deny" as const,
          allow: []
        },
        side_effect_family: "workspace_write" as const,
        justification:
          "The exact simulation preview shows an overwrite outside approved temp/output paths, which is classified as DANGER."
      }
    ],
    simulation_summary: {
      highest_risk: "DANGER" as const,
      approval_required: true,
      preview_count: 1,
      confidence_breakdown: {
        high: 1,
        medium: 0,
        low: 0
      },
      notes: [
        "Simulation runs after compile and before approval.",
        "1 action(s) require explicit approval."
      ]
    },
    diff_previews: [
      {
        path: "D:\\Jarvis-proto5 repo\\Jarvis-proto5\\README.md",
        status: "modified" as const,
        before: "hello\n",
        after: "hello jarvis\n",
        unified_diff:
          "--- D:\\Jarvis-proto5 repo\\Jarvis-proto5\\README.md\n+++ D:\\Jarvis-proto5 repo\\Jarvis-proto5\\README.md\n@@\n-hello\n+hello jarvis"
      }
    ],
    planner_assistance: validPlannerAssistance,
    preview_generated_at: "2026-03-11T18:00:00.000Z"
  })) as unknown as JarvisDesktopApi["submitTaskIntent"];

  return {
    submitTaskIntent,
    submitApprovalDecision: vi.fn(async () => ({
      ...validApprovalDecisionResponse,
      manifest_id: "manifest-1",
      session_id: "phase-6-proof-gate"
    })),
    executeManifest: vi.fn(async () => validRunExecutionResponse),
    listRunHistory: vi.fn(async () => validRunHistoryResponse),
    deleteRunHistoryEntry: vi.fn(async () => validRunDeleteResponse),
    exportRunHistoryEntry: vi.fn(async () => validRunExportResponse),
    searchLocalRecall: vi.fn(async () => validRecallSearchResponse),
    recordWorkflowProof: vi.fn(async (payload) => payload),
    getWorkflowProofSummary: vi.fn(async () => validWorkflowProofSummaryResponse),
    getWorkflowProofReport: vi.fn(async () => validWorkflowProofReportResponse),
    getPlannerStatus: vi.fn(async () => validPlannerProviderStatus),
    updatePlannerSettings: vi.fn(async () => validPlannerProviderStatus),
    getPolicySnapshot: vi.fn(async () => ({
      version: "phase-6-planner-assist",
      workflow: workflowSequence,
      local_first: true as const,
      approval_required_for_risky_actions: true as const,
      app_started_at: ISO_APP_STARTED,
      retention_policy: {
        run_history_days: 30,
        event_logs_days: 7,
        cache_days: 3,
        sensitive_session_cache_hours: 24,
        export_staging_encrypted_at_rest: true as const
      },
      sensitive_session_defaults: {
        reduced_logging: true as const,
        tier2_memory_writes_enabled: false as const,
        tier3_analytics_writes_enabled: false as const,
        minimal_summaries_only: true as const
      }
    })) as unknown as JarvisDesktopApi["getPolicySnapshot"],
    subscribeToRunEvents: vi.fn(() => () => {})
  };
}

function createExecutingDesktopApiStub(): JarvisDesktopApi {
  let runEventListener: ((event: typeof validRunEvent) => void) | undefined;
  const editDesktopApi = createEditDesktopApiStub();
  const submitTaskIntent = vi.fn(async () => ({
    ...(await editDesktopApi.submitTaskIntent({
      task: "Preview and execute a typed repo edit.",
      session_id: "phase-6-proof-gate",
      workspace_roots: ["D:\\Jarvis-proto5 repo\\Jarvis-proto5"],
      requested_at: "2026-03-11T18:00:00.000Z"
    }))
  })) as unknown as JarvisDesktopApi["submitTaskIntent"];

  return {
    submitTaskIntent,
    submitApprovalDecision: vi.fn(async () => ({
      ...validApprovalDecisionResponse,
      manifest_id: "manifest-1",
      session_id: "phase-6-proof-gate"
    })),
    executeManifest: vi.fn(async () => {
      runEventListener?.(validRunEvent);
      return validRunExecutionResponse;
    }),
    listRunHistory: vi.fn(async () => validRunHistoryResponse),
    deleteRunHistoryEntry: vi.fn(async () => validRunDeleteResponse),
    exportRunHistoryEntry: vi.fn(async () => validRunExportResponse),
    searchLocalRecall: vi.fn(async () => validRecallSearchResponse),
    recordWorkflowProof: vi.fn(async (payload) => payload),
    getWorkflowProofSummary: vi.fn(async () => validWorkflowProofSummaryResponse),
    getWorkflowProofReport: vi.fn(async () => validWorkflowProofReportResponse),
    getPlannerStatus: vi.fn(async () => validPlannerProviderStatus),
    updatePlannerSettings: vi.fn(async () => validPlannerProviderStatus),
    getPolicySnapshot: vi.fn(async () => ({
      version: "phase-6-planner-assist",
      workflow: workflowSequence,
      local_first: true as const,
      approval_required_for_risky_actions: true as const,
      app_started_at: ISO_APP_STARTED,
      retention_policy: {
        run_history_days: 30,
        event_logs_days: 7,
        cache_days: 3,
        sensitive_session_cache_hours: 24,
        export_staging_encrypted_at_rest: true as const
      },
      sensitive_session_defaults: {
        reduced_logging: true as const,
        tier2_memory_writes_enabled: false as const,
        tier3_analytics_writes_enabled: false as const,
        minimal_summaries_only: true as const
      }
    })) as unknown as JarvisDesktopApi["getPolicySnapshot"],
    subscribeToRunEvents: vi.fn((listener) => {
      runEventListener = listener as unknown as typeof runEventListener;
      return () => {
        runEventListener = undefined;
      };
    })
  };
}

afterEach(() => {
  cleanup();
  delete window.jarvisDesktop;
});

describe("Phase 6 renderer shell", () => {
  it(
    "renders the Command Center preview surfaces for route, simulation, manifest, and diff",
    async () => {
    window.jarvisDesktop = createDesktopApiStub();

    render(<JarvisApp />);

    await screen.findByText("phase-6-planner-assist");
    expect(screen.getByRole("heading", { name: /shortest safe path from task to review/i })).toBeDefined();
    expect(screen.getByLabelText(/task composer \/ input/i)).toBeDefined();
    expect(screen.getByRole("button", { name: "Preview" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Execute" })).toBeDefined();
    expect(screen.getByText("Task Level")).toBeDefined();
    expect(screen.getByText("Task Type")).toBeDefined();
    expect(screen.getByText("Risk Class")).toBeDefined();
    expect(screen.getByText("Chosen Route")).toBeDefined();
    expect(screen.getByText("Plan Summary")).toBeDefined();
    expect(screen.getByText("Manifest Summary")).toBeDefined();
    expect(screen.getByText("Simulation Summary")).toBeDefined();
    expect(screen.getByText("Compiled Actions")).toBeDefined();
    expect(screen.getByText("Event feed")).toBeDefined();
    expect(screen.getByText("Run output and result")).toBeDefined();
    expect(screen.getByText("Attestation results")).toBeDefined();
    expect(screen.getByText("Effect previews")).toBeDefined();
    expect(screen.getByText("Exact approval scope")).toBeDefined();
    expect(screen.getByText("Exact Diff Preview")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    await waitFor(() => {
      expect(
        screen.getByText("Prepared a read-only repo inspection preview and simulation summary.")
      ).toBeDefined();
    });

    expect(screen.getByText("repo_inspection")).toBeDefined();
    expect(screen.getByText("local_read_tools")).toBeDefined();
    expect(screen.getByText("Read the README and prepare a safe next step")).toBeDefined();
    expect(screen.getByText("1 compiled action(s) ready for inspection.")).toBeDefined();
    expect(screen.getByText("read_text_file")).toBeDefined();
    expect(screen.getByText(/1 preview\(s\), highest risk SAFE/i)).toBeDefined();
    },
    15000
  );

  it(
    "renders the detail rail on demand and switches between scaffold pages",
    async () => {
    window.jarvisDesktop = createDesktopApiStub();

    render(<JarvisApp />);

    await screen.findByText("phase-6-planner-assist");
    fireEvent.click(screen.getByRole("button", { name: "Show details" }));

    expect(screen.getByRole("heading", { name: /progressive disclosure surfaces/i })).toBeDefined();
    expect(
      within(screen.getByLabelText("Detail rail")).getByText("Recent Tool Calls")
    ).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Tasks & Projects/i }));
    expect(
      screen.getByRole("heading", { name: /operational history stays grouped by outcome/i })
    ).toBeDefined();
    expect(screen.getByText("Latest run run-1 is review_ready.")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Second Brain/i }));
    expect(
      screen.getByRole("heading", { name: /local recall stays useful before full memory hardening/i })
    ).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /^Connections/i }));
    expect(
      screen.getByRole("heading", { name: /adapters stay visible even when unavailable/i })
    ).toBeDefined();
    expect(screen.getByText(/local_ollama \(active\)/i)).toBeDefined();
    expect(screen.getByText(/Available models: qwen2.5:3b, qwen2.5:1.5b/i)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /^Settings/i }));
    expect(
      screen.getByRole("heading", { name: /retention, approval, and session posture stay explicit/i })
    ).toBeDefined();
    expect(screen.getByDisplayValue("qwen2.5:3b")).toBeDefined();
    expect(screen.getByDisplayValue("http://127.0.0.1:11434")).toBeDefined();
    expect(screen.getByText(/1 of 1 golden workflow attempt\(s\) reached review_ready/i)).toBeDefined();
    expect(screen.getByText(/Status: collecting evidence/i)).toBeDefined();
    expect(screen.getByText(/\.tmp\/runs: 30 days \| \.tmp\/logs: 7 days/i)).toBeDefined();
    expect(screen.getByText(/\.tmp\/cache: 3 days \| sensitive session cache: 24 hours/i)).toBeDefined();
    expect(screen.getByText(/Run exports are staged under encrypted-at-rest local storage/i)).toBeDefined();
    expect(screen.getByText(/Reduced logging: on \| minimal summaries only: yes/i)).toBeDefined();
    expect(screen.getByText(/Tier 2 memory writes: disabled \| Tier 3 analytics writes: disabled/i)).toBeDefined();
    expect(screen.getAllByText(/Cold start -> composer median: 500 ms/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Preview -> approval median: 2000 ms/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Repeat task -> preview median: 1000 ms/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Review-ready in window: 1 \/ 3/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Resumed samples: 1 \/ 1/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/At least one resumed journey reached review_ready/i).length
    ).toBeGreaterThan(0);
    expect(screen.getByText(/Local Proof Report/i)).toBeDefined();
    expect(screen.getByLabelText("Local proof report").textContent).toContain(
      "# Workflow Proof Report"
    );
    },
    15000
  );

  it(
    "exposes per-run delete and export controls through the typed desktop API",
    async () => {
      const desktopApi = createDesktopApiStub();
      window.jarvisDesktop = desktopApi;

      render(<JarvisApp />);

      await screen.findByText("phase-6-planner-assist");
      fireEvent.click(screen.getByRole("button", { name: /Tasks & Projects/i }));

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Export run" })).toBeDefined();
      });

      fireEvent.click(screen.getByRole("button", { name: "Export run" }));

      await waitFor(() => {
        expect(screen.getByText(/Staged a sanitized encrypted export for run-1/i)).toBeDefined();
      });

      fireEvent.click(screen.getByRole("button", { name: "Delete run" }));

      await waitFor(() => {
        expect(screen.getByText(/Deleted local review artifacts for run-1/i)).toBeDefined();
      });

      expect(desktopApi.exportRunHistoryEntry).toHaveBeenCalledWith({
        workspace_root: "D:\\Jarvis-proto5 repo\\Jarvis-proto5",
        run_id: "run-1"
      });
      expect(desktopApi.deleteRunHistoryEntry).toHaveBeenCalledWith({
        workspace_root: "D:\\Jarvis-proto5 repo\\Jarvis-proto5",
        run_id: "run-1"
      });
    },
    15000
  );

  it(
    "renders an exact diff preview when the typed edit route returns one",
    async () => {
    window.jarvisDesktop = createEditDesktopApiStub();

    render(<JarvisApp />);

    await screen.findByText("phase-6-planner-assist");
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    await waitFor(() => {
      expect(screen.getByText(/Prepared an exact diff preview/i)).toBeDefined();
    });

    expect(screen.getByText("repo_edit")).toBeDefined();
    expect(screen.getByText("local_repo_file_tools")).toBeDefined();
    expect(screen.getByText("DANGER")).toBeDefined();
    expect(screen.getByLabelText("Unified diff preview").textContent).toContain("-hello");
    expect(screen.getByLabelText("Unified diff preview").textContent).toContain("+hello jarvis");
    expect(screen.getByText(/1 preview\(s\), highest risk DANGER/i)).toBeDefined();
    expect(screen.getByText("Decisions: deny, approve_once")).toBeDefined();
    expect(screen.getByText(/Network scope: default deny/i)).toBeDefined();
    },
    15000
  );

  it(
    "submits approval decisions through the typed desktop API and shows the receipt",
    async () => {
    const desktopApi = createEditDesktopApiStub();
    window.jarvisDesktop = desktopApi;

    render(<JarvisApp />);

    await screen.findByText("phase-6-planner-assist");
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    await waitFor(() => {
      expect(screen.getByText(/Prepared an exact diff preview/i)).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: "Approve once" }));

    await waitFor(() => {
      expect(screen.getByText(/Recorded approve_once for the exact compiled action/i)).toBeDefined();
    });

    expect(desktopApi.submitApprovalDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        manifest_id: "manifest-1",
        action_id: "action-1",
        decision: "approve_once",
        approval_scope_class: "exact_action_only",
        approval_signature: "approval-signature-1",
        execution_hash: "execution-hash-1"
      })
    );
    },
    15000
  );

  it(
    "executes an approved manifest and renders live review surfaces",
    async () => {
    const desktopApi = createExecutingDesktopApiStub();
    window.jarvisDesktop = desktopApi;

    render(<JarvisApp />);

    await screen.findByText("phase-6-planner-assist");
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    await waitFor(() => {
      expect(screen.getByText(/Prepared an exact diff preview/i)).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: "Approve once" }));

    await waitFor(() => {
      expect(screen.getByText(/Recorded approve_once for the exact compiled action/i)).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: "Execute" }));

    await waitFor(() => {
      expect(screen.getByText(/Execution completed and attestation matched the approved manifest/i)).toBeDefined();
    });

    expect(screen.getByText("review_ready")).toBeDefined();
    expect(screen.getByText("Read README successfully")).toBeDefined();
    expect(screen.getByText("Artifacts (1)")).toBeDefined();
    expect(
      screen.getAllByText(/D:\\Jarvis-proto5 repo\\Jarvis-proto5\\.tmp\\runs\\run-1.json/i)
    ).toHaveLength(2);
    expect(screen.getByText(/Matched: yes/i)).toBeDefined();
    expect(screen.getByText("plan_ready")).toBeDefined();
    expect(desktopApi.executeManifest).toHaveBeenCalledWith({
      manifest_id: "manifest-1",
      session_id: "phase-6-proof-gate"
    });
    expect(desktopApi.recordWorkflowProof).toHaveBeenCalled();
    },
    15000
  );

  it(
    "resumes a previous task from local recall into the Command Center composer",
    async () => {
      window.jarvisDesktop = createDesktopApiStub();

      render(<JarvisApp />);

      await screen.findByText("phase-6-planner-assist");
      fireEvent.click(screen.getByRole("button", { name: /Tasks & Projects/i }));

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Resume task" })).toBeDefined();
      });

      fireEvent.click(screen.getByRole("button", { name: "Resume task" }));

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /shortest safe path from task to review/i })
        ).toBeDefined();
      });

      expect(
        (screen.getByLabelText(/task composer \/ input/i) as HTMLTextAreaElement).value
      ).toContain("Resume the previous task from run-1");
    },
    15000
  );
});
