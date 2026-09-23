-- Bulk messaging (broadcasts) with approved WhatsApp templates

-- Messages can now come from a broadcast
alter table public.messages drop constraint messages_sender_check;
alter table public.messages add constraint messages_sender_check
  check (sender in ('contact', 'ai', 'rule', 'human', 'system', 'broadcast'));

-- Opt-out: contacts who replied STOP are skipped by broadcasts
alter table public.contacts add column opted_out boolean not null default false;
alter table public.contacts add column opted_out_at timestamptz;

create table public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  template_name text not null,
  template_language text not null,
  preview text,
  status text not null default 'sending' check (status in ('sending', 'completed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index broadcasts_created_idx on public.broadcasts (created_at desc);

create table public.broadcast_recipients (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references public.broadcasts(id) on delete cascade,
  wa_id text not null,
  name text,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'delivered', 'read', 'failed', 'skipped')),
  error text,
  wa_message_id text unique,
  conversation_id uuid references public.conversations(id) on delete set null,
  sent_at timestamptz,
  replied_at timestamptz,
  unique (broadcast_id, wa_id)
);
create index broadcast_recipients_broadcast_idx on public.broadcast_recipients (broadcast_id);
create index broadcast_recipients_wa_id_idx on public.broadcast_recipients (wa_id, sent_at desc);

alter table public.broadcasts enable row level security;
alter table public.broadcast_recipients enable row level security;
create policy "authenticated full access" on public.broadcasts for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.broadcast_recipients for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table public.broadcasts;
alter publication supabase_realtime add table public.broadcast_recipients;
