import crypto from "node:crypto";
import { ENV } from "./env";

const PREFIX = "enc:v1";

function parseKey(key: string): Buffer {
  // Prefer base64/hex; fall back to utf8.
  const trimmed = (key ?? "").trim();
  if (!trimmed) {
    throw new Error("DATA_ENCRYPTION_KEY is required for encrypting secrets");
  }

  // base64
  if (/^[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length >= 43) {
    try {
      const b = Buffer.from(trimmed, "base64");
      if (b.length === 32) return b;
    } catch {
      // ignore
    }
  }

  // hex
  if (/^[0-9a-fA-F]+$/.test(trimmed)) {
    try {
      const b = Buffer.from(trimmed, "hex");
      if (b.length === 32) return b;
    } catch {
      // ignore
    }
  }

  // utf8 -> sha256 to 32 bytes
  return crypto.createHash("sha256").update(trimmed, "utf8").digest();
}

function getKey(): Buffer {
  return parseKey(ENV.dataEncryptionKey);
}

export function encryptSecret(plaintext: string): string {
  if (!plaintext) return plaintext;
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}:${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptSecret(maybeEncrypted: string | null | undefined): string | null {
  if (!maybeEncrypted) return null;
  const value = maybeEncrypted.trim();
  if (!value.startsWith(PREFIX + ":")) {
    // Backwards-compatible: plaintext storage
    return value;
  }

  const parts = value.split(":");
  if (parts.length !== 5) {
    // malformed
    return null;
  }
  const [, , ivB64, tagB64, dataB64] = parts;
  try {
    const key = getKey();
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const data = Buffer.from(dataB64, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
    return plaintext;
  } catch {
    return null;
  }
}

export function maskSecret(maybeSecret: string | null | undefined): string | null {
  if (!maybeSecret) return null;
  const s = maybeSecret.trim();
  if (!s) return null;
  const plain = s.startsWith(PREFIX + ":") ? "(encrypted)" : s;
  if (plain === "(encrypted)") return "••••••••";
  if (plain.length <= 10) return "••••••";
  return `${plain.slice(0, 6)}••••${plain.slice(-4)}`;
}
