import { execFileSync } from "node:child_process";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const persistencePurposes = [
  "run_log",
  "memory_store",
  "cache_entry",
  "sensitive_setting",
  "export_staging"
] as const;

export type PersistencePurpose = (typeof persistencePurposes)[number];

export interface ContentKeyEnvelope {
  readonly version: 1;
  readonly provider: "windows-dpapi-current-user";
  readonly key_id: string;
  readonly protected_key: string;
  readonly created_at: string;
}

export interface ContentKeyMaterial {
  readonly keyId: string;
  readonly key: Buffer;
  readonly envelopePath: string;
}

export interface EncryptedFileEnvelope {
  readonly version: 1;
  readonly format: "jarvis.encrypted-file";
  readonly algorithm: "aes-256-gcm";
  readonly key_id: string;
  readonly purpose: PersistencePurpose;
  readonly iv: string;
  readonly ciphertext: string;
  readonly tag: string;
  readonly created_at: string;
}

export interface DpapiProtector {
  readonly protect: (plaintext: Buffer) => Buffer;
  readonly unprotect: (protectedBytes: Buffer) => Buffer;
}

export interface EncryptedAtRestProvider {
  readonly loadOrCreateContentKey: (keyDirectory: string) => ContentKeyMaterial;
  readonly writeEncryptedJson: <T>(
    filePath: string,
    purpose: PersistencePurpose,
    value: T,
    keyDirectory: string
  ) => EncryptedFileEnvelope;
  readonly readEncryptedJson: <T>(
    filePath: string,
    purpose: PersistencePurpose,
    keyDirectory: string
  ) => T;
}

function toBase64(value: Buffer): string {
  return value.toString("base64");
}

function fromBase64(value: string): Buffer {
  return Buffer.from(value, "base64");
}

function nowIso(): string {
  return new Date().toISOString();
}

function computeKeyId(key: Buffer): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

function loadAssemblyPreamble(): string {
  return "Add-Type -AssemblyName System.Security";
}

function protectScript(inputBase64: string): string {
  return [
    loadAssemblyPreamble(),
    `$inputB64 = '${inputBase64}'`,
    "$scope = [System.Security.Cryptography.DataProtectionScope]::CurrentUser",
    "$bytes = [Convert]::FromBase64String($inputB64)",
    "$protected = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $null, $scope)",
    "[Console]::Out.Write([Convert]::ToBase64String($protected))"
  ].join(";");
}

function unprotectScript(inputBase64: string): string {
  return [
    loadAssemblyPreamble(),
    `$inputB64 = '${inputBase64}'`,
    "$scope = [System.Security.Cryptography.DataProtectionScope]::CurrentUser",
    "$bytes = [Convert]::FromBase64String($inputB64)",
    "$unprotected = [System.Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, $scope)",
    "[Console]::Out.Write([Convert]::ToBase64String($unprotected))"
  ].join(";");
}

function ensureSupportedPlatform(): void {
  if (process.platform !== "win32") {
    throw new Error("Phase 0 encrypted-at-rest currently requires Windows DPAPI");
  }
}

export class PowerShellCurrentUserDpapiProtector implements DpapiProtector {
  public protect(plaintext: Buffer): Buffer {
    ensureSupportedPlatform();
    const protectedBase64 = execFileSync(
      "powershell",
      ["-NoProfile", "-Command", protectScript(toBase64(plaintext))],
      {
        encoding: "utf8",
        windowsHide: true
      }
    ).trim();

    return fromBase64(protectedBase64);
  }

  public unprotect(protectedBytes: Buffer): Buffer {
    ensureSupportedPlatform();
    const plaintextBase64 = execFileSync(
      "powershell",
      ["-NoProfile", "-Command", unprotectScript(toBase64(protectedBytes))],
      {
        encoding: "utf8",
        windowsHide: true
      }
    ).trim();

    return fromBase64(plaintextBase64);
  }
}

export class DefaultEncryptedAtRestProvider implements EncryptedAtRestProvider {
  private readonly cachedContentKeys = new Map<string, ContentKeyMaterial>();

