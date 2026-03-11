import { describe, expect, it } from "vitest";

import { redactToolResultPayload } from "../../src/core/redaction/redactor";

describe("recursive redaction", () => {
  it("redacts nested tool-result fields, filenames, and preview payloads", () => {
    const secret = "super-secret-token";
    const payload = {
      summary: `Authorization: Bearer ${secret}`,
      output: {
        filename: `preview-${secret}.txt`,
        nested: [
          {
            error: `Cookie: session=${secret}; csrftoken=${secret}`
          }
        ]
      },
      error: `sk-${secret}`,
      artifacts: [
        {
          location: `D:\\tmp\\${secret}.log`
        }
      ],
      structured_data: {
        preview_payload: {
          text: `Token ${secret} appears again`
        }
      },
      observed_effects: [
        {
          detail: `Secret marker ${secret}`
        }
      ]
    };

    const redacted = redactToolResultPayload(payload, {
      explicitSecrets: [secret]
    });

    const firstPlaceholder = redacted.placeholders[0];
    expect(firstPlaceholder).toMatch(/^\[REDACTED:/);
    expect(JSON.stringify(redacted.redactedValue)).not.toContain(secret);
    expect(JSON.stringify(redacted.redactedValue)).toContain(firstPlaceholder);
    expect(redacted.redactionCount).toBeGreaterThan(0);
  });

  it("uses deterministic placeholders for repeated leaks", () => {
    const secret = "same-secret";
    const first = redactToolResultPayload(`Bearer ${secret}`, {
      explicitSecrets: [secret]
    });
    const second = redactToolResultPayload(`Cookie: token=${secret}`, {
      explicitSecrets: [secret]
    });

    expect(first.placeholders[0]).toBe(second.placeholders[0]);
  });
});

