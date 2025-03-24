/**
 * Утилита для детального логирования процесса авторизации
 * Помогает отследить все этапы процесса и диагностировать проблемы
 */

import { v4 as uuidv4 } from 'uuid';

// Типы событий авторизации
export enum AuthEventType {
  // Общие события
  AUTH_STARTED = 'AUTH_STARTED',
  AUTH_COMPLETED = 'AUTH_COMPLETED',
  AUTH_FAILED = 'AUTH_FAILED',
  
  // События компонентов UI
  UI_COMPONENT_MOUNTED = 'UI_COMPONENT_MOUNTED',
  UI_COMPONENT_ERROR = 'UI_COMPONENT_ERROR',
  UI_RENDER = 'UI_RENDER',
  UI_STATE_CHANGED = 'UI_STATE_CHANGED',
  
  // События Telegram
  TELEGRAM_AUTH_STARTED = 'TELEGRAM_AUTH_STARTED',
  TELEGRAM_AUTH_SUCCESS = 'TELEGRAM_AUTH_SUCCESS',
  TELEGRAM_AUTH_FAILED = 'TELEGRAM_AUTH_FAILED',
  TELEGRAM_DATA_RECEIVED = 'TELEGRAM_DATA_RECEIVED',
  TELEGRAM_DATA_SENT = 'TELEGRAM_DATA_SENT',
  TELEGRAM_DATA_VALIDATION = 'TELEGRAM_DATA_VALIDATION',
  
  // События API
  API_REQUEST_STARTED = 'API_REQUEST_STARTED',
  API_REQUEST_COMPLETED = 'API_REQUEST_COMPLETED',
  API_REQUEST_FAILED = 'API_REQUEST_FAILED',
  API_RESPONSE_RECEIVED = 'API_RESPONSE_RECEIVED',
  
  // События базы данных
  DB_QUERY_STARTED = 'DB_QUERY_STARTED',
  DB_QUERY_COMPLETED = 'DB_QUERY_COMPLETED',
  DB_QUERY_FAILED = 'DB_QUERY_FAILED',
  DB_USER_CREATED = 'DB_USER_CREATED',
  DB_USER_UPDATED = 'DB_USER_UPDATED',
  DB_USER_FETCH_FAILED = 'DB_USER_FETCH_FAILED',
  
  // События токенов
  TOKEN_GENERATED = 'TOKEN_GENERATED',
  TOKEN_VALIDATED = 'TOKEN_VALIDATED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  TOKEN_SAVED = 'TOKEN_SAVED',
  
  // События сессии
  SESSION_CREATED = 'SESSION_CREATED',
  SESSION_RESTORED = 'SESSION_RESTORED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  SESSION_TERMINATED = 'SESSION_TERMINATED',
  SESSION_VALIDATION = 'SESSION_VALIDATION',
  
  // События сохранения
  SAVE_STARTED = 'SAVE_STARTED',
  SAVE_COMPLETED = 'SAVE_COMPLETED',
  SAVE_FAILED = 'SAVE_FAILED',
  
  // События ошибок
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  UNEXPECTED_ERROR = 'UNEXPECTED_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR'
}

// Уровни логирования
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

// Структура события логирования
export interface AuthLogEvent {
  id: string;
  timestamp: string;
  sessionId: string;
  userId?: string | number;
  telegramId?: string | number;
  eventType: AuthEventType;
  level: LogLevel;
  message: string;
  component?: string;
  location?: string;
  data?: any;
  error?: any;
  duration?: number;
  requestId?: string;
  apiEndpoint?: string;
  httpStatus?: number;
  browser?: string;
  device?: string;
  ip?: string;
  correlationId?: string;
}

// Опции логирования
interface LogOptions {
  storeLocally?: boolean;
  sendToServer?: boolean;
  consoleOutput?: boolean;
  maxLocalEntries?: number;
  sensitiveFields?: string[];
}

/**
 * Класс логгера авторизации для детального отслеживания процесса
 */
