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

function createDesktopApiStub(): JarvisDesktopApi {
  const submitTaskIntent = vi.fn(async () => ({
    accepted: true,
    workflow_state: "preparing_plan" as const,
    message: "Intent accepted"
  })) as unknown as JarvisDesktopApi["submitTaskIntent"];
  const getPolicySnapshot = vi.fn(async () => ({
    version: "phase-1-shell",
    workflow: workflowSequence,
    local_first: true as const,
    approval_required_for_risky_actions: true as const
  })) as unknown as JarvisDesktopApi["getPolicySnapshot"];

  return {
    submitTaskIntent,
    submitApprovalDecision: vi.fn(),
    getPolicySnapshot,
    subscribeToRunEvents: vi.fn(() => () => {})
  };
}

afterEach(() => {
  cleanup();
  delete window.jarvisDesktop;
});

describe("Phase 1 renderer shell", () => {
  it("renders the Command Center skeleton with the required workflow surfaces", async () => {
    window.jarvisDesktop = createDesktopApiStub();

    render(<JarvisApp />);

    await screen.findByText("phase-1-shell");
    expect(screen.getByRole("heading", { name: /shortest safe path from task to review/i })).toBeDefined();
    expect(screen.getByLabelText(/task composer \/ input/i)).toBeDefined();
    expect(screen.getByRole("button", { name: "Preview" })).toBeDefined();
    expect(screen.getByText("Plan Summary")).toBeDefined();
    expect(screen.getByText("Manifest Summary")).toBeDefined();
    expect(screen.getByText("Simulation Summary")).toBeDefined();
    expect(screen.getByText("Approval Region")).toBeDefined();
    expect(screen.getByText("Run Output / Result")).toBeDefined();
    expect(screen.getByText("Review / Attestation")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    await waitFor(() => {
      expect(screen.getByText("Intent accepted")).toBeDefined();
    });
  });

  it("renders the detail rail on demand and switches between scaffold pages", async () => {
    window.jarvisDesktop = createDesktopApiStub();

    render(<JarvisApp />);

    await screen.findByText("phase-1-shell");
    fireEvent.click(screen.getByRole("button", { name: "Show details" }));

    expect(screen.getByRole("heading", { name: /progressive disclosure surfaces/i })).toBeDefined();
    expect(
      within(screen.getByLabelText("Detail rail")).getByText("Recent Tool Calls")
    ).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Tasks & Projects/i }));
    expect(
      screen.getByRole("heading", { name: /operational history stays grouped by outcome/i })
    ).toBeDefined();

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
  });
});
