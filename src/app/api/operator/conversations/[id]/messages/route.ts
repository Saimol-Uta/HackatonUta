import { getContainer } from "@/server/container";
import { operatorAction } from "@/server/operator-action-route";

const MAX_LENGTH = 4000; // Telegram's message limit is 4096 characters.

export const POST = operatorAction(async (id, request) => {
  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.slice(0, MAX_LENGTH) : "";
  await getContainer().sendOperatorMessage(id, text);
});
