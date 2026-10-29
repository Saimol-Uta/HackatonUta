-- Detail fields from the full course scrape (cursoN.php pages).
-- The site publishes three price tiers, so the single price column is replaced.
-- Lifecycle (open, in progress, finished) is derived from these dates at runtime:
-- the site's ABIERTO/CERRADO label is stale.

alter table public.courses
  drop column price,
  add column full_title text,
  add column location text,
  add column organizers text,
  add column enrollment_start date,
  add column enrollment_end date,
  add column end_date date,
  add column price_uta_student numeric(10, 2) check (price_uta_student >= 0),
  add column price_uta_staff numeric(10, 2) check (price_uta_staff >= 0),
  add column price_public numeric(10, 2) check (price_public >= 0),
  -- Whole details section, verbatim: grounding text for the agent.
  add column details_text text;

comment on column public.courses.price_uta_student is 'UTA students up to their last term';
comment on column public.courses.price_uta_staff is 'UTA graduates, faculty and administrative staff';
comment on column public.courses.price_public is 'General public';
