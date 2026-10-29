// Live smoke tests: real Claude, Gemini, Telegram and Supabase calls using .env.local.
// They print no secrets. The end-to-end check uses chat id -1 (never a real private chat)
// and a recording messenger, so nothing is sent to Telegram; its rows are deleted afterwards.
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Api } from "grammy";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ClaudeLanguageModel } from "@/adapters/llm/claude-language-model";
import { GeminiLanguageModel } from "@/adapters/llm/gemini-language-model";
import { SupabaseCatalogRepository, SupabaseConversationRepository } from "@/adapters/supabase/supabase-repositories";
import type { Course } from "@/core/catalog/course";
import type { ChatTurn, LanguageModel } from "@/core/ports";
import { buildSystemPrompt, courseStateLabel } from "@/core/sales-agent/build-system-prompt";
import { handleIncomingMessage } from "@/core/sales-agent/handle-incoming-message";
import { RecordingMessenger } from "@/core/testing/fakes";
import { parseEnv, type Env } from "@/server/env";

process.loadEnvFile(".env.local");

const TEST_CHAT_ID = -1;
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil" }).format(new Date());
const HISTORY: ChatTurn[] = [
  { role: "user", content: "<user_message>Hola, soy estudiante de la UTA. ¿Cuánto cuesta Fundamentos de Python 2 y cuándo empieza?</user_message>" },
];

let env: Env;
let db: SupabaseClient;
let courses: Course[] = [];

beforeAll(async () => {
  env = parseEnv(process.env);
  db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  courses = await new SupabaseCatalogRepository(db).listCourses().catch(() => []);
});

const log = (label: string, value: unknown) => console.log(`  ${label}:`, value);

/** Logs how long each live call takes, to find where chat latency goes. */
async function timed<T>(label: string, run: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await run();
  } finally {
    log(`${label} ms`, Math.round(performance.now() - start));
  }
}

describe("configuration", () => {
  it("environment variables are valid", () => {
    log("primary", env.LLM_PRIMARY);
    log("fallback", env.LLM_FALLBACK);
    expect(env).toBeTruthy();
  });
});

describe("Telegram", () => {
  it("bot token is valid", async () => {
    const me = await new Api(env.TELEGRAM_BOT_TOKEN).getMe();
    log("bot", `@${me.username}`);
    const info = await new Api(env.TELEGRAM_BOT_TOKEN).getWebhookInfo();
    log("webhook", info.url || "(not registered yet)");
    expect(me.is_bot).toBe(true);
  });
});

describe("Supabase", () => {
  it("schema from migrations 0001-0003 is applied", async () => {
    const conversations = await db.from("conversations").select("summarized_until_message_id").limit(1);
    const courseColumns = await db.from("courses").select("price_public, details_text").limit(1);
    expect(conversations.error?.message ?? null, "run supabase/migrations/*.sql in order").toBeNull();
    expect(courseColumns.error?.message ?? null, "run supabase/migrations/0002_course_details.sql").toBeNull();
  });

  it("course catalog is seeded", () => {
    log("courses", courses.length);
    expect(courses.length, "run supabase/seed.sql").toBe(18);
  });
});

async function checkModel(model: LanguageModel) {
  const classification = await timed("classify", () =>
    model.classify({
      history: HISTORY,
      courses: courses.map((c) => ({ slug: c.slug, name: c.name, state: courseStateLabel(c, TODAY) })),
    }),
  );
  log("classification", classification);
  expect(["interested", "doubtful", "hot_lead"]).toContain(classification.intentState);

  const system = buildSystemPrompt({
    courses,
    promotions: [],
    today: TODAY,
    focusCourse: courses.find((c) => c.slug === "curso21") ?? null,
    injectionSuspected: false,
  });
  const reply = await timed("reply", () => model.reply({ system, summary: null, history: HISTORY }));
  log("reply", reply.text);
  log("usage", reply.usage);
  expect(reply.text.length).toBeGreaterThan(0);
}

describe("Claude", () => {
  it.skipIf(!process.env.ANTHROPIC_API_KEY)("classifies and replies", async () => {
    await checkModel(
      new ClaudeLanguageModel(new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 30_000, maxRetries: 1 }), {
        replyModel: env.AGENT_MODEL,
        classifierModel: env.CLASSIFIER_MODEL,
      }),
    );
  });
});

describe("Gemini", () => {
  it.skipIf(!process.env.GEMINI_API_KEY)("baseline latency of a tiny request", async () => {
    const models = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY, httpOptions: { timeout: 30_000 } }).models;
    const response = await timed("ping", () =>
      models.generateContent({
        model: env.GEMINI_MODEL,
        contents: "Responde solo: ok",
        config: { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } },
      }),
    );
    expect(response.text?.length).toBeGreaterThan(0);
  });

  it.skipIf(!process.env.GEMINI_API_KEY)("classifies and replies", async () => {
    await checkModel(
      new GeminiLanguageModel(new GoogleGenAI({ apiKey: env.GEMINI_API_KEY, httpOptions: { timeout: 30_000 } }).models, {
        model: env.GEMINI_MODEL,
      }),
    );
  });
});

describe("end to end (no Telegram send)", () => {
  const cleanup = () => db.from("contacts").delete().eq("telegram_chat_id", TEST_CHAT_ID);

  beforeAll(cleanup);
  afterAll(cleanup);

  it("stores the exchange, classifies it and answers through the configured provider", async () => {
    const provider = env.LLM_PRIMARY === "claude" ? "claude" : "gemini";
    const model: LanguageModel =
      provider === "claude"
        ? new ClaudeLanguageModel(new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 30_000, maxRetries: 1 }), {
            replyModel: env.AGENT_MODEL,
            classifierModel: env.CLASSIFIER_MODEL,
          })
        : new GeminiLanguageModel(new GoogleGenAI({ apiKey: env.GEMINI_API_KEY }).models, { model: env.GEMINI_MODEL });
    const conversations = new SupabaseConversationRepository(db);
    const messenger = new RecordingMessenger();
    const handle = handleIncomingMessage({
      conversations,
      catalog: new SupabaseCatalogRepository(db),
      messenger,
      model,
      clock: { today: () => TODAY },
    });

    const result = await timed("full flow", () => handle({
      contact: { telegramChatId: TEST_CHAT_ID, firstName: "Smoke", username: null },
      text: "Hola, quiero inscribirme en Fundamentos de Python 2. ¿Cómo pago?",
      source: "text",
    }));

    log("action", result.action);
    log("sent", messenger.sent.map((m) => m.text));
    const stored = await conversations.recentMessages(result.conversationId, 10);
    const conversation = await conversations.get(result.conversationId);
    log("thermometer", conversation?.intentState);
    expect(result.action).toBe("replied");
    expect(stored.map((m) => m.role)).toEqual(["user", "ai"]);
  });
});
