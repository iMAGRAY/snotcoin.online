const { createServer } = require('https');
const http = require('http');
const { parse } = require('url');
const fs = require('fs');
const path = require('path');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// Пути к SSL-сертификатам с проверкой существования
let sslOptions;
try {
  sslOptions = {
    key: fs.readFileSync('/etc/ssl/snotcoin.online/private.key'),
    cert: fs.readFileSync('/etc/ssl/snotcoin.online/fullchain.crt'),
    minVersion: 'TLSv1.2' // Улучшаем безопасность, требуя минимум TLS 1.2
  };
  console.log('SSL сертификаты успешно загружены');
} catch (error) {
  console.error('Ошибка при загрузке SSL сертификатов:', error);
  process.exit(1); // Выходим, т.к. без сертификатов HTTPS сервер не запустится
}

// Порты
const httpsPort = process.env.HTTPS_PORT || 443;
const httpPort = process.env.HTTP_PORT || 80;

// Максимальное количество попыток запуска серверов
const MAX_RETRY_ATTEMPTS = 5;
let retryAttempts = 0;

// Функция для запуска серверов с возможностью повторных попыток
const startServers = () => {
  // Попытка запуска завершилась неудачей
  const handleStartupFailure = (err, isHttps = true) => {
    console.error(`Ошибка при запуске ${isHttps ? 'HTTPS' : 'HTTP'} сервера:`, err);
    
    if (retryAttempts < MAX_RETRY_ATTEMPTS) {
      retryAttempts++;
      const delay = 3000; // 3 секунды между попытками
      console.log(`Повторная попытка (${retryAttempts}/${MAX_RETRY_ATTEMPTS}) через ${delay/1000} секунд...`);
      setTimeout(startServers, delay);
    } else {
      console.error(`Достигнут лимит попыток (${MAX_RETRY_ATTEMPTS}). Запуск серверов не удался.`);
      process.exit(1);
    }
  };

  app.prepare()
    .then(() => {
      try {
        // Создаем HTTPS сервер
        const httpsServer = createServer(sslOptions, (req, res) => {
          try {
            const parsedUrl = parse(req.url, true);
            handle(req, res, parsedUrl);
          } catch (err) {
            console.error('Ошибка при обработке HTTPS запроса:', err);
            res.statusCode = 500;
            res.end('Internal Server Error');
          }
        });

        httpsServer.on('error', (err) => handleStartupFailure(err, true));
        
        httpsServer.listen(httpsPort, (err) => {
          if (err) {
            handleStartupFailure(err, true);
            return;
          }
          console.log(`> HTTPS Server ready on https://snotcoin.online:${httpsPort}`);
        });

        // Создаем HTTP сервер для редиректа на HTTPS
        const httpServer = http.createServer((req, res) => {
          try {
            const host = req.headers.host;
            // Перенаправляем на HTTPS
            res.writeHead(301, {
              'Location': `https://${host}${req.url}`
            });
            res.end();
          } catch (err) {
            console.error('Ошибка при обработке HTTP запроса:', err);
            res.statusCode = 500;
            res.end('Internal Server Error');
          }
        });

        httpServer.on('error', (err) => handleStartupFailure(err, false));
        
        httpServer.listen(httpPort, (err) => {
          if (err) {
            handleStartupFailure(err, false);
            return;
          }
          console.log(`> HTTP Redirect ready on http://snotcoin.online:${httpPort}`);
        });
        
        // Добавляем обработчики для корректного завершения при сигналах
        ['SIGINT', 'SIGTERM'].forEach(signal => {
          process.on(signal, () => {
            console.log(`\nПолучен сигнал ${signal}, останавливаем серверы...`);
            httpServer.close(() => {
              httpsServer.close(() => {
                console.log('Серверы остановлены.');
                process.exit(0);
              });
            });
          });
        });
      } catch (err) {
        handleStartupFailure(err);
      }
    })
    .catch((err) => {
      console.error('Ошибка при подготовке Next.js приложения:', err);
      process.exit(1);
    });
};

// Запустить серверы
startServers(); 