/**
 * Конфигурация и переменные окружения для приложения
 */

// Флаги для включения/отключения внешних сервисов
export const ENV = {
  // База данных
  DATABASE_URL: process.env.DATABASE_URL,
  
  // JWT секреты
  JWT_SECRET: process.env.JWT_SECRET || 'insecure-jwt-secret-change-me',
  REFRESH_SECRET: process.env.REFRESH_SECRET || 'insecure-refresh-secret-change-me',
  
  // Окружение
  NODE_ENV: process.env.NODE_ENV || 'production',
  
  // Сервисы аутентификации
  NEYNAR_API_KEY: process.env.NEYNAR_API_KEY,
  
  // Режим работы
  IS_MAINTENANCE_MODE: process.env.MAINTENANCE_MODE === 'true',
  
  // Логирование
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  ENABLE_DEBUG_LOGS: false,
  
  // Метрики и мониторинг
  ENABLE_METRICS: process.env.ENABLE_METRICS !== 'false',
};

// Вспомогательные функции для проверки окружения
export const isProduction = ENV.NODE_ENV === 'production';
export const isTest = ENV.NODE_ENV === 'test';

// Функция для проверки, доступен ли сервис
export function isServiceEnabled(serviceName: keyof typeof ENV): boolean {
  switch (serviceName) {
    case 'ENABLE_METRICS':
      return ENV.ENABLE_METRICS;
    default:
      return !!ENV[serviceName];
  }
}

// Установить режим обслуживания
export function setMaintenanceMode(enabled: boolean): void {
  ENV.IS_MAINTENANCE_MODE = enabled;
}

// Получение текущего статуса сервисов
export function getServicesStatus(): Record<string, boolean> {
  return {
    metrics: ENV.ENABLE_METRICS,
    maintenanceMode: ENV.IS_MAINTENANCE_MODE,
    debugLogs: ENV.ENABLE_DEBUG_LOGS,
  };
} 