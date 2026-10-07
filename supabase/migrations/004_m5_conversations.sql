-- ============================================================
-- EmbedAI — Supabase SQL for Module 5 (RAG & Chat Engine)
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id   uuid         NOT NULL REFERENCES public.chatbots(id) ON DELETE CASCADE,
  session_id   text,
  created_at   timestamptz  NOT NULL DEFAULT now()
);

-- 2. messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid         NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role             text         NOT NULL CHECK (role IN ('user', 'assistant')),
  content          text         NOT NULL,
  created_at       timestamptz  NOT NULL DEFAULT now()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_chatbot_id
  ON public.conversations(chatbot_id);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
  ON public.messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_messages_created_at
  ON public.messages(created_at);

-- 4. RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages      ENABLE ROW LEVEL SECURITY;

-- conversations: owner access via chatbot ownership
CREATE POLICY "Users can view own conversations"
  ON public.conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chatbots
      WHERE chatbots.id = conversations.chatbot_id
        AND chatbots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own conversations"
  ON public.conversations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.chatbots
      WHERE chatbots.id = conversations.chatbot_id
        AND chatbots.user_id = auth.uid()
    )
  );

-- messages: owner access via conversation → chatbot
CREATE POLICY "Users can view own messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
        JOIN public.chatbots b ON b.id = c.chatbot_id
      WHERE c.id = messages.conversation_id
        AND b.user_id = auth.uid()
    )
  );
