const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Функция для проверки наличия директории
function checkDirectory(directory) {
  try {
    return fs.existsSync(directory) && fs.statSync(directory).isDirectory();
  } catch (error) {
    console.error(`Ошибка при проверке директории ${directory}:`, error);
    return false;
  }
}

// Функция для проверки наличия файла
function checkFile(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch (error) {
    console.error(`Ошибка при проверке файла ${filePath}:`, error);
    return false;
  }
}

// Функция для рекурсивного получения всех файлов в директории
function getAllFiles(dirPath, arrayOfFiles = []) {
  try {
    const files = fs.readdirSync(dirPath);

    files.forEach(file => {
      const filePath = path.join(dirPath, file);
      
      if (fs.statSync(filePath).isDirectory()) {
        arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
      } else {
        arrayOfFiles.push(filePath);
      }
    });
    
    return arrayOfFiles;
  } catch (error) {
    console.error(`Ошибка при получении файлов из директории ${dirPath}:`, error);
    return arrayOfFiles;
  }
}

// Проверяем наличие директории .next
const dotNextDir = path.join(__dirname, '.next');
if (!checkDirectory(dotNextDir)) {
  console.error(`Директория .next не найдена! Нужно выполнить сборку командой 'next build'.`);
  process.exit(1);
}

console.log('Директория .next найдена.');

// Проверяем наличие директории static
const staticDir = path.join(dotNextDir, 'static');
if (!checkDirectory(staticDir)) {
  console.error(`Директория .next/static не найдена! Возможно, сборка не завершилась успешно.`);
  process.exit(1);
}

console.log('Директория .next/static найдена.');

// Проверяем конкретные файлы, которые не загружаются
const missingFiles = [
  '5a4317799bbb54ef.css',
  'chunks/webpack-88c12019797c54d0.js',
  'chunks/350-5350eb43a03bf4dd.js',
  'chunks/26-d8b44d05856930ce.js',
  'chunks/app/page-4e9be26fd9c48e29.js',
  'chunks/516-7e405a17706a25fe.js',
  'chunks/app/layout-7e597e412e85065e.js'
];

console.log('\nПроверка упомянутых в ошибке файлов:');
missingFiles.forEach(file => {
  const cssDir = path.join(staticDir, 'css');
  const chunksDir = path.join(staticDir, 'chunks');
  const appChunksDir = path.join(chunksDir, 'app');
  
  let foundPath = null;
  
  if (file.endsWith('.css')) {
    foundPath = path.join(cssDir, file);
  } else if (file.startsWith('chunks/app/')) {
    foundPath = path.join(staticDir, file);
  } else if (file.startsWith('chunks/')) {
    foundPath = path.join(staticDir, file);
  }
  
  if (foundPath && checkFile(foundPath)) {
    console.log(`✅ Файл ${file} найден: ${foundPath}`);
  } else {
    console.log(`❌ Файл ${file} НЕ найден!`);
    
    // Проверяем, есть ли похожие файлы
    let searchDir;
    if (file.endsWith('.css')) {
      searchDir = cssDir;
    } else if (file.startsWith('chunks/app/')) {
      searchDir = appChunksDir;
    } else if (file.startsWith('chunks/')) {
      searchDir = chunksDir;
    }
    
    if (searchDir && checkDirectory(searchDir)) {
      const similarFiles = fs.readdirSync(searchDir)
        .filter(f => f.includes(file.split('/').pop().split('-')[0]));
      
      if (similarFiles.length > 0) {
        console.log(`  Найдены похожие файлы в ${searchDir}:`);
        similarFiles.forEach(f => console.log(`  - ${f}`));
      }
    }
  }
});

// Проверяем структуру директории .next/static
console.log('\nСтруктура директории .next/static:');
const staticSubdirs = fs.readdirSync(staticDir);
staticSubdirs.forEach(subdir => {
  const subdirPath = path.join(staticDir, subdir);
  if (fs.statSync(subdirPath).isDirectory()) {
    const files = fs.readdirSync(subdirPath);
    console.log(`- ${subdir}/: ${files.length} файлов`);
    if (files.length > 0) {
      console.log(`  Первые 5 файлов: ${files.slice(0, 5).join(', ')}`);
    }
  }
});

// Проверяем существует ли server.js и работает ли он
console.log('\nПроверка сервера:');
const serverPath = path.join(__dirname, 'server.js');
if (checkFile(serverPath)) {
  console.log(`✅ Файл server.js найден.`);
  
  // Проверяем строку assetPrefix в next.config.js
  const nextConfigPath = path.join(__dirname, 'next.config.mjs');
  if (checkFile(nextConfigPath)) {
    const nextConfig = fs.readFileSync(nextConfigPath, 'utf8');
    if (nextConfig.includes('assetPrefix')) {
      console.log('⚠️ В next.config.mjs найдена настройка assetPrefix:');
      const lines = nextConfig.split('\n');
      lines.forEach((line, index) => {
        if (line.includes('assetPrefix')) {
          console.log(`  ${index + 1}: ${line.trim()}`);
        }
      });
    } else {
      console.log('✅ В next.config.mjs нет настройки assetPrefix.');
    }
  }
  
  // Проверяем наличие nextjs.config
  const nextjsConfigPath = path.join(__dirname, 'nextjs.config');
  if (checkFile(nextjsConfigPath)) {
    console.log(`⚠️ Найден файл nextjs.config. Может конфликтовать с next.config.mjs.`);
  }
} else {
  console.log(`❌ Файл server.js НЕ найден!`);
}

console.log('\nЗавершение проверки.'); 