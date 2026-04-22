import { cookies, headers } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { getJwtSecret } from "@/lib/security";

// Lazily resolve the secret at request time, not at module load time.
// Calling getJwtSecret() at the top level causes Next.js to evaluate it
// during the static build phase (when collecting page data), where
// JWT_SECRET is not yet available, crashing the build.
function secret() {
  return getJwtSecret();
}

type SessionPayload = {
  userId: string;
  email: string;
  name: string;
  sessionVersion: number;
};

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
    maxAge: 60 * 60 * 24 * 7
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete("observex_session");
}

export async function getSession() {
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

export async function getRequestMeta() {
  const h = await headers();
  return {
    ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || undefined,
    userAgent: h.get("user-agent") || undefined
  };
}

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user || user.sessionVersion !== session.sessionVersion) redirect("/login");

  return user;
}
