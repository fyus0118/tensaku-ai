-- =============================================
-- TENSAKU RAG: pgvector ベクトル検索基盤
-- 実行前に Supabase Dashboard > Database > Extensions で vector を有効化
-- =============================================

-- pgvector拡張を有効化
create extension if not exists vector with schema extensions;

-- ドキュメントテーブル（RAGのナレッジベース）
create table if not exists public.documents (
  id uuid default gen_random_uuid() primary key,
  exam_id text not null,
  subject text not null,
  topic text,
  content text not null,
  embedding vector(1024), -- Voyage AI voyage-3-lite は1024次元
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- HNSWインデックス（高速近似最近傍探索）
create index if not exists documents_embedding_idx
  on public.documents
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- 試験ID + 科目での絞り込み用インデックス
create index if not exists documents_exam_subject_idx
  on public.documents(exam_id, subject);

-- RLS
alter table public.documents enable row level security;
-- ドキュメントは全ユーザーが読めるが、書き込みはサービスロール経由のみ
create policy "Anyone can read documents" on public.documents for select using (true);

-- ベクトル類似度検索のRPC関数
create or replace function match_documents(
  query_embedding vector(1024),
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
  similarity float,
  metadata jsonb
)
language plpgsql
as $$
begin
  return query
  select
    d.id,
    d.content,
    d.subject,
    d.topic,
    1 - (d.embedding <=> query_embedding) as similarity,
    d.metadata
  from public.documents d
  where d.exam_id = match_exam_id
    and (match_subject is null or d.subject = match_subject)
    and 1 - (d.embedding <=> query_embedding) > match_threshold
  order by d.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- フラッシュカードテーブル
create table if not exists public.flashcards (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  exam_id text not null,
  subject text not null,
  topic text,
  front text not null, -- 問題面
  back text not null,  -- 解答面
  -- SM-2 スケジューリングパラメータ
  ease_factor real default 2.5,
  interval_days integer default 0,
  repetitions integer default 0,
  next_review_at timestamptz default now(),
  last_reviewed_at timestamptz,
  created_at timestamptz default now()
);

alter table public.flashcards enable row level security;
create policy "Users can view own flashcards" on public.flashcards for select using (auth.uid() = user_id);
create policy "Users can insert own flashcards" on public.flashcards for insert with check (auth.uid() = user_id);
create policy "Users can update own flashcards" on public.flashcards for update using (auth.uid() = user_id);
create policy "Users can delete own flashcards" on public.flashcards for delete using (auth.uid() = user_id);

create index if not exists flashcards_user_review_idx on public.flashcards(user_id, next_review_at);
create index if not exists flashcards_user_exam_idx on public.flashcards(user_id, exam_id);

-- 学習ストリーク用テーブル
create table if not exists public.study_streaks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  study_date date not null,
  questions_answered integer default 0,
  correct_answers integer default 0,
  study_minutes integer default 0,
  created_at timestamptz default now(),
  unique(user_id, study_date)
);

alter table public.study_streaks enable row level security;
create policy "Users can view own streaks" on public.study_streaks for select using (auth.uid() = user_id);
create policy "Users can insert own streaks" on public.study_streaks for insert with check (auth.uid() = user_id);
create policy "Users can update own streaks" on public.study_streaks for update using (auth.uid() = user_id);

create index if not exists study_streaks_user_date_idx on public.study_streaks(user_id, study_date desc);

-- プロフィールに追加カラム
alter table public.profiles add column if not exists daily_goal integer default 10;
alter table public.profiles add column if not exists current_streak integer default 0;
alter table public.profiles add column if not exists longest_streak integer default 0;
alter table public.profiles add column if not exists onboarding_completed boolean default false;
