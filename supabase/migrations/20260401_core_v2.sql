-- Core Knowledge v2 マイグレーション
-- 新カラム追加、embeddingインデックス、セマンティック検索RPC

-- 0. pgvector拡張がextensionsスキーマにあるのでパスに追加
SET search_path TO public, extensions;

-- 1. core_knowledge に新カラム追加
ALTER TABLE core_knowledge ADD COLUMN IF NOT EXISTS embedding vector(1024);
ALTER TABLE core_knowledge ADD COLUMN IF NOT EXISTS teach_count int DEFAULT 1;
ALTER TABLE core_knowledge ADD COLUMN IF NOT EXISTS last_taught_at timestamptz DEFAULT now();

-- 2. インデックス追加
CREATE INDEX IF NOT EXISTS idx_core_knowledge_embedding ON core_knowledge
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_core_knowledge_topic ON core_knowledge(user_id, exam_id, subject, topic);

-- 3. UPDATE RLSポリシー追加
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'core_knowledge' AND policyname = 'Users can update own core knowledge'
  ) THEN
    CREATE POLICY "Users can update own core knowledge"
      ON core_knowledge FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 4. teach_diagnostics に新カラム追加
ALTER TABLE teach_diagnostics ADD COLUMN IF NOT EXISTS session_summary jsonb;
ALTER TABLE teach_diagnostics ADD COLUMN IF NOT EXISTS question_level_reached int DEFAULT 1;

-- 5. match_core_knowledge RPC関数（セマンティック検索）
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
AS $func$
BEGIN
  RETURN QUERY
  SELECT
    ck.id,
    ck.subject,
    ck.topic,
    ck.content,
    ck.source,
    ck.understanding_depth,
    ck.confidence::float,
    ck.connections,
    ck.initial_mistake,
    ck.correction_path,
    ck.teach_count,
    (1 - (ck.embedding <=> query_embedding))::float AS similarity
  FROM core_knowledge ck
  WHERE ck.user_id = match_user_id
    AND ck.exam_id = match_exam_id
    AND ck.embedding IS NOT NULL
    AND 1 - (ck.embedding <=> query_embedding) > match_threshold
  ORDER BY ck.embedding <=> query_embedding
  LIMIT match_count;
END;
$func$;
