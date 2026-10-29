import { z } from "zod";

const optionalKey = z
  .string()
  .optional()
  .transform((value) => (value?.trim() ? value.trim() : undefined));

const SCHEMA = z
  .object({
    ANTHROPIC_API_KEY: optionalKey,
    GEMINI_API_KEY: optionalKey,
    LLM_PRIMARY: z.enum(["claude", "gemini"]).default("claude"),
    LLM_FALLBACK: z.enum(["claude", "gemini", "none"]).optional(),
    AGENT_MODEL: z.string().default("claude-sonnet-5-5"),
    CLASSIFIER_MODEL: z.string().default("claude-haiku-5-5"),
    GEMINI_MODEL: z.string().default("gemini-3.5-flash-lite"),
    TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN is required"),
    TELEGRAM_WEBHOOK_SECRET: z
      .string()
      .regex(/^[A-Za-z0-9_-]{32,256}$/, "TELEGRAM_WEBHOOK_SECRET must be 32-256 chars of A-Z, a-z, 0-9, _ or -"),
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  })
  .transform((env) => ({
    ...env,
    // Without an explicit choice, the other provider backs up the primary when its key is present.
    // A fallback equal to the primary would only retry the same provider.
    LLM_FALLBACK:
      env.LLM_FALLBACK === env.LLM_PRIMARY
        ? ("none" as const)
        : (env.LLM_FALLBACK ??
          (env.LLM_PRIMARY === "claude" ? (env.GEMINI_API_KEY ? "gemini" : "none") : env.ANTHROPIC_API_KEY ? "claude" : "none")),
  }))
  .superRefine((env, ctx) => {
    const keyFor = { claude: "ANTHROPIC_API_KEY", gemini: "GEMINI_API_KEY" } as const;
    const providers = [env.LLM_PRIMARY, ...(env.LLM_FALLBACK === "none" ? [] : [env.LLM_FALLBACK])];
    for (const provider of providers) {
      if (!env[keyFor[provider]]) {
        ctx.addIssue({ code: "custom", path: [keyFor[provider]], message: `${keyFor[provider]} is required for provider "${provider}"` });
      }
    }
  });

export type Env = z.output<typeof SCHEMA>;

/** Validates server configuration; the error lists every missing or invalid variable. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = SCHEMA.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `- ${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment:\n${problems.join("\n")}`);
  }
  return result.data;
}
