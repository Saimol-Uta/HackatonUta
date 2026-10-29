export type ConversationMode = "ai" | "human";

/** The "thermometer" shown on each chat card. */
export type IntentState = "interested" | "doubtful" | "frustrated" | "hot_lead";

export type MessageRole = "user" | "ai" | "operator" | "system";

export type MessageSource = "text" | "voice" | "document";

export type EventType = "handover" | "resume" | "enrollment" | "injection_attempt" | "hot_lead";

export interface Conversation {
  id: number;
  telegramChatId: number;
  mode: ConversationMode;
  intentState: IntentState;
  needsAttention: boolean;
  interestedCourseId: number | null;
  summary: string | null;
  /** Last message folded into `summary`; newer messages are not summarized yet. */
  summarizedUntilMessageId: number | null;
}

export interface Message {
  id: number;
  conversationId: number;
  role: MessageRole;
  content: string;
  source: MessageSource;
  meta: Record<string, unknown>;
  createdAt: string;
}

export type NewMessage = Omit<Message, "id" | "createdAt">;

export type ConversationPatch = Partial<
  Pick<Conversation, "mode" | "intentState" | "needsAttention" | "interestedCourseId" | "summary" | "summarizedUntilMessageId">
>;
