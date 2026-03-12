import { describe, expect, it } from "vitest";

import { ipcContractMap, parseIpcEnvelope } from "../../src/shared/ipc";
import {
  validApprovalEnvelope,
  validApprovalDecisionResponseEnvelope,
  validPolicySnapshotRequestEnvelope,
  validPolicySnapshotResponseEnvelope,
  validRunExecutionRequestEnvelope,
  validRunExecutionResponseEnvelope,
  validRunHistoryRequestEnvelope,
  validRunHistoryResponseEnvelope,
  validRunEventEnvelope,
  validTaskIntentEnvelope,
  validTaskIntentResponseEnvelope
} from "../fixtures";

describe("IPC boundary contracts", () => {
  it("accepts the allowed typed envelopes", () => {
    expect(parseIpcEnvelope(validTaskIntentEnvelope)).toEqual(validTaskIntentEnvelope);
    expect(parseIpcEnvelope(validTaskIntentResponseEnvelope)).toEqual(
      validTaskIntentResponseEnvelope
    );
    expect(parseIpcEnvelope(validApprovalEnvelope)).toEqual(validApprovalEnvelope);
    expect(parseIpcEnvelope(validApprovalDecisionResponseEnvelope)).toEqual(
      validApprovalDecisionResponseEnvelope
    );
    expect(parseIpcEnvelope(validRunExecutionRequestEnvelope)).toEqual(
      validRunExecutionRequestEnvelope
    );
    expect(parseIpcEnvelope(validRunExecutionResponseEnvelope)).toEqual(
      validRunExecutionResponseEnvelope
    );
    expect(parseIpcEnvelope(validRunHistoryRequestEnvelope)).toEqual(
      validRunHistoryRequestEnvelope
    );
    expect(parseIpcEnvelope(validRunHistoryResponseEnvelope)).toEqual(
      validRunHistoryResponseEnvelope
    );
    expect(parseIpcEnvelope(validPolicySnapshotRequestEnvelope)).toEqual(
      validPolicySnapshotRequestEnvelope
    );
    expect(parseIpcEnvelope(validPolicySnapshotResponseEnvelope)).toEqual(
      validPolicySnapshotResponseEnvelope
    );
    expect(parseIpcEnvelope(validRunEventEnvelope)).toEqual(validRunEventEnvelope);
  });

  it("rejects unknown channels", () => {
    expect(() =>
      parseIpcEnvelope({
        channel: "unknown.channel",
        payload: {}
      })
    ).toThrow();
  });

  it("rejects malformed payloads", () => {
    expect(() =>
      parseIpcEnvelope({
        channel: "task.intent.submit",
        payload: {
          task: "Inspect the repo",
          session_id: "session-1"
        }
      })
    ).toThrow();
  });

  it("rejects generic command and shell bridge payloads", () => {
    expect(() =>
      parseIpcEnvelope({
        channel: "command.run",
        payload: {
          command: "del /s /q"
        }
      })
    ).toThrow();

    expect(Object.keys(ipcContractMap)).not.toContain("command.run");
    expect(Object.keys(ipcContractMap)).not.toContain("shell.execute");
    expect(Object.keys(ipcContractMap)).not.toContain("runCommand");
  });
});
