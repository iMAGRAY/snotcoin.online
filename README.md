# RoyaleCoin.online

Игровой проект с веб-интерфейсом на Next.js 14 и PostgreSQL.

## Структура проекта

```
/app
  /api             - API эндпоинты
  /components      - React компоненты
  /constants       - Константы и начальные значения
  /contexts        - React контексты
  /lib             - Библиотеки и утилиты
  /pages           - Страницы приложения
  /reducers        - Редьюсеры для управления состоянием
  /services        - Сервисы для работы с API и внешними ресурсами
  /types           - TypeScript типы и интерфейсы
  /utils           - Вспомогательные функции
/prisma            - Prisma ORM схема и миграции
/public            - Статические файлы
```

## Структура базы данных

База данных PostgreSQL содержит следующие основные таблицы:

- `users` - Информация о пользователях
- `user_progress` - Прогресс игры пользователя
- `sync_queue` - Очередь синхронизации для отложенных операций
- `progress_history` - История изменений прогресса игры

## Работа с Prisma

### Модели и поля

При работе с Prisma используйте следующие соглашения:

1. Используйте типы из `app/types/prisma.d.ts` для работы с моделями
2. Используйте константы полей из `app/utils/modelHelpers.ts` для исключения опечаток в именах
3. Используйте вспомогательные функции для создания данных:
   - `createUserData()`
   - `createProgressData()`
   - `createSyncQueueData()`
   - `createProgressHistoryData()`

Пример:
```typescript
import { ModelFields, createProgressData } from '../utils/modelHelpers';

// Создание записи прогресса
await prisma.progress.create({
  data: createProgressData({
    user_id: userId,
    game_state: gameState,
    version: 1
  })
});

// Запрос с использованием констант полей
await prisma.progress.findUnique({
  where: { [ModelFields.Progress.user_id]: userId }
});
```

### Обновление схемы

1. Измените `prisma/schema.prisma`
2. Выполните `npx prisma generate` для обновления клиента
3. Обновите типы в `app/types/prisma.d.ts`
4. Обновите константы в `app/utils/modelHelpers.ts`

### Особенности работы с полями

Важно учитывать следующие особенности именования полей:
1. В JavaScript коде используйте имена полей как они определены в схеме Prisma:
   - `user_id` вместо `userId`
   - `game_state` вместо `gameState`
   - `is_compressed` вместо `isCompressed`
   
2. При использовании `$executeRaw` также используйте оригинальные имена полей из базы данных.

## Запуск проекта

```bash
# Установка зависимостей
npm install

# Генерация клиента Prisma
npx prisma generate

# Запуск в режиме разработки
npm run dev

# Сборка для продакшена
npm run build

# Запуск в продакшене
npm start
```

## Переменные окружения

Для правильной работы приложения необходимо настроить следующие переменные окружения:

```bash
# Для авторизации через Discord
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=

# Хостинг
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=

# База данных
DATABASE_URL=

# Серверная часть
API_SECRET=
API_ENDPOINT=
```