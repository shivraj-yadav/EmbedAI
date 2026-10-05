-- ============================================================
-- EmbedAI — Supabase SQL Setup for Module 4 (Knowledge Base & Vector Store)
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Enable the pgvector extension to work with embedding vectors
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create documents table (stores raw file metadata & status)
CREATE TABLE IF NOT EXISTS public.documents (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id        uuid          NOT NULL REFERENCES public.chatbots(id) ON DELETE CASCADE,
  filename          text          NOT NULL,
  file_url          text          NOT NULL,
  imagekit_file_id  text,
  status            text          NOT NULL DEFAULT 'uploading' 
                                  CHECK (status IN ('uploading', 'processing', 'ready', 'failed')),
  error_message     text,
  file_size_bytes   bigint,
  chunk_count       integer       DEFAULT 0,
  created_at        timestamptz   NOT NULL DEFAULT now()
);

-- 3. Create document_chunks table (stores 768-dim vector embeddings from Gemini text-embedding-004)
CREATE TABLE IF NOT EXISTS public.document_chunks (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     uuid          NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  chatbot_id      uuid          NOT NULL REFERENCES public.chatbots(id) ON DELETE CASCADE,
  content         text          NOT NULL,
  embedding       vector(768)   NOT NULL,
  chunk_index     integer       NOT NULL,
  metadata        jsonb         DEFAULT '{}'::jsonb,
  created_at      timestamptz   NOT NULL DEFAULT now()
);

-- 4. Fast Foreign Key Indexes
CREATE INDEX IF NOT EXISTS idx_documents_chatbot_id 
  ON public.documents(chatbot_id);

CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id 
  ON public.document_chunks(document_id);

CREATE INDEX IF NOT EXISTS idx_document_chunks_chatbot_id 
  ON public.document_chunks(chatbot_id);

-- 5. Database Vector Index: HNSW (Hierarchical Navigable Small World)
-- Uses cosine similarity (vector_cosine_ops) for ultra-fast approximate nearest neighbor retrieval
CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx
  ON public.document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 6. Row Level Security (RLS)
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

-- Documents RLS policies (user owns parent chatbot)
CREATE POLICY "Users can view own documents"
  ON public.documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chatbots
      WHERE chatbots.id = documents.chatbot_id
        AND chatbots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own documents"
  ON public.documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chatbots
      WHERE chatbots.id = documents.chatbot_id
        AND chatbots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own documents"
  ON public.documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.chatbots
      WHERE chatbots.id = documents.chatbot_id
        AND chatbots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own documents"
  ON public.documents FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.chatbots
      WHERE chatbots.id = documents.chatbot_id
        AND chatbots.user_id = auth.uid()
    )
  );

-- Document Chunks RLS policies
CREATE POLICY "Users can view own document chunks"
  ON public.document_chunks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chatbots
      WHERE chatbots.id = document_chunks.chatbot_id
        AND chatbots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own document chunks"
  ON public.document_chunks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.chatbots
      WHERE chatbots.id = document_chunks.chatbot_id
        AND chatbots.user_id = auth.uid()
    )
  );

-- 7. Vector Similarity Search Function (for RAG in Module 5)
-- Enables calling supabase.rpc('match_chunks', { ... })
CREATE OR REPLACE FUNCTION match_chunks(
  filter_chatbot_id uuid,
  query_embedding vector(768),
  match_count int DEFAULT 5,
  similarity_threshold float DEFAULT 0.2
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM public.document_chunks dc
  WHERE dc.chatbot_id = filter_chatbot_id
    AND 1 - (dc.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
