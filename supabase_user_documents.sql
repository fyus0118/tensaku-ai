-- =============================================
-- user_documents: ユーザー持ち込み教材テーブル
-- 共有documentsとは完全分離。user_idスコープ
-- =============================================

-- 1. テーブル作成
create table if not exists public.user_documents (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
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

-- 2. インデックス
create index if not exists user_documents_embedding_idx
  on public.user_documents
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

create index if not exists user_documents_user_exam_idx
  on public.user_documents(user_id, exam_id);

create index if not exists user_documents_user_exam_subject_idx
  on public.user_documents(user_id, exam_id, subject);

-- 3. RLS（本人のみアクセス可能）
alter table public.user_documents enable row level security;

create policy "Users can view own documents"
  on public.user_documents for select
  using (auth.uid() = user_id);

create policy "Users can insert own documents"
  on public.user_documents for insert
  with check (auth.uid() = user_id);

create policy "Users can update own documents"
  on public.user_documents for update
  using (auth.uid() = user_id);

create policy "Users can delete own documents"
  on public.user_documents for delete
  using (auth.uid() = user_id);

-- 4. ベクトル検索 RPC（ユーザー専用教材のみ検索）
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
