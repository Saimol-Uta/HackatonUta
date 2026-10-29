// Points the Telegram bot at the deployed webhook, with the shared secret.
// Usage: pnpm telegram:webhook https://your-app.vercel.app
const baseUrl = process.argv[2];
const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!baseUrl?.startsWith("https://") || !token || !secret) {
  console.error("Usage: pnpm telegram:webhook https://<public-host>");
  console.error("Requires TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET in .env.local.");
  process.exit(1);
}

const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    url: `${baseUrl.replace(/\/$/, "")}/api/telegram/webhook`,
    secret_token: secret,
    allowed_updates: ["message"],
    drop_pending_updates: true,
  }),
});
console.log(await response.json());

export {};
