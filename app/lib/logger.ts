/**
 * Логгер приложения
 */

// Конфигурация уровней логирования
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent';

// Стандартный уровень логирования
const DEFAULT_LOG_LEVEL: LogLevel = 
  (process.env.LOG_LEVEL as LogLevel) || 'info';

// Включен ли режим отладки
const DEBUG_MODE = process.env.NODE_ENV !== 'production' || 
                  process.env.DEBUG === 'true';

// Числовые уровни для сравнения
const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
  silent: 6
};

// Служебная функция форматирования даты для логов
function formatDate(date: Date): string {
  return date.toISOString();
}

// Параметры логгера
export interface LoggerOptions {
  level?: LogLevel;
  component?: string;
  enabled?: boolean;
  prefix?: string;
}

/**
 * Базовый класс логгера
 */
export class Logger {
  private level: LogLevel;
  private component: string;
  private enabled: boolean;
  private prefix: string;
  
  constructor(options: LoggerOptions = {}) {
    this.level = options.level || DEFAULT_LOG_LEVEL;
    this.component = options.component || 'app';
    this.enabled = options.enabled !== false;
    this.prefix = options.prefix || '';
  }
  
  /**
   * Создает дочерний логгер с дополнительным контекстом
   */
  child(options: LoggerOptions): Logger {
    return new Logger({
      level: options.level || this.level,
      component: options.component || this.component,
      enabled: options.enabled !== undefined ? options.enabled : this.enabled,
      prefix: `${this.prefix}${options.prefix || ''}`
    });
  }
  
  /**
   * Проверяет, должно ли сообщение быть залогировано на текущем уровне
   */
  private shouldLog(messageLevel: LogLevel): boolean {
    return (
      this.enabled && 
      LOG_LEVEL_VALUES[messageLevel] >= LOG_LEVEL_VALUES[this.level]
    );
  }
  
  /**
   * Форматирует сообщение лога
   */
  private formatMessage(level: string, message: string, data: any = {}): string {
    const timestamp = formatDate(new Date());
    const prefix = this.prefix ? `${this.prefix} ` : '';
    
    if (typeof data === 'object' && data !== null) {
      // Преобразование объекта в строку, исключая циклические ссылки
      try {
        const dataStr = JSON.stringify(data);
        return `[${timestamp}] [${level.toUpperCase()}] [${this.component}] ${prefix}${message} ${dataStr}`;
      } catch (e) {
        return `[${timestamp}] [${level.toUpperCase()}] [${this.component}] ${prefix}${message} [Невозможно сериализовать данные]`;
      }
    }
    
    return `[${timestamp}] [${level.toUpperCase()}] [${this.component}] ${prefix}${message}`;
  }
  
  /**
   * Логирует сообщение с указанным уровнем
   */
  private log(level: LogLevel, message: string, data?: any): void {
    if (!this.shouldLog(level)) return;
    
    const formattedMessage = this.formatMessage(level, message, data);
    
    switch (level) {
      case 'trace':
      case 'debug':
        if (DEBUG_MODE) {
          console.debug(formattedMessage);
        }
        break;
      case 'info':
        console.info(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      case 'error':
      case 'fatal':
        console.error(formattedMessage);
        break;
      default:
        // silent и неизвестные уровни не логируются
        break;
    }
  }
  
  // Методы логирования разных уровней
  trace(message: string, data?: any): void {
    this.log('trace', message, data);
  }
  
  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }
  
  info(message: string, data?: any): void {
    this.log('info', message, data);
  }
  
  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }
  
  error(message: string, data?: any): void {
    this.log('error', message, data);
  }
  
  fatal(message: string, data?: any): void {
    this.log('fatal', message, data);
  }
}

// Основной экземпляр логгера
export const logger = new Logger();

// Логгеры компонентов
export const apiLogger = logger.child({ component: 'api' });
export const authLogger = logger.child({ component: 'auth' });
export const gameLogger = logger.child({ component: 'game' });
export const dbLogger = logger.child({ component: 'db' });
export const clientLogger = logger.child({ component: 'client' });
export const serverLogger = logger.child({ component: 'server' });

// Инструмент для логирования времени выполнения операций
export function logTiming(operationName: string, callback: () => any, logger = apiLogger): any {
  const start = performance.now();
  try {
    const result = callback();
    const duration = performance.now() - start;
    
    logger.debug(`Операция "${operationName}" выполнена за ${duration.toFixed(2)}ms`);
    
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    logger.error(`Ошибка в операции "${operationName}" через ${duration.toFixed(2)}ms`, { error });
    throw error;
  }
}

// Асинхронная версия логирования времени
export async function logTimingAsync<T>(
  operationName: string, 
  callback: () => Promise<T>, 
  logger = apiLogger
): Promise<T> {
  const start = performance.now();
  try {
    const result = await callback();
    const duration = performance.now() - start;
    
    logger.debug(`Асинхронная операция "${operationName}" выполнена за ${duration.toFixed(2)}ms`);
    
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    logger.error(`Ошибка в асинхронной операции "${operationName}" через ${duration.toFixed(2)}ms`, { error });
    throw error;
  }
} 