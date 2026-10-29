import type { SupabaseClient } from "@supabase/supabase-js";
import type { Course, Promotion } from "@/core/catalog/course";
import type { Conversation, ConversationPatch, EventType, Message, NewMessage } from "@/core/conversation/types";
import type { CatalogRepository, ContactProfile, ConversationRepository } from "@/core/ports";
import {
  CONVERSATION_SELECT,
  toContactRow,
  toConversation,
  toConversationRow,
  toCourse,
  toMessage,
  toPromotion,
  type ConversationRow,
  type CourseRow,
  type MessageRow,
  type PromotionRow,
} from "./rows";

function must<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  if (result.data === null) throw new Error(`${what}: no data`);
  return result.data;
}

/** Server-side repository; uses the service role client, never exposed to browsers. */
export class SupabaseConversationRepository implements ConversationRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findOrCreateByChat(contact: ContactProfile): Promise<Conversation> {
    const { id: contactId } = must(
      await this.db
        .from("contacts")
        .upsert(toContactRow(contact), { onConflict: "telegram_chat_id" })
        .select("id")
        .single<{ id: number }>(),
      "upsert contact",
    );

    const existing = await this.db
      .from("conversations")
      .select(CONVERSATION_SELECT)
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<ConversationRow>();
    if (existing.error) throw new Error(`find conversation: ${existing.error.message}`);
    if (existing.data) return toConversation(existing.data);

    return toConversation(
      must(
        await this.db.from("conversations").insert({ contact_id: contactId }).select(CONVERSATION_SELECT).single<ConversationRow>(),
        "create conversation",
      ),
    );
  }

  async get(conversationId: number): Promise<Conversation | null> {
    const result = await this.db
      .from("conversations")
      .select(CONVERSATION_SELECT)
      .eq("id", conversationId)
      .maybeSingle<ConversationRow>();
    if (result.error) throw new Error(`get conversation: ${result.error.message}`);
    return result.data ? toConversation(result.data) : null;
  }

  async appendMessage(message: NewMessage): Promise<Message> {
    const row = must(
      await this.db
        .from("messages")
        .insert({
          conversation_id: message.conversationId,
          role: message.role,
          content: message.content,
          source: message.source,
          meta: message.meta,
        })
        .select("*")
        .single<MessageRow>(),
      "append message",
    );
    const touched = await this.db
      .from("conversations")
      .update({ last_message_at: row.created_at })
      .eq("id", message.conversationId);
    if (touched.error) throw new Error(`touch conversation: ${touched.error.message}`);
    return toMessage(row);
  }

  async recentMessages(conversationId: number, limit: number): Promise<Message[]> {
    const rows = must(
      await this.db
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("id", { ascending: false })
        .limit(limit)
        .returns<MessageRow[]>(),
      "recent messages",
    );
    return rows.map(toMessage).reverse();
  }

  async messagesAfter(conversationId: number, afterId: number): Promise<Message[]> {
    const rows = must(
      await this.db
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .gt("id", afterId)
        .order("id", { ascending: true })
        .returns<MessageRow[]>(),
      "messages after",
    );
    return rows.map(toMessage);
  }

  async update(conversationId: number, patch: ConversationPatch): Promise<void> {
    const row = toConversationRow(patch);
    if (Object.keys(row).length === 0) return;
    const result = await this.db.from("conversations").update(row).eq("id", conversationId);
    if (result.error) throw new Error(`update conversation: ${result.error.message}`);
  }

  async recordEvent(conversationId: number, type: EventType, meta: Record<string, unknown> = {}): Promise<void> {
    const result = await this.db.from("events").insert({ conversation_id: conversationId, type, meta });
    if (result.error) throw new Error(`record event: ${result.error.message}`);
  }
}

export class SupabaseCatalogRepository implements CatalogRepository {
  constructor(private readonly db: SupabaseClient) {}

  async listCourses(): Promise<Course[]> {
    const rows = must(await this.db.from("courses").select("*").order("id").returns<CourseRow[]>(), "list courses");
    return rows.map(toCourse);
  }

  async listActivePromotions(today: string): Promise<Promotion[]> {
    const rows = must(
      await this.db
        .from("promotions")
        .select("code, course_id, discount_pct, valid_until")
        .eq("active", true)
        .or(`valid_until.is.null,valid_until.gte.${today}`)
        .returns<PromotionRow[]>(),
      "list promotions",
    );
    return rows.map(toPromotion);
  }
}
