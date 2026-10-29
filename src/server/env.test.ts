import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const BASE = {
  TELEGRAM_BOT_TOKEN: "123:abc",
  TELEGRAM_WEBHOOK_SECRET: "s".repeat(32),
  NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
};

describe("parseEnv", () => {
  it("defaults to Claude with Gemini as backup when both keys are set", () => {
    const env = parseEnv({ ...BASE, ANTHROPIC_API_KEY: "a", GEMINI_API_KEY: "g" });

    expect(env).toMatchObject({
      LLM_PRIMARY: "claude",
      LLM_FALLBACK: "gemini",
      AGENT_MODEL: "claude-sonnet-5-5",
      CLASSIFIER_MODEL: "claude-haiku-5-5",
      GEMINI_MODEL: "gemini-3.5-flash-lite",
    });
  });

  it("runs Claude alone when no Gemini key is set", () => {
    expect(parseEnv({ ...BASE, ANTHROPIC_API_KEY: "a" }).LLM_FALLBACK).toBe("none");
  });

  it("can run on Gemini alone", () => {
    expect(parseEnv({ ...BASE, GEMINI_API_KEY: "g", LLM_PRIMARY: "gemini" })).toMatchObject({
      LLM_PRIMARY: "gemini",
      LLM_FALLBACK: "none",
    });
  });

  it("rejects a provider without its key, naming the missing variable", () => {
    expect(() => parseEnv({ ...BASE, GEMINI_API_KEY: "g" })).toThrow("ANTHROPIC_API_KEY");
    expect(() => parseEnv({ ...BASE, ANTHROPIC_API_KEY: "a", LLM_FALLBACK: "gemini" })).toThrow("GEMINI_API_KEY");
  });

  it("rejects a short webhook secret", () => {
    expect(() => parseEnv({ ...BASE, ANTHROPIC_API_KEY: "a", TELEGRAM_WEBHOOK_SECRET: "short" })).toThrow(
      "TELEGRAM_WEBHOOK_SECRET",
    );
  });
});
