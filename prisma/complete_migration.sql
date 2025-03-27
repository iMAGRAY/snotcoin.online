-- Удаление таблицы game_states, если она существует
DROP TABLE IF EXISTS "game_states";

-- Добавление поля metadata в таблицу users, если оно не существует
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users'
        AND column_name = 'metadata'
    ) THEN
        ALTER TABLE "users" ADD COLUMN "metadata" JSONB;
    END IF;
END
$$; 