/**
 * Утилита для расширенного логирования процесса авторизации
 * Обеспечивает единый подход к логированию на клиенте и сервере
 */

import { v4 as uuidv4 } from 'uuid';

// Типы логов авторизации
export enum AuthLogType {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG',
  SECURITY = 'SECURITY',
  TELEMETRY = 'TELEMETRY'
}

// Этапы авторизации
export enum AuthStep {
  INIT = 'INIT',              // Инициализация процесса авторизации
  AUTH_START = 'AUTH_START',  // Начало процесса авторизации
  AUTH_ERROR = 'AUTH_ERROR',  // Ошибки в процессе авторизации
  AUTH_COMPLETE = 'AUTH_COMPLETE', // Успешная авторизация
  USER_INTERACTION = 'USER_INTERACTION', // Взаимодействие пользователя
  TOKEN_RECEIVED = 'TOKEN_RECEIVED', // Получение токена
  TOKEN_VALIDATION = 'TOKEN_VALIDATION', // Валидация токена
  FARCASTER_INIT = 'FARCASTER_INIT',      // Инициализация Farcaster авторизации
  FARCASTER_REQUEST = 'FARCASTER_REQUEST', // Запрос к API Farcaster
  FARCASTER_QR_DISPLAY = 'FARCASTER_QR_DISPLAY', // Отображение QR-кода
  FARCASTER_POLLING = 'FARCASTER_POLLING', // Ожидание подтверждения
  FARCASTER_VERIFY_DATA = 'FARCASTER_VERIFY_DATA', // Проверка данных Farcaster
  FARCASTER_SUCCESS = 'FARCASTER_SUCCESS', // Успешная авторизация через Farcaster
  SESSION_CHECK = 'SESSION_CHECK', // Проверка сессии
  SESSION_ERROR = 'SESSION_ERROR', // Ошибки сессии
  SESSION_REFRESH = 'SESSION_REFRESH', // Обновление сессии
  VALIDATE_DATA = 'VALIDATE_DATA', // Валидация данных пользователя
  VALIDATE_FARCASTER = 'VALIDATE_FARCASTER', // Валидация Farcaster данных
  AUTH_RETRY = 'AUTH_RETRY', // Повторная попытка авторизации
}

// Интерфейс записи лога
export interface AuthLogEntry {
  timestamp: string;
  sessionId: string;
  userId?: number | string;
  step: AuthStep;
  type: AuthLogType;
  message: string;
  data?: any;
  error?: any;
  clientInfo?: {
    userAgent?: string;
    platform?: string;
    screenSize?: string;
    language?: string;
    referrer?: string;
  };
  serverInfo?: {
    endpoint?: string;
    method?: string;
    statusCode?: number;
    responseTime?: number;
    serverName?: string;
  };
}

// Хранилище для сессионных ID
let currentSessionId: string | null = null;
let currentUserId: number | string | null = null;

/**
 * Создает или возвращает существующий ID сессии
 */
export function getSessionId(): string {
  if (!currentSessionId) {
    try {
      // Пытаемся восстановить sessionId из localStorage на клиенте
      if (typeof window !== 'undefined' && window.localStorage) {
        const storedSessionId = localStorage.getItem('auth_session_id');
        if (storedSessionId) {
          currentSessionId = storedSessionId;
        } else {
          currentSessionId = `session_${uuidv4()}`;
          localStorage.setItem('auth_session_id', currentSessionId);
        }
      } else {
        // На сервере или если localStorage недоступен
        currentSessionId = `session_${uuidv4()}`;
      }
    } catch (e) {
      // Если произошла ошибка, создаем новый ID
      currentSessionId = `session_${uuidv4()}`;
    }
  }
  
  return currentSessionId;
}

/**
 * Устанавливает ID пользователя для логов
 */
export function setUserId(userId: number | string): void {
  currentUserId = userId;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('auth_user_id', String(userId));
    }
  } catch (e) {
    // Игнорируем ошибки localStorage
  }
}

/**
 * Получает сохраненный ID пользователя
 */
