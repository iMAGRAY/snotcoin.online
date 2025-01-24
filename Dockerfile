FROM node:18-alpine  # Используйте LTS-версию

WORKDIR /app

# Копируем зависимости отдельно для кеширования
COPY package.json package-lock.json* ./  # Звездочка на случай отсутствия lock-файла

# Устанавливаем зависимости с очисткой кеша
RUN npm install --legacy-peer-dep && \
    npm cache clean --force

# Копируем исходный код
COPY . .

# Дополнительные шаги (если нужно)
RUN npm run build

CMD ["npm", "start"]