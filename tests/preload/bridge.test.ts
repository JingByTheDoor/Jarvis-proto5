import { describe, expect, it, vi } from "vitest";

import { createJarvisDesktopApi } from "../../src/preload/bridge";
import {
  validApprovalDecision,
  validRunEvent,
  validTaskIntentResponseEnvelope
} from "../fixtures";

describe("preload bridge", () => {
  it("rejects malformed task-intent payloads before they cross IPC", async () => {
    const ipcRenderer = {
      invoke: vi.fn(),
      send: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn()
    };
    const desktopApi = createJarvisDesktopApi(ipcRenderer);

    await expect(
      desktopApi.submitTaskIntent({
        task: "",
        session_id: "session-1",
        workspace_roots: ["D:\\Jarvis-proto5 repo\\Jarvis-proto5"],
        requested_at: "2026-03-11T18:00:00.000Z"
      })
    ).rejects.toThrow();

    expect(ipcRenderer.invoke).not.toHaveBeenCalled();
  });

  it("validates task-intent and policy responses from the main process", async () => {
    const ipcRenderer = {
      invoke: vi
        .fn()
        .mockResolvedValueOnce(validTaskIntentResponseEnvelope.payload)
        .mockResolvedValueOnce({
          version: "phase-1-shell"
        }),
      send: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn()
    };
    const desktopApi = createJarvisDesktopApi(ipcRenderer);

    await expect(
      desktopApi.submitTaskIntent({
        task: "Inspect the repo",
        session_id: "session-1",
        workspace_roots: ["D:\\Jarvis-proto5 repo\\Jarvis-proto5"],
        requested_at: "2026-03-11T18:00:00.000Z"
      })
    ).resolves.toEqual(validTaskIntentResponseEnvelope.payload);

    await expect(
      desktopApi.getPolicySnapshot({
        session_id: "session-1"
      })
    ).rejects.toThrow();
  });

  it("sends typed approval payloads and only forwards schema-valid run events", () => {
    let runEventListener:
      | ((event: unknown, payload: unknown) => void)
      | undefined;
    const receivedEvents: string[] = [];
    const ipcRenderer = {
      invoke: vi.fn(),
      send: vi.fn(),
      on: vi.fn((channel, listener) => {
        if (channel === "run.event.push") {
          runEventListener = listener;
        }
      }),
      removeListener: vi.fn()
    };
    const desktopApi = createJarvisDesktopApi(ipcRenderer);

    desktopApi.submitApprovalDecision(validApprovalDecision);
    expect(ipcRenderer.send).toHaveBeenCalledWith(
      "approval.decision.submit",
      validApprovalDecision
    );

    const unsubscribe = desktopApi.subscribeToRunEvents((event) => {
      receivedEvents.push(event.kind.type);
    });

    runEventListener?.({}, validRunEvent);
    runEventListener?.({}, { invalid: true });

    expect(receivedEvents).toEqual(["plan_ready"]);

    unsubscribe();
    expect(ipcRenderer.removeListener).toHaveBeenCalledWith(
      "run.event.push",
      expect.any(Function)
    );
  });
});