export function getUserId(): number | string | null {
  if (!currentUserId && typeof window !== 'undefined' && window.localStorage) {
    try {
      const storedUserId = localStorage.getItem('auth_user_id');
      if (storedUserId) {
        if (!isNaN(Number(storedUserId))) {
          currentUserId = Number(storedUserId);
        } else {
          currentUserId = storedUserId;
        }
      }
    } catch (e) {
      // Игнорируем ошибки localStorage
    }
  }
  return currentUserId;
}

/**
 * Сбрасывает текущую сессию
 */
export function resetSession(): void {
  currentSessionId = null;
  currentUserId = null;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('auth_session_id');
      localStorage.removeItem('auth_user_id');
    }
  } catch (e) {
    // Игнорируем ошибки localStorage
  }
}

/**
 * Собирает информацию о клиенте
 */
function getClientInfo(): AuthLogEntry['clientInfo'] | undefined {
  if (typeof window === 'undefined') return undefined;
  
  try {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      screenSize: `${window.screen.width}x${window.screen.height}`,
      language: navigator.language,
      referrer: document.referrer
    };
  } catch (e) {
    return undefined;
  }
}

/**
 * Обрабатывает объект ошибки для логирования
 */
function processError(error: any): any {
  if (!error) return undefined;
  
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(error as any).code && { code: (error as any).code },
      ...(error as any).status && { status: (error as any).status }
    };
  }
  
  if (typeof error === 'object') {
    try {
      // Удаляем циклические ссылки для безопасной сериализации
      return JSON.parse(JSON.stringify(error));
    } catch (e) {
      return { message: String(error) };
    }
  }
  
  return { message: String(error) };
}

/**
 * Основная функция логирования
 */
export function logAuth(
  step: AuthStep,
  type: AuthLogType,
  message: string,
  data?: any,
  error?: any,
  serverInfo?: AuthLogEntry['serverInfo']
): AuthLogEntry {
  const logEntry: AuthLogEntry = {
    timestamp: new Date().toISOString(),
    sessionId: getSessionId(),
    userId: getUserId() || undefined,
    step,
    type,
    message,
    data: data ? (typeof data === 'object' ? { ...data } : data) : undefined,
    error: error ? processError(error) : undefined,
    clientInfo: getClientInfo(),
    serverInfo
  };
  
  // Вывод в консоль с соответствующим форматированием, 
  // пропускаем частые инициализации/размонтирования для уменьшения спама
  const skipConsoleLog = 
    (step === AuthStep.INIT && message === 'Окно аутентификации инициализировано') ||
    (step === AuthStep.USER_INTERACTION && message === 'Окно аутентификации размонтировано');
  
  if (!skipConsoleLog) {
    const consolePrefix = `[AUTH:${type}:${step}]`;
    switch (type) {
      case AuthLogType.ERROR:
        console.error(consolePrefix, message, { ...logEntry });
        break;
      case AuthLogType.WARNING:
        console.warn(consolePrefix, message, { ...logEntry });
        break;
      case AuthLogType.SECURITY:
        console.warn(consolePrefix, message, { ...logEntry });
        break;
      case AuthLogType.DEBUG:
        console.debug(consolePrefix, message, { ...logEntry });
        break;
      default:
        console.log(consolePrefix, message, { ...logEntry });
    }
  }
  
  // Если это ошибка, также отправляем в аналитику или мониторинг ошибок
  if (type === AuthLogType.ERROR) {
    try {
      sendErrorToMonitoring(logEntry);
    } catch (e) {
      // Игнорируем ошибки отправки
    }
  }
  
  // Сохраняем в localStorage для отладки
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const logs = JSON.parse(localStorage.getItem('auth_debug_logs') || '[]');
      logs.push(logEntry);
      
      // Ограничиваем количество логов
      if (logs.length > 100) logs.shift();
      
      localStorage.setItem('auth_debug_logs', JSON.stringify(logs));
    } catch (e) {
      // Игнорируем ошибки localStorage
    }
  }
  
  return logEntry;
}

/**
 * Вспомогательные функции для разных типов логов
 */
