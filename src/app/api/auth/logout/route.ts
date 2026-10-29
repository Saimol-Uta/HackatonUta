import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/server/operator-session";

export async function POST(): Promise<Response> {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
