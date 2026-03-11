import net from "node:net";

import type {
  NetworkAccessClass,
  NetworkMethodFamily,
  NetworkScheme
} from "../../shared/constants";
import type { NetworkScopeRule } from "../schemas";

export interface NetworkRequestDescriptor {
  readonly url: string;
  readonly method: string;
  readonly accessClass: NetworkAccessClass;
  readonly redirectChain?: readonly string[];
}

export interface NetworkResolver {
  readonly resolveHost: (host: string) => Promise<readonly string[]> | readonly string[];
}

export interface NetworkDecision {
  readonly allowed: boolean;
  readonly reason?: string;
}

export interface NetworkScopePolicy {
  readonly authorizeRequest: (
    rules: readonly NetworkScopeRule[],
    request: NetworkRequestDescriptor,
    options?: {
      readonly allowRedirects?: boolean;
      readonly resolver?: NetworkResolver;
    }
  ) => Promise<NetworkDecision>;
}

function normalizeScheme(protocol: string): NetworkScheme {
  const scheme = protocol.replace(/:$/, "").toLowerCase();
  if (scheme !== "http" && scheme !== "https") {
    throw new Error("Only HTTP(S) network scopes are supported in Phase 0A");
  }

  return scheme;
}

function inferPort(url: URL): number {
  if (url.port) {
    return Number(url.port);
  }

  return url.protocol === "https:" ? 443 : 80;
}

function classifyMethodFamily(method: string): NetworkMethodFamily {
  const normalized = method.trim().toUpperCase();
  if (["GET", "HEAD", "OPTIONS", "TRACE"].includes(normalized)) {
    return "read_methods";
  }

  return "write_methods";
}

function normalizeHost(host: string): string {
  return host.trim().toLowerCase();
}

function isPrivateIpv4(address: string): boolean {
  const segments = address.split(".").map((value) => Number(value));
  if (segments.length !== 4 || segments.some((value) => Number.isNaN(value))) {
    return false;
  }

  if (segments[0] === 10 || segments[0] === 127) {
    return true;
  }

  if (segments[0] === 169 && segments[1] === 254) {
    return true;
  }

  if (segments[0] === 172 && segments[1] >= 16 && segments[1] <= 31) {
    return true;
  }

  if (segments[0] === 192 && segments[1] === 168) {
    return true;
  }

  if (segments[0] >= 224 && segments[0] <= 239) {
    return true;
  }

  return false;
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("ff")
  );
}

function isBlockedLiteralHost(host: string): boolean {
  const normalized = normalizeHost(host);
  if (normalized === "localhost" || normalized.endsWith(".localhost")) {
    return true;
  }

  if (normalized === "169.254.169.254") {
    return true;
  }

  const ipVersion = net.isIP(normalized);
  if (ipVersion === 4) {
    return isPrivateIpv4(normalized);
  }

  if (ipVersion === 6) {
    return isPrivateIpv6(normalized);
  }

  return false;
}

async function validateResolvedAddresses(
  host: string,
  resolver?: NetworkResolver
): Promise<void> {
  if (!resolver) {
    return;
  }

  const resolved = await resolver.resolveHost(host);
  for (const address of resolved) {
    if (isBlockedLiteralHost(address)) {
      throw new Error("DNS revalidation resolved to a blocked destination");
    }
  }
}

function ruleMatches(
  rule: NetworkScopeRule,
  url: URL,
  methodFamily: NetworkMethodFamily,
  accessClass: NetworkAccessClass
): boolean {
  return (
    rule.scheme === normalizeScheme(url.protocol) &&
    normalizeHost(rule.host) === normalizeHost(url.hostname) &&
    rule.port === inferPort(url) &&
    rule.methodFamily === methodFamily &&
    rule.accessClass === accessClass
  );
}

export class DefaultNetworkScopePolicy implements NetworkScopePolicy {
  public async authorizeRequest(
    rules: readonly NetworkScopeRule[],
    request: NetworkRequestDescriptor,
    options?: {
      readonly allowRedirects?: boolean;
      readonly resolver?: NetworkResolver;
    }
  ): Promise<NetworkDecision> {
    const descriptors = [request.url, ...(request.redirectChain ?? [])];
    if ((request.redirectChain?.length ?? 0) > 0 && !options?.allowRedirects) {
      return {
        allowed: false,
        reason: "redirects_disabled"
      };
    }

    for (const descriptor of descriptors) {
      const url = new URL(descriptor);
      normalizeScheme(url.protocol);

      if (isBlockedLiteralHost(url.hostname)) {
        return {
          allowed: false,
          reason: "blocked_destination"
        };
      }

      await validateResolvedAddresses(url.hostname, options?.resolver);

      const methodFamily = classifyMethodFamily(request.method);
      const matchedRule = rules.some((rule) =>
        ruleMatches(rule, url, methodFamily, request.accessClass)
      );

      if (!matchedRule) {
        return {
          allowed: false,
          reason: "not_allowlisted"
        };
      }
    }

    return { allowed: true };
  }
}
