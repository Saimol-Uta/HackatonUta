import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { IncomingMessage } from "@/core/sales-agent/handle-incoming-message";

const UPDATE = z.object({
  update_id: z.number(),
  message: z
    .object({
      chat: z.object({ id: z.number(), type: z.string() }),
      from: z.object({ first_name: z.string().optional(), username: z.string().optional() }).optional(),
      text: z.string().optional(),
    })
    .optional(),
});

export type ParsedUpdate =
  | { kind: "text"; message: IncomingMessage }
  | { kind: "unsupported"; telegramChatId: number }
  | { kind: "ignored" };

/** Keeps only private chat messages; the bot is a one-to-one sales advisor. */
export function parseUpdate(body: unknown): ParsedUpdate {
  const parsed = UPDATE.safeParse(body);
  const message = parsed.success ? parsed.data.message : undefined;
  if (!message || message.chat.type !== "private") return { kind: "ignored" };

  const text = message.text?.trim();
  if (!text) return { kind: "unsupported", telegramChatId: message.chat.id };

  return {
    kind: "text",
    message: {
      contact: {
        telegramChatId: message.chat.id,
        firstName: message.from?.first_name ?? null,
        username: message.from?.username ?? null,
      },
      text,
      source: "text",
    },
  };
}

/** Telegram echoes the webhook secret in X-Telegram-Bot-Api-Secret-Token; compare in constant time. */
export function isValidSecret(received: string | null, expected: string): boolean {
  if (!received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
