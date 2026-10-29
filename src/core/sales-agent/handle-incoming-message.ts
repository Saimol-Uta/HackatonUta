import type { Course } from "../catalog/course";
import type { Conversation, Message, MessageSource } from "../conversation/types";
import { checkReply, type ReplyPolicy } from "../guardrails/check-reply";
import { detectInjection } from "../guardrails/detect-injection";
import type {
  CatalogRepository,
  ChatTurn,
  Clock,
  ContactProfile,
  ConversationRepository,
  LanguageModel,
  Messenger,
} from "../ports";
import { buildSystemPrompt } from "./build-system-prompt";

// User-facing copy is Spanish: the bot talks to Spanish-speaking prospects.
export const HANDOVER_MESSAGE =
  "Entiendo, y quiero que recibas la mejor atención. Te comunico con una persona de nuestro equipo; en breve te responde por este mismo chat.";

export const SAFE_FALLBACK_MESSAGE =
  "Para no darte un dato incorrecto, prefiero confirmarte solo los valores oficiales publicados de cada curso. ¿De qué curso te gustaría conocer los precios?";

export interface HandleIncomingMessageDeps {
  conversations: ConversationRepository;
  catalog: CatalogRepository;
  messenger: Messenger;
  model: LanguageModel;
  clock: Clock;
  /** Messages sent verbatim to the model; older ones live in the rolling summary. */
  historyWindow?: number;
  /** Refresh the rolling summary every N messages. */
  summaryEvery?: number;
}

export interface IncomingMessage {
  contact: ContactProfile;
  text: string;
  source: MessageSource;
}

export interface HandleResult {
  action: "replied" | "paused" | "handover";
  conversationId: number;
}

const escapeTags = (text: string): string => text.replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** Operator messages become assistant turns: the prospect sees a single bot identity. */
function toTurns(messages: Message[]): ChatTurn[] {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) =>
      m.role === "user"
        ? { role: "user", content: `<user_message>${escapeTags(m.content)}</user_message>` }
        : { role: "assistant", content: m.content },
    );
}

function replyPolicy(courses: Course[], discounts: number[]): ReplyPolicy {
  const allowedAmounts = courses.flatMap((c) => (c.prices ? [c.prices.utaStudent, c.prices.utaStaff, c.prices.public] : []));
  return { allowedAmounts, allowedDiscounts: discounts };
}

export function handleIncomingMessage(deps: HandleIncomingMessageDeps) {
  const { conversations, catalog, messenger, model, clock } = deps;
  const historyWindow = deps.historyWindow ?? 10;
  const summaryEvery = deps.summaryEvery ?? 10;

  async function handOver(conversation: Conversation, reason: string): Promise<HandleResult> {
    await conversations.update(conversation.id, { mode: "human", needsAttention: true });
    await conversations.recordEvent(conversation.id, "handover", { reason });
    await messenger.sendText(conversation.telegramChatId, HANDOVER_MESSAGE);
    await conversations.appendMessage({
      conversationId: conversation.id,
      role: "ai",
      content: HANDOVER_MESSAGE,
      source: "text",
      meta: { handover: reason },
    });
    return { action: "handover", conversationId: conversation.id };
  }

  async function refreshSummary(conversation: Conversation): Promise<void> {
    const count = await conversations.countMessages(conversation.id);
    if (count % summaryEvery !== 0) return;
    const latest = await conversations.get(conversation.id);
    const history = toTurns(await conversations.recentMessages(conversation.id, summaryEvery));
    const summary = await model.summarize({ previousSummary: latest?.summary ?? null, history });
    await conversations.update(conversation.id, { summary });
  }

  return async function handle(incoming: IncomingMessage): Promise<HandleResult> {
    const conversation = await conversations.findOrCreateByChat(incoming.contact);
    await conversations.appendMessage({
      conversationId: conversation.id,
      role: "user",
      content: incoming.text,
      source: incoming.source,
      meta: {},
    });

    const today = clock.today();
    const [courses, promotions, recent] = await Promise.all([
      catalog.listCourses(),
      catalog.listActivePromotions(today),
      conversations.recentMessages(conversation.id, historyWindow),
    ]);
    const history = toTurns(recent);

    // Thermometer: classify every message, even while a human owns the chat.
    const classification = await model.classify({ history, courseSlugs: courses.map((c) => c.slug) });
    const rules = detectInjection(incoming.text);
    const mentioned = courses.find((c) => c.slug === classification.courseSlug) ?? null;

    await conversations.update(conversation.id, {
      intentState: classification.intentState,
      ...(mentioned ? { interestedCourseId: mentioned.id } : {}),
    });
    if (classification.intentState === "hot_lead" && conversation.intentState !== "hot_lead") {
      await conversations.recordEvent(conversation.id, "hot_lead");
    }
    const injectionSuspected = rules.suspected || classification.injectionSuspected;
    if (injectionSuspected) {
      await conversations.recordEvent(conversation.id, "injection_attempt", {
        categories: rules.suspected ? rules.categories : ["classifier"],
        text: incoming.text,
      });
    }

    if (conversation.mode === "human") return { action: "paused", conversationId: conversation.id };
    if (classification.intentState === "frustrated") return handOver(conversation, "frustrated");
    if (classification.wantsHuman) return handOver(conversation, "wants_human");

    const focusCourse = mentioned ?? courses.find((c) => c.id === conversation.interestedCourseId) ?? null;
    const system = buildSystemPrompt({ courses, promotions, today, focusCourse, injectionSuspected });
    const policy = replyPolicy(courses, promotions.map((p) => p.discountPct));
    const summary = conversation.summary;

    let draft = await model.reply({ system, summary, history });
    let check = checkReply(draft.text, policy);
    if (!check.ok) {
      const retrySystem = `${system}\n\n# PREVIOUS DRAFT REJECTED\nIt broke the pricing rules (${check.violations.join(", ")}). Answer again using only catalog prices and active promotions.`;
      draft = await model.reply({ system: retrySystem, summary, history });
      check = checkReply(draft.text, policy);
    }
    const text = check.ok ? draft.text : SAFE_FALLBACK_MESSAGE;

    // An operator may have taken over while the model was thinking: their word wins.
    const current = await conversations.get(conversation.id);
    if (current?.mode === "human") return { action: "paused", conversationId: conversation.id };

    await messenger.sendText(conversation.telegramChatId, text);
    await conversations.appendMessage({
      conversationId: conversation.id,
      role: "ai",
      content: text,
      source: "text",
      meta: {
        classification,
        usage: draft.usage,
        ...(check.ok ? {} : { guard: { violations: check.violations, fallback: true } }),
      },
    });
    await refreshSummary(conversation);

    return { action: "replied", conversationId: conversation.id };
  };
}
