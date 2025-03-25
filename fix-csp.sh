#!/bin/bash

# Скрипт для проверки и исправления проблемы с дублированием CSP заголовков в Nginx

# Проверка наличия файла конфигурации Nginx
if [ -f /etc/nginx/sites-available/default ]; then
  NGINX_CONFIG="/etc/nginx/sites-available/default"
elif [ -f /etc/nginx/conf.d/default.conf ]; then
  NGINX_CONFIG="/etc/nginx/conf.d/default.conf"
else
  echo "Не найден файл конфигурации Nginx."
  exit 1
fi

# Проверка наличия повторяющихся CSP заголовков
if grep -q "Content-Security-Policy" "$NGINX_CONFIG"; then
  echo "Найдены настройки CSP в конфигурации Nginx."
  
  # Создаем резервную копию
  cp "$NGINX_CONFIG" "${NGINX_CONFIG}.backup"
  echo "Создана резервная копия конфигурации: ${NGINX_CONFIG}.backup"
  
  # Удаляем строки с CSP заголовками
  sed -i '/Content-Security-Policy/d' "$NGINX_CONFIG"
  echo "Удалены настройки CSP из конфигурации Nginx."
  
  # Добавляем правильный CSP заголовок
  sed -i '/server_name/a \    add_header Content-Security-Policy "default-src '\''self'\''; frame-ancestors *; script-src '\''self'\'' '\''unsafe-inline'\'' '\''unsafe-eval'\'' https://*.kaspersky-labs.com https://gc.kis.v2.scr.kaspersky-labs.com; style-src '\''self'\'' '\''unsafe-inline'\''; img-src '\''self'\'' data: https:; connect-src '\''self'\'' https:; font-src '\''self'\'' data:;"' "$NGINX_CONFIG"
  sed -i '/server_name/a \    add_header X-Frame-Options "ALLOWALL";' "$NGINX_CONFIG"
  echo "Добавлены новые настройки CSP."
  
  # Перезапускаем Nginx
  echo "Проверка конфигурации Nginx..."
  nginx -t
  
  if [ $? -eq 0 ]; then
    echo "Конфигурация успешно проверена. Перезапуск Nginx..."
    systemctl restart nginx
    echo "Nginx перезапущен."
  else
    echo "Ошибка в конфигурации Nginx. Восстанавливаем резервную копию..."
    cp "${NGINX_CONFIG}.backup" "$NGINX_CONFIG"
    echo "Резервная копия восстановлена."
  fi
else
  echo "Настройки CSP не найдены в конфигурации Nginx."
fi

echo "Готово! Проверьте правильность работы CSP." 