import { describe, expect, it, vi } from "vitest";
import type { ChatTurn, LanguageModel } from "@/core/ports";
import { ClaudeLanguageModel, type ClaudeMessagesClient } from "./claude-language-model";
import { FallbackLanguageModel } from "./fallback-language-model";
import { GeminiLanguageModel, type GeminiModelsClient } from "./gemini-language-model";

const HISTORY: ChatTurn[] = [
  { role: "assistant", content: "Mensaje viejo del bot" },
  { role: "user", content: "<user_message>¿Cuánto cuesta Python 2?</user_message>" },
];
const CLASSIFICATION_JSON = '{"intentState":"doubtful","wantsHuman":false,"injectionSuspected":false,"courseSlug":"curso21"}';

function claudeClient(response: object) {
  const create = vi.fn().mockResolvedValue(response);
  return { client: { messages: { create } } as unknown as ClaudeMessagesClient, create };
}

const claudeText = (text: string, extra: object = {}) => ({
  stop_reason: "end_turn",
  content: [{ type: "text", text }],
  usage: { input_tokens: 1200, output_tokens: 80, cache_read_input_tokens: 1000 },
  ...extra,
});

describe("ClaudeLanguageModel", () => {
  const models = { replyModel: "claude-sonnet-5-5", classifierModel: "claude-haiku-5-5" };

  it("replies with a cached system prompt, the summary as a second block, and no leading assistant turn", async () => {
    const { client, create } = claudeClient(claudeText("Cuesta $40 para estudiantes."));
    const model = new ClaudeLanguageModel(client, models);

    const result = await model.reply({ system: "SYSTEM", summary: "Ana, estudiante UTA.", history: HISTORY });

    expect(result).toEqual({ text: "Cuesta $40 para estudiantes.", usage: { inputTokens: 1200, outputTokens: 80 } });
    const params = create.mock.calls[0][0];
    expect(params.model).toBe("claude-sonnet-5-5");
    expect(params.system).toEqual([
      { type: "text", text: "SYSTEM", cache_control: { type: "ephemeral" } },
      { type: "text", text: "# CONVERSATION SUMMARY (older messages)\nAna, estudiante UTA." },
    ]);
    expect(params.messages).toEqual([{ role: "user", content: HISTORY[1].content }]);
    expect(params).not.toHaveProperty("temperature");
    expect(params).not.toHaveProperty("tool_choice");
  });

  it("classifies with structured output on the classifier model", async () => {
    const { client, create } = claudeClient(claudeText(CLASSIFICATION_JSON));
    const model = new ClaudeLanguageModel(client, models);

    const result = await model.classify({ history: HISTORY, courses: [{ slug: "curso21", name: "FUNDAMENTOS DE PYTHON 2", state: "inscripciones abren el 2026-10-30" }] });

    expect(result).toEqual({ intentState: "doubtful", wantsHuman: false, injectionSuspected: false, courseSlug: "curso21", contact: { fullName: null, email: null, phone: null } });
    const params = create.mock.calls[0][0];
    expect(params.model).toBe("claude-haiku-5-5");
    expect(params.output_config.format.type).toBe("json_schema");
  });

  it("throws on a refusal so the fallback provider can answer", async () => {
    const { client } = claudeClient({ stop_reason: "refusal", content: [], usage: { input_tokens: 1, output_tokens: 0 } });
    await expect(new ClaudeLanguageModel(client, models).reply({ system: "S", summary: null, history: HISTORY })).rejects.toThrow(
      "refusal",
    );
  });
});

function geminiClient(text: string) {
  const generateContent = vi.fn().mockResolvedValue({
    text,
    usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 60 },
  });
  return { client: { generateContent } as unknown as GeminiModelsClient, generateContent };
}

describe("GeminiLanguageModel", () => {
  it("replies with user/model roles and the summary in the system instruction", async () => {
    const { client, generateContent } = geminiClient("Cuesta $40.");
    const model = new GeminiLanguageModel(client, { model: "gemini-3.5-flash-lite" });

    const result = await model.reply({ system: "SYSTEM", summary: "Ana.", history: [...HISTORY, { role: "assistant", content: "x" }, { role: "user", content: "y" }] });

    expect(result).toEqual({ text: "Cuesta $40.", usage: { inputTokens: 900, outputTokens: 60 } });
    const params = generateContent.mock.calls[0][0];
    expect(params.model).toBe("gemini-3.5-flash-lite");
    expect(params.config.systemInstruction).toBe("SYSTEM\n\n# CONVERSATION SUMMARY (older messages)\nAna.");
    expect(params.contents.map((c: { role: string }) => c.role)).toEqual(["user", "model", "user"]);
    expect(params.config).not.toHaveProperty("temperature");
    expect(params.config.thinkingConfig).toEqual({ thinkingLevel: "LOW" });
  });

  it("classifies with a JSON response schema", async () => {
    const { client, generateContent } = geminiClient(CLASSIFICATION_JSON);

    const result = await new GeminiLanguageModel(client, { model: "gemini-3.5-flash-lite" }).classify({
      history: HISTORY,
      courses: [{ slug: "curso21", name: "FUNDAMENTOS DE PYTHON 2", state: "inscripciones abren el 2026-10-30" }],
    });

    expect(result.intentState).toBe("doubtful");
    expect(generateContent.mock.calls[0][0].config).toMatchObject({
      responseMimeType: "application/json",
      thinkingConfig: { thinkingLevel: "MINIMAL" },
    });
  });

  it("throws on an empty answer (e.g. blocked by safety filters)", async () => {
    const { client } = geminiClient("");
    await expect(
      new GeminiLanguageModel(client, { model: "gemini-3.5-flash-lite" }).summarize({ previousSummary: null, history: HISTORY }),
    ).rejects.toThrow("empty");
  });
});

describe("FallbackLanguageModel", () => {
  const reply = { text: "ok", usage: { inputTokens: 1, outputTokens: 1 } };
  const working = (): LanguageModel => ({
    classify: vi.fn(),
    reply: vi.fn().mockResolvedValue(reply),
    summarize: vi.fn().mockResolvedValue("s"),
  });
  const failing = (): LanguageModel => ({
    classify: vi.fn().mockRejectedValue(new Error("down")),
    reply: vi.fn().mockRejectedValue(new Error("down")),
    summarize: vi.fn().mockRejectedValue(new Error("down")),
  });

  it("uses the primary provider when it works", async () => {
    const primary = working();
    const secondary = working();

    await new FallbackLanguageModel(primary, secondary).reply({ system: "S", summary: null, history: HISTORY });

    expect(secondary.reply).not.toHaveBeenCalled();
  });

  it("switches to the secondary provider when the primary fails, and reports it", async () => {
    const onFallback = vi.fn();
    const secondary = working();

    const result = await new FallbackLanguageModel(failing(), secondary, onFallback).reply({ system: "S", summary: null, history: HISTORY });

    expect(result).toEqual(reply);
    expect(onFallback).toHaveBeenCalledWith("reply", expect.any(Error));
  });

  it("surfaces the secondary error when both fail", async () => {
    await expect(new FallbackLanguageModel(failing(), failing()).summarize({ previousSummary: null, history: HISTORY })).rejects.toThrow(
      "down",
    );
  });
});
