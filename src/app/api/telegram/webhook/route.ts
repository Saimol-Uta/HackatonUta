import { after, NextResponse } from "next/server";
import { isValidSecret, parseUpdate } from "@/adapters/telegram/parse-update";
import { getContainer } from "@/server/container";

// Copy for prospects stays in Spanish.
const UNSUPPORTED_MESSAGE =
  "Por ahora solo puedo leer mensajes de texto. ¿Me cuentas por escrito en qué curso estás interesado?";

export async function POST(request: Request): Promise<Response> {
  const { env, handleIncomingMessage, messenger } = getContainer();

  if (!isValidSecret(request.headers.get("x-telegram-bot-api-secret-token"), env.TELEGRAM_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const update = parseUpdate(await request.json().catch(() => null));

  // Answer Telegram at once and do the slow LLM work afterwards, so it never retries a delivery.
  after(async () => {
    try {
      if (update.kind === "text") await handleIncomingMessage(update.message);
      if (update.kind === "unsupported") await messenger.sendText(update.telegramChatId, UNSUPPORTED_MESSAGE);
    } catch (error) {
      console.error("[telegram] failed to handle update", error);
    }
  });

  return NextResponse.json({ ok: true });
}
