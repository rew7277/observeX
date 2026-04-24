import { cookies, headers } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { getJwtSecret, getJwtSecretOld, checkBruteForce } from "@/lib/security";

type SessionPayload = {
  userId: string;
  email: string;
  name: string;
  sessionVersion: number;
  mfaVerified?: boolean;
};

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret());

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

// FIX #6 — JWT secret rotation with a 24-hour grace period.
// Try the current secret first; if verification fails, try the old secret
// (JWT_SECRET_OLD env var). This lets you rotate secrets without a forced
// mass logout: set JWT_SECRET to the new value and JWT_SECRET_OLD to the
// previous value, then remove JWT_SECRET_OLD after 24 hours.
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get("observex_session")?.value;
  if (!token) return null;

  // Try current secret
  try {
    const verified = await jwtVerify(token, getJwtSecret());
    return verified.payload as unknown as SessionPayload;
  } catch {
    // Fall through to old secret grace-period check
  }

  // Try previous secret (grace period for rotation)
  const oldSecret = getJwtSecretOld();
  if (oldSecret) {
    try {
      const verified = await jwtVerify(token, oldSecret);
      return verified.payload as unknown as SessionPayload;
    } catch {
      return null;
    }
  }

  return null;
}

export async function getRequestMeta() {
  const h = await headers();
  return {
    ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || undefined,
    userAgent: h.get("user-agent") || undefined,
  };
}

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user || user.sessionVersion !== session.sessionVersion) redirect("/login");

  if (user.mfaEnabled && !session.mfaVerified) redirect("/login/mfa");

  return user;
}

export async function isAccountLocked(email: string): Promise<boolean> {
  return checkBruteForce(email);
}
