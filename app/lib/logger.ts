/**
 * Модуль структурированного логирования
 */

// Определяем уровни логирования
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

// Тип для метаданных лога
export interface LogMetadata {
  [key: string]: any;
}

// Основной класс логгера
class Logger {
  private serviceName: string;
  private minLevel: LogLevel;
  
  /**
   * Создает экземпляр логгера
   * @param serviceName Название сервиса для идентификации логов
   * @param minLevel Минимальный уровень логирования
   */
  constructor(serviceName: string, minLevel: LogLevel = LogLevel.INFO) {
    this.serviceName = serviceName;
    this.minLevel = minLevel;
    
    // Используем настройки из переменных окружения, если они доступны
    if (process.env.LOG_LEVEL) {
      this.minLevel = process.env.LOG_LEVEL as LogLevel;
    }
  }
  
  /**
   * Форматирует сообщение лога в JSON
   */
  private formatLog(level: LogLevel, message: string, metadata?: LogMetadata): string {
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      level,
      service: this.serviceName,
      message,
      ...metadata,
    };
    
    return JSON.stringify(logData);
  }
  
  /**
   * Проверяет, нужно ли логировать указанный уровень
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentLevelIndex = levels.indexOf(this.minLevel);
    const targetLevelIndex = levels.indexOf(level);
    
    return targetLevelIndex >= currentLevelIndex;
  }
  
  /**
   * Логирует сообщение уровня DEBUG
   */
  public debug(message: string, metadata?: LogMetadata): void {
    // Отключено для production режима
    return;
  }
  
  /**
   * Логирует сообщение уровня INFO
   */
  public info(message: string, metadata?: LogMetadata): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatLog(LogLevel.INFO, message, metadata));
    }
  }
  
  /**
   * Логирует сообщение уровня WARN
   */
  public warn(message: string, metadata?: LogMetadata): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatLog(LogLevel.WARN, message, metadata));
    }
  }
  
  /**
   * Логирует сообщение уровня ERROR
   */
  public error(message: string, metadata?: LogMetadata): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatLog(LogLevel.ERROR, message, metadata));
    }
  }
  
  /**
   * Создает дочерний логгер с дополнительным контекстом
   */
  public child(context: LogMetadata): Logger {
    const childLogger = new Logger(this.serviceName, this.minLevel);
    
    // Переопределяем методы для добавления контекста
    const originalMethods = {
      debug: childLogger.debug.bind(childLogger),
      info: childLogger.info.bind(childLogger),
      warn: childLogger.warn.bind(childLogger),
      error: childLogger.error.bind(childLogger),
    };
    
    childLogger.debug = (message: string, metadata?: LogMetadata) => {
      originalMethods.debug(message, { ...context, ...metadata });
    };
    
    childLogger.info = (message: string, metadata?: LogMetadata) => {
      originalMethods.info(message, { ...context, ...metadata });
    };
    
    childLogger.warn = (message: string, metadata?: LogMetadata) => {
      originalMethods.warn(message, { ...context, ...metadata });
    };
    
    childLogger.error = (message: string, metadata?: LogMetadata) => {
      originalMethods.error(message, { ...context, ...metadata });
    };
    
    return childLogger;
  }
}

// Создаем и экспортируем экземпляр логгера
export const logger = new Logger('game-service');

// Создаем предварительно настроенные логгеры для разных компонентов
export const apiLogger = logger.child({ component: 'api' });
export const redisLogger = logger.child({ component: 'redis' });
export const dbLogger = logger.child({ component: 'database' });
export const syncLogger = logger.child({ component: 'sync' });

// Функция для логирования времени выполнения
export function logTiming<T>(
  fn: () => Promise<T>,
  message: string,
  targetLogger = logger
): Promise<T> {
  const start = performance.now();
  
  return fn().then(result => {
    const elapsed = performance.now() - start;
    targetLogger.info(`${message} - выполнено за ${elapsed.toFixed(2)}мс`);
    return result;
  }).catch(error => {
    const elapsed = performance.now() - start;
    targetLogger.error(`${message} - ошибка за ${elapsed.toFixed(2)}мс`, { error: error.message });
    throw error;
  });
}

// По умолчанию экспортируем основной логгер
export default logger; 