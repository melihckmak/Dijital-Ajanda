-- Hoş geldin (çift gönderim önleme) ve günlük hatırlatma özeti (Edge Functions)
create table if not exists public.welcome_mail_sent (
  user_id uuid primary key references auth.users (id) on delete cascade,
  sent_at timestamptz not null default now()
);

create table if not exists public.mail_digest_sent (
  user_id uuid not null references auth.users (id) on delete cascade,
  digest_date date not null,
  primary key (user_id, digest_date)
);

alter table public.welcome_mail_sent enable row level security;
alter table public.mail_digest_sent enable row level security;

comment on table public.welcome_mail_sent is 'Edge mail-welcome: kullanıcı başına bir kez';
comment on table public.mail_digest_sent is 'Edge mail-reminder-digest: kullanıcı + TR takvim günü başına bir kez';
