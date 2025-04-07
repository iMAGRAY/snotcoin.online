const { createServer } = require('https');
const http = require('http');
const { parse } = require('url');
const fs = require('fs');
const path = require('path');
const next = require('next');

// Всегда используем production режим
const dev = false;
const app = next({ dev });
const handle = app.getRequestHandler();

// Пути к SSL-сертификатам с проверкой существования
let sslOptions;
try {
  sslOptions = {
    key: fs.readFileSync('/etc/ssl/snotcoin.online/private.key'),
    cert: fs.readFileSync('/etc/ssl/snotcoin.online/fullchain.crt'),
    ca: fs.readFileSync('/etc/ssl/snotcoin.online/ca-bundle.crt'),
    minVersion: 'TLSv1.2' // Улучшаем безопасность, требуя минимум TLS 1.2
  };
  console.log('SSL сертификаты успешно загружены');
} catch (error) {
  console.error('Ошибка при загрузке SSL сертификатов:', error);
  // В режиме разработки создаем самоподписанные сертификаты
  if (process.env.NODE_ENV !== 'production') {
    try {
      const certDir = path.join(__dirname, 'certs');
      
      if (!fs.existsSync(certDir)) {
        fs.mkdirSync(certDir, { recursive: true });
      }
      
      const keyPath = path.join(certDir, 'localhost.key');
      const certPath = path.join(certDir, 'localhost.crt');
      
      if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
        console.log('Сертификаты для разработки не найдены, используем HTTP сервер');
        // Будем использовать только HTTP сервер для разработки
      } else {
        sslOptions = {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath),
          minVersion: 'TLSv1.2'
        };
        console.log('Используем локальные сертификаты для разработки');
      }
    } catch (devCertError) {
      console.error('Ошибка при загрузке локальных сертификатов:', devCertError);
    }
  } else {
    process.exit(1); // Выходим только в production, т.к. без сертификатов HTTPS сервер не запустится
  }
}

// Порты
const httpsPort = process.env.HTTPS_PORT || 443;
const httpPort = process.env.HTTP_PORT || 80;

// Максимальное количество попыток запуска серверов
const MAX_RETRY_ATTEMPTS = 5;
let retryAttempts = 0;

// Проверяем наличие .next/static и выводим содержимое для отладки
try {
  const staticDir = path.join(__dirname, '.next', 'static');
  if (fs.existsSync(staticDir) && fs.statSync(staticDir).isDirectory()) {
    console.log('[Server] Каталог .next/static найден');
    // Проверяем подкаталоги
    const subdirs = fs.readdirSync(staticDir);
    console.log('[Server] Подкаталоги в .next/static:', subdirs);
  } else {
    console.error('[Server] ВНИМАНИЕ! Каталог .next/static не найден! Статические файлы не будут доступны.');
  }
} catch (err) {
  console.error('[Server] Ошибка при проверке каталога .next/static:', err);
}

// Настройка обработки запросов к статическим файлам
const handleStaticFiles = (req, res) => {
  const url = parse(req.url, true);
  const pathname = url.pathname;
  
  // Обрабатываем только запросы к файлам в /_next/static/
  if (pathname.startsWith('/_next/static/')) {
    try {
      console.log(`[Static] Запрос к статическому файлу: ${pathname}`);
      
      // Формируем путь к файлу на диске
      const filePath = path.join(__dirname, '.next', pathname);
      
      // Проверяем существование файла
      fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
          console.error(`[Static] Ошибка: файл не найден: ${filePath}`);
          
          // Проверяем, существует ли директория
          const dirPath = path.dirname(filePath);
          if (fs.existsSync(dirPath)) {
            const files = fs.readdirSync(dirPath);
            console.log(`[Static] Директория ${dirPath} существует и содержит ${files.length} файлов`);
            
            // Ищем файлы с похожими именами
            const fileName = path.basename(pathname);
            const baseFileName = fileName.split('-')[0]; // Берем часть до первого дефиса (обычно это основное имя без хеша)
            
            if (baseFileName) {
              const similarFiles = files.filter(f => f.includes(baseFileName));
              if (similarFiles.length > 0) {
                console.log(`[Static] Найдены похожие файлы: ${similarFiles.join(', ')}`);
              }
            }
          } else {
            console.error(`[Static] Директория не существует: ${dirPath}`);
          }
          
          // Передаем управление Next.js для стандартной обработки 404
          handle(req, res, url);
          return;
        }
        
        // Определяем тип содержимого
        const extname = path.extname(filePath);
        let contentType = 'application/octet-stream';
        
        switch (extname) {
          case '.html': contentType = 'text/html'; break;
          case '.js': contentType = 'application/javascript'; break;
          case '.css': contentType = 'text/css'; break;
          case '.json': contentType = 'application/json'; break;
          case '.png': contentType = 'image/png'; break;
          case '.jpg': 
          case '.jpeg': contentType = 'image/jpeg'; break;
          case '.gif': contentType = 'image/gif'; break;
          case '.svg': contentType = 'image/svg+xml'; break;
          case '.ico': contentType = 'image/x-icon'; break;
          case '.webp': contentType = 'image/webp'; break;
          case '.woff': contentType = 'font/woff'; break;
          case '.woff2': contentType = 'font/woff2'; break;
        }
        
        // Устанавливаем правильные заголовки
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable' // 1 год кеширования
        });
        
        // Возвращаем файл
        const readStream = fs.createReadStream(filePath);
        readStream.pipe(res);
        
        // Обрабатываем ошибки потока чтения
        readStream.on('error', (readErr) => {
          console.error(`[Static] Ошибка при чтении файла ${filePath}:`, readErr);
          res.statusCode = 500;
          res.end('Internal Server Error');
        });
      });
    } catch (err) {
      console.error(`[Static] Ошибка при обработке статического файла ${pathname}:`, err);
      // Передаем управление Next.js
      handle(req, res, url);
    }
  } else {
    // Для других запросов используем стандартный обработчик Next.js
    handle(req, res, url);
  }
};

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
        // Создаем HTTPS сервер, если есть SSL сертификаты
        if (sslOptions) {
          const httpsServer = createServer(sslOptions, handleStaticFiles);

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
        } else {
          // Если нет SSL сертификатов, запускаем только HTTP сервер
          const httpServer = http.createServer(handleStaticFiles);
          
          httpServer.on('error', (err) => handleStartupFailure(err, false));
          
          httpServer.listen(httpPort, (err) => {
            if (err) {
              handleStartupFailure(err, false);
              return;
            }
            console.log(`> HTTP Server ready on http://localhost:${httpPort}`);
          });
          
          // Обработчик завершения
          ['SIGINT', 'SIGTERM'].forEach(signal => {
            process.on(signal, () => {
              console.log(`\nПолучен сигнал ${signal}, останавливаем сервер...`);
              httpServer.close(() => {
                console.log('Сервер остановлен.');
                process.exit(0);
              });
            });
          });
        }
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