  public constructor(
    private readonly protector: DpapiProtector = new PowerShellCurrentUserDpapiProtector()
  ) {}

  public loadOrCreateContentKey(keyDirectory: string): ContentKeyMaterial {
    const normalizedKeyDirectory = path.resolve(keyDirectory);
    const cached = this.cachedContentKeys.get(normalizedKeyDirectory);
    if (cached) {
      return cached;
    }

    fs.mkdirSync(normalizedKeyDirectory, { recursive: true });
    const envelopePath = path.join(normalizedKeyDirectory, "content-key.json");

    if (!fs.existsSync(envelopePath)) {
      const key = randomBytes(32);
      const envelope: ContentKeyEnvelope = {
        version: 1,
        provider: "windows-dpapi-current-user",
        key_id: computeKeyId(key),
        protected_key: toBase64(this.protector.protect(key)),
        created_at: nowIso()
      };

      fs.writeFileSync(envelopePath, JSON.stringify(envelope, null, 2), "utf8");
    }

    const envelope = JSON.parse(
      fs.readFileSync(envelopePath, "utf8")
    ) as ContentKeyEnvelope;

    if (envelope.version !== 1 || envelope.provider !== "windows-dpapi-current-user") {
      throw new Error("Unsupported content key envelope");
    }

    const key = this.protector.unprotect(fromBase64(envelope.protected_key));
    const material = {
      keyId: envelope.key_id,
      key,
      envelopePath
    };

    this.cachedContentKeys.set(normalizedKeyDirectory, material);
    return material;
  }

  public writeEncryptedJson<T>(
    filePath: string,
    purpose: PersistencePurpose,
    value: T,
    keyDirectory: string
  ): EncryptedFileEnvelope {
    const contentKey = this.loadOrCreateContentKey(keyDirectory);
    const iv = randomBytes(12);
    const envelopeBase = {
      purpose,
      key_id: contentKey.keyId,
      version: 1
    } as const;
    const aad = Buffer.from(JSON.stringify(envelopeBase), "utf8");
    const plaintext = Buffer.from(JSON.stringify(value), "utf8");
    const cipher = createCipheriv("aes-256-gcm", contentKey.key, iv);
    cipher.setAAD(aad);

    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();

    const envelope: EncryptedFileEnvelope = {
      version: 1,
      format: "jarvis.encrypted-file",
      algorithm: "aes-256-gcm",
      key_id: contentKey.keyId,
      purpose,
      iv: toBase64(iv),
      ciphertext: toBase64(ciphertext),
      tag: toBase64(tag),
      created_at: nowIso()
    };

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(envelope, null, 2), "utf8");

    return envelope;
  }

  public readEncryptedJson<T>(
    filePath: string,
    purpose: PersistencePurpose,
    keyDirectory: string
  ): T {
    const contentKey = this.loadOrCreateContentKey(keyDirectory);
    const envelope = JSON.parse(
      fs.readFileSync(filePath, "utf8")
    ) as EncryptedFileEnvelope;

    if (
      envelope.version !== 1 ||
      envelope.format !== "jarvis.encrypted-file" ||
      envelope.algorithm !== "aes-256-gcm"
    ) {
      throw new Error("Unsupported encrypted file envelope");
    }

    if (envelope.key_id !== contentKey.keyId) {
      throw new Error("Encrypted file key ID does not match the current installation key");
    }

    if (envelope.purpose !== purpose) {
      throw new Error("Encrypted file purpose mismatch");
    }

    const aad = Buffer.from(
      JSON.stringify({
        purpose: envelope.purpose,
        key_id: envelope.key_id,
        version: envelope.version
      }),
      "utf8"
    );
    const decipher = createDecipheriv(
      "aes-256-gcm",
      contentKey.key,
      fromBase64(envelope.iv)
    );
    decipher.setAAD(aad);
    decipher.setAuthTag(fromBase64(envelope.tag));

    const plaintext = Buffer.concat([
      decipher.update(fromBase64(envelope.ciphertext)),
      decipher.final()
    ]);

    return JSON.parse(plaintext.toString("utf8")) as T;
  }
}
