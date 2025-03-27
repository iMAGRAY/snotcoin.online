-- Добавление поля metadata в таблицу users
ALTER TABLE "users" ADD COLUMN "metadata" JSONB;

-- Удаление таблицы game_states, если она существует
DROP TABLE IF EXISTS "game_states"; 