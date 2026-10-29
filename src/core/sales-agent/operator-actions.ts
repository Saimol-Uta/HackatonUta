import type { Conversation } from "../conversation/types";
import type { ConversationRepository, Messenger } from "../ports";

async function load(conversations: ConversationRepository, conversationId: number): Promise<Conversation> {
  const conversation = await conversations.get(conversationId);
  if (!conversation) throw new Error(`conversation ${conversationId} not found`);
  return conversation;
}

async function claim(conversations: ConversationRepository, conversation: Conversation): Promise<void> {
  if (conversation.mode === "human") return;
  await conversations.update(conversation.id, { mode: "human" });
  await conversations.recordEvent(conversation.id, "handover", { reason: "operator" });
}

/** The operator takes the conversation: the AI stops answering. */
export function takeOver({ conversations }: { conversations: ConversationRepository }) {
  return async (conversationId: number): Promise<void> => {
    await claim(conversations, await load(conversations, conversationId));
  };
}

/** Sends an operator message through the bot, so the prospect keeps seeing the same identity. */
export function sendOperatorMessage({
  conversations,
  messenger,
}: {
  conversations: ConversationRepository;
  messenger: Messenger;
}) {
  return async (conversationId: number, rawText: string): Promise<void> => {
    const text = rawText.trim();
    if (!text) throw new Error("operator message is empty");
    const conversation = await load(conversations, conversationId);

    // Direct operator intervention pauses the AI before anything is sent.
    await claim(conversations, conversation);
    await conversations.update(conversation.id, { needsAttention: false });
    await messenger.sendText(conversation.telegramChatId, text);
    await conversations.appendMessage({ conversationId, role: "operator", content: text, source: "text", meta: {} });
  };
}

/** Gives the conversation back to the AI. */
export function resumeAi({ conversations }: { conversations: ConversationRepository }) {
  return async (conversationId: number): Promise<void> => {
    const conversation = await load(conversations, conversationId);
    await conversations.update(conversation.id, {
      mode: "ai",
      needsAttention: false,
      // A resolved frustration should not keep the card red.
      ...(conversation.intentState === "frustrated" ? { intentState: "interested" as const } : {}),
    });
    await conversations.recordEvent(conversation.id, "resume");
  };
}
