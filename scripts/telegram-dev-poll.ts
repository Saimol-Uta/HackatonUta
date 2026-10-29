// Local development without a public URL: long-polls Telegram and forwards each update
// to the local webhook with the shared secret, exactly as Telegram would.
// Usage: pnpm dev (in one terminal), then pnpm telegram:poll [http://localhost:3000]
// Telegram refuses getUpdates while a webhook is set; this script removes it first.
const localUrl = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!token || !secret) {
  console.error("Requires TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET in .env.local.");
  process.exit(1);
}

const api = (method: string, body: object) =>
  fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json() as Promise<{ ok: boolean; result: { update_id: number }[]; description?: string }>);

// Network drops (e.g. switching Wi-Fi) should not kill the loop: retry until Telegram answers.
for (;;) {
  const removed = await api("deleteWebhook", { drop_pending_updates: false }).catch((error: Error) => {
    console.error(`Telegram unreachable (${error.cause ?? error.message}), retrying in 5 s...`);
    return null;
  });
  if (removed?.ok) break;
  await new Promise((resolve) => setTimeout(resolve, 5000));
}
console.log(`Polling Telegram and forwarding to ${localUrl}/api/telegram/webhook (Ctrl+C to stop)`);

let offset = 0;
for (;;) {
  const updates = await api("getUpdates", { offset, timeout: 30, allowed_updates: ["message"] }).catch((error: Error) => {
    console.error(`getUpdates failed (${error.cause ?? error.message}), retrying...`);
    return null;
  });
  if (!updates?.ok) {
    if (updates?.description) console.error("getUpdates:", updates.description);
    await new Promise((resolve) => setTimeout(resolve, 3000));
    continue;
  }
  for (const update of updates.result) {
    offset = update.update_id + 1;
    const response = await fetch(`${localUrl}/api/telegram/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": secret },
      body: JSON.stringify(update),
    }).catch(() => null);
    console.log(`update ${update.update_id} -> ${response?.status ?? "local server unreachable"}`);
  }
}

export {};
