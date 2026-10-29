import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryConversations, RecordingMessenger } from "../testing/fakes";
import { resumeAi, sendOperatorMessage, takeOver } from "./operator-actions";

describe("operator actions", () => {
  let conversations: InMemoryConversations;
  let messenger: RecordingMessenger;

  beforeEach(async () => {
    conversations = new InMemoryConversations();
    messenger = new RecordingMessenger();
    await conversations.findOrCreateByChat({ telegramChatId: 777, firstName: null, username: null });
  });

  it("take over pauses the AI and records a handover", async () => {
    await takeOver({ conversations })(1);

    expect(conversations.conversation().mode).toBe("human");
    expect(conversations.events).toEqual([{ conversationId: 1, type: "handover", meta: { reason: "operator" } }]);
  });

  it("an operator message goes out through the bot, is stored as operator and pauses the AI", async () => {
    await sendOperatorMessage({ conversations, messenger })(1, "  Hola, soy Carla del CTT  ");

    expect(messenger.sent).toEqual([{ telegramChatId: 777, text: "Hola, soy Carla del CTT" }]);
    expect(conversations.messages.map((m) => [m.role, m.content])).toEqual([["operator", "Hola, soy Carla del CTT"]]);
    expect(conversations.conversation()).toMatchObject({ mode: "human", needsAttention: false });
    expect(conversations.events.map((e) => e.type)).toEqual(["handover"]);
  });

  it("does not record a second handover when the operator already owns the chat", async () => {
    await takeOver({ conversations })(1);
    await sendOperatorMessage({ conversations, messenger })(1, "Te ayudo");

    expect(conversations.events.map((e) => e.type)).toEqual(["handover"]);
  });

  it("rejects empty operator messages", async () => {
    await expect(sendOperatorMessage({ conversations, messenger })(1, "   ")).rejects.toThrow("empty");
    expect(messenger.sent).toEqual([]);
  });

  it("resume returns the chat to the AI and clears the attention flag", async () => {
    await conversations.update(1, { mode: "human", needsAttention: true, intentState: "frustrated" });

    await resumeAi({ conversations })(1);

    expect(conversations.conversation()).toMatchObject({ mode: "ai", needsAttention: false, intentState: "interested" });
    expect(conversations.events.map((e) => e.type)).toEqual(["resume"]);
  });

  it("fails on an unknown conversation", async () => {
    await expect(resumeAi({ conversations })(99)).rejects.toThrow("not found");
  });
});
