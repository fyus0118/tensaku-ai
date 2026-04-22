create table if not exists error_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_id text not null,
  topic text,
  message text not null,
  status text not null default 'open' check (status in ('open', 'fixed', 'dismissed')),
  created_at timestamptz not null default now()
);

create index idx_error_reports_status on error_reports (status, created_at desc);

alter table error_reports enable row level security;

create policy "users_insert_own" on error_reports for insert with check (auth.uid() = user_id);
create policy "service_all" on error_reports for all using (auth.role() = 'service_role');
