import type { Course } from "../catalog/course";
import type { Conversation, Message, MessageSource } from "../conversation/types";
import { checkReply, type ReplyPolicy } from "../guardrails/check-reply";
import { detectInjection } from "../guardrails/detect-injection";
import type {
  CatalogRepository,
  ChatTurn,
  Classification,
  Clock,
  ContactProfile,
  ConversationRepository,
  LanguageModel,
  Messenger,
} from "../ports";
import { courseLifecycle } from "../catalog/course-lifecycle";
import { matchCourseByText } from "../catalog/match-course";
import { buildSystemPrompt, courseStateLabel } from "./build-system-prompt";

// User-facing copy is Spanish: the bot talks to Spanish-speaking prospects.
export const HANDOVER_MESSAGE =
  "Entiendo, y quiero que recibas la mejor atención. Te comunico con una persona de nuestro equipo; en breve te responde por este mismo chat.";

export const SAFE_FALLBACK_MESSAGE =
  "Para no darte un dato incorrecto, prefiero confirmarte solo los valores oficiales publicados de cada curso. ¿De qué curso te gustaría conocer los precios?";

export const TECHNICAL_ISSUE_MESSAGE =
  "Disculpa, tuve un inconveniente técnico. Ya avisé a una persona de nuestro equipo para que te responda por aquí en breve.";

const NEUTRAL_CLASSIFICATION: Classification = {
  intentState: "interested",
  wantsHuman: false,
  injectionSuspected: false,
  courseSlug: null,
};

const normalizeName = (name: string): string =>
  name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

/** Courses run in editions with the same name; a finished one should not win over the active one. */
function resolveCourse(courses: Course[], slug: string | null, today: string): Course | null {
  const picked = courses.find((c) => c.slug === slug) ?? null;
  if (!picked || courseLifecycle(picked, today) !== "finished") return picked;
  const active = courses.find(
    (c) => c.id !== picked.id && normalizeName(c.name) === normalizeName(picked.name) && courseLifecycle(c, today) !== "finished",
  );
  return active ?? picked;
}

type DraftOutcome =
  | { ok: true; draft: Awaited<ReturnType<LanguageModel["reply"]>>; check: ReturnType<typeof checkReply> }
  | { ok: false; error: unknown };

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

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
  /** "failed": no model could answer; the prospect got an apology and the chat is flagged. */
  action: "replied" | "paused" | "handover" | "failed";
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

  /** Folds messages that left the history window into the rolling summary, in batches. */
  async function apologize(conversation: Conversation, error: unknown): Promise<HandleResult> {
    await conversations.update(conversation.id, { needsAttention: true });
    await messenger.sendText(conversation.telegramChatId, TECHNICAL_ISSUE_MESSAGE);
    await conversations.appendMessage({
      conversationId: conversation.id,
      role: "ai",
      content: TECHNICAL_ISSUE_MESSAGE,
      source: "text",
      meta: { error: errorMessage(error) },
    });
    return { action: "failed", conversationId: conversation.id };
  }

  async function refreshSummary(conversationId: number): Promise<void> {
    const latest = await conversations.get(conversationId);
    if (!latest) return;
    const pending = await conversations.messagesAfter(conversationId, latest.summarizedUntilMessageId ?? 0);
    const outOfWindow = pending.slice(0, Math.max(0, pending.length - historyWindow));
    if (outOfWindow.length < summaryEvery) return;

    const summary = await model.summarize({ previousSummary: latest.summary, history: toTurns(outOfWindow) });
    await conversations.update(conversationId, { summary, summarizedUntilMessageId: outOfWindow.at(-1)!.id });
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

    const rules = detectInjection(incoming.text);
    const textCourse = matchCourseByText(courses, incoming.text, today);
    const policy = replyPolicy(courses, promotions.map((p) => p.discountPct));
    const summary = conversation.summary;
    const promptFor = (focusCourse: Course | null, injectionSuspected: boolean) =>
      buildSystemPrompt({ courses, promotions, today, focusCourse, injectionSuspected });

    /** Drafts a reply and checks it against the pricing policy, regenerating once. Never rejects. */
    async function draftReply(system: string): Promise<DraftOutcome> {
      try {
        let draft = await model.reply({ system, summary, history });
        let check = checkReply(draft.text, policy);
        if (!check.ok) {
          const retrySystem = `${system}\n\n# PREVIOUS DRAFT REJECTED\nIt broke the pricing rules (${check.violations.join(", ")}). Answer again using only catalog prices and active promotions.`;
          draft = await model.reply({ system: retrySystem, summary, history });
          check = checkReply(draft.text, policy);
        }
        return { ok: true, draft, check };
      } catch (error) {
        return { ok: false, error };
      }
    }

    // The reply and the classifier run in parallel: both are slow model calls, and the reply only
    // needs the course (found in the text) and the rule-based injection check. The classifier's
    // verdict still decides below whether the draft is sent, dropped (handover) or regenerated.
    const earlyFocus = textCourse ?? courses.find((c) => c.id === conversation.interestedCourseId) ?? null;
    // No draft at all while an operator already owns the chat.
    const replying: Promise<DraftOutcome> | null =
      conversation.mode === "human" ? null : draftReply(promptFor(earlyFocus, rules.suspected));

    // Thermometer: classify every message, even while a human owns the chat.
    // A classifier outage must not silence the bot: fall back to a neutral reading.
    const classification = await model
      .classify({
        history,
        courses: courses.map((c) => ({ slug: c.slug, name: c.name, state: courseStateLabel(c, today) })),
      })
      .catch(() => NEUTRAL_CLASSIFICATION);
    const mentioned = resolveCourse(courses, classification.courseSlug, today) ?? textCourse;

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

    // Re-read: an operator may have taken over while the classifier was running.
    const fresh = (await conversations.get(conversation.id)) ?? conversation;
    if (fresh.mode === "human") return { action: "paused", conversationId: conversation.id };
    if (classification.intentState === "frustrated") return handOver(conversation, "frustrated");
    if (classification.wantsHuman) return handOver(conversation, "wants_human");

    // The early draft lacked the security alert (or never started): write it with the right prompt.
    let outcome = replying ? await replying : await draftReply(promptFor(mentioned ?? earlyFocus, injectionSuspected));
    if (replying && injectionSuspected && !rules.suspected) {
      outcome = await draftReply(promptFor(mentioned ?? earlyFocus, true));
    }
    if (!outcome.ok) return apologize(conversation, outcome.error);
    const { draft, check } = outcome;
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
    // The summary is a nice-to-have: a failure retries on the next message (the watermark did not move).
    await refreshSummary(conversation.id).catch(() => undefined);

    return { action: "replied", conversationId: conversation.id };
  };
}
