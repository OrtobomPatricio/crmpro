import dns from "node:dns/promises";
import net from "node:net";

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map(n => Number(n));
  if (parts.length !== 4 || parts.some(n => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique local
  if (normalized.startsWith("fe80")) return true; // link-local
  return false;
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIpv4(ip);
  if (net.isIPv6(ip)) return isPrivateIpv6(ip);
  return true;
}

function parseAllowlist(): string[] {
  const raw = (process.env.INTEGRATIONS_WEBHOOK_ALLOWLIST ?? "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowlisted(hostname: string, allowlist: string[]): boolean {
  if (allowlist.length === 0) return false;
  const h = hostname.toLowerCase();
  return allowlist.some(d => h === d || h.endsWith(`.${d}`));
}

export async function assertSafeOutboundUrl(urlString: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error("URL inválida");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Solo se permite http/https");
  }

  const hostname = url.hostname;
  if (!hostname) throw new Error("URL inválida");

  const allowlist = parseAllowlist();
  const allowlisted = isAllowlisted(hostname, allowlist);

  // Block obvious local hostnames
  if (!allowlisted) {
    const lower = hostname.toLowerCase();
    if (lower === "localhost" || lower.endsWith(".local") || lower.endsWith(".internal")) {
      throw new Error("Webhook no permitido (hostname local)");
    }
  }

  // If host is an IP literal, validate directly
  const ipKind = net.isIP(hostname);
  if (ipKind) {
    if (!allowlisted && isPrivateIp(hostname)) {
      throw new Error("Webhook no permitido (IP privada)");
    }
    return;
  }

  // Resolve DNS and block private ranges (unless allowlisted)
  try {
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    if (!allowlisted) {
      for (const r of records) {
        if (isPrivateIp(r.address)) {
          throw new Error("Webhook no permitido (resuelve a IP privada)");
        }
      }
    }
  } catch (e) {
    // If DNS fails, treat as unsafe
    if (e instanceof Error) {
      throw new Error(`No se pudo resolver el dominio del webhook: ${e.message}`);
    }
    throw new Error("No se pudo resolver el dominio del webhook");
  }
}
