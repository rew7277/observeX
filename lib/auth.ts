import { cookies, headers } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { getJwtSecret, checkBruteForce } from "@/lib/security";

// Lazily resolve the secret at request time — not at module load time.
function secret() {
  return getJwtSecret();
}

// ---------------------------------------------------------------------------
// Session payload
// ---------------------------------------------------------------------------

type SessionPayload = {
  userId: string;
  email: string;
  name: string;
  sessionVersion: number;
  /** Set to true only after MFA is verified (for MFA-enabled accounts) */
  mfaVerified?: boolean;
};

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());

  const store = await cookies();
  store.set("observex_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete("observex_session");
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get("observex_session")?.value;
  if (!token) return null;

  try {
    const verified = await jwtVerify(token, secret());
    return verified.payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Request metadata
// ---------------------------------------------------------------------------

export async function getRequestMeta() {
  const h = await headers();
  return {
    ipAddress:
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      undefined,
    userAgent: h.get("user-agent") || undefined,
  };
}

// ---------------------------------------------------------------------------
// Auth guards
// ---------------------------------------------------------------------------

/**
 * Require a fully-authenticated user.
 * - Validates session JWT
 * - Validates session version (so revoked sessions are rejected)
 * - For MFA-enabled accounts, ensures the second factor has been verified
 */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user || user.sessionVersion !== session.sessionVersion) redirect("/login");

  // ✅ MFA gate — if MFA is enabled, the session must carry mfaVerified: true
  if (user.mfaEnabled && !session.mfaVerified) {
    redirect("/login/mfa");
  }

  return user;
}

/**
 * Lightweight guard: only checks the session JWT without a DB round-trip.
 * Use for routes that just need to know "is anyone logged in".
 */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

// ---------------------------------------------------------------------------
// Login helpers (used in auth server action)
// ---------------------------------------------------------------------------

/**
 * Returns true if the given email is currently blocked due to too many
 * recent failed login attempts.
 */
export async function isAccountLocked(email: string): Promise<boolean> {
  return checkBruteForce(email);
}
