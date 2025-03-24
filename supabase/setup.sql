-- Включаем необходимые расширения
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Схема для публичных таблиц
CREATE SCHEMA IF NOT EXISTS public;

-- Таблица пользователей
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id BIGINT UNIQUE NOT NULL,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    jwt_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Создаем индекс для быстрого поиска по telegram_id
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON public.users(telegram_id);

-- Таблица прогресса пользователей
CREATE TABLE IF NOT EXISTS public.user_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    game_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    version INTEGER DEFAULT 1,
    UNIQUE (user_id)
);

-- Создаем индекс для быстрого поиска по user_id
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON public.user_progress(user_id);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для таблицы users
CREATE TRIGGER set_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Триггер для таблицы user_progress
CREATE TRIGGER set_user_progress_updated_at
BEFORE UPDATE ON public.user_progress
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Настройка политик защиты строк (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

-- Политика для таблицы users - пользователи могут видеть только свои записи
CREATE POLICY users_select_policy ON public.users
    FOR SELECT USING (
        auth.uid() = id OR
        telegram_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'telegram_id')::BIGINT
    );

-- Политики для таблицы user_progress
CREATE POLICY user_progress_select_policy ON public.user_progress
    FOR SELECT USING (
        user_id = auth.uid() OR
        user_id IN (
            SELECT id FROM public.users 
            WHERE telegram_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'telegram_id')::BIGINT
        )
    );

-- Функция для обновления версии при изменении game_state
CREATE OR REPLACE FUNCTION increment_progress_version()
RETURNS TRIGGER AS $$
BEGIN
    -- Увеличиваем версию только если game_state изменился
    IF OLD.game_state <> NEW.game_state THEN
        NEW.version = OLD.version + 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для инкрементации версии
CREATE TRIGGER increment_version_on_update
BEFORE UPDATE ON public.user_progress
FOR EACH ROW
EXECUTE FUNCTION increment_progress_version();

-- Функция для создания нового пользователя с пустым прогрессом
CREATE OR REPLACE FUNCTION create_user_with_progress(
    p_telegram_id BIGINT,
    p_username TEXT,
    p_first_name TEXT,
    p_last_name TEXT,
    p_initial_state JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Пытаемся найти существующего пользователя
    SELECT id INTO v_user_id FROM public.users WHERE telegram_id = p_telegram_id;
    
    -- Если пользователь не существует, создаем нового
    IF v_user_id IS NULL THEN
        INSERT INTO public.users (telegram_id, username, first_name, last_name)
        VALUES (p_telegram_id, p_username, p_first_name, p_last_name)
        RETURNING id INTO v_user_id;
        
        -- Создаем начальный прогресс для нового пользователя
        INSERT INTO public.user_progress (user_id, game_state) 
        VALUES (v_user_id, p_initial_state);
    ELSE
        -- Обновляем существующего пользователя
        UPDATE public.users 
        SET username = COALESCE(p_username, username),
            first_name = COALESCE(p_first_name, first_name),
            last_name = COALESCE(p_last_name, last_name),
            updated_at = now()
        WHERE id = v_user_id;
    END IF;
    
    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql;

-- Создаем хранимую процедуру для полной замены game_state
CREATE OR REPLACE FUNCTION replace_game_state(
    p_telegram_id BIGINT,
    p_game_state JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_updated_game_state JSONB;
BEGIN
    -- Находим ID пользователя по telegram_id
    SELECT id INTO v_user_id FROM public.users WHERE telegram_id = p_telegram_id;
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User with telegram_id % not found', p_telegram_id;
    END IF;
    
    -- Проверяем, есть ли запись прогресса
    IF EXISTS (SELECT 1 FROM public.user_progress WHERE user_id = v_user_id) THEN
        -- Обновляем существующую запись
        UPDATE public.user_progress 
        SET game_state = p_game_state,
            updated_at = now()
        WHERE user_id = v_user_id
        RETURNING game_state INTO v_updated_game_state;
    ELSE
        -- Создаем новую запись прогресса
        INSERT INTO public.user_progress (user_id, game_state) 
        VALUES (v_user_id, p_game_state)
        RETURNING game_state INTO v_updated_game_state;
    END IF;
    
    RETURN v_updated_game_state;
END;
$$ LANGUAGE plpgsql;

-- Функция для обработки Telegram-аутентификации с учетом рассинхронизации данных
CREATE OR REPLACE FUNCTION handle_telegram_user_auth(
    p_telegram_id BIGINT,
    p_username TEXT,
    p_first_name TEXT,
    p_last_name TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_result JSONB;
    v_auth_exists BOOLEAN;
BEGIN
    -- Проверяем существование пользователя в таблице users
    SELECT id INTO v_user_id FROM public.users WHERE telegram_id = p_telegram_id;
    
    -- Проверяем существование email в auth.users
    SELECT EXISTS(
        SELECT 1 FROM auth.users 
        WHERE email = p_telegram_id || '@telegram.user'
    ) INTO v_auth_exists;
    
    -- Если пользователь не существует в таблице users
    IF v_user_id IS NULL THEN
        -- Создаем запись в таблице users
        INSERT INTO public.users (telegram_id, username, first_name, last_name)
        VALUES (p_telegram_id, p_username, p_first_name, p_last_name)
        RETURNING id INTO v_user_id;
        
        -- Создаем начальный прогресс
        INSERT INTO public.user_progress (user_id, game_state, version) 
        VALUES (v_user_id, '{"inventory": {"snot": 0, "snotCoins": 0}}', 1);
        
        -- Если пользователь уже существует в auth, связываем его с новой записью
        IF v_auth_exists THEN
            -- Можно обновить метаданные auth пользователя, чтобы связать с новым user_id
            -- Эта часть кода будет зависеть от вашей структуры Auth
            NULL; -- Заглушка
        END IF;
    END IF;
    
    -- Генерируем новый токен
    UPDATE public.users 
    SET jwt_token = encode(gen_random_bytes(32), 'hex'),
        updated_at = now()
    WHERE id = v_user_id
    RETURNING jsonb_build_object(
        'id', id,
        'telegram_id', telegram_id,
        'username', username,
        'first_name', first_name,
        'last_name', last_name,
        'token', jwt_token
    ) INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Предоставляем необходимые права аутентифицированным пользователям
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_progress TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_with_progress TO authenticated;
GRANT EXECUTE ON FUNCTION replace_game_state TO authenticated;
GRANT EXECUTE ON FUNCTION handle_telegram_user_auth TO authenticated;