class AuthLogger {
  private sessionId: string;
  private logs: AuthLogEvent[] = [];
  private startTime: number = Date.now();
  private lastActivityTime: number = Date.now();
  private options: LogOptions = {
    storeLocally: true,
    sendToServer: true,
    consoleOutput: true,
    maxLocalEntries: 1000,
    sensitiveFields: ['password', 'token', 'jwt', 'auth_token', 'hash']
  };
  
  constructor() {
    this.sessionId = uuidv4();
    this.initLogger();
  }
  
  /**
   * Инициализирует логгер, загружает предыдущие логи из localStorage
   */
  private initLogger(): void {
    try {
      // Загружаем предыдущие логи, если они есть
      const storedLogs = localStorage.getItem('auth_logs');
      if (storedLogs) {
        const parsedLogs = JSON.parse(storedLogs);
        if (Array.isArray(parsedLogs)) {
          // Обрезаем логи, если их слишком много
          this.logs = parsedLogs.slice(-this.options.maxLocalEntries!);
        }
      }
      
      // Определяем информацию о браузере и устройстве
      const browserInfo = this.getBrowserInfo();
      
      // Логируем начало новой сессии
      this.log(
        LogLevel.INFO,
        AuthEventType.SESSION_CREATED,
        'Новая сессия авторизации начата',
        {
          browser: browserInfo.browser,
          device: browserInfo.device,
          userAgent: navigator.userAgent,
          language: navigator.language,
          screenSize: `${window.screen.width}x${window.screen.height}`,
          viewportSize: `${window.innerWidth}x${window.innerHeight}`,
          devicePixelRatio: window.devicePixelRatio,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          sessionStartTime: new Date().toISOString(),
        }
      );
    } catch (error) {
      console.error('Ошибка инициализации AuthLogger:', error);
    }
  }
  
  /**
   * Получает информацию о браузере и устройстве
   */
  private getBrowserInfo(): { browser: string; device: string } {
    try {
      const userAgent = navigator.userAgent;
      let browser = 'Unknown';
      let device = 'Unknown';
      
      // Определяем браузер
      if (userAgent.indexOf('Firefox') > -1) {
        browser = 'Firefox';
      } else if (userAgent.indexOf('SamsungBrowser') > -1) {
        browser = 'Samsung Browser';
      } else if (userAgent.indexOf('Opera') > -1 || userAgent.indexOf('OPR') > -1) {
        browser = 'Opera';
      } else if (userAgent.indexOf('Trident') > -1) {
        browser = 'Internet Explorer';
      } else if (userAgent.indexOf('Edge') > -1) {
        browser = 'Edge';
      } else if (userAgent.indexOf('Chrome') > -1) {
        browser = 'Chrome';
      } else if (userAgent.indexOf('Safari') > -1) {
        browser = 'Safari';
      }
      
      // Определяем устройство
      if (userAgent.indexOf('iPhone') > -1) {
        device = 'iPhone';
      } else if (userAgent.indexOf('iPad') > -1) {
        device = 'iPad';
      } else if (userAgent.indexOf('Android') > -1) {
        device = 'Android';
      } else if (userAgent.indexOf('Win') > -1) {
        device = 'Windows';
      } else if (userAgent.indexOf('Mac') > -1) {
        device = 'MacOS';
      } else if (userAgent.indexOf('Linux') > -1) {
        device = 'Linux';
      }
      
      return { browser, device };
    } catch (error) {
      return { browser: 'Unknown', device: 'Unknown' };
    }
  }
  
