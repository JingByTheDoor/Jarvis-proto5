import { describe, expect, it } from "vitest";

import { DefaultNetworkScopePolicy } from "../../src/core/capabilities/network-scope-policy";

describe("network scope policy", () => {
  const policy = new DefaultNetworkScopePolicy();
  const allowReadRule = [
    {
      scheme: "https" as const,
      host: "example.com",
      port: 443,
      methodFamily: "read_methods" as const,
      accessClass: "read" as const
    }
  ];

  it("defaults to deny when nothing is allowlisted", async () => {
    await expect(
      policy.authorizeRequest([], {
        url: "https://example.com/api",
        method: "GET",
        accessClass: "read"
      })
    ).resolves.toEqual({
      allowed: false,
      reason: "not_allowlisted"
    });
  });

  it("allows exact allowlist matches", async () => {
    await expect(
      policy.authorizeRequest(allowReadRule, {
        url: "https://example.com/api",
        method: "GET",
        accessClass: "read"
      })
    ).resolves.toEqual({
      allowed: true
    });
  });

  it("rejects redirects to localhost and private ranges", async () => {
    await expect(
      policy.authorizeRequest(
        allowReadRule,
        {
          url: "https://example.com/api",
          method: "GET",
          accessClass: "read",
          redirectChain: ["https://localhost/admin"]
        },
        {
          allowRedirects: true
        }
      )
    ).resolves.toEqual({
      allowed: false,
      reason: "blocked_destination"
    });

    await expect(
      policy.authorizeRequest(
        allowReadRule,
        {
          url: "https://example.com/api",
          method: "GET",
          accessClass: "read",
          redirectChain: ["https://192.168.1.20/admin"]
        },
        {
          allowRedirects: true
        }
      )
    ).resolves.toEqual({
      allowed: false,
      reason: "blocked_destination"
    });
  });

  it("rejects cloud metadata endpoints", async () => {
    await expect(
      policy.authorizeRequest(allowReadRule, {
        url: "http://169.254.169.254/latest/meta-data",
        method: "GET",
        accessClass: "read"
      })
    ).resolves.toEqual({
      allowed: false,
      reason: "blocked_destination"
    });
  });

  it("revalidates DNS results at connect time", async () => {
    await expect(
      policy.authorizeRequest(
        allowReadRule,
        {
          url: "https://example.com/api",
          method: "GET",
          accessClass: "read"
        },
        {
          resolver: {
            resolveHost: () => ["10.0.0.5"]
          }
        }
      )
    ).rejects.toThrow(/blocked destination/i);
  });
});

