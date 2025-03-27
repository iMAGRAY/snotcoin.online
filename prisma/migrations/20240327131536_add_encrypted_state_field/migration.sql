-- Добавляем поле encryptedState в таблицу user_progress
ALTER TABLE "user_progress" ADD COLUMN "encryptedState" TEXT;

-- Добавляем индекс для ускорения поиска по userId
CREATE INDEX IF NOT EXISTS "idx_progress_user_id" ON "user_progress"("userId"); 