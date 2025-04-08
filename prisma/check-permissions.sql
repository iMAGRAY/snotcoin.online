-- Проверка прав доступа к таблицам
SELECT grantee, table_name, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
AND table_name IN ('users', 'user_progress', 'sync_queue', 'progress_history')
AND grantee = 'admin'; 