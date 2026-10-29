// Read models for the operator dashboard. Server-side only (service role client).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConversationMode, EventType, IntentState, Message } from "@/core/conversation/types";
import { toMessage, type MessageRow } from "./rows";

export interface ConversationCard {
  id: number;
  contactName: string;
  username: string | null;
  mode: ConversationMode;
  intentState: IntentState;
  needsAttention: boolean;
  courseName: string | null;
  summary: string | null;
  lastMessageAt: string;
}

export interface ConversationDetail extends ConversationCard {
  messages: Message[];
}

export interface DashboardStats {
  conversations: number;
  byIntent: Record<IntentState, number>;
  inHumanMode: number;
  needsAttention: number;
  events: Record<EventType, number>;
}

interface CardRow {
  id: number;
  mode: ConversationMode;
  intent_state: IntentState;
  needs_attention: boolean;
  summary: string | null;
  last_message_at: string;
  contacts: { first_name: string | null; username: string | null; telegram_chat_id: number | string };
  courses: { name: string } | null;
}

const CARD_SELECT =
  "id, mode, intent_state, needs_attention, summary, last_message_at, contacts!inner(first_name, username, telegram_chat_id), courses(name)";

const MESSAGE_LIMIT = 200;

function toCard(row: CardRow): ConversationCard {
  return {
    id: row.id,
    contactName: row.contacts.first_name ?? row.contacts.username ?? `Chat ${row.contacts.telegram_chat_id}`,
    username: row.contacts.username,
    mode: row.mode,
    intentState: row.intent_state,
    needsAttention: row.needs_attention,
    courseName: row.courses?.name ?? null,
    summary: row.summary,
    lastMessageAt: row.last_message_at,
  };
}

function fail(what: string, error: { message: string }): never {
  throw new Error(`${what}: ${error.message}`);
}

export interface CourseDemand {
  conversations: number;
  hotLeads: number;
}

export class SupabaseDashboardQueries {
  constructor(private readonly db: SupabaseClient) {}

  async listConversations(limit = 100): Promise<ConversationCard[]> {
    const { data, error } = await this.db
      .from("conversations")
      .select(CARD_SELECT)
      .order("last_message_at", { ascending: false })
      .limit(limit)
      .returns<CardRow[]>();
    if (error) fail("list conversations", error);
    return (data ?? []).map(toCard);
  }

  async getConversation(id: number): Promise<ConversationDetail | null> {
    const card = await this.db.from("conversations").select(CARD_SELECT).eq("id", id).maybeSingle<CardRow>();
    if (card.error) fail("get conversation", card.error);
    if (!card.data) return null;
    // Newest first with a limit, then reversed, so long chats show their latest messages.
    const messages = await this.db
      .from("messages")
      .select("*")
      .eq("conversation_id", id)
      .order("id", { ascending: false })
      .limit(MESSAGE_LIMIT)
      .returns<MessageRow[]>();
    if (messages.error) fail("list messages", messages.error);
    return { ...toCard(card.data), messages: (messages.data ?? []).map(toMessage).reverse() };
  }

  /** Conversations and hot leads per interested course id. */
  async demandByCourse(): Promise<Map<number, CourseDemand>> {
    const { data, error } = await this.db
      .from("conversations")
      .select("interested_course_id, intent_state")
      .not("interested_course_id", "is", null)
      .returns<{ interested_course_id: number; intent_state: IntentState }[]>();
    if (error) fail("course demand", error);
    const demand = new Map<number, CourseDemand>();
    for (const row of data ?? []) {
      const entry = demand.get(row.interested_course_id) ?? { conversations: 0, hotLeads: 0 };
      entry.conversations += 1;
      if (row.intent_state === "hot_lead") entry.hotLeads += 1;
      demand.set(row.interested_course_id, entry);
    }
    return demand;
  }

  async stats(): Promise<DashboardStats> {
    const conversations = await this.db
      .from("conversations")
      .select("mode, intent_state, needs_attention")
      .returns<{ mode: ConversationMode; intent_state: IntentState; needs_attention: boolean }[]>();
    if (conversations.error) fail("conversation stats", conversations.error);
    const events = await this.db.from("events").select("type").returns<{ type: EventType }[]>();
    if (events.error) fail("event stats", events.error);

    const rows = conversations.data ?? [];
    const byIntent: Record<IntentState, number> = { interested: 0, doubtful: 0, frustrated: 0, hot_lead: 0 };
    for (const row of rows) byIntent[row.intent_state] += 1;
    const eventCounts: Record<EventType, number> = { handover: 0, resume: 0, enrollment: 0, injection_attempt: 0, hot_lead: 0 };
    for (const row of events.data ?? []) eventCounts[row.type] += 1;

    return {
      conversations: rows.length,
      byIntent,
      inHumanMode: rows.filter((r) => r.mode === "human").length,
      needsAttention: rows.filter((r) => r.needs_attention).length,
      events: eventCounts,
    };
  }
}
