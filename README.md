# Hackathon UTA 2026 — Multi-Agent Conversational Sales

Telegram sales agent powered by an LLM plus a real-time operator dashboard with seamless human handover, built for the FISEI (Universidad Técnica de Ambato) Hackathon 2026 challenge.

- Planning: [docs/PLANNING.md](docs/PLANNING.md)
- Task log: [odd/tasks/sales-agent-mvp.md](odd/tasks/sales-agent-mvp.md)

## Stack

Next.js 15 (dashboard + webhook API) · Supabase (Postgres, Realtime, Auth) · grammY (Telegram) · Claude via `@anthropic-ai/sdk` · Vitest.

## Getting started

```bash
pnpm install
pnpm test        # unit tests
pnpm dev         # http://localhost:3000
```

### Environment variables

Create `.env.local` with:

| Variable | Description |
| --- | --- |
| `ANTHROPIC_API_KEY` | Claude API key |
| `AGENT_MODEL` | Reply model, default `claude-sonnet-5-5` |
| `CLASSIFIER_MODEL` | Classifier/summary model, default `claude-haiku-5-5` |
| `TELEGRAM_BOT_TOKEN` | Token from @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | Random string, validated on every webhook call |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key, server only — never expose it |

### Database

1. Create a Supabase project.
2. Run `supabase/migrations/0001_init.sql` in the SQL editor.
3. Regenerate the course seed from the scraped CSV and run it:

```bash
pnpm seed                        # data/cursos_fisei.csv -> supabase/seed.sql
```

Then run `supabase/seed.sql` in the SQL editor.

## Course data

`data/cursos_fisei.csv` comes from scraping the listing page `https://ctt-talleresfisei.uta.edu.ec/course.php` (name, status, duration, link, image). Detail fields (syllabus, schedule, price, modality, certificate) live on each course page and are still pending. The site is only reachable from the UTA network.

## Project layout

```
src/core/        # domain and use cases, framework-free
src/app/         # Next.js routes (dashboard UI + API)
supabase/        # migrations and seed
scripts/         # data tooling
data/            # scraped source data
```

## Deliverables

1. Live Telegram bot
2. Public dashboard URL
3. Source code, environment configuration and deployment guide
