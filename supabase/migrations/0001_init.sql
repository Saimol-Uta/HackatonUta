-- Core schema for the sales agent and the operator dashboard.

create table public.courses (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  status text not null check (status in ('open', 'closed')),
  training_hours integer check (training_hours > 0),
  url text not null,
  image_url text,
  -- Detail fields, filled from the course detail pages. Null means "unknown": the bot must not invent them.
  description text,
  objectives text,
  syllabus text,
  schedule text,
  start_date date,
  modality text,
  price numeric(10, 2) check (price >= 0),
  certificate text,
  certificate_hours integer check (certificate_hours > 0),
  brochure_url text,
  updated_at timestamptz not null default now()
);

-- The only source of truth for discounts. The agent can quote nothing that is not here.
create table public.promotions (
  id bigint generated always as identity primary key,
  course_id bigint references public.courses (id) on delete cascade,
  code text not null unique,
  discount_pct numeric(5, 2) not null check (discount_pct > 0 and discount_pct <= 100),
  valid_until date,
  active boolean not null default true
);
create index promotions_course_id_idx on public.promotions (course_id);

create table public.contacts (
  id bigint generated always as identity primary key,
  telegram_chat_id bigint not null unique,
  first_name text,
  username text,
  created_at timestamptz not null default now()
);

create table public.conversations (
  id bigint generated always as identity primary key,
  contact_id bigint not null references public.contacts (id) on delete cascade,
  mode text not null default 'ai' check (mode in ('ai', 'human')),
  intent_state text not null default 'interested'
    check (intent_state in ('interested', 'doubtful', 'frustrated', 'hot_lead')),
  needs_attention boolean not null default false,
  interested_course_id bigint references public.courses (id) on delete set null,
  summary text,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index conversations_contact_id_idx on public.conversations (contact_id);
create index conversations_interested_course_id_idx on public.conversations (interested_course_id);
create index conversations_last_message_at_idx on public.conversations (last_message_at desc);

create table public.messages (
  id bigint generated always as identity primary key,
  conversation_id bigint not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('user', 'ai', 'operator', 'system')),
  content text not null,
  source text not null default 'text' check (source in ('text', 'voice', 'document')),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index messages_conversation_id_created_at_idx on public.messages (conversation_id, created_at);

create table public.enrollments (
  id bigint generated always as identity primary key,
  conversation_id bigint not null references public.conversations (id) on delete cascade,
  course_id bigint not null references public.courses (id) on delete restrict,
  full_name text not null,
  email text,
  phone text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);
create index enrollments_conversation_id_idx on public.enrollments (conversation_id);
create index enrollments_course_id_idx on public.enrollments (course_id);

-- Analytics events: handovers, enrollments, injection attempts.
create table public.events (
  id bigint generated always as identity primary key,
  conversation_id bigint references public.conversations (id) on delete cascade,
  type text not null check (type in ('handover', 'resume', 'enrollment', 'injection_attempt', 'hot_lead')),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index events_conversation_id_idx on public.events (conversation_id);
create index events_type_created_at_idx on public.events (type, created_at);

-- Row Level Security: the webhook uses the service role (bypasses RLS);
-- signed-in operators (Supabase Auth) can read and act on everything.
alter table public.courses enable row level security;
alter table public.promotions enable row level security;
alter table public.contacts enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.enrollments enable row level security;
alter table public.events enable row level security;

create policy operators_read_courses on public.courses for select to authenticated using (true);
create policy operators_read_promotions on public.promotions for select to authenticated using (true);
create policy operators_read_contacts on public.contacts for select to authenticated using (true);
create policy operators_read_conversations on public.conversations for select to authenticated using (true);
create policy operators_update_conversations on public.conversations for update to authenticated using (true) with check (true);
create policy operators_read_messages on public.messages for select to authenticated using (true);
create policy operators_read_enrollments on public.enrollments for select to authenticated using (true);
create policy operators_update_enrollments on public.enrollments for update to authenticated using (true) with check (true);
create policy operators_read_events on public.events for select to authenticated using (true);

-- Realtime: the dashboard subscribes to these tables over WebSockets.
alter publication supabase_realtime add table public.conversations, public.messages, public.enrollments;
