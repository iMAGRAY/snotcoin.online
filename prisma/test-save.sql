-- Создаем тестового пользователя
INSERT INTO users (id, farcaster_fid, farcaster_username, created_at, updated_at)
VALUES ('test_user', 'test_fid', 'test_username', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Создаем тестовый прогресс
INSERT INTO user_progress (id, user_id, game_state, version, created_at, updated_at, is_compressed)
VALUES ('test_progress', 'test_user', '{"test": true}', 1, NOW(), NOW(), false)
ON CONFLICT (user_id) DO NOTHING;

-- Проверяем, что данные сохранились
SELECT * FROM users WHERE id = 'test_user';
SELECT * FROM user_progress WHERE user_id = 'test_user'; 