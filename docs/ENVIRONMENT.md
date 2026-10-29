# Environment

Create `.env.local` in the project root (it is git-ignored) with this content, then fill in the values:

```bash
# --- LLM providers ---
ANTHROPIC_API_KEY=            # Claude, primary provider
GEMINI_API_KEY=               # Gemini, backup provider
LLM_PRIMARY=claude            # claude | gemini
LLM_FALLBACK=gemini           # claude | gemini | none (default: the other provider if its key is set)
AGENT_MODEL=claude-sonnet-5-5
CLASSIFIER_MODEL=claude-haiku-5-5
GEMINI_MODEL=gemini-3.5-flash-lite

# --- Telegram ---
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=      # 32-256 chars of A-Z a-z 0-9 _ -

# --- Supabase ---
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=    # server only, bypasses RLS
DASHBOARD_PASSWORD=           # operator dashboard password (16+ chars); empty disables sign-in
```

The app validates these on the first request and lists every missing or invalid variable.

## Where each value comes from

| Variable | How to get it |
| --- | --- |
| `ANTHROPIC_API_KEY` | [platform.claude.com](https://platform.claude.com) → sign in → **Billing**: add credit → **API Keys** → *Create Key*. Shown once. |
| `GEMINI_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → *Create API key*. The free tier is enough for the demo. |
| `TELEGRAM_BOT_TOKEN` | In Telegram, open **@BotFather** → `/newbot` → choose a name and a username ending in `bot`. It replies with the token (`123456:ABC...`). |
| `TELEGRAM_WEBHOOK_SECRET` | Invent it: `openssl rand -hex 32`. Telegram sends it back on every call and the webhook rejects calls without it. |
| `NEXT_PUBLIC_SUPABASE_URL` | [supabase.com](https://supabase.com) → *New project* → **Project Settings → API** → *Project URL*. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page → *anon / public* key. Safe for the browser; Row Level Security protects data. |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page → *service_role* key. Secret: server only, never in client code or git. |
| `DASHBOARD_PASSWORD` | Choose one, e.g. `openssl rand -base64 24`. Operators type it at `/login`. |

## Provider fallback

With both keys set, Claude answers and Gemini takes over the same call if Claude fails (outage, rate limit, refusal, malformed output). Set `LLM_PRIMARY=gemini` to run on Gemini alone (for example while Claude credit is pending).

## After filling it in

1. Run `supabase/migrations/*.sql` in order and then `supabase/seed.sql` in the Supabase SQL editor.
2. Create an operator user: Supabase → **Authentication → Users → Add user**.
3. Deploy (e.g. Vercel, adding the same variables in its settings) or expose `pnpm dev` with `cloudflared tunnel --url http://localhost:3000`.
4. Register the webhook: `pnpm telegram:webhook https://<public-host>`.
