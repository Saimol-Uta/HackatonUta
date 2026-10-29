# Hackathon UTA 2026 — Multi-Agent Conversational Sales

Telegram sales agent powered by an LLM plus a real-time operator dashboard with seamless human handover, built for the FISEI (Universidad Técnica de Ambato) Hackathon 2026 challenge.

- Planning: [docs/PLANNING.md](docs/PLANNING.md)
- Task log: [odd/tasks/sales-agent-mvp.md](odd/tasks/sales-agent-mvp.md)

## Stack

Next.js 15 (dashboard + webhook API) · Supabase (Postgres, Realtime, Auth) · grammY (Telegram) · Claude via `@anthropic-ai/sdk`, with Gemini (`@google/genai`) as backup provider · Vitest.

## Getting started

```bash
pnpm install
pnpm test        # unit tests
pnpm dev         # http://localhost:3000
```

### Environment variables

See [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md): the `.env.local` template, where to get each key, and the Claude → Gemini fallback.

### Telegram webhook

Once the app is reachable over HTTPS:

```bash
pnpm telegram:webhook https://<public-host>   # registers /api/telegram/webhook with the secret
```

### Database

1. Create a Supabase project.
2. Run the files in `supabase/migrations/` in order (`0001_init.sql`, `0002_course_details.sql`) in the SQL editor.
3. Regenerate the course seed from the scraped CSV and run it:

```bash
pnpm seed                        # data/cursos_fisei_completo.csv -> supabase/seed.sql
```

Then run `supabase/seed.sql` in the SQL editor.

## Course data

`data/cursos_fisei_completo.csv` comes from scraping `https://ctt-talleresfisei.uta.edu.ec/course.php` and every course detail page (`cursoN.php`): name, duration, image, description, objectives, location, organizers and a details section (enrollment and course dates, schedule, three price tiers, modality, certificate, prerequisites, modules).

`src/core/catalog/extract-course-details.ts` turns the details section into structured fields; the full text is also stored in `courses.details_text` so the agent answers from it instead of inventing.

The site's `ABIERTO`/`CERRADO` label is stale (2025 courses still say `ABIERTO`), so `courseLifecycle()` derives the real state from the dates: `upcoming`, `enrollment_open`, `enrollment_closed`, `in_progress`, `finished`.

The site resolves to a private UTA address (`172.21.123.71`). If it is unreachable from a laptop on the campus network while a phone works, check for a Docker bridge network in `172.21.0.0/16` (`ip route get 172.21.123.71`): it hijacks the route. The server also omits its intermediate TLS certificate, so non-browser clients need to supply it or skip verification.

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
