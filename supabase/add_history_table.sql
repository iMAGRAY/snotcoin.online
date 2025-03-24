-- Добавление таблицы для истории прогресса пользователя
CREATE TABLE IF NOT EXISTS public.user_progress_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    progress_id UUID REFERENCES public.user_progress(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    game_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    version INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Создаем индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_user_progress_history_user_id ON public.user_progress_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_history_progress_id ON public.user_progress_history(progress_id);

-- Настройка политик защиты строк (RLS)
ALTER TABLE public.user_progress_history ENABLE ROW LEVEL SECURITY;

-- Предоставляем права
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_progress_history TO authenticated; 