import { randomUUID } from "node:crypto";

import type { CapabilityRevocationReason } from "../../shared/constants";
import type { CapabilityTokenRecord } from "./contracts";

export interface CapabilityTokenStore {
  issueToken: (input: {
    readonly run_id: string;
    readonly action_id: string;
    readonly approval_signature: string;
    readonly execution_hash: string;
    readonly session_id: string;
    readonly issued_at: string;
    readonly expires_at: string;
  }) => CapabilityTokenRecord;
  consumeToken: (input: {
    readonly token_id: string;
    readonly run_id: string;
    readonly action_id: string;
    readonly approval_signature: string;
    readonly execution_hash: string;
    readonly session_id: string;
    readonly now: string;
  }) => CapabilityTokenRecord;
  revokeTokensForSession: (
    sessionId: string,
    reason: CapabilityRevocationReason
  ) => void;
  revokeAllTokens: (reason: CapabilityRevocationReason) => void;
}

function isExpired(expiresAt: string, now: string): boolean {
  return new Date(now).getTime() > new Date(expiresAt).getTime();
}

function markRevoked(
  token: CapabilityTokenRecord,
  reason: CapabilityRevocationReason
): CapabilityTokenRecord {
  return {
    ...token,
    status: "revoked",
    remaining_uses: 0,
    revocation_reason: reason
  };
}

export class InMemoryCapabilityTokenStore implements CapabilityTokenStore {
  private readonly tokens = new Map<string, CapabilityTokenRecord>();

  issueToken(input: {
    readonly run_id: string;
    readonly action_id: string;
    readonly approval_signature: string;
    readonly execution_hash: string;
    readonly session_id: string;
    readonly issued_at: string;
    readonly expires_at: string;
  }): CapabilityTokenRecord {
    const token: CapabilityTokenRecord = {
      token_id: randomUUID(),
      run_id: input.run_id,
      action_id: input.action_id,
      approval_signature: input.approval_signature,
      execution_hash: input.execution_hash,
      session_id: input.session_id,
      issued_at: input.issued_at,
      expires_at: input.expires_at,
      remaining_uses: 1,
      status: "active"
    };

    this.tokens.set(token.token_id, token);
    return token;
  }

  consumeToken(input: {
    readonly token_id: string;
    readonly run_id: string;
    readonly action_id: string;
    readonly approval_signature: string;
    readonly execution_hash: string;
    readonly session_id: string;
    readonly now: string;
  }): CapabilityTokenRecord {
    const token = this.tokens.get(input.token_id);

    if (!token) {
      throw new Error("Capability token was not issued.");
    }

    if (token.status === "revoked") {
      throw new Error("Capability token has been revoked.");
    }

    if (token.status === "consumed" || token.remaining_uses < 1) {
      throw new Error("Capability token has already been consumed.");
    }

    if (isExpired(token.expires_at, input.now)) {
      const expiredToken = {
        ...token,
        status: "expired",
        remaining_uses: 0
      } satisfies CapabilityTokenRecord;
      this.tokens.set(token.token_id, expiredToken);
      throw new Error("Capability token has expired.");
    }

    if (
      token.run_id !== input.run_id ||
      token.action_id !== input.action_id ||
      token.approval_signature !== input.approval_signature ||
      token.execution_hash !== input.execution_hash ||
      token.session_id !== input.session_id
    ) {
      throw new Error("Capability token binding mismatch.");
    }

    const consumedToken = {
      ...token,
      status: "consumed",
      remaining_uses: 0
    } satisfies CapabilityTokenRecord;
    this.tokens.set(token.token_id, consumedToken);
    return consumedToken;
  }

  revokeTokensForSession(
    sessionId: string,
    reason: CapabilityRevocationReason
  ): void {
    for (const [tokenId, token] of this.tokens.entries()) {
      if (token.session_id === sessionId && token.status === "active") {
        this.tokens.set(tokenId, markRevoked(token, reason));
      }
    }
  }

  revokeAllTokens(reason: CapabilityRevocationReason): void {
    for (const [tokenId, token] of this.tokens.entries()) {
      if (token.status === "active") {
        this.tokens.set(tokenId, markRevoked(token, reason));
      }
    }
  }
}
