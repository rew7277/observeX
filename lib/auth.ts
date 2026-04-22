import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-me");

type SessionPayload = {
  userId: string;
  email: string;
  name: string;
};

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);

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
    const verified = await jwtVerify(token, secret);
    return verified.payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user) redirect("/login");

  return user;
}
