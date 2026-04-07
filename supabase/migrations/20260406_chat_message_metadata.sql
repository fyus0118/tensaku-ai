-- Chat message metadata for references

SET search_path TO public, extensions;

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
