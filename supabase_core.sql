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
  created_at timestamptz DEFAULT now()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_core_knowledge_user_exam ON core_knowledge(user_id, exam_id);
CREATE INDEX IF NOT EXISTS idx_core_knowledge_subject ON core_knowledge(user_id, exam_id, subject);

-- RLS（行レベルセキュリティ）
ALTER TABLE core_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own core knowledge"
  ON core_knowledge FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own core knowledge"
  ON core_knowledge FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =============================================
-- Teach Diagnostics テーブル（Prismの診断データ）
-- =============================================

CREATE TABLE IF NOT EXISTS teach_diagnostics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  exam_id text NOT NULL,
  subject text NOT NULL,
  topic text,
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