export function logAuthInfo(step: AuthStep, message: string, data?: any): AuthLogEntry {
  return logAuth(step, AuthLogType.INFO, message, data);
}

export function logAuthWarning(step: AuthStep, message: string, data?: any): AuthLogEntry {
  return logAuth(step, AuthLogType.WARNING, message, data);
}

export function logAuthError(step: AuthStep, message: string, error?: any, data?: any): AuthLogEntry {
  return logAuth(step, AuthLogType.ERROR, message, data, error);
}

export function logAuthDebug(step: AuthStep, message: string, data?: any): AuthLogEntry {
  return logAuth(step, AuthLogType.DEBUG, message, data);
}

export function logAuthSecurity(step: AuthStep, message: string, data?: any): AuthLogEntry {
  return logAuth(step, AuthLogType.SECURITY, message, data);
}

/**
 * Отправляет ошибку в систему мониторинга если она настроена
 */
function sendErrorToMonitoring(logEntry: AuthLogEntry): void {
  // Здесь можно добавить интеграцию с Sentry, LogRocket, или другими системами мониторинга
  // Например:
  // if (typeof window !== 'undefined' && (window as any).Sentry) {
  //   (window as any).Sentry.captureException(logEntry.error, {
  //     extra: {
  //       step: logEntry.step,
  //       message: logEntry.message,
  //       data: logEntry.data,
  //       userId: logEntry.userId,
  //       sessionId: logEntry.sessionId
  //     }
  //   });
  // }
}

/**
 * Получает все сохраненные логи для отладки
 */
export function getAuthLogs(): AuthLogEntry[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  
  try {
    return JSON.parse(localStorage.getItem('auth_debug_logs') || '[]');
  } catch (e) {
    return [];
  }
}

/**
 * Очищает сохраненные логи
 */
export function clearAuthLogs(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  
  try {
    localStorage.removeItem('auth_debug_logs');
  } catch (e) {
    // Игнорируем ошибки localStorage
  }
}

/**
 * Экспортирует логи в JSON формате
 */
export function exportAuthLogs(): string {
  const logs = getAuthLogs();
  return JSON.stringify(logs, null, 2);
}

/**
 * Предоставляет строковое представление процесса авторизации для отладки
 */
export function getAuthFlowSummary(): string {
  const logs = getAuthLogs();
  let summary = `=== Сводка процесса авторизации ===\n`;
  summary += `Сессия: ${getSessionId()}\n`;
  summary += `Пользователь: ${getUserId() || 'Неизвестен'}\n`;
  summary += `Всего записей: ${logs.length}\n\n`;
  
  if (logs.length === 0) {
    summary += 'Логи авторизации отсутствуют.\n';
    return summary;
  }
  
  const firstLog = logs[0];
  const lastLog = logs[logs.length - 1];
  
  summary += `Начало: ${new Date(firstLog.timestamp).toLocaleString()} (${firstLog.step})\n`;
  summary += `Конец: ${new Date(lastLog.timestamp).toLocaleString()} (${lastLog.step})\n`;
  
  // Подсчет шагов по типам
  const stepCounts: Record<string, number> = {};
  logs.forEach(log => {
    stepCounts[log.step] = (stepCounts[log.step] || 0) + 1;
  });
  
  summary += `\nШаги процесса:\n`;
  Object.entries(stepCounts).forEach(([step, count]) => {
    summary += `- ${step}: ${count} раз\n`;
  });
  
  // Нахождение ошибок
  const errors = logs.filter(log => log.type === AuthLogType.ERROR);
  if (errors.length > 0) {
    summary += `\nОшибки (${errors.length}):\n`;
    errors.forEach((error, index) => {
      summary += `${index + 1}. [${error.step}] ${error.message}\n`;
    });
  } else {
    summary += `\nОшибки отсутствуют.\n`;
  }
  
  // Общая продолжительность
  const duration = new Date(lastLog.timestamp).getTime() - new Date(firstLog.timestamp).getTime();
  summary += `\nПродолжительность: ${duration / 1000} секунд\n`;
  
  return summary;
} 