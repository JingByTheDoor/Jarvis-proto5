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
  validRunEvent,
  validRunExecutionResponse,
  validRunHistoryResponse,
  validTaskIntentResponseEnvelope
} from "../fixtures";

function createDesktopApiStub(): JarvisDesktopApi {
  const submitTaskIntent = vi.fn(
    async () => validTaskIntentResponseEnvelope.payload
  ) as unknown as JarvisDesktopApi["submitTaskIntent"];
  const getPolicySnapshot = vi.fn(async () => ({
    version: "phase-4-execution",
    workflow: workflowSequence,
    local_first: true as const,
    approval_required_for_risky_actions: true as const
  })) as unknown as JarvisDesktopApi["getPolicySnapshot"];

  return {
    submitTaskIntent,
    submitApprovalDecision: vi.fn(async () => validApprovalDecisionResponse),
    executeManifest: vi.fn(async () => validRunExecutionResponse),
    listRunHistory: vi.fn(async () => validRunHistoryResponse),
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
        session_id: "phase-4-execution",
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
    preview_generated_at: "2026-03-11T18:00:00.000Z"
  })) as unknown as JarvisDesktopApi["submitTaskIntent"];

  return {
    submitTaskIntent,
    submitApprovalDecision: vi.fn(async () => ({
      ...validApprovalDecisionResponse,
      manifest_id: "manifest-1",
      session_id: "phase-4-execution"
    })),
    executeManifest: vi.fn(async () => validRunExecutionResponse),
    listRunHistory: vi.fn(async () => validRunHistoryResponse),
    getPolicySnapshot: vi.fn(async () => ({
      version: "phase-4-execution",
      workflow: workflowSequence,
      local_first: true as const,
      approval_required_for_risky_actions: true as const
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
      session_id: "phase-4-execution",
      workspace_roots: ["D:\\Jarvis-proto5 repo\\Jarvis-proto5"],
      requested_at: "2026-03-11T18:00:00.000Z"
    }))
  })) as unknown as JarvisDesktopApi["submitTaskIntent"];

  return {
    submitTaskIntent,
    submitApprovalDecision: vi.fn(async () => ({
      ...validApprovalDecisionResponse,
      manifest_id: "manifest-1",
      session_id: "phase-4-execution"
    })),
    executeManifest: vi.fn(async () => {
      runEventListener?.(validRunEvent);
      return validRunExecutionResponse;
    }),
    listRunHistory: vi.fn(async () => validRunHistoryResponse),
    getPolicySnapshot: vi.fn(async () => ({
      version: "phase-4-execution",
      workflow: workflowSequence,
      local_first: true as const,
      approval_required_for_risky_actions: true as const
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

describe("Phase 4 renderer shell", () => {
  it(
    "renders the Command Center preview surfaces for route, simulation, manifest, and diff",
    async () => {
    window.jarvisDesktop = createDesktopApiStub();

    render(<JarvisApp />);

    await screen.findByText("phase-4-execution");
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

    await screen.findByText("phase-4-execution");
    fireEvent.click(screen.getByRole("button", { name: "Show details" }));

    expect(screen.getByRole("heading", { name: /progressive disclosure surfaces/i })).toBeDefined();
    expect(
      within(screen.getByLabelText("Detail rail")).getByText("Recent Tool Calls")
    ).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Tasks & Projects/i }));
    expect(
      screen.getByRole("heading", { name: /operational history stays grouped by outcome/i })
    ).toBeDefined();
    expect(screen.getByText("run-1")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Second Brain/i }));
    expect(
      screen.getByRole("heading", { name: /memory visibility without memory writes yet/i })
    ).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /^Connections/i }));
    expect(
      screen.getByRole("heading", { name: /adapters stay visible even when unavailable/i })
    ).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /^Settings/i }));
    expect(
      screen.getByRole("heading", { name: /retention, approval, and session posture stay explicit/i })
    ).toBeDefined();
    },
    15000
  );

  it(
    "renders an exact diff preview when the typed edit route returns one",
    async () => {
    window.jarvisDesktop = createEditDesktopApiStub();

    render(<JarvisApp />);

    await screen.findByText("phase-4-execution");
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

    await screen.findByText("phase-4-execution");
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

    await screen.findByText("phase-4-execution");
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
      session_id: "phase-4-execution"
    });
    },
    15000
  );
});
