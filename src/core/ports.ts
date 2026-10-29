// Ports: what the core needs from the outside world. Adapters (Supabase, Claude, Telegram) implement them.
import type { Course, Promotion } from "./catalog/course";
import type {
  Conversation,
  ConversationPatch,
  EventType,
  IntentState,
  Message,
  NewEnrollment,
  NewMessage,
} from "./conversation/types";

export interface ContactProfile {
  telegramChatId: number;
  firstName: string | null;
  username: string | null;
}

export interface ConversationRepository {
  findOrCreateByChat(contact: ContactProfile): Promise<Conversation>;
  get(conversationId: number): Promise<Conversation | null>;
  /** Persists a message and bumps the conversation's last activity. */
  appendMessage(message: NewMessage): Promise<Message>;
  /** Most recent messages, oldest first. */
  recentMessages(conversationId: number, limit: number): Promise<Message[]>;
  /** Messages with an id greater than `afterId`, oldest first. */
  messagesAfter(conversationId: number, afterId: number): Promise<Message[]>;
  update(conversationId: number, patch: ConversationPatch): Promise<void>;
  recordEvent(conversationId: number, type: EventType, meta?: Record<string, unknown>): Promise<void>;
  /** Stores the request once per conversation and course; false when it already existed. */
  createEnrollment(enrollment: NewEnrollment): Promise<boolean>;
}

export interface CatalogRepository {
  listCourses(): Promise<Course[]>;
  listActivePromotions(today: string): Promise<Promotion[]>;
}

export interface Messenger {
  /** Sends as the bot, so operator messages share its identity. */
  sendText(telegramChatId: number, text: string): Promise<void>;
}

export interface Classification {
  intentState: IntentState;
  wantsHuman: boolean;
  injectionSuspected: boolean;
  /** Slug of the course the user is talking about, if any. */
  courseSlug: string | null;
  /** Enrollment data the prospect gave anywhere in the conversation; null when not given. */
  contact: { fullName: string | null; email: string | null; phone: string | null };
}

/** What the classifier needs to tell courses apart, including editions of the same course. */
export interface CourseOption {
  slug: string;
  name: string;
  /** Human-readable state, e.g. "finalizado" or "inscripciones abiertas hasta 2026-11-15". */
  state: string;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LanguageModel {
  classify(input: { history: ChatTurn[]; courses: CourseOption[] }): Promise<Classification>;
  reply(input: { system: string; summary: string | null; history: ChatTurn[] }): Promise<{
    text: string;
    usage: TokenUsage;
  }>;
  summarize(input: { previousSummary: string | null; history: ChatTurn[] }): Promise<string>;
}

export interface Clock {
  /** Today's date in the center's time zone, ISO "YYYY-MM-DD". */
  today(): string;
}