  /**
   * Основной метод логирования
   * @param level Уровень логирования
   * @param eventType Тип события
   * @param message Сообщение
   * @param data Дополнительные данные
   * @param error Объект ошибки
   */
  log(level: LogLevel, eventType: AuthEventType, message: string, data?: any, error?: any): string {
    try {
      // Обновляем время последней активности
      this.lastActivityTime = Date.now();
      
      // Создаем идентификатор события
      const eventId = uuidv4();
      
      // Очищаем чувствительные данные
      const sanitizedData = data ? this.sanitizeData(data) : undefined;
      
      // Форматируем ошибку, если она есть
      const errorInfo = error ? this.formatError(error) : undefined;
      
      // Получаем информацию о месте вызова лога
      const stackInfo = this.getCallerInfo();
      
      // Формируем объект события
      const logEvent: AuthLogEvent = {
        id: eventId,
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId,
        eventType,
        level,
        message,
        data: sanitizedData,
        error: errorInfo,
        location: stackInfo.location,
        component: stackInfo.component,
        browser: this.getBrowserInfo().browser,
        device: this.getBrowserInfo().device
      };
      
      // Если есть userId или telegramId в данных, добавляем их в событие
      if (sanitizedData) {
        if (sanitizedData.userId) logEvent.userId = sanitizedData.userId;
        if (sanitizedData.telegramId) logEvent.telegramId = sanitizedData.telegramId;
        
        // Добавляем API endpoint и HTTP статус, если они есть
        if (sanitizedData.endpoint) logEvent.apiEndpoint = sanitizedData.endpoint;
        if (sanitizedData.statusCode) logEvent.httpStatus = sanitizedData.statusCode;
      }
      
      // Сохраняем лог в массив
      this.logs.push(logEvent);
      
      // Выводим в консоль, если включено
      if (this.options.consoleOutput) {
        this.printToConsole(logEvent);
      }
      
      // Сохраняем в localStorage, если включено
      if (this.options.storeLocally) {
        this.saveToLocalStorage();
      }
      
      // Отправляем на сервер, если включено и это критичная ошибка
      if (this.options.sendToServer && (level === LogLevel.ERROR || level === LogLevel.CRITICAL)) {
        this.sendToServer(logEvent);
      }
      
      return eventId;
    } catch (error) {
      console.error('Ошибка при логировании:', error);
      return '';
    }
  }
  
  /**
   * Уровни логирования со стандартными значениями
   */
  debug(eventType: AuthEventType, message: string, data?: any): string {
    return this.log(LogLevel.DEBUG, eventType, message, data);
  }
  
  info(eventType: AuthEventType, message: string, data?: any): string {
    return this.log(LogLevel.INFO, eventType, message, data);
  }
  
  warn(eventType: AuthEventType, message: string, data?: any): string {
    return this.log(LogLevel.WARN, eventType, message, data);
  }
  
  error(eventType: AuthEventType, message: string, data?: any, error?: any): string {
    return this.log(LogLevel.ERROR, eventType, message, data, error);
  }
  
  critical(eventType: AuthEventType, message: string, data?: any, error?: any): string {
    return this.log(LogLevel.CRITICAL, eventType, message, data, error);
  }
  
  /**
   * Логирует замеры производительности
   * @param eventType Тип события
   * @param label Метка для замера
   * @param callback Функция, производительность которой измеряется
   */
  async measure<T>(eventType: AuthEventType, label: string, callback: () => Promise<T>): Promise<T> {
    const startTime = performance.now();
    const requestId = uuidv4();
    
    try {
      this.debug(eventType, `Начало операции: ${label}`, { requestId });
      const result = await callback();
      const duration = performance.now() - startTime;
      
      this.info(
        eventType, 
        `Операция завершена: ${label}`, 
        { requestId, duration: `${duration.toFixed(2)}ms`, result: typeof result }
      );
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.error(
        eventType, 
        `Ошибка операции: ${label}`, 
        { requestId, duration: `${duration.toFixed(2)}ms` },
        error
      );
      throw error;
    }
  }
  
  /**
   * Очищает чувствительные данные перед логированием
   */
  private sanitizeData(data: any): any {
    if (!data) return data;
    
    try {
      // Создаем копию данных
      const sanitized = JSON.parse(JSON.stringify(data));
      
      // Рекурсивно очищаем чувствительные поля
      const sanitizeObject = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        
        Object.keys(obj).forEach(key => {
          // Проверяем, является ли поле чувствительным
          if (this.options.sensitiveFields!.some(field => 
            key.toLowerCase().includes(field.toLowerCase())
          )) {
            obj[key] = '[СКРЫТО]';
          } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            // Рекурсивно обрабатываем вложенные объекты
            sanitizeObject(obj[key]);
          }
        });
      };
      
