-- =============================================
-- Core Knowledge テーブル（ユーザーの知識の分身）
-- Prismで検証済みの知識だけが蓄積される
-- =============================================

CREATE TABLE IF NOT EXISTS core_knowledge (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  exam_id text NOT NULL,
  subject text NOT NULL,
  topic text,
  content text NOT NULL,
  source text NOT NULL DEFAULT 'correct',  -- 'correct' | 'verified'
  understanding_depth int DEFAULT 3,        -- 1-6 (What=1, Challenge=6)
  initial_mistake text,                     -- 最初の間違い（修正ループ経由の場合）
  correction_path text,                     -- どう修正したか
  connections text[],                       -- 関連トピック
  confidence float DEFAULT 0.8,             -- 0-1
  embedding vector(1024),                   -- Bedrock Titan Embed v2
  teach_count int DEFAULT 1,                -- 何回教えたか（再学習で増加）
  last_taught_at timestamptz DEFAULT now(), -- 最後に教えた日時
  created_at timestamptz DEFAULT now()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_core_knowledge_user_exam ON core_knowledge(user_id, exam_id);
CREATE INDEX IF NOT EXISTS idx_core_knowledge_subject ON core_knowledge(user_id, exam_id, subject);
CREATE INDEX IF NOT EXISTS idx_core_knowledge_topic ON core_knowledge(user_id, exam_id, subject, topic);
CREATE INDEX IF NOT EXISTS idx_core_knowledge_embedding ON core_knowledge
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- RLS（行レベルセキュリティ）
ALTER TABLE core_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own core knowledge"
  ON core_knowledge FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own core knowledge"
  ON core_knowledge FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own core knowledge"
  ON core_knowledge FOR UPDATE
  USING (auth.uid() = user_id);

-- =============================================
-- Core知識のセマンティック検索用RPC
-- =============================================

CREATE OR REPLACE FUNCTION match_core_knowledge(
  query_embedding vector(1024),
  match_user_id uuid,
  match_exam_id text,
  match_count int DEFAULT 10,
  match_threshold float DEFAULT 0.3
)
RETURNS TABLE (
  id uuid,
  subject text,
  topic text,
  content text,
  source text,
  understanding_depth int,
  confidence float,
  connections text[],
  initial_mistake text,
  correction_path text,
  teach_count int,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ck.id,
    ck.subject,
    ck.topic,
    ck.content,
    ck.source,
    ck.understanding_depth,
    ck.confidence,
    ck.connections,
    ck.initial_mistake,
    ck.correction_path,
    ck.teach_count,
    1 - (ck.embedding <=> query_embedding) AS similarity
  FROM core_knowledge ck
  WHERE ck.user_id = match_user_id
    AND ck.exam_id = match_exam_id
    AND ck.embedding IS NOT NULL
    AND 1 - (ck.embedding <=> query_embedding) > match_threshold
  ORDER BY ck.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- =============================================
-- Teach Diagnostics テーブル（Prismの診断データ）
-- =============================================

CREATE TABLE IF NOT EXISTS teach_diagnostics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  exam_id text NOT NULL,
  subject text NOT NULL,
  topic text,
  session_summary jsonb,  -- セッション全体のサマリー
  question_level_reached int DEFAULT 1,  -- 到達した質問レベル（1-6）
  caught jsonb DEFAULT '[]',
  missed jsonb DEFAULT '[]',
  errors jsonb DEFAULT '[]',
  correct jsonb DEFAULT '[]',
  verified jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teach_diagnostics_user ON teach_diagnostics(user_id, exam_id);

ALTER TABLE teach_diagnostics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own diagnostics"
  ON teach_diagnostics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own diagnostics"
  ON teach_diagnostics FOR INSERT
  WITH CHECK (auth.uid() = user_id);
