/**
 * layout.js - Общий скрипт для макета приложения
 * Используется для инициализации общих функций и обработчиков
 */

// Настройка обработчиков событий при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
  console.log('[Layout] Страница загружена');
  
  // Инициализация сервиса IndexedDB
  initDatabaseService();
  
  // Обработчики для панели инструментов разработчика
  setupDevToolsHandlers();
});

// Проверка состояния базы данных
async function checkDatabaseStatus() {
  try {
    const response = await fetch('/database');
    
    if (response.ok) {
      console.log('[Layout] База данных доступна');
      return true;
    } else {
      console.warn('[Layout] База данных недоступна, статус:', response.status);
      return false;
    }
  } catch (error) {
    console.error('[Layout] Ошибка при проверке состояния базы данных:', error);
    return false;
  }
}

// Инициализация сервиса базы данных
async function initDatabaseService() {
  try {
    // Проверяем состояние сервиса базы данных
    const dbStatus = await checkDatabaseStatus();
    
    if (!dbStatus) {
      console.warn('[Layout] Используем локальное хранилище вместо базы данных');
      // Здесь можно добавить логику для использования альтернативного хранилища
    }
  } catch (error) {
    console.error('[Layout] Ошибка при инициализации сервиса базы данных:', error);
  }
}

// Настройка обработчиков для панели инструментов разработчика
function setupDevToolsHandlers() {
  // Обработчик для клавиши Ctrl+A для открытия/закрытия панели разработчика
  document.addEventListener('keydown', function(event) {
    // Ничего не делаем, обработка производится в компоненте WarpcastDevMode
  });
}

// Обработка данных для сохранения
async function processDataForSave(data) {
  if (!data) return null;
  
  try {
    // Проверяем валидность данных
    if (typeof data !== 'object') {
      throw new Error('Данные должны быть объектом');
    }
    
    // Добавляем метаданные
    const processedData = {
      ...data,
      _processedAt: Date.now(),
      _version: '1.0.0'
    };
    
    return processedData;
  } catch (error) {
    console.error('[Layout] Ошибка при обработке данных для сохранения:', error);
    return null;
  }
}

// Экспорт функций для использования в других скриптах
window.appLayout = {
  checkDatabaseStatus,
  processDataForSave
}; 