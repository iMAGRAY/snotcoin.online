# Развертывание KingCoin Online с Next.js и HTTPS

Эта инструкция поможет настроить запуск вашего Next.js приложения с HTTPS на домене kingcoin.online.

## Подготовка сервера

1. Запустите чистый сервер Ubuntu 22.04 LTS.

2. Обновите систему и установите необходимые пакеты:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx certbot python3-certbot-nginx git nodejs npm
```

3. Установите Node.js 20.x (если не установлен):

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

4. Установите PM2 для управления Node.js процессами:

```bash
sudo npm install -g pm2
```

5. Клонируйте репозиторий и перейдите в него:

```bash
git clone <ваш-репозиторий> /path/to/kingcoin.online
cd /path/to/kingcoin.online
```

6. Установите зависимости и соберите проект:

```bash
npm install
npm run build
```

## Настройка HTTPS с SSL сертификатом

### Вариант 1: Бесплатный SSL сертификат от Let's Encrypt

1. Настройте DNS для вашего домена, чтобы он указывал на IP-адрес вашего сервера.

2. Запустите certbot для получения SSL сертификата:

```bash
sudo certbot --nginx -d kingcoin.online -d www.kingcoin.online
```

### Вариант 2: Использование собственного SSL сертификата

Сертификаты должны находиться в директории `/etc/ssl/kingcoin.online/`:

1. Создайте директорию:

```bash
sudo mkdir -p /etc/ssl/kingcoin.online
```

2. Скопируйте сертификаты:

```bash
sudo cp /path/to/your/cert.crt /etc/ssl/kingcoin.online/fullchain.crt
sudo cp /path/to/your/private.key /etc/ssl/kingcoin.online/private.key
sudo cp /path/to/your/ca-bundle.crt /etc/ssl/kingcoin.online/ca-bundle.crt
```

3. Настройте права доступа:

```bash
sudo chmod 600 /etc/ssl/kingcoin.online/private.key
sudo chmod 644 /etc/ssl/kingcoin.online/fullchain.crt
sudo chmod 644 /etc/ssl/kingcoin.online/ca-bundle.crt
```

## Настройка PM2 для запуска приложения

1. Создайте файл `ecosystem.config.js` в корне проекта:

```javascript
module.exports = {
  apps: [{
    name: "kingcoin-online",
    script: "server.js",
    env: {
      NODE_ENV: "production",
      HTTP_PORT: 80,
      HTTPS_PORT: 443
    },
    log_date_format: "YYYY-MM-DD HH:mm Z",
    error_file: "/var/log/kingcoin/error.log",
    out_file: "/var/log/kingcoin/output.log",
    watch: false,
    max_memory_restart: "1G"
  }]
};
```

2. Создайте директорию для логов:

```bash
sudo mkdir -p /var/log/kingcoin
sudo chown -R $USER:$USER /var/log/kingcoin
```

3. Создайте server.js для поддержки HTTP и HTTPS:

```javascript
const { createServer } = require('http');
const { createServer: createHttpsServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const HTTP_PORT = parseInt(process.env.HTTP_PORT || 3000, 10);
const HTTPS_PORT = parseInt(process.env.HTTPS_PORT || 3443, 10);

app.prepare().then(() => {
  // HTTP Server - будет использоваться для редиректа на HTTPS
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(HTTP_PORT, (err) => {
    if (err) throw err;
    console.log(`> HTTP Server running on http://localhost:${HTTP_PORT}`);
  });

  // HTTPS Server
  if (process.env.NODE_ENV === 'production') {
    try {
      const httpsOptions = {
        key: fs.readFileSync('/etc/ssl/kingcoin.online/private.key'),
        cert: fs.readFileSync('/etc/ssl/kingcoin.online/fullchain.crt'),
        ca: fs.readFileSync('/etc/ssl/kingcoin.online/ca-bundle.crt')
      };

      createHttpsServer(httpsOptions, (req, res) => {
        const parsedUrl = parse(req.url, true);
        handle(req, res, parsedUrl);
      }).listen(HTTPS_PORT, (err) => {
        if (err) throw err;
        console.log(`> HTTPS Server running on https://localhost:${HTTPS_PORT}`);
      });
    } catch (error) {
      console.error('Error starting HTTPS server:', error);
      console.log('Continuing with HTTP only...');
    }
  }
});
```

## Настройка Nginx как проксирующего сервера

1. Создайте конфигурационный файл для вашего сайта:

```bash
sudo nano /etc/nginx/sites-available/kingcoin.online
```

2. Добавьте следующую конфигурацию:

```nginx
# Редирект с HTTP на HTTPS
server {
    listen 80;
    server_name kingcoin.online www.kingcoin.online;
    return 301 https://$host$request_uri;
}

# HTTPS сервер
server {
    listen 443 ssl http2;
    server_name kingcoin.online www.kingcoin.online;

    ssl_certificate /etc/ssl/kingcoin.online/fullchain.crt;
    ssl_certificate_key /etc/ssl/kingcoin.online/private.key;
    ssl_trusted_certificate /etc/ssl/kingcoin.online/ca-bundle.crt;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Настройки HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Прокси-настройки
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

3. Создайте символическую ссылку для активации конфигурации:

```bash
sudo ln -s /etc/nginx/sites-available/kingcoin.online /etc/nginx/sites-enabled/
```

4. Проверьте конфигурацию Nginx и перезапустите:

```bash
sudo nginx -t
sudo systemctl restart nginx
```

## Запуск приложения

1. Запустите приложение с помощью PM2:

```bash
pm2 start ecosystem.config.js
```

2. Посетите https://kingcoin.online и убедитесь, что сайт работает корректно и HTTPS настроен правильно.

3. Настройте автозапуск PM2 при перезагрузке сервера:

```bash
pm2 startup
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME
pm2 save
```

## Обновление приложения

Для обновления приложения выполните:

```bash
cd /path/to/kingcoin.online
git pull
npm install
npm run build
sudo pm2 restart kingcoin-online
```

## Устранение неполадок

- Проверьте логи PM2: `pm2 logs` или файлы логов в `/var/log/kingcoin/`.
- Проверьте логи Nginx: `sudo tail -f /var/log/nginx/error.log`
- Убедитесь, что порты 80 и 443 открыты: `sudo ufw status` или настройте их: `sudo ufw allow 80/tcp && sudo ufw allow 443/tcp`
