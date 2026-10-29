// Ports: what the core needs from the outside world. Adapters (Supabase, Claude, Telegram) implement them.
import type { Course, Promotion } from "./catalog/course";
import type {
  Conversation,
  ConversationPatch,
  EventType,
  IntentState,
  Message,
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
  countMessages(conversationId: number): Promise<number>;
  update(conversationId: number, patch: ConversationPatch): Promise<void>;
  recordEvent(conversationId: number, type: EventType, meta?: Record<string, unknown>): Promise<void>;
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
  classify(input: { history: ChatTurn[]; courseSlugs: string[] }): Promise<Classification>;
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
