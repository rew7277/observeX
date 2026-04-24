import crypto from "crypto";

const MIN_SECRET_LEN = 32;

export function requireEnv(name: string, options?: { allowInDev?: boolean; fallback?: string }) {
  const value = process.env[name] || options?.fallback;
  if (value) return value;
  if (process.env.NODE_ENV !== "production" && options?.allowInDev) {
    return `${name.toLowerCase()}-dev-only-secret-please-change`;
  }
  throw new Error(`Missing required environment variable: ${name}`);
}

export function getJwtSecret(): Uint8Array {
  const secret = requireEnv("JWT_SECRET");
  if (secret.length < MIN_SECRET_LEN) throw new Error("JWT_SECRET must be at least 32 characters.");
  return new TextEncoder().encode(secret);
}

// FIX #6 — Grace-period secret for JWT rotation (set JWT_SECRET_OLD during rotation window)
export function getJwtSecretOld(): Uint8Array | null {
  const old = process.env.JWT_SECRET_OLD;
  if (!old || old.length < MIN_SECRET_LEN) return null;
  return new TextEncoder().encode(old);
}

export function hashValue(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

// FIX #7 — Audit log hash chaining: compute a SHA-256 HMAC chain
// so that any deleted or modified row breaks the chain and is detectable.
export function computeAuditHash(previousHash: string, eventData: {
  workspaceId: string; userId: string; action: string; details?: string | null; createdAt: Date;
}): string {
  const payload = [previousHash, eventData.workspaceId, eventData.userId, eventData.action, eventData.details ?? "", eventData.createdAt.toISOString()].join("|");
  const pepper  = process.env.AUDIT_HASH_PEPPER || "observex-audit-v1";
  return crypto.createHmac("sha256", pepper).update(payload).digest("hex");
}

/** Constant-time comparison to prevent timing attacks on API key checks */
export function safeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a.padEnd(64, "0").slice(0, 64));
    const bufB = Buffer.from(b.padEnd(64, "0").slice(0, 64));
    return crypto.timingSafeEqual(bufA, bufB) && a.length === b.length;
  } catch {
    return false;
  }
}

export function createOpaqueToken(prefix = "ovx") {
  return `${prefix}_${crypto.randomBytes(24).toString("hex")}`;
}

/** HTML-entity encode to prevent stored XSS */
export function sanitizeFreeText(input: string, max = 500) {
  return input
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#x27;")
    .trim().slice(0, max);
}

export function isSafeHttpUrl(url: string) {
  try {
    const parsed = new URL(url);
    return ["https:", "http:"].includes(parsed.protocol);
  } catch { return false; }
}

// FIX #9 — Content validation: check that uploaded bytes are valid UTF-8 text,
// not binary data masquerading as a log file.
export function validateTextContent(content: string): { ok: boolean; reason?: string } {
  if (!content || content.trim().length === 0) {
    return { ok: false, reason: "File appears to be empty." };
  }
  // Reject if more than 5% of chars are non-printable (likely binary)
  const nonPrintable = (content.match(/[\x00-\x08\x0E-\x1F\x7F]/g) || []).length;
  const ratio = nonPrintable / content.length;
  if (ratio > 0.05) {
    return { ok: false, reason: "File appears to be binary, not a text log file." };
  }
  return { ok: true };
}

const PII_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "aadhaar-like",    pattern: /\b\d{4}\s?\d{4}\s?\d{4}\b/ },
  { name: "pan-like",        pattern: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i },
  { name: "passport-like",   pattern: /\b[A-Z][1-9][0-9]{7}\b/ },
  { name: "card-like",       pattern: /\b(?:\d[ -]*?){13,19}\b/ },
  { name: "ifsc-like",       pattern: /\b[A-Z]{4}0[A-Z0-9]{6}\b/ },
  { name: "email",           pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
  { name: "phone-in",        pattern: /\b(?:\+91[\s-]?)?[6-9]\d{9}\b/ },
  { name: "upi-vpa",         pattern: /\b[A-Z0-9._-]+@(?:upi|paytm|ybl|okhdfcbank|okaxis|oksbi|okicici)\b/i },
  { name: "ipv4",            pattern: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/ },
  { name: "bearer-token",    pattern: /bearer\s+[A-Za-z0-9._\-]{20,}/i },
  { name: "jwt-token",       pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: "aws-access-key",  pattern: /\b(?:AKIA|ASIA|AROA|AIDA)[A-Z0-9]{16}\b/ },
  { name: "secret-keyword",  pattern: /(password|passwd|secret|api[_-]?key|auth[_-]?token|private[_-]?key)\s*[:=]/i },
  { name: "ssh-private-key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "github-token",    pattern: /\bghp_[A-Za-z0-9]{36}\b/ },
  { name: "stripe-key",      pattern: /\bsk_(?:live|test)_[A-Za-z0-9]{24,}\b/ },
  { name: "google-api-key",  pattern: /\bAIza[A-Za-z0-9_-]{35}\b/ },
  { name: "slack-token",     pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
];

export function detectSensitiveData(message: string) {
  const text = message || "";
  const matched = new Set<string>();
  for (const { name, pattern } of PII_PATTERNS) {
    if (pattern.test(text)) matched.add(name);
  }
  return { containsPii: matched.size > 0, piiTypes: Array.from(matched) };
}

export function maskSensitiveText(message: string): string {
  return message
    .replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, "xxxx xxxx xxxx")
    .replace(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/gi, "*****0000*")
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, "**** **** **** ****")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "***@***.***")
    .replace(/\b(?:\+91[\s-]?)?[6-9]\d{9}\b/g, "**********")
    .replace(/bearer\s+[A-Za-z0-9._\-]{20,}/gi, "Bearer [REDACTED]")
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, "[JWT_REDACTED]")
    .replace(/\b(?:AKIA|ASIA|AROA|AIDA)[A-Z0-9]{16}\b/g, "AKIA[REDACTED]")
    .replace(/((?:password|passwd|secret|api[_-]?key|auth[_-]?token|private[_-]?key)\s*[:=]\s*)([^\s,;]+)/gi, "$1[REDACTED]")
    .replace(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, "[PRIVATE_KEY_REDACTED]")
    .replace(/\bghp_[A-Za-z0-9]{36}\b/g, "ghp_[REDACTED]")
    .replace(/\bsk_(?:live|test)_[A-Za-z0-9]{24,}\b/g, "sk_[REDACTED]");
}

/** Improved signature — keeps first numeric token, collapses repeats */
export function buildSignature(message: string): string {
  return message.toLowerCase()
    .replace(/\b[0-9a-f]{8,}\b/g, "?")
    .replace(/(\b\d+\b)(\s+\d+\b)+/g, "$1 ?")
    .replace(/\s+/g, " ").trim().slice(0, 200);
}

const BRUTE_FORCE_WINDOW_MS   = 15 * 60 * 1000;
const BRUTE_FORCE_MAX_ATTEMPTS = 10;

export async function checkBruteForce(email: string): Promise<boolean> {
  const { db } = await import("@/lib/db");
  const since = new Date(Date.now() - BRUTE_FORCE_WINDOW_MS);
  const failures = await db.authEvent.count({ where: { email, success: false, createdAt: { gte: since } } });
  return failures >= BRUTE_FORCE_MAX_ATTEMPTS;
}
