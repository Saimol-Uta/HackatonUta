import { NextResponse } from "next/server";
import { getContainer } from "@/server/container";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, createSessionToken, isValidPassword } from "@/server/operator-session";

export async function POST(request: Request): Promise<Response> {
  const secret = getContainer().env.DASHBOARD_PASSWORD;
  const body = (await request.json().catch(() => null)) as { password?: unknown } | null;

  if (!isValidPassword(body?.password, secret)) {
    return NextResponse.json({ error: "invalid_password" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, createSessionToken(secret!), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}
