create table if not exists material_illustrations (
  id uuid primary key default gen_random_uuid(),
  exam_id text not null,
  subject text not null,
  topic text not null,
  image_url text not null,
  caption text,
  position text not null default 'after_heading' check (position in ('before_content', 'after_heading', 'after_content', 'inline')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_illustrations_lookup on material_illustrations (exam_id, subject, topic);

alter table material_illustrations enable row level security;

create policy "illustrations_public_read" on material_illustrations
  for select using (true);

create policy "illustrations_service_write" on material_illustrations
  for all using (auth.role() = 'service_role');
