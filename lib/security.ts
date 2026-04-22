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

export function getJwtSecret() {
  const secret = requireEnv("JWT_SECRET");
  if (secret.length < MIN_SECRET_LEN) {
    throw new Error("JWT_SECRET must be at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export function hashValue(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function createOpaqueToken(prefix = "ovx") {
  const token = crypto.randomBytes(24).toString("hex");
  return `${prefix}_${token}`;
}

export function sanitizeFreeText(input: string, max = 500) {
  return input.replace(/[<>]/g, "").trim().slice(0, max);
}

export function isSafeHttpUrl(url: string) {
  try {
    const parsed = new URL(url);
    return ["https:", "http:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function detectSensitiveData(message: string) {
  const matches = new Set<string>();
  const text = message || "";

  if (/\b\d{12}\b/.test(text)) matches.add("aadhaar-like");
  if (/\b(?:\d[ -]*?){13,19}\b/.test(text)) matches.add("card-like");
  if (/\b[A-Z]{5}[0-9]{4}[A-Z]\b/i.test(text)) matches.add("pan-like");
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text)) matches.add("email");
  if (/bearer\s+[A-Za-z0-9._-]+/i.test(text)) matches.add("bearer-token");
  if (/(password|passwd|secret|api[_-]?key)\s*[:=]/i.test(text)) matches.add("secret-keyword");

  return {
    containsPii: matches.size > 0,
    piiTypes: Array.from(matches)
  };
}

export function maskSensitiveText(message: string) {
  return message
    .replace(/\b\d{12}\b/g, "************")
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, "**** **** **** ****")
    .replace(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/gi, "*****0000*")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "***@***")
    .replace(/bearer\s+[A-Za-z0-9._-]+/gi, "Bearer ***")
    .replace(/((?:password|passwd|secret|api[_-]?key)\s*[:=]\s*)([^\s,;]+)/gi, "$1***");
}

export function buildSignature(message: string) {
  return message
    .toLowerCase()
    .replace(/\b[0-9a-f]{8,}\b/g, "?")
    .replace(/\b\d+\b/g, "?")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}
