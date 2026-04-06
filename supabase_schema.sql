-- ═══════════════════════════════════════════════════════
-- SCHEMA: História da Psicologia Moderna — Área de Estudo
-- Execute este SQL no Supabase SQL Editor
-- (Dashboard > SQL Editor > New Query)
-- ═══════════════════════════════════════════════════════

-- 1. Tabela de anotações (uma por capítulo por usuário)
CREATE TABLE IF NOT EXISTS study_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  chapter INTEGER NOT NULL CHECK (chapter BETWEEN 1 AND 16),
  content TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Cada usuário só pode ter uma anotação por capítulo
  UNIQUE(user_id, chapter)
);

-- 2. Tabela de respostas da IA
CREATE TABLE IF NOT EXISTS ai_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  chapter INTEGER NOT NULL CHECK (chapter BETWEEN 1 AND 16),
  response_type TEXT NOT NULL CHECK (response_type IN ('review', 'question', 'flashcards')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabela de flashcards
CREATE TABLE IF NOT EXISTS flashcards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  chapter INTEGER NOT NULL CHECK (chapter BETWEEN 1 AND 16),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════
-- INDEXES para performance
-- ═══════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_study_notes_user 
  ON study_notes(user_id);

CREATE INDEX IF NOT EXISTS idx_study_notes_user_chapter 
  ON study_notes(user_id, chapter);

CREATE INDEX IF NOT EXISTS idx_ai_responses_user_chapter 
  ON ai_responses(user_id, chapter);

CREATE INDEX IF NOT EXISTS idx_flashcards_user_chapter 
  ON flashcards(user_id, chapter);

-- ═══════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- Cada usuário só vê/edita seus próprios dados
-- ═══════════════════════════════════════════════════════

-- study_notes
ALTER TABLE study_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notes"
  ON study_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes"
  ON study_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes"
  ON study_notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes"
  ON study_notes FOR DELETE
  USING (auth.uid() = user_id);

-- ai_responses
ALTER TABLE ai_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own AI responses"
  ON ai_responses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own AI responses"
  ON ai_responses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own AI responses"
  ON ai_responses FOR DELETE
  USING (auth.uid() = user_id);

-- flashcards
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own flashcards"
  ON flashcards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own flashcards"
  ON flashcards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own flashcards"
  ON flashcards FOR DELETE
  USING (auth.uid() = user_id);


-- ═══════════════════════════════════════════════════════
-- PRONTO! Agora vá em Authentication > Settings e:
-- 1. Desative "Confirm email" se quiser login imediato
-- 2. Copie a URL e anon key de Settings > API
-- ═══════════════════════════════════════════════════════
