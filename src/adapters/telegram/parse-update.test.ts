import { describe, expect, it } from "vitest";
import { isValidSecret, parseUpdate } from "./parse-update";

describe("parseUpdate", () => {
  it("turns a private text message into an incoming message", () => {
    expect(
      parseUpdate({
        update_id: 1,
        message: {
          message_id: 10,
          chat: { id: 555, type: "private" },
          from: { id: 555, first_name: "Ana", username: "ana_uta" },
          text: "Hola",
        },
      }),
    ).toEqual({
      kind: "text",
      message: { contact: { telegramChatId: 555, firstName: "Ana", username: "ana_uta" }, text: "Hola", source: "text" },
    });
  });

  it("reports unsupported content (voice, stickers, photos) so the bot can say so", () => {
    expect(
      parseUpdate({ update_id: 2, message: { message_id: 11, chat: { id: 555, type: "private" }, voice: { file_id: "x" } } }),
    ).toEqual({ kind: "unsupported", telegramChatId: 555 });
  });

  it("ignores updates that are not private messages", () => {
    expect(parseUpdate({ update_id: 3, edited_message: { chat: { id: 1 } } })).toEqual({ kind: "ignored" });
    expect(parseUpdate({ update_id: 4, message: { message_id: 1, chat: { id: -100, type: "group" }, text: "hi" } })).toEqual({
      kind: "ignored",
    });
    expect(parseUpdate("garbage")).toEqual({ kind: "ignored" });
  });
});

describe("isValidSecret", () => {
  it("accepts only the exact configured secret", () => {
    expect(isValidSecret("a".repeat(32), "a".repeat(32))).toBe(true);
    expect(isValidSecret("a".repeat(31) + "b", "a".repeat(32))).toBe(false);
    expect(isValidSecret(null, "a".repeat(32))).toBe(false);
    expect(isValidSecret("short", "a".repeat(32))).toBe(false);
  });
});
