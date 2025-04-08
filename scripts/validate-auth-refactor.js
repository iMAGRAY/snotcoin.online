/**
 * Скрипт для проверки и валидации рефакторинга аутентификации
 * 
 * Запуск: node scripts/validate-auth-refactor.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Начинаю проверку рефакторинга системы аутентификации...');

// Проверяем наличие необходимых директорий
const requiredDirs = [
  'app/api/auth/providers',
  'app/api/auth/providers/farcaster',
  'app/api/auth/logout',
  'app/api/auth/refresh'
];

let allExists = true;
requiredDirs.forEach(dir => {
  const exists = fs.existsSync(path.resolve(process.cwd(), dir));
  console.log(`Директория ${dir}: ${exists ? 'Существует ✅' : 'Отсутствует ❌'}`);
  
  if (!exists) {
    allExists = false;
  }
});

// Проверяем наличие файлов маршрутов
const requiredFiles = [
  'app/api/auth/providers/farcaster/route.ts',
  'app/api/auth/logout/route.ts',
  'app/api/auth/refresh/route.ts',
  'app/api/auth/README.md',
  'app/services/auth/README.md'
];

requiredFiles.forEach(file => {
  const exists = fs.existsSync(path.resolve(process.cwd(), file));
  console.log(`Файл ${file}: ${exists ? 'Существует ✅' : 'Отсутствует ❌'}`);
  
  if (!exists) {
    allExists = false;
  }
});

// Проверяем, что старый маршрут не используется
console.log('\nПроверка на использование старых путей:');
try {
  const result = execSync('grep -r "/api/farcaster/auth" --include="*.ts" --include="*.tsx" app').toString();
  
  if (result) {
    console.log('⚠️ Найдены использования старого пути /api/farcaster/auth:');
    console.log(result);
    allExists = false;
  } else {
    console.log('Старые пути не используются ✅');
  }
} catch (error) {
  // grep возвращает код ошибки, если ничего не найдено, что в данном случае хорошо
  console.log('Старые пути не используются ✅');
}

// Проверяем middleware.ts на использование новых путей
console.log('\nПроверка middleware.ts:');
try {
  const middlewareContent = fs.readFileSync(path.resolve(process.cwd(), 'app/middleware.ts'), 'utf8');
  
  if (middlewareContent.includes('/api/auth/providers/farcaster')) {
    console.log('middleware.ts использует новые пути ✅');
  } else {
    console.log('⚠️ middleware.ts не обновлен с новыми путями');
    allExists = false;
  }
} catch (error) {
  console.log('❌ Ошибка при проверке middleware.ts:', error.message);
  allExists = false;
}

// Проверяем api.ts на использование новых путей
console.log('\nПроверка api.ts:');
try {
  const apiContent = fs.readFileSync(path.resolve(process.cwd(), 'app/lib/api.ts'), 'utf8');
  
  if (apiContent.includes('/api/auth/providers/farcaster')) {
    console.log('api.ts использует новые пути ✅');
  } else {
    console.log('⚠️ api.ts не обновлен с новыми путями');
    allExists = false;
  }
} catch (error) {
  console.log('❌ Ошибка при проверке api.ts:', error.message);
  allExists = false;
}

// Вывод итогов
console.log('\n=== Итоги рефакторинга ===');
if (allExists) {
  console.log('✅ Рефакторинг системы аутентификации успешно завершен.');
  console.log('Теперь все эндпоинты аутентификации находятся в /api/auth/ с правильной структурой.');
} else {
  console.log('⚠️ Рефакторинг завершен с предупреждениями или ошибками.');
  console.log('Проверьте вышеуказанные проблемы и выполните необходимые исправления.');
} 