import type { LanguageModel } from "@/core/ports";

type Operation = keyof LanguageModel;

/**
 * Tries the primary provider and, on any error (outage, rate limit, refusal, malformed output),
 * retries the same call on the secondary one. The prospect never sees the switch.
 */
export class FallbackLanguageModel implements LanguageModel {
  constructor(
    private readonly primary: LanguageModel,
    private readonly secondary: LanguageModel,
    private readonly onFallback: (operation: Operation, error: unknown) => void = () => {},
  ) {}

  private async attempt<T>(operation: Operation, call: (model: LanguageModel) => Promise<T>): Promise<T> {
    try {
      return await call(this.primary);
    } catch (error) {
      this.onFallback(operation, error);
      return call(this.secondary);
    }
  }

  classify: LanguageModel["classify"] = (input) => this.attempt("classify", (m) => m.classify(input));
  reply: LanguageModel["reply"] = (input) => this.attempt("reply", (m) => m.reply(input));
  summarize: LanguageModel["summarize"] = (input) => this.attempt("summarize", (m) => m.summarize(input));
}
