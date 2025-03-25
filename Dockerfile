FROM node:20-alpine AS base

# 1. Установка зависимостей
FROM base AS deps
WORKDIR /app

# Копирование файлов package.json и package-lock.json
COPY package.json package-lock.json* ./

# Установка зависимостей с учетом платформы
RUN npm ci

# 2. Сборка приложения
FROM base AS builder
WORKDIR /app

# Копирование зависимостей из предыдущего этапа
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Установка переменных окружения для nextjs
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production

# Сборка приложения
RUN npm run build

# 3. Финальный образ для production
FROM base AS runner
WORKDIR /app

# Установка переменных окружения для nextjs
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production

# Создание пользователя для запуска nextjs
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Копирование необходимых файлов
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/.env* ./

# Генерация клиента Prisma
RUN npx prisma generate

# Установка прав доступа
USER nextjs

# Экспорт порта
EXPOSE 3000

# Запуск приложения
CMD ["npm", "start"] 