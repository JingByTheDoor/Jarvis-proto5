import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  DefaultEncryptedAtRestProvider,
  type PersistencePurpose
} from "../../src/core/persistence/encrypted-at-rest";

const tempRoots: string[] = [];

function createTempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jarvis-phase0-"));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root && fs.existsSync(root)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

function tamperBase64(encoded: string): string {
  const bytes = Buffer.from(encoded, "base64");
  bytes[0] = bytes[0] ^ 0xff;
  return bytes.toString("base64");
}

describe("encrypted-at-rest provider", () => {
  it(
    "encrypts run logs, memory, caches, sensitive settings, and export staging on disk",
    () => {
    const provider = new DefaultEncryptedAtRestProvider();
    const root = createTempRoot();
    const keyDirectory = path.join(root, "keys");
    const cases: Array<{
      purpose: PersistencePurpose;
      fileName: string;
      payload: Record<string, string>;
      plaintextMarker: string;
    }> = [
      {
        purpose: "run_log",
        fileName: "run-log.json",
        payload: { summary: "run log payload" },
        plaintextMarker: "run log payload"
      },
      {
        purpose: "memory_store",
        fileName: "memory.json",
        payload: { fact: "memory payload" },
        plaintextMarker: "memory payload"
      },
      {
        purpose: "cache_entry",
        fileName: "cache.json",
        payload: { entry: "cache payload" },
        plaintextMarker: "cache payload"
      },
      {
        purpose: "sensitive_setting",
        fileName: "settings.json",
        payload: { apiKeyRef: "sensitive payload" },
        plaintextMarker: "sensitive payload"
      },
      {
        purpose: "export_staging",
        fileName: "export.json",
        payload: { artifact: "export payload" },
        plaintextMarker: "export payload"
      }
    ];

    for (const entry of cases) {
      const filePath = path.join(root, entry.fileName);
      provider.writeEncryptedJson(filePath, entry.purpose, entry.payload, keyDirectory);

      const rawDiskContent = fs.readFileSync(filePath, "utf8");
      expect(rawDiskContent).not.toContain(entry.plaintextMarker);

      const roundTrip = provider.readEncryptedJson<typeof entry.payload>(
        filePath,
        entry.purpose,
        keyDirectory
      );
      expect(roundTrip).toEqual(entry.payload);
    }

    const keyMaterial = provider.loadOrCreateContentKey(keyDirectory);
    const keyEnvelope = fs.readFileSync(keyMaterial.envelopePath, "utf8");
    expect(keyEnvelope).not.toContain(keyMaterial.key.toString("base64"));
    expect(keyEnvelope).toContain("windows-dpapi-current-user");
    },
    15000
  );

  it("reuses the same installation key across provider instances", () => {
    const root = createTempRoot();
    const keyDirectory = path.join(root, "keys");
    const filePath = path.join(root, "run-log.json");

    const firstProvider = new DefaultEncryptedAtRestProvider();
    const secondProvider = new DefaultEncryptedAtRestProvider();

    firstProvider.writeEncryptedJson(
      filePath,
      "run_log",
      { summary: "shared key round trip" },
      keyDirectory
    );

    expect(
      secondProvider.readEncryptedJson<{ summary: string }>(
        filePath,
        "run_log",
        keyDirectory
      )
    ).toEqual({
      summary: "shared key round trip"
    });
  });

  it("fails safely when the encrypted payload is tampered with", () => {
    const provider = new DefaultEncryptedAtRestProvider();
    const root = createTempRoot();
    const keyDirectory = path.join(root, "keys");
    const filePath = path.join(root, "run-log.json");

    provider.writeEncryptedJson(
      filePath,
      "run_log",
      { summary: "tamper check" },
      keyDirectory
    );

    const envelope = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
      ciphertext: string;
    };
    envelope.ciphertext = tamperBase64(envelope.ciphertext);
    fs.writeFileSync(filePath, JSON.stringify(envelope, null, 2), "utf8");

    expect(() =>
      provider.readEncryptedJson<{ summary: string }>(filePath, "run_log", keyDirectory)
    ).toThrow();
  });
});
