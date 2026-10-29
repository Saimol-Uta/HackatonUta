import type Anthropic from "@anthropic-ai/sdk";
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

export type ClaudeMessagesClient = Pick<Anthropic, "messages">;

export interface ClaudeModels {
  /** Writes the replies the prospect reads. */
  replyModel: string;
  /** Cheap model for the per-message classifier and the rolling summary. */
  classifierModel: string;
}

function textOf(message: Anthropic.Message): string {
  // Check stop_reason before reading content: a refusal carries no usable answer.
  if (message.stop_reason === "refusal") throw new Error("Claude refusal");
  const text = message.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("")
    .trim();
  if (!text) throw new Error(`Claude returned no text (stop_reason: ${message.stop_reason})`);
  return text;
}

/** LanguageModel backed by the Claude API. Chat traffic runs at low effort: it is short and latency-sensitive. */
export class ClaudeLanguageModel implements LanguageModel {
  constructor(
    private readonly client: ClaudeMessagesClient,
    private readonly models: ClaudeModels,
  ) {}

  async classify(input: { history: ChatTurn[]; courses: CourseOption[] }): Promise<Classification> {
    const message = await this.client.messages.create({
      model: this.models.classifierModel,
      max_tokens: 2048,
      system: CLASSIFIER_SYSTEM,
      messages: [{ role: "user", content: classifierInput(input.history, input.courses) }],
      output_config: { effort: "low", format: { type: "json_schema", schema: CLASSIFICATION_JSON_SCHEMA } },
    });
    return parseClassification(textOf(message), input.courses.map((c) => c.slug));
  }

  async reply(input: { system: string; summary: string | null; history: ChatTurn[] }): Promise<{
    text: string;
    usage: TokenUsage;
  }> {
    const summary = summarySystemBlock(input.summary);
    // The catalog prompt is stable across messages, so it is cached; the summary changes and goes after it.
    const system: Anthropic.TextBlockParam[] = [
      { type: "text", text: input.system, cache_control: { type: "ephemeral" } },
      ...(summary ? [{ type: "text" as const, text: summary }] : []),
    ];
    const message = await this.client.messages.create({
      model: this.models.replyModel,
      max_tokens: 4096,
      system,
      messages: conversationTurns(input.history),
      output_config: { effort: "low" },
    });
    return {
      text: textOf(message),
      usage: { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens },
    };
  }

  async summarize(input: { previousSummary: string | null; history: ChatTurn[] }): Promise<string> {
    const message = await this.client.messages.create({
      model: this.models.classifierModel,
      max_tokens: 2048,
      system: SUMMARIZER_SYSTEM,
      messages: [{ role: "user", content: summarizerInput(input.previousSummary, input.history) }],
      output_config: { effort: "low" },
    });
    return textOf(message);
  }
}
