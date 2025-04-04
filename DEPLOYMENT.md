# Развертывание SnotCoin Online с Next.js и HTTPS

Эта инструкция поможет настроить запуск вашего Next.js приложения с HTTPS на домене snotcoin.online.

## Подготовка

1. Убедитесь, что на сервере установлены:
   - Node.js (рекомендуется v18.x или выше)
   - npm или yarn
   - Git
   
2. Клонируйте репозиторий:
   ```bash
   git clone <ваш-репозиторий> /path/to/snotcoin.online
   cd /path/to/snotcoin.online
   ```

3. Установите зависимости:
   ```bash
   npm install
   # или
   yarn install
   ```

4. Создайте production сборку:
   ```bash
   npm run build
   # или
   yarn build
   ```

## Настройка SSL сертификатов

Сертификаты должны находиться в директории `/etc/ssl/snotcoin.online/`:
- `private.key` - приватный ключ
- `fullchain.crt` - основной сертификат
- `ca-bundle.crt` - сертификат удостоверяющего центра

Убедитесь, что файлы имеют правильные права доступа:
```bash
sudo chmod 600 /etc/ssl/snotcoin.online/private.key
sudo chmod 644 /etc/ssl/snotcoin.online/fullchain.crt
sudo chmod 644 /etc/ssl/snotcoin.online/ca-bundle.crt
```

## Запуск приложения

### Вариант 1: Запуск с помощью скрипта из package.json

Запуск с правами администратора необходим для использования портов 80 и 443:

```bash
npm run start:prod:ssl
# или
yarn start:prod:ssl
```

### Вариант 2: Использование PM2 (рекомендуется для production)

1. Установите PM2 глобально:
   ```bash
   npm install -g pm2
   ```

2. Создайте конфигурационный файл `ecosystem.config.js`:
   ```javascript
   module.exports = {
     apps: [{
       name: "snotcoin-online",
       script: "server.js",
       env: {
         NODE_ENV: "production",
       },
       log_date_format: "YYYY-MM-DD HH:mm Z",
       error_file: "/var/log/snotcoin/error.log",
       out_file: "/var/log/snotcoin/output.log"
     }]
   };
   ```

3. Создайте директорию для логов:
   ```bash
   sudo mkdir -p /var/log/snotcoin
   sudo chown -R $USER:$USER /var/log/snotcoin
   ```

4. Запустите приложение через PM2:
   ```bash
   sudo pm2 start ecosystem.config.js
   ```

5. Настройте автозапуск при перезагрузке сервера:
   ```bash
   sudo pm2 startup
   sudo pm2 save
   ```

## Настройка NGINX в качестве прокси (опционально)

Если вы хотите использовать NGINX как обратный прокси:

1. Установите NGINX:
   ```bash
   sudo apt update
   sudo apt install nginx
   ```

2. Создайте конфигурационный файл для вашего домена:
   ```bash
   sudo nano /etc/nginx/sites-available/snotcoin.online
   ```

3. Добавьте следующую конфигурацию:
   ```nginx
   server {
       listen 80;
       server_name snotcoin.online www.snotcoin.online;
       
       # Редирект на HTTPS
       location / {
           return 301 https://$host$request_uri;
       }
   }

   server {
       listen 443 ssl;
       server_name snotcoin.online www.snotcoin.online;
       
       ssl_certificate /etc/ssl/snotcoin.online/fullchain.crt;
       ssl_certificate_key /etc/ssl/snotcoin.online/private.key;
       ssl_trusted_certificate /etc/ssl/snotcoin.online/ca-bundle.crt;
       
       # Настройки SSL
       ssl_protocols TLSv1.2 TLSv1.3;
       ssl_prefer_server_ciphers on;
       ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
       
       # Прокси к Next.js приложению, запущенному на порту 3000
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

4. Включите конфигурацию и перезапустите NGINX:
   ```bash
   sudo ln -s /etc/nginx/sites-available/snotcoin.online /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

## Проверка работоспособности

Посетите https://snotcoin.online и убедитесь, что сайт работает корректно и HTTPS настроен правильно.

## Обновление приложения

Для обновления приложения:

```bash
git pull
npm install
npm run build
sudo pm2 restart snotcoin-online
```

## Устранение неполадок

- Если возникают проблемы с доступом к сертификатам, проверьте права доступа и владельца файлов.
- Если сервер не запускается из-за конфликта портов, убедитесь, что порты 80 и 443 не заняты другими процессами.
- Проверьте логи: `pm2 logs` или файлы логов в `/var/log/snotcoin/`.
