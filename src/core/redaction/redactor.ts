import { createHash } from "node:crypto";

export interface RedactionOptions {
  readonly explicitSecrets?: readonly string[];
}

export interface RedactionResult<T = unknown> {
  readonly redactedValue: T;
  readonly redactionCount: number;
  readonly placeholders: readonly string[];
}

const providerKeyPattern =
  /\b(?:sk-[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9]{8,}|github_pat_[A-Za-z0-9_]{8,}|AIza[A-Za-z0-9_-]{8,})\b/g;

function placeholderFor(secret: string): string {
  return `[REDACTED:${createHash("sha256").update(secret).digest("hex").slice(0, 12)}]`;
}

function redactCookieHeader(value: string, onReplacement: (secret: string) => string): string {
  return value.replace(/(Cookie:\s*)(.+)$/gi, (_, prefix: string, cookies: string) => {
    const sanitized = cookies
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const separatorIndex = entry.indexOf("=");
        if (separatorIndex === -1) {
          return onReplacement(entry);
        }

        const name = entry.slice(0, separatorIndex);
        const secret = entry.slice(separatorIndex + 1);
        return `${name}=${onReplacement(secret)}`;
      })
      .join("; ");

    return `${prefix}${sanitized}`;
  });
}

function redactAuthorizationHeader(
  value: string,
  onReplacement: (secret: string) => string
): string {
  return value.replace(
    /(Authorization:\s*(?:Bearer|Basic)\s+)([^\s]+)/gi,
    (_, prefix: string, secret: string) => `${prefix}${onReplacement(secret)}`
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function sanitizeString(
  value: string,
  options: RedactionOptions,
  placeholders: Set<string>
): { value: string; count: number } {
  let count = 0;
  const replacementMap = new Map<string, string>();

  const getReplacement = (secret: string): string => {
    if (!replacementMap.has(secret)) {
      const placeholder = placeholderFor(secret);
      replacementMap.set(secret, placeholder);
      placeholders.add(placeholder);
    }

    return replacementMap.get(secret)!;
  };

  let redacted = value;

  for (const secret of options.explicitSecrets ?? []) {
    if (!secret) {
      continue;
    }

    if (redacted.includes(secret)) {
      redacted = redacted.split(secret).join(getReplacement(secret));
      count += 1;
    }
  }

  redacted = redactAuthorizationHeader(redacted, (secret) => {
    count += 1;
    return getReplacement(secret);
  });

  redacted = redactCookieHeader(redacted, (secret) => {
    count += 1;
    return getReplacement(secret);
  });

  redacted = redacted.replace(providerKeyPattern, (secret) => {
    count += 1;
    return getReplacement(secret);
  });

  return { value: redacted, count };
}

function sanitizeValue(
  value: unknown,
  options: RedactionOptions,
  placeholders: Set<string>
): { value: unknown; count: number } {
  if (typeof value === "string") {
    return sanitizeString(value, options, placeholders);
  }

  if (Array.isArray(value)) {
    let count = 0;
    const next = value.map((entry) => {
      const sanitized = sanitizeValue(entry, options, placeholders);
      count += sanitized.count;
      return sanitized.value;
    });

    return { value: next, count };
  }

  if (isPlainObject(value)) {
    let count = 0;
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      const sanitizedKey = sanitizeString(key, options, placeholders);
      const sanitizedValue = sanitizeValue(entry, options, placeholders);
      count += sanitizedKey.count + sanitizedValue.count;
      next[sanitizedKey.value] = sanitizedValue.value;
    }

    return { value: next, count };
  }

  return { value, count: 0 };
}

export function redactValue<T>(
  value: T,
  options: RedactionOptions = {}
): RedactionResult<T> {
  const placeholders = new Set<string>();
  const sanitized = sanitizeValue(value, options, placeholders);
  return {
    redactedValue: sanitized.value as T,
    redactionCount: sanitized.count,
    placeholders: [...placeholders]
  };
}

export function redactToolResultPayload<T>(
  value: T,
  options: RedactionOptions = {}
): RedactionResult<T> {
  return redactValue(value, options);
}
