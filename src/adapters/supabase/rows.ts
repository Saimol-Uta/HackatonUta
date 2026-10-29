// Mapping between Postgres rows (snake_case, numerics as strings) and core types.
import type { Course, Promotion } from "@/core/catalog/course";
import type { Conversation, ConversationPatch, Message } from "@/core/conversation/types";

type Numeric = number | string | null;

const num = (value: Numeric): number | null => (value === null ? null : Number(value));

export interface CourseRow {
  id: number;
  slug: string;
  name: string;
  full_title: string | null;
  training_hours: number | null;
  url: string;
  image_url: string | null;
  description: string | null;
  objectives: string | null;
  location: string | null;
  organizers: string | null;
  enrollment_start: string | null;
  enrollment_end: string | null;
  start_date: string | null;
  end_date: string | null;
  schedule: string | null;
  modality: string | null;
  certificate: string | null;
  price_uta_student: Numeric;
  price_uta_staff: Numeric;
  price_public: Numeric;
  details_text: string | null;
}

export function toCourse(row: CourseRow): Course {
  const [utaStudent, utaStaff, publicPrice] = [row.price_uta_student, row.price_uta_staff, row.price_public].map(num);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    fullTitle: row.full_title,
    trainingHours: row.training_hours,
    url: row.url,
    imageUrl: row.image_url,
    description: row.description,
    objectives: row.objectives,
    location: row.location,
    organizers: row.organizers,
    enrollmentStart: row.enrollment_start,
    enrollmentEnd: row.enrollment_end,
    startDate: row.start_date,
    endDate: row.end_date,
    schedule: row.schedule,
    modality: row.modality,
    certificate: row.certificate,
    prices:
      utaStudent !== null && utaStaff !== null && publicPrice !== null
        ? { utaStudent, utaStaff, public: publicPrice }
        : null,
    detailsText: row.details_text,
  };
}

export interface PromotionRow {
  code: string;
  course_id: number | null;
  discount_pct: Numeric;
  valid_until: string | null;
}

export function toPromotion(row: PromotionRow): Promotion {
  return { code: row.code, courseId: row.course_id, discountPct: Number(row.discount_pct), validUntil: row.valid_until };
}

export interface ConversationRow {
  id: number;
  mode: Conversation["mode"];
  intent_state: Conversation["intentState"];
  needs_attention: boolean;
  interested_course_id: number | null;
  summary: string | null;
  summarized_until_message_id: Numeric;
  contacts: { telegram_chat_id: Numeric };
}

/** Select clause that yields a ConversationRow. */
export const CONVERSATION_SELECT =
  "id, mode, intent_state, needs_attention, interested_course_id, summary, summarized_until_message_id, contacts!inner(telegram_chat_id)";

export function toConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    telegramChatId: Number(row.contacts.telegram_chat_id),
    mode: row.mode,
    intentState: row.intent_state,
    needsAttention: row.needs_attention,
    interestedCourseId: row.interested_course_id,
    summary: row.summary,
    summarizedUntilMessageId: num(row.summarized_until_message_id),
  };
}

const PATCH_COLUMNS: Record<keyof ConversationPatch, string> = {
  mode: "mode",
  intentState: "intent_state",
  needsAttention: "needs_attention",
  interestedCourseId: "interested_course_id",
  summary: "summary",
  summarizedUntilMessageId: "summarized_until_message_id",
};

export function toConversationRow(patch: ConversationPatch): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(patch)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [PATCH_COLUMNS[key as keyof ConversationPatch], value]),
  );
}

export interface MessageRow {
  id: Numeric;
  conversation_id: number;
  role: Message["role"];
  content: string;
  source: Message["source"];
  meta: Record<string, unknown>;
  created_at: string;
}

export function toMessage(row: MessageRow): Message {
  return {
    id: Number(row.id),
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    source: row.source,
    meta: row.meta,
    createdAt: row.created_at,
  };
}
