#!/usr/bin/env tsx
/**
 * FIX #23 — Startup environment variable validation.
 * Run this before `next start` to get a clear error for each missing variable
 * instead of a cryptic crash on first request.
 *
 * Add to package.json "start" script:
 *   "start": "tsx scripts/check-env.ts && next start"
 */

type EnvRule = {
  key:        string;
  required:   boolean;
  minLen?:    number;
  hint:       string;
};

const rules: EnvRule[] = [
  { key: "DATABASE_URL",           required: true,  hint: "PostgreSQL connection string — get from Railway or Supabase" },
  { key: "JWT_SECRET",             required: true,  minLen: 32, hint: "Random 32+ char string: openssl rand -hex 32" },
  { key: "JWT_SECRET_OLD",         required: false, minLen: 32, hint: "Previous JWT_SECRET during rotation window (optional)" },
  { key: "CRON_SECRET",            required: false, hint: "Bearer token for Railway cron job authorization" },
  { key: "NEXT_PUBLIC_APP_URL",    required: false, hint: "Full public URL e.g. https://observex.railway.app" },
  { key: "AUDIT_HASH_PEPPER",      required: false, hint: "Secret pepper for audit log HMAC chain (set for production)" },
];

let hasError = false;

console.log("\n🔍  ObserveX — Environment Variable Check\n");

for (const rule of rules) {
  const value = process.env[rule.key];
  const label = rule.required ? "[REQUIRED]" : "[optional]";

  if (rule.required && !value) {
    console.error(`  ❌  ${label} ${rule.key} is not set\n     → ${rule.hint}`);
    hasError = true;
    continue;
  }

  if (value && rule.minLen && value.length < rule.minLen) {
    const status = rule.required ? "❌ " : "⚠️ ";
    console.error(`  ${status} ${label} ${rule.key} is too short (${value.length} chars, need ${rule.minLen}+)\n     → ${rule.hint}`);
    if (rule.required) hasError = true;
    continue;
  }

  if (value) {
    console.log(`  ✅  ${label} ${rule.key}`);
  } else {
    console.log(`  ⚪  ${label} ${rule.key} — not set (${rule.hint})`);
  }
}

console.log("");

if (hasError) {
  console.error("❌  One or more required environment variables are missing. Fix them before starting.\n");
  process.exit(1);
} else {
  console.log("✅  All required environment variables are present.\n");
}
