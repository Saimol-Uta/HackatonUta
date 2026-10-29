// Stateless operator session: an expiry timestamp signed with HMAC-SHA256.
import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "operator_session";
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

const sign = (payload: string, secret: string): string =>
  createHmac("sha256", `operator-session:${secret}`).update(payload).digest("base64url");

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createSessionToken(secret: string, nowMs: number = Date.now()): string {
  const expiresAt = String(Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS);
  return `${expiresAt}.${sign(expiresAt, secret)}`;
}

/** A missing secret disables the dashboard: no token is ever valid. */
export function isValidSessionToken(token: string | undefined, secret: string | undefined, nowMs: number = Date.now()): boolean {
  if (!token || !secret) return false;
  const [expiresAt, signature, extra] = token.split(".");
  if (!expiresAt || !signature || extra !== undefined || !/^\d+$/.test(expiresAt)) return false;
  if (!safeEqual(signature, sign(expiresAt, secret))) return false;
  return Number(expiresAt) > Math.floor(nowMs / 1000);
}

/** Compares the submitted password without leaking its length or content through timing. */
export function isValidPassword(submitted: unknown, expected: string | undefined): boolean {
  if (!expected || typeof submitted !== "string") return false;
  return safeEqual(sign(submitted, "password"), sign(expected, "password"));
}
