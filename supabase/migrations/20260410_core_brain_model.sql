-- Core Brain Model マイグレーション
-- 人間の頭脳を再現するための忘却・再構成・干渉・校正・チャンキング機能

SET search_path TO public, extensions;

-- 1. core_knowledge に新カラム追加
ALTER TABLE core_knowledge ADD COLUMN IF NOT EXISTS stability float DEFAULT 3.0;
ALTER TABLE core_knowledge ADD COLUMN IF NOT EXISTS retrieval_count int DEFAULT 0;
ALTER TABLE core_knowledge ADD COLUMN IF NOT EXISTS last_retrieved_at timestamptz;
ALTER TABLE core_knowledge ADD COLUMN IF NOT EXISTS retrieval_success_count int DEFAULT 0;
ALTER TABLE core_knowledge ADD COLUMN IF NOT EXISTS retrieval_fail_count int DEFAULT 0;
ALTER TABLE core_knowledge ADD COLUMN IF NOT EXISTS interference_count int DEFAULT 0;
ALTER TABLE core_knowledge ADD COLUMN IF NOT EXISTS mistake_embedding vector(1024);
ALTER TABLE core_knowledge ADD COLUMN IF NOT EXISTS operation_evidence jsonb DEFAULT '{"recognized":false,"reproduced":false,"explained":false,"applied":false,"integrated":false}';
ALTER TABLE core_knowledge ADD COLUMN IF NOT EXISTS prerequisite_ids uuid[];
ALTER TABLE core_knowledge ADD COLUMN IF NOT EXISTS connection_strengths jsonb DEFAULT '{}';
ALTER TABLE core_knowledge ADD COLUMN IF NOT EXISTS retrieval_contexts jsonb DEFAULT '[]';
ALTER TABLE core_knowledge ADD COLUMN IF NOT EXISTS rag_verified_at timestamptz;
ALTER TABLE core_knowledge ADD COLUMN IF NOT EXISTS rag_verification_status text DEFAULT 'unverified';

-- 2. knowledge_chunks テーブル (知識の統合/チャンキング)
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_id text NOT NULL,
  subject text NOT NULL,
  label text NOT NULL,
  member_ids uuid[] NOT NULL,
  abstraction_level int DEFAULT 2,
  synthesis_content text NOT NULL,
  embedding vector(1024),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_user_exam ON knowledge_chunks(user_id, exam_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding ON knowledge_chunks
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- 3. RLSポリシー for knowledge_chunks
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own chunks"
  ON knowledge_chunks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chunks"
  ON knowledge_chunks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chunks"
  ON knowledge_chunks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chunks"
  ON knowledge_chunks FOR DELETE
  USING (auth.uid() = user_id);

-- 4. match_core_knowledge RPCを更新（新カラムを返す）
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
  stability float,
  retrieval_count int,
  last_retrieved_at timestamptz,
  retrieval_success_count int,
  retrieval_fail_count int,
  interference_count int,
  operation_evidence jsonb,
  prerequisite_ids uuid[],
  connection_strengths jsonb,
  retrieval_contexts jsonb,
  rag_verification_status text,
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
    ck.stability::float,
    ck.retrieval_count,
    ck.last_retrieved_at,
    ck.retrieval_success_count,
    ck.retrieval_fail_count,
    ck.interference_count,
    ck.operation_evidence,
    ck.prerequisite_ids,
    ck.connection_strengths,
    ck.retrieval_contexts,
    ck.rag_verification_status,
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
