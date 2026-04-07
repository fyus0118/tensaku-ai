-- User Materials migration
-- 読める教材原本(user_materials) と検索用チャンク(user_documents) を分離

SET search_path TO public, extensions;

CREATE TABLE IF NOT EXISTS public.user_materials (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  exam_id text NOT NULL,
  subject text NOT NULL,
  topic text,
  title text NOT NULL DEFAULT '',
  raw_content text NOT NULL,
  normalized_content text NOT NULL,
  content_format text NOT NULL DEFAULT 'markdown' CHECK (content_format IN ('plain', 'markdown')),
  char_count integer NOT NULL DEFAULT 0,
  chunk_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('processing', 'ready', 'failed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_materials_user_exam_idx
  ON public.user_materials(user_id, exam_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS user_materials_user_exam_subject_idx
  ON public.user_materials(user_id, exam_id, subject);

ALTER TABLE public.user_materials ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_materials' AND policyname = 'Users can view own materials'
  ) THEN
    CREATE POLICY "Users can view own materials"
      ON public.user_materials FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_materials' AND policyname = 'Users can insert own materials'
  ) THEN
    CREATE POLICY "Users can insert own materials"
      ON public.user_materials FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_materials' AND policyname = 'Users can update own materials'
  ) THEN
    CREATE POLICY "Users can update own materials"
      ON public.user_materials FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_materials' AND policyname = 'Users can delete own materials'
  ) THEN
    CREATE POLICY "Users can delete own materials"
      ON public.user_materials FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE public.user_documents
  ADD COLUMN IF NOT EXISTS material_id uuid REFERENCES public.user_materials(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS user_documents_material_idx
  ON public.user_documents(user_id, material_id, chunk_index);

WITH grouped AS (
  SELECT
    user_id,
    exam_id,
    subject,
    topic,
    title,
    created_at,
    string_agg(content, E'\n\n' ORDER BY chunk_index) AS full_content,
    COUNT(*)::int AS chunk_count
  FROM public.user_documents
  GROUP BY user_id, exam_id, subject, topic, title, created_at
)
INSERT INTO public.user_materials (
  user_id,
  exam_id,
  subject,
  topic,
  title,
  raw_content,
  normalized_content,
  char_count,
  chunk_count,
  status,
  created_at,
  updated_at
)
SELECT
  grouped.user_id,
  grouped.exam_id,
  grouped.subject,
  grouped.topic,
  grouped.title,
  grouped.full_content,
  grouped.full_content,
  char_length(grouped.full_content),
  grouped.chunk_count,
  'ready',
  grouped.created_at,
  grouped.created_at
FROM grouped
LEFT JOIN public.user_materials existing
  ON existing.user_id = grouped.user_id
  AND existing.exam_id = grouped.exam_id
  AND existing.subject = grouped.subject
  AND existing.topic IS NOT DISTINCT FROM grouped.topic
  AND existing.title = grouped.title
  AND existing.created_at = grouped.created_at
WHERE existing.id IS NULL;

UPDATE public.user_documents AS documents
SET
  material_id = materials.id,
  metadata = COALESCE(documents.metadata, '{}'::jsonb) || jsonb_build_object(
    'source', 'user_material',
    'materialId', materials.id,
    'title', documents.title,
    'chunkIndex', COALESCE(documents.chunk_index, 0),
    'totalChunks', COALESCE(documents.total_chunks, 1)
  )
FROM public.user_materials AS materials
WHERE documents.user_id = materials.user_id
  AND documents.exam_id = materials.exam_id
  AND documents.subject = materials.subject
  AND documents.topic IS NOT DISTINCT FROM materials.topic
  AND documents.title = materials.title
  AND documents.created_at = materials.created_at
  AND (
    documents.material_id IS DISTINCT FROM materials.id
    OR documents.metadata IS NULL
  );
