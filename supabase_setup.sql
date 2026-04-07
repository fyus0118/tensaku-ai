-- =============================================
-- TENSAKU 完全セットアップ SQL
-- Supabase Dashboard > SQL Editor に貼り付けて実行
-- =============================================

-- 1. pgvector 拡張を有効化
create extension if not exists vector with schema extensions;

-- 2. ユーザープロフィール
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  plan text default 'free' check (plan in ('free', 'pro')),
  stripe_customer_id text,
  stripe_subscription_id text,
  free_reviews_used integer default 0,
  free_reviews_limit integer default 3,
  target_exam text,
  target_exam_date date,
  daily_goal integer default 10,
  current_streak integer default 0,
  longest_streak integer default 0,
  onboarding_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- 自動プロフィール作成トリガー
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. 添削履歴
create table if not exists public.reviews (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  review_type text not null check (review_type in ('essay', 'report')),
  exam_id text,
  document_type text,
  target_university text,
  target_department text,
  exam_type text,
  theme text,
  word_limit integer,
  grade text,
  citation_style text,
  content text not null,
  score integer,
  result text not null,
  created_at timestamptz default now()
);

alter table public.reviews enable row level security;
create policy "Users can view own reviews" on public.reviews for select using (auth.uid() = user_id);
create policy "Users can insert own reviews" on public.reviews for insert with check (auth.uid() = user_id);

create index if not exists reviews_user_id_idx on public.reviews(user_id);
create index if not exists reviews_created_at_idx on public.reviews(created_at desc);

-- 4. AIチャット履歴
create table if not exists public.chat_messages (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  exam_id text not null,
  subject text,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

alter table public.chat_messages enable row level security;
create policy "Users can view own messages" on public.chat_messages for select using (auth.uid() = user_id);
create policy "Users can insert own messages" on public.chat_messages for insert with check (auth.uid() = user_id);

create index if not exists chat_messages_user_exam_idx on public.chat_messages(user_id, exam_id, created_at desc);

-- 5. 練習問題の結果
create table if not exists public.practice_results (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  exam_id text not null,
  subject text,
  topic text,
  question_type text check (question_type in ('multiple_choice', 'essay', 'short_answer')),
  question text not null,
  options jsonb,
  user_answer text,
  correct_answer text,
  is_correct boolean,
  explanation text,
  difficulty integer check (difficulty between 1 and 5),
  created_at timestamptz default now()
);

alter table public.practice_results enable row level security;
create policy "Users can view own results" on public.practice_results for select using (auth.uid() = user_id);
create policy "Users can insert own results" on public.practice_results for insert with check (auth.uid() = user_id);

create index if not exists practice_results_user_exam_idx on public.practice_results(user_id, exam_id, created_at desc);
create index if not exists practice_results_subject_idx on public.practice_results(user_id, exam_id, subject, topic);

-- 6. RAG ドキュメントテーブル
create table if not exists public.documents (
  id uuid default gen_random_uuid() primary key,
  exam_id text not null,
  subject text not null,
  topic text,
  content text not null,
  embedding vector(1024),
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create index if not exists documents_embedding_idx
  on public.documents
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

create index if not exists documents_exam_subject_idx
  on public.documents(exam_id, subject);

alter table public.documents enable row level security;
create policy "Anyone can read documents" on public.documents for select using (true);

-- ベクトル検索 RPC
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

-- 7. フラッシュカード
create table if not exists public.flashcards (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  exam_id text not null,
  subject text not null,
  topic text,
  front text not null,
  back text not null,
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

-- 8. 学習ストリーク
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

-- 9. 弱点トラッキングビュー
create or replace view public.weak_points as
select
  user_id,
  exam_id,
  subject,
  topic,
  count(*) as total_attempts,
  count(*) filter (where is_correct = true) as correct_count,
  round(
    (count(*) filter (where is_correct = true))::numeric / nullif(count(*), 0) * 100,
    1
  ) as accuracy_pct
from public.practice_results
where user_answer is not null
group by user_id, exam_id, subject, topic;

-- 10. 学習セッション
create table if not exists public.study_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  exam_id text not null,
  session_type text not null check (session_type in ('chat', 'practice', 'review', 'flashcard')),
  subject text,
  duration_seconds integer default 0,
  created_at timestamptz default now()
);

alter table public.study_sessions enable row level security;
create policy "Users can view own sessions" on public.study_sessions for select using (auth.uid() = user_id);
create policy "Users can insert own sessions" on public.study_sessions for insert with check (auth.uid() = user_id);
create policy "Users can update own sessions" on public.study_sessions for update using (auth.uid() = user_id);

create index if not exists study_sessions_user_idx on public.study_sessions(user_id, created_at desc);
