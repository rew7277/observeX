import crypto from "crypto";

const MIN_SECRET_LEN = 32;

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

export function requireEnv(name: string, options?: { allowInDev?: boolean; fallback?: string }) {
  const value = process.env[name] || options?.fallback;
  if (value) return value;
  if (process.env.NODE_ENV !== "production" && options?.allowInDev) {
    return `${name.toLowerCase()}-dev-only-secret-please-change`;
  }
  throw new Error(`Missing required environment variable: ${name}`);
}

export function getJwtSecret() {
  const secret = requireEnv("JWT_SECRET");
  if (secret.length < MIN_SECRET_LEN) {
    throw new Error("JWT_SECRET must be at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

// ---------------------------------------------------------------------------
// Hashing & tokens
// ---------------------------------------------------------------------------

export function hashValue(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/** Constant-time comparison to prevent timing attacks on API keys */
export function safeCompare(a: string, b: string): boolean {
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

export function createOpaqueToken(prefix = "ovx") {
  const token = crypto.randomBytes(24).toString("hex");
  return `${prefix}_${token}`;
}

// ---------------------------------------------------------------------------
// Input sanitization
// ---------------------------------------------------------------------------

/** HTML-entity encode to prevent stored XSS in dashboard UI */
export function sanitizeFreeText(input: string, max = 500) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .trim()
    .slice(0, max);
}

export function isSafeHttpUrl(url: string) {
  try {
    const parsed = new URL(url);
    return ["https:", "http:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// PII & sensitive-data detection — expanded pattern set
// ---------------------------------------------------------------------------

const PII_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  // Identity documents
  { name: "aadhaar-like",    pattern: /\b\d{4}\s?\d{4}\s?\d{4}\b/ },
  { name: "pan-like",        pattern: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i },
  { name: "passport-like",   pattern: /\b[A-Z][1-9][0-9]{7}\b/ },               // Indian passport format

  // Financial
  { name: "card-like",       pattern: /\b(?:\d[ -]*?){13,19}\b/ },
  { name: "ifsc-like",       pattern: /\b[A-Z]{4}0[A-Z0-9]{6}\b/ },

  // Contact
  { name: "email",           pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
  { name: "phone-like",      pattern: /\b(?:\+91[\s-]?)?[6-9]\d{9}\b/ },        // Indian mobile
  { name: "upi-vpa",         pattern: /\b[A-Z0-9._-]+@(?:upi|paytm|ybl|okhdfcbank|okaxis|oksbi|okicici)\b/i },

  // Network
  { name: "ipv4-private",    pattern: /\b(?:10|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b/ },
  { name: "ipv4-public",     pattern: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/ },

  // Secrets & tokens
  { name: "bearer-token",    pattern: /bearer\s+[A-Za-z0-9._\-]{20,}/i },
  { name: "jwt-token",       pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: "aws-access-key",  pattern: /\b(?:AKIA|ASIA|AROA|AIDA|ANPA|ANVA|APKA)[A-Z0-9]{16}\b/ },
  { name: "aws-secret-key",  pattern: /\b[A-Za-z0-9/+]{40}\b/ },
  { name: "secret-keyword",  pattern: /(password|passwd|secret|api[_-]?key|auth[_-]?token|private[_-]?key)\s*[:=]/i },
  { name: "ssh-private-key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "github-token",    pattern: /\bghp_[A-Za-z0-9]{36}\b/ },
  { name: "stripe-key",      pattern: /\bsk_(?:live|test)_[A-Za-z0-9]{24,}\b/ },
];

export function detectSensitiveData(message: string): {
  containsPii: boolean;
  piiTypes: string[];
} {
  const text = message || "";
  const matched = new Set<string>();

  for (const { name, pattern } of PII_PATTERNS) {
    if (pattern.test(text)) matched.add(name);
  }

  return {
    containsPii: matched.size > 0,
    piiTypes: Array.from(matched),
  };
}

export function maskSensitiveText(message: string): string {
  return message
    // Identity
    .replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, "xxxx xxxx xxxx")
    .replace(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/gi, "*****0000*")
    .replace(/\b[A-Z][1-9][0-9]{7}\b/g, "P*******")
    // Financial
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, "**** **** **** ****")
    // Contact
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "***@***.***")
    .replace(/\b(?:\+91[\s-]?)?[6-9]\d{9}\b/g, "**********")
    .replace(/\b[A-Z0-9._-]+@(?:upi|paytm|ybl|okhdfcbank|okaxis|oksbi|okicici)\b/gi, "***@upi")
    // Tokens & secrets
    .replace(/bearer\s+[A-Za-z0-9._\-]{20,}/gi, "Bearer [REDACTED]")
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, "[JWT_REDACTED]")
    .replace(/\b(?:AKIA|ASIA|AROA|AIDA|ANPA|ANVA|APKA)[A-Z0-9]{16}\b/g, "AKIA[REDACTED]")
    .replace(/((?:password|passwd|secret|api[_-]?key|auth[_-]?token|private[_-]?key)\s*[:=]\s*)([^\s,;]+)/gi, "$1[REDACTED]")
    .replace(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, "[PRIVATE_KEY_REDACTED]")
    .replace(/\bghp_[A-Za-z0-9]{36}\b/g, "ghp_[REDACTED]")
    .replace(/\bsk_(?:live|test)_[A-Za-z0-9]{24,}\b/g, "sk_[REDACTED]");
}

// ---------------------------------------------------------------------------
// Message signature — improved to reduce false-positive deduplication
// ---------------------------------------------------------------------------

/**
 * Builds a normalised signature for grouping similar log messages.
 *
 * Improvement over the original: the first occurrence of a number in each
 * segment is preserved as context (e.g. "disk usage 90%" and "disk usage 10%"
 * no longer hash identically). Only trailing/repeated numeric tokens are
 * collapsed to "?".
 */
export function buildSignature(message: string): string {
  return message
    .toLowerCase()
    // Redact long hex IDs (UUIDs, trace IDs) unconditionally
    .replace(/\b[0-9a-f]{8,}\b/g, "?")
    // Redact repeated digits at the end of segments (keep first occurrence)
    .replace(/(\b\d+\b)(\s+\d+\b)+/g, "$1 ?")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

// ---------------------------------------------------------------------------
// Brute-force protection
// ---------------------------------------------------------------------------

const BRUTE_FORCE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const BRUTE_FORCE_MAX_ATTEMPTS = 10;

/**
 * Returns true if the email has exceeded the failed login threshold in the
 * recent window. Import `db` lazily to avoid top-level Prisma instantiation
 * during build-time static analysis.
 */
export async function checkBruteForce(email: string): Promise<boolean> {
  const { db } = await import("@/lib/db");
  const since = new Date(Date.now() - BRUTE_FORCE_WINDOW_MS);
  const failures = await db.authEvent.count({
    where: {
      email,
      success: false,
      createdAt: { gte: since },
    },
  });
  return failures >= BRUTE_FORCE_MAX_ATTEMPTS;
}
