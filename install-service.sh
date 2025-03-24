#!/bin/bash

# Переход в директорию приложения
cd "$(dirname "$0")"

# Копируем файл сервиса в systemd
sudo cp snotcoin-nextjs.service /etc/systemd/system/

# Перезагружаем systemd для обнаружения нового сервиса
sudo systemctl daemon-reload

# Включаем и запускаем сервис
sudo systemctl enable snotcoin-nextjs
sudo systemctl start snotcoin-nextjs

# Проверяем статус
sudo systemctl status snotcoin-nextjs

echo "Сервис установлен и запущен. Для проверки логов используйте: journalctl -u snotcoin-nextjs -f" 