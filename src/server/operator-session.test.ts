import { describe, expect, it } from "vitest";
import { SESSION_TTL_SECONDS, createSessionToken, isValidPassword, isValidSessionToken } from "./operator-session";

const SECRET = "una-clave-de-operador-larga";
const NOW = Date.UTC(2026, 9, 29, 12);

describe("operator session", () => {
  it("accepts a fresh token signed with the same secret", () => {
    expect(isValidSessionToken(createSessionToken(SECRET, NOW), SECRET, NOW)).toBe(true);
  });

  it("rejects an expired token", () => {
    const token = createSessionToken(SECRET, NOW);
    expect(isValidSessionToken(token, SECRET, NOW + SESSION_TTL_SECONDS * 1000 + 1000)).toBe(false);
  });

  it("rejects a token signed with another secret or with a tampered expiry", () => {
    const token = createSessionToken(SECRET, NOW);
    expect(isValidSessionToken(token, "otra-clave", NOW)).toBe(false);
    const [, signature] = token.split(".");
    expect(isValidSessionToken(`9999999999.${signature}`, SECRET, NOW)).toBe(false);
  });

  it("rejects malformed tokens and a missing secret", () => {
    for (const token of [undefined, "", "abc", "1.2.3", ".sig"]) expect(isValidSessionToken(token, SECRET, NOW)).toBe(false);
    expect(isValidSessionToken(createSessionToken(SECRET, NOW), undefined, NOW)).toBe(false);
  });

  it("checks the password and refuses everything when none is configured", () => {
    expect(isValidPassword(SECRET, SECRET)).toBe(true);
    expect(isValidPassword("incorrecta", SECRET)).toBe(false);
    expect(isValidPassword(undefined, SECRET)).toBe(false);
    expect(isValidPassword("", undefined)).toBe(false);
  });
});
