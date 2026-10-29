-- Rolling summary watermark: the last message already folded into conversations.summary.
alter table public.conversations
  add column summarized_until_message_id bigint references public.messages (id) on delete set null;
