-- =============================================
-- TENSAKU v2: 総合学習プラットフォーム スキーマ拡張
-- 既存の profiles, reviews テーブルはそのまま維持
-- =============================================

-- プロフィールに目標試験カラム追加
alter table public.profiles add column if not exists target_exam text;
alter table public.profiles add column if not exists target_exam_date date;

-- 学習セッション
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

-- AIチャット履歴
create table if not exists public.chat_messages (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  exam_id text not null,
  subject text,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

alter table public.chat_messages enable row level security;
create policy "Users can view own messages" on public.chat_messages for select using (auth.uid() = user_id);
create policy "Users can insert own messages" on public.chat_messages for insert with check (auth.uid() = user_id);

-- 練習問題の結果
create table if not exists public.practice_results (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  exam_id text not null,
  subject text,
  topic text,
  question_type text check (question_type in ('multiple_choice', 'essay', 'short_answer')),
  question text not null,
  options jsonb, -- 選択肢 (multiple_choice用)
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

-- 弱点トラッキング（集計用ビュー）
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

-- インデックス
create index if not exists study_sessions_user_idx on public.study_sessions(user_id, created_at desc);
create index if not exists chat_messages_user_exam_idx on public.chat_messages(user_id, exam_id, created_at desc);
create index if not exists practice_results_user_exam_idx on public.practice_results(user_id, exam_id, created_at desc);
create index if not exists practice_results_subject_idx on public.practice_results(user_id, exam_id, subject, topic);

-- reviews テーブルに exam_id カラム追加（既存の入試添削と統合）
alter table public.reviews add column if not exists exam_id text;
