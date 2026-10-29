import { ThinkingLevel, type GoogleGenAI } from "@google/genai";
import type { ChatTurn, Classification, CourseOption, LanguageModel, TokenUsage } from "@/core/ports";
import {
  CLASSIFICATION_JSON_SCHEMA,
  CLASSIFIER_SYSTEM,
  SUMMARIZER_SYSTEM,
  classifierInput,
  conversationTurns,
  parseClassification,
  summarizerInput,
  summarySystemBlock,
} from "./shared";

export type GeminiModelsClient = Pick<GoogleGenAI["models"], "generateContent">;

type GenerateResponse = Awaited<ReturnType<GeminiModelsClient["generateContent"]>>;

function textOf(response: GenerateResponse): string {
  const text = response.text?.trim();
  // An empty answer usually means the safety filters blocked it.
  if (!text) throw new Error("Gemini returned an empty answer");
  return text;
}

/**
 * LanguageModel backed by Gemini (e.g. gemini-3.5-flash-lite). Used as a backup provider so the bot
 * keeps answering if Claude is down, rate-limited or refuses. Sampling parameters are not sent:
 * Gemini 3.5 models ignore them. Thinking stays low: chat turns are short and latency-sensitive
 * (the default level took over 20 s per call in the live smoke test).
 */
export class GeminiLanguageModel implements LanguageModel {
  constructor(
    private readonly models: GeminiModelsClient,
    private readonly options: { model: string },
  ) {}

  async classify(input: { history: ChatTurn[]; courses: CourseOption[] }): Promise<Classification> {
    const response = await this.models.generateContent({
      model: this.options.model,
      contents: [{ role: "user", parts: [{ text: classifierInput(input.history, input.courses) }] }],
      config: {
        systemInstruction: CLASSIFIER_SYSTEM,
        responseMimeType: "application/json",
        responseJsonSchema: CLASSIFICATION_JSON_SCHEMA,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      },
    });
    return parseClassification(textOf(response), input.courses.map((c) => c.slug));
  }

  async reply(input: { system: string; summary: string | null; history: ChatTurn[] }): Promise<{
    text: string;
    usage: TokenUsage;
  }> {
    const summary = summarySystemBlock(input.summary);
    const response = await this.models.generateContent({
      model: this.options.model,
      contents: conversationTurns(input.history).map((turn) => ({
        role: turn.role === "user" ? "user" : "model",
        parts: [{ text: turn.content }],
      })),
      config: {
        systemInstruction: summary ? `${input.system}\n\n${summary}` : input.system,
        maxOutputTokens: 4096,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });
    return {
      text: textOf(response),
      usage: {
        inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      },
    };
  }

  async summarize(input: { previousSummary: string | null; history: ChatTurn[] }): Promise<string> {
    const response = await this.models.generateContent({
      model: this.options.model,
      contents: [{ role: "user", parts: [{ text: summarizerInput(input.previousSummary, input.history) }] }],
      config: { systemInstruction: SUMMARIZER_SYSTEM, thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
    });
    return textOf(response);
  }
}
