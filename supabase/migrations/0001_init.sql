-- WhatsApp AI agent schema
create extension if not exists "pgcrypto";

-- Contacts: one row per WhatsApp user
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  wa_id text not null unique,
  name text,
  created_at timestamptz not null default now()
);

-- Conversations: one per contact
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null unique references public.contacts(id) on delete cascade,
  ai_enabled boolean not null default true,
  needs_human boolean not null default false,
  unread_count integer not null default 0,
  last_message_at timestamptz not null default now(),
  last_message_preview text,
  last_inbound_at timestamptz,
  created_at timestamptz not null default now()
);
create index conversations_last_message_at_idx on public.conversations (last_message_at desc);

-- Messages
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  sender text not null check (sender in ('contact', 'ai', 'rule', 'human', 'system')),
  body text,
  type text not null default 'text',
  wa_message_id text unique,
  status text not null default 'sent' check (status in ('received', 'pending', 'sent', 'delivered', 'read', 'failed')),
  error text,
  raw jsonb,
  created_at timestamptz not null default now()
);
create index messages_conversation_created_idx on public.messages (conversation_id, created_at);
create index messages_created_idx on public.messages (created_at);

-- "If someone messages X, reply Y"
create table public.reply_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  match_type text not null check (match_type in ('exact', 'contains', 'starts_with', 'intent')),
  trigger text not null,
  response_mode text not null default 'fixed' check (response_mode in ('fixed', 'guide')),
  response text not null,
  priority integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Business facts / FAQ the AI answers from
create table public.knowledge_base (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Single-row agent settings
create table public.settings (
  id integer primary key default 1 check (id = 1),
  agent_name text not null default 'Assistant',
  business_name text not null default 'Our Firm',
  persona text not null default '',
  global_ai_enabled boolean not null default true,
  model text,
  fallback_message text not null default 'Thanks for your message! Our team will get back to you shortly.',
  handoff_message text not null default 'Thanks! I''ve passed your conversation to our team — someone will reply to you here soon.',
  unsupported_message text not null default 'Thanks for sending that! I can only read text messages right now — could you type your message instead?',
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict do nothing;

-- Update conversation after a message is stored (atomic unread increment)
create or replace function public.touch_conversation(p_conversation_id uuid, p_preview text, p_inbound boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.conversations
  set last_message_at = now(),
      last_message_preview = left(p_preview, 200),
      unread_count = case when p_inbound then unread_count + 1 else unread_count end,
      last_inbound_at = case when p_inbound then now() else last_inbound_at end
  where id = p_conversation_id;
$$;
revoke execute on function public.touch_conversation(uuid, text, boolean) from public, anon, authenticated;

-- Daily message counts for the dashboard chart
create or replace function public.message_daily_counts(p_days integer default 14)
returns table (day date, inbound bigint, outbound bigint)
language sql
stable
as $$
  select d::date as day,
         count(m.id) filter (where m.direction = 'in') as inbound,
         count(m.id) filter (where m.direction = 'out') as outbound
  from generate_series(current_date - (p_days - 1), current_date, interval '1 day') d
  left join public.messages m on m.created_at::date = d::date
  group by d
  order by d;
$$;

-- Row level security: any signed-in dashboard user has full access.
-- The webhook uses the service role key, which bypasses RLS.
alter table public.contacts enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.reply_rules enable row level security;
alter table public.knowledge_base enable row level security;
alter table public.settings enable row level security;

create policy "authenticated full access" on public.contacts for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.conversations for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.messages for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.reply_rules for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.knowledge_base for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.settings for all to authenticated using (true) with check (true);

-- Realtime for the live conversation viewer
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
