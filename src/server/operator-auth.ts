// Guards for operator pages and API routes.
import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getContainer } from "./container";
import { SESSION_COOKIE, isValidSessionToken } from "./operator-session";

export async function isOperatorSignedIn(): Promise<boolean> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return isValidSessionToken(token, getContainer().env.DASHBOARD_PASSWORD);
}

/** Returns a 401 response when the caller is not a signed-in operator, otherwise null. */
export async function rejectUnlessOperator(): Promise<NextResponse | null> {
  return (await isOperatorSignedIn()) ? null : NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

/** Parses the [id] route segment; null when it is not a positive integer. */
export function parseConversationId(raw: string): number | null {
  return /^[1-9]\d{0,15}$/.test(raw) ? Number(raw) : null;
}
