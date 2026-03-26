-- ユーザープロフィール
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  plan text default 'free' check (plan in ('free', 'pro')),
  stripe_customer_id text,
  stripe_subscription_id text,
  free_reviews_used integer default 0,
  free_reviews_limit integer default 3,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS
alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- 新規ユーザー登録時に自動でprofileを作成
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 添削履歴
create table public.reviews (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  review_type text not null check (review_type in ('essay', 'report')),
  -- 入力情報
  document_type text, -- 小論文/志望理由書/自己推薦書 or 論証型/実験/文献レビュー/書評
  target_university text,
  target_department text,
  exam_type text, -- 一般/AO/推薦/公募
  theme text,
  word_limit integer,
  grade text, -- 学年
  citation_style text, -- APA/MLA等
  content text not null,
  -- 結果
  score integer,
  result text not null,
  -- メタ
  created_at timestamptz default now()
);

alter table public.reviews enable row level security;
create policy "Users can view own reviews" on public.reviews for select using (auth.uid() = user_id);
create policy "Users can insert own reviews" on public.reviews for insert with check (auth.uid() = user_id);

-- インデックス
create index reviews_user_id_idx on public.reviews(user_id);
create index reviews_created_at_idx on public.reviews(created_at desc);
