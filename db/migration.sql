-- Migration: create book_ai table for storing AI metadata (summary, tags, embeddings)
-- Adjust embedding_vector dimension to match the embedding model you use.
-- This migration enables required extensions, creates table, and adds useful indexes.

-- Enable pgcrypto for gen_random_uuid() if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable pgvector (vector) extension for efficient vector storage & search
-- If you don't plan to use pgvector, you may remove the embedding_vector column and the ivfflat index below.
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the table
CREATE TABLE IF NOT EXISTS book_ai (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL UNIQUE REFERENCES books(id) ON DELETE CASCADE,
  summary text,
  tags text[],
  -- Generic float array fallback for embeddings (portable)
  embedding float8[],
  -- pgvector column for efficient vector search; dimension should match your embedding model
  embedding_vector vector(153),
  updated_at timestamptz DEFAULT now()
);

-- GIN index for tags to speed up tag-based filtering
CREATE INDEX IF NOT EXISTS idx_book_ai_tags_gin ON book_ai USING gin (tags);

-- ivfflat index for vector similarity search (pgvector). Tune 'lists' for your dataset size.
-- Note: ivfflat requires pgvector and works best after populating the table; you may need to ANALYZE / REINDEX.
CREATE INDEX IF NOT EXISTS idx_book_ai_embedding_vector ON book_ai USING ivfflat (embedding_vector) WITH (lists = 100);

-- Optional: small helper to keep updated_at current on upsert/update
CREATE OR REPLACE FUNCTION book_ai_updated_at_trigger()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_book_ai_updated_at ON book_ai;
CREATE TRIGGER trig_book_ai_updated_at
BEFORE INSERT OR UPDATE ON book_ai
FOR EACH ROW EXECUTE FUNCTION book_ai_updated_at_trigger();

-- Notes:
-- - If your environment doesn't support pgvector, you can omit the 'CREATE EXTENSION vector' line,
--   remove the embedding_vector column and the ivfflat index, and rely on the embedding float8[] column.
-- - Ensure the chosen vector dimension (153 here) matches the dimension returned by your embeddings provider.
-- - After bulk-inserting embeddings, run: SELECT vector_io_create_index('book_ai','embedding_vector'); or ANALYZE for best performance depending on pgvector version.
