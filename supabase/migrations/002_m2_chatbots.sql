-- ============================================================
-- EmbedAI — Supabase SQL Setup for Module 2 (Dashboard)
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Create chatbots table
CREATE TABLE IF NOT EXISTS public.chatbots (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name            text          NOT NULL,
  description     text,
  welcome_message text          NOT NULL DEFAULT 'Hi! How can I help you?',
  system_prompt   text,
  theme           jsonb         NOT NULL DEFAULT '{}',
  created_at      timestamptz   NOT NULL DEFAULT now()
);

-- 2. Enable Row Level Security
ALTER TABLE public.chatbots ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies — users can only access their own chatbots
CREATE POLICY "Users can view own chatbots"
  ON public.chatbots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chatbots"
  ON public.chatbots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chatbots"
  ON public.chatbots FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chatbots"
  ON public.chatbots FOR DELETE
  USING (auth.uid() = user_id);