      sanitizeObject(sanitized);
      return sanitized;
    } catch (error) {
      // В случае ошибки возвращаем безопасную версию
      return { sanitizeError: 'Не удалось безопасно обработать данные' };
    }
  }
  
  /**
   * Форматирует объект ошибки для логирования
   */
  private formatError(error: any): any {
    if (!error) return undefined;
    
    try {
      return {
        message: error.message || 'Неизвестная ошибка',
        name: error.name || 'Error',
        stack: error.stack ? error.stack.split('\n').slice(0, 5).join('\n') : undefined,
        code: error.code,
        status: error.status,
        statusText: error.statusText,
        response: error.response ? {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data ? this.sanitizeData(error.response.data) : undefined
        } : undefined
      };
    } catch (formatError) {
      return { 
        message: 'Ошибка форматирования ошибки',
        originalError: String(error)
      };
    }
  }
  
  /**
   * Получает информацию о вызывающем методе для более точной диагностики
   */
  private getCallerInfo(): { location: string; component: string } {
    try {
      const stackLines = new Error().stack?.split('\n') || [];
      // Пропускаем первые две строки (Error и текущий метод)
      const callerLine = stackLines[3] || '';
      
      // Извлекаем путь файла и номер строки
      const locationMatch = callerLine.match(/at (?:(.+?)\s+\()?(?:(.+?):(\d+)(?::(\d+))?|([^)]+))\)?/);
      
      if (locationMatch) {
        const methodName = locationMatch[1] || '';
        const fileName = (locationMatch[2] || locationMatch[5] || '').split('/').pop() || '';
        const lineNumber = locationMatch[3] || '';
        const columnNumber = locationMatch[4] || '';
        
        // Пытаемся выделить название компонента из имени файла
        const component = fileName.replace(/\.[^/.]+$/, '') || 'unknown';
        
        return {
          location: `${fileName}:${lineNumber}:${columnNumber}`,
          component: `${component}${methodName ? `#${methodName}` : ''}`
        };
      }
      
      return { location: 'unknown', component: 'unknown' };
    } catch (error) {
      return { location: 'error', component: 'error' };
    }
  }
  
  /**
   * Выводит отформатированный лог в консоль
   */
  private printToConsole(logEvent: AuthLogEvent): void {
    const timestamp = new Date(logEvent.timestamp).toLocaleTimeString();
    const prefix = `[AUTH][${timestamp}][${logEvent.level}][${logEvent.eventType}]`;
    
    switch (logEvent.level) {
      case LogLevel.DEBUG:
        console.debug(`${prefix} ${logEvent.message}`, 
          logEvent.data ? { ...logEvent.data, location: logEvent.location } : { location: logEvent.location });
        break;
      case LogLevel.INFO:
        console.info(`${prefix} ${logEvent.message}`, 
          logEvent.data ? { ...logEvent.data, location: logEvent.location } : { location: logEvent.location });
        break;
      case LogLevel.WARN:
        console.warn(`${prefix} ${logEvent.message}`, 
          logEvent.data ? { ...logEvent.data, location: logEvent.location } : { location: logEvent.location });
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(`${prefix} ${logEvent.message}`, 
          logEvent.data ? { ...logEvent.data, location: logEvent.location } : { location: logEvent.location },
          logEvent.error || '');
        break;
    }
  }
  
  /**
   * Сохраняет логи в localStorage
   */
  private saveToLocalStorage(): void {
    try {
      // Ограничиваем количество сохраняемых логов
      const logsToSave = this.logs.slice(-this.options.maxLocalEntries!);
      localStorage.setItem('auth_logs', JSON.stringify(logsToSave));
    } catch (error) {
      console.error('Ошибка сохранения логов в localStorage:', error);
    }
  }
  
  /**
   * Отправляет лог на сервер для анализа
   */
  private async sendToServer(logEvent: AuthLogEvent): Promise<void> {
    try {
      // Проверяем, включена ли отправка на сервер
      if (!this.options.sendToServer) return;
      
      // Проверяем наличие авторитого эндпоинта для логов
      const logEndpoint = '/api/logs/auth';
      
      // Отправляем асинхронно, без ожидания ответа
      fetch(logEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(logEvent),
        // Устанавливаем низкий приоритет для запроса
        priority: 'low',
        // Не ждем ответа, чтобы не блокировать основной поток
        keepalive: true
      }).catch(() => {
        // Игнорируем ошибки отправки логов, чтобы не блокировать работу приложения
      });
    } catch (error) {
      // Игнорируем ошибки, чтобы не блокировать работу приложения
    }
  }
  
  /**
   * Возвращает все сохраненные логи
   */
  getAllLogs(): AuthLogEvent[] {
    return [...this.logs];
  }
  
  /**
   * Возвращает последние N логов
   */
  getRecentLogs(count: number = 50): AuthLogEvent[] {
    return this.logs.slice(-count);
  }
  
  /**
   * Фильтрует логи по различным критериям
   */
  filterLogs({
    level,
    eventType,
    fromDate,
    toDate,
    userId,
    telegramId,
    searchTerm
  }: {
    level?: LogLevel;
    eventType?: AuthEventType;
    fromDate?: Date;
    toDate?: Date;
    userId?: string | number;
    telegramId?: string | number;
    searchTerm?: string;
  }): AuthLogEvent[] {
    return this.logs.filter(log => {
      if (level && log.level !== level) return false;
      if (eventType && log.eventType !== eventType) return false;
      
      if (fromDate) {
        const logDate = new Date(log.timestamp);
        if (logDate < fromDate) return false;
      }
      
      if (toDate) {
        const logDate = new Date(log.timestamp);
        if (logDate > toDate) return false;
      }
      
      if (userId && log.userId !== userId) return false;
      if (telegramId && log.telegramId !== telegramId) return false;
      
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesMessage = log.message.toLowerCase().includes(term);
        const matchesComponent = log.component && log.component.toLowerCase().includes(term);
        const matchesLocation = log.location && log.location.toLowerCase().includes(term);
        
        if (!(matchesMessage || matchesComponent || matchesLocation)) {
          return false;
        }
      }
      
      return true;
    });
  }
  
  /**
   * Очищает все сохраненные логи
   */
  clearLogs(): void {
    this.logs = [];
    localStorage.removeItem('auth_logs');
  }
  
  /**
   * Экспортирует логи в JSON формате
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
  
  /**
   * Создает новую сессию логирования
   */
  createNewSession(): void {
    this.sessionId = uuidv4();
    this.startTime = Date.now();
    this.lastActivityTime = Date.now();
    
    this.info(
      AuthEventType.SESSION_CREATED,
      'Новая сессия создана',
      {
        previousSessionDuration: `${Math.floor((this.lastActivityTime - this.startTime) / 1000)}s`
      }
    );
  }
  
  /**
   * Завершает текущую сессию
   */
  terminateSession(reason?: string): void {
    const sessionDuration = Date.now() - this.startTime;
    
    this.info(
      AuthEventType.SESSION_TERMINATED,
      `Сессия завершена: ${reason || 'По запросу'}`,
      {
        sessionDuration: `${Math.floor(sessionDuration / 1000)}s`,
        logsCount: this.logs.length,
        reason
      }
    );
    
    // Сохраняем финальное состояние в localStorage
    this.saveToLocalStorage();
  }
}

// Создаем и экспортируем глобальный экземпляр логгера
export const authLogger = new AuthLogger();

// Добавляем глобальную обработку необработанных ошибок
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    authLogger.critical(
      AuthEventType.UNEXPECTED_ERROR,
      `Необработанная ошибка: ${event.message}`,
      {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      },
      event.error
    );
  });
  
  window.addEventListener('unhandledrejection', (event) => {
    authLogger.critical(
      AuthEventType.UNEXPECTED_ERROR,
      `Необработанное отклонение промиса: ${event.reason?.message || 'Неизвестная причина'}`,
      {},
      event.reason
    );
  });
  
  // Логируем при закрытии страницы
  window.addEventListener('beforeunload', () => {
    authLogger.info(
      AuthEventType.SESSION_TERMINATED,
      'Сессия завершена: Страница закрыта',
      {
        sessionDuration: `${Math.floor((Date.now() - authLogger['startTime']) / 1000)}s`,
        logsCount: authLogger.getAllLogs().length
      }
    );
  });
} 