-- =============================================
-- user_materials / user_documents
-- 読める教材原本とRAG用チャンクを分離する最新版セットアップSQL
-- =============================================

set search_path to public, extensions;

-- 1. 教材原本テーブル
create table if not exists public.user_materials (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  exam_id text not null,
  subject text not null,
  topic text,
  title text not null default '',
  raw_content text not null,
  normalized_content text not null,
  content_format text not null default 'markdown' check (content_format in ('plain', 'markdown')),
  char_count integer not null default 0,
  chunk_count integer not null default 0,
  status text not null default 'ready' check (status in ('processing', 'ready', 'failed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists user_materials_user_exam_idx
  on public.user_materials(user_id, exam_id, updated_at desc);

create index if not exists user_materials_user_exam_subject_idx
  on public.user_materials(user_id, exam_id, subject);

alter table public.user_materials enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_materials' and policyname = 'Users can view own materials'
  ) then
    create policy "Users can view own materials"
      on public.user_materials for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_materials' and policyname = 'Users can insert own materials'
  ) then
    create policy "Users can insert own materials"
      on public.user_materials for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_materials' and policyname = 'Users can update own materials'
  ) then
    create policy "Users can update own materials"
      on public.user_materials for update
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_materials' and policyname = 'Users can delete own materials'
  ) then
    create policy "Users can delete own materials"
      on public.user_materials for delete
      using (auth.uid() = user_id);
  end if;
end $$;

-- 2. RAG用チャンクテーブル
create table if not exists public.user_documents (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  material_id uuid references public.user_materials(id) on delete cascade,
  exam_id text not null,
  subject text not null,
  topic text,
  title text not null default '',
  content text not null,
  embedding vector(1024),
  chunk_index integer default 0,
  total_chunks integer default 1,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- 3. インデックス
create index if not exists user_documents_embedding_idx
  on public.user_documents
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

create index if not exists user_documents_user_exam_idx
  on public.user_documents(user_id, exam_id);

create index if not exists user_documents_user_exam_subject_idx
  on public.user_documents(user_id, exam_id, subject);

create index if not exists user_documents_material_idx
  on public.user_documents(user_id, material_id, chunk_index);

-- 4. RLS（本人のみアクセス可能）
alter table public.user_documents enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_documents' and policyname = 'Users can view own documents'
  ) then
    create policy "Users can view own documents"
      on public.user_documents for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_documents' and policyname = 'Users can insert own documents'
  ) then
    create policy "Users can insert own documents"
      on public.user_documents for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_documents' and policyname = 'Users can update own documents'
  ) then
    create policy "Users can update own documents"
      on public.user_documents for update
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_documents' and policyname = 'Users can delete own documents'
  ) then
    create policy "Users can delete own documents"
      on public.user_documents for delete
      using (auth.uid() = user_id);
  end if;
end $$;

-- 5. ベクトル検索 RPC（ユーザー専用教材のみ検索）
create or replace function match_user_documents(
  query_embedding vector(1024),
  match_user_id uuid,
  match_exam_id text,
  match_subject text default null,
  match_count int default 5,
  match_threshold float default 0.3
)
returns table (
  id uuid,
  content text,
  subject text,
  topic text,
  title text,
  similarity float,
  metadata jsonb
)
language plpgsql
security definer
as $$
begin
  return query
  select
    d.id,
    d.content,
    d.subject,
    d.topic,
    d.title,
    1 - (d.embedding <=> query_embedding) as similarity,
    d.metadata
  from public.user_documents d
  where d.user_id = match_user_id
    and d.exam_id = match_exam_id
    and (match_subject is null or d.subject = match_subject)
    and d.embedding is not null
    and 1 - (d.embedding <=> query_embedding) > match_threshold
  order by d.embedding <=> query_embedding
  limit match_count;
end;
$$;
