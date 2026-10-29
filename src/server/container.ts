// Composition root: wires adapters into the core use cases. Server-only.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { ClaudeLanguageModel } from "@/adapters/llm/claude-language-model";
import { FallbackLanguageModel } from "@/adapters/llm/fallback-language-model";
import { GeminiLanguageModel } from "@/adapters/llm/gemini-language-model";
import { SupabaseDashboardQueries } from "@/adapters/supabase/dashboard-queries";
import { SupabaseCatalogRepository, SupabaseConversationRepository } from "@/adapters/supabase/supabase-repositories";
import { TelegramMessenger } from "@/adapters/telegram/telegram-messenger";
import type { Clock, LanguageModel } from "@/core/ports";
import { handleIncomingMessage } from "@/core/sales-agent/handle-incoming-message";
import { resumeAi, sendOperatorMessage, takeOver } from "@/core/sales-agent/operator-actions";
import { parseEnv, type Env } from "./env";

const TIME_ZONE = "America/Guayaquil";
// Live smoke: a trivial Gemini request alone took ~13 s, so a 20 s limit cut real replies.
const LLM_TIMEOUT_MS = 40_000;
const DB_TIMEOUT_MS = 8_000;

/** A dead keep-alive socket (e.g. after a network change) must fail fast instead of hanging. */
const fetchWithTimeout: typeof fetch = (input, init) =>
  fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(DB_TIMEOUT_MS)]) : AbortSignal.timeout(DB_TIMEOUT_MS) });

const guayaquilClock: Clock = {
  // en-CA formats dates as YYYY-MM-DD.
  today: () => new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date()),
};

function buildModel(env: Env, provider: "claude" | "gemini"): LanguageModel {
  if (provider === "claude") {
    // Fail fast so the backup provider still answers within the function's time limit.
    return new ClaudeLanguageModel(new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: LLM_TIMEOUT_MS, maxRetries: 1 }), {
      replyModel: env.AGENT_MODEL,
      classifierModel: env.CLASSIFIER_MODEL,
    });
  }
  return new GeminiLanguageModel(
    new GoogleGenAI({ apiKey: env.GEMINI_API_KEY, httpOptions: { timeout: LLM_TIMEOUT_MS } }).models,
    { model: env.GEMINI_MODEL },
  );
}

function build() {
  const env = parseEnv(process.env);
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchWithTimeout },
  });
  const conversations = new SupabaseConversationRepository(db);
  const catalog = new SupabaseCatalogRepository(db);
  const messenger = new TelegramMessenger(env.TELEGRAM_BOT_TOKEN);

  const primary = buildModel(env, env.LLM_PRIMARY);
  const model =
    env.LLM_FALLBACK === "none"
      ? primary
      : new FallbackLanguageModel(primary, buildModel(env, env.LLM_FALLBACK), (operation, error) =>
          console.warn(`[llm] ${env.LLM_PRIMARY} failed on ${operation}, using ${env.LLM_FALLBACK}:`, error),
        );

  return {
    env,
    messenger,
    dashboard: new SupabaseDashboardQueries(db),
    catalog,
    clock: guayaquilClock,
    handleIncomingMessage: handleIncomingMessage({ conversations, catalog, messenger, model, clock: guayaquilClock }),
    takeOver: takeOver({ conversations }),
    resumeAi: resumeAi({ conversations }),
    sendOperatorMessage: sendOperatorMessage({ conversations, messenger }),
  };
}

let container: ReturnType<typeof build> | null = null;

/** Built lazily so a missing variable fails the request with a clear message, not the build. */
export function getContainer(): ReturnType<typeof build> {
  container ??= build();
  return container;
}
