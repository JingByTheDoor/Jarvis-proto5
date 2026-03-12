import { describe, expect, it } from "vitest";

import { InMemoryCapabilityTokenStore } from "../../src/core/capabilities/capability-token-store";
import { ISO_EXPIRY, ISO_NOW } from "../fixtures";

describe("capability token store", () => {
  it("issues a single-use token and rejects replay after the first consume", () => {
    const tokenStore = new InMemoryCapabilityTokenStore();
    const token = tokenStore.issueToken({
      run_id: "run-1",
      action_id: "action-1",
      approval_signature: "approval-signature-1",
      execution_hash: "execution-hash-1",
      session_id: "session-1",
      issued_at: ISO_NOW,
      expires_at: ISO_EXPIRY
    });

    expect(
      tokenStore.consumeToken({
        token_id: token.token_id,
        run_id: "run-1",
        action_id: "action-1",
        approval_signature: "approval-signature-1",
        execution_hash: "execution-hash-1",
        session_id: "session-1",
        now: ISO_NOW
      }).status
    ).toBe("consumed");

    expect(() =>
      tokenStore.consumeToken({
        token_id: token.token_id,
        run_id: "run-1",
        action_id: "action-1",
        approval_signature: "approval-signature-1",
        execution_hash: "execution-hash-1",
        session_id: "session-1",
        now: ISO_NOW
      })
    ).toThrow("already been consumed");
  });

  it("allows only one winner under parallel double-submit against the same token", async () => {
    const tokenStore = new InMemoryCapabilityTokenStore();
    const token = tokenStore.issueToken({
      run_id: "run-1",
      action_id: "action-1",
      approval_signature: "approval-signature-1",
      execution_hash: "execution-hash-1",
      session_id: "session-1",
      issued_at: ISO_NOW,
      expires_at: ISO_EXPIRY
    });

    const results = await Promise.allSettled([
      Promise.resolve().then(() =>
        tokenStore.consumeToken({
          token_id: token.token_id,
          run_id: "run-1",
          action_id: "action-1",
          approval_signature: "approval-signature-1",
          execution_hash: "execution-hash-1",
          session_id: "session-1",
          now: ISO_NOW
        })
      ),
      Promise.resolve().then(() =>
        tokenStore.consumeToken({
          token_id: token.token_id,
          run_id: "run-1",
          action_id: "action-1",
          approval_signature: "approval-signature-1",
          execution_hash: "execution-hash-1",
          session_id: "session-1",
          now: ISO_NOW
        })
      )
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });

  it("revokes active tokens on session lock and app restart", () => {
    const tokenStore = new InMemoryCapabilityTokenStore();
    const sessionToken = tokenStore.issueToken({
      run_id: "run-1",
      action_id: "action-1",
      approval_signature: "approval-signature-1",
      execution_hash: "execution-hash-1",
      session_id: "session-1",
      issued_at: ISO_NOW,
      expires_at: ISO_EXPIRY
    });
    const restartToken = tokenStore.issueToken({
      run_id: "run-2",
      action_id: "action-2",
      approval_signature: "approval-signature-2",
      execution_hash: "execution-hash-2",
      session_id: "session-2",
      issued_at: ISO_NOW,
      expires_at: ISO_EXPIRY
    });

    tokenStore.revokeTokensForSession("session-1", "manual_lock");
    expect(() =>
      tokenStore.consumeToken({
        token_id: sessionToken.token_id,
        run_id: "run-1",
        action_id: "action-1",
        approval_signature: "approval-signature-1",
        execution_hash: "execution-hash-1",
        session_id: "session-1",
        now: ISO_NOW
      })
    ).toThrow("revoked");

    tokenStore.revokeAllTokens("app_restart");
    expect(() =>
      tokenStore.consumeToken({
        token_id: restartToken.token_id,
        run_id: "run-2",
        action_id: "action-2",
        approval_signature: "approval-signature-2",
        execution_hash: "execution-hash-2",
        session_id: "session-2",
        now: ISO_NOW
      })
    ).toThrow("revoked");
  });
});
