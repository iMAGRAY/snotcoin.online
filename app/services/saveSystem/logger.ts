/**
 * Система логирования для SaveManager
 * Обеспечивает структурированное и настраиваемое логирование всех операций
 */

export enum LogLevel {
  TRACE = 0,  // Самый детальный уровень для отладки
  DEBUG = 1,  // Подробная отладочная информация
  INFO = 2,   // Информационные сообщения о работе
  WARN = 3,   // Предупреждения, не блокирующие работу
  ERROR = 4,  // Ошибки, которые могут влиять на работу
  FATAL = 5,  // Критические ошибки, блокирующие работу
  NONE = 6    // Логирование выключено
}

export enum LogCategory {
  INIT = 'INIT',           // Инициализация системы
  SAVE = 'SAVE',           // Операции сохранения
  LOAD = 'LOAD',           // Операции загрузки
  BACKUP = 'BACKUP',       // Резервное копирование
  INDEXEDDB = 'INDEXEDDB', // Операции с IndexedDB
  LOCALSTORAGE = 'LOCALSTORAGE', // Операции с localStorage
  CRYPTO = 'CRYPTO',       // Шифрование/хеширование
  SYNC = 'SYNC',           // Синхронизация
  INTEGRITY = 'INTEGRITY', // Проверка целостности
  RECOVERY = 'RECOVERY',   // Восстановление данных
  GENERAL = 'GENERAL'      // Общие сообщения
}

interface LogOptions {
  timestamp?: boolean;  // Добавлять временную метку
  category?: boolean;   // Показывать категорию
  level?: boolean;      // Показывать уровень
  prefix?: boolean;     // Добавлять префикс [SaveManager]
  userId?: boolean;     // Показывать ID пользователя (если есть)
  source?: boolean;     // Показывать источник (файл/адаптер)
  color?: boolean;      // Использовать цветное форматирование
  groupLogs?: boolean;  // Группировать связанные логи
}

interface LogEntry {
  level: LogLevel;
  category: LogCategory;
  message: string;
  userId?: string;
  source?: string;
  timestamp: number;
  data?: any;
  duration?: number;
  error?: Error;
}

type LogListener = (entry: LogEntry) => void;

class SaveLogger {
  private level: LogLevel = LogLevel.INFO;
  private enabled: boolean = true;
  private history: LogEntry[] = [];
  private historySize: number = 100;
  private listeners: LogListener[] = [];
  private pendingOperations: Map<string, { start: number, category: LogCategory }> = new Map();
  private defaultOptions: LogOptions = {
    timestamp: true,
    category: true,
    level: true,
    prefix: true,
    userId: true,
    source: true,
    color: true,
    groupLogs: true
  };

  /**
   * Устанавливает уровень логирования
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Включает или выключает логирование
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Устанавливает максимальный размер истории логов
   */
  setHistorySize(size: number): void {
    this.historySize = size;
    // Обрезаем историю, если она превышает новый размер
    if (this.history.length > size) {
      this.history = this.history.slice(this.history.length - size);
    }
  }

  /**
   * Добавляет слушателя логов
   */
  addListener(listener: LogListener): void {
    this.listeners.push(listener);
  }

  /**
   * Удаляет слушателя логов
   */
  removeListener(listener: LogListener): void {
    const index = this.listeners.indexOf(listener);
    if (index >= 0) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Возвращает историю логов
   */
  getHistory(): LogEntry[] {
    return [...this.history];
  }

  /**
   * Очищает историю логов
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Начинает отслеживание длительности операции
   */
  startOperation(operationId: string, category: LogCategory): void {
    this.pendingOperations.set(operationId, {
      start: performance.now(),
      category
    });
  }

  /**
   * Завершает отслеживание длительности операции и возвращает время в мс
   */
  endOperation(operationId: string): number {
    const operation = this.pendingOperations.get(operationId);
    if (!operation) return 0;
    
    const duration = performance.now() - operation.start;
    this.pendingOperations.delete(operationId);
    return duration;
  }

  /**
   * Функции логирования различных уровней
   */
  trace(category: LogCategory, message: string, data?: any, userId?: string, source?: string): void {
    this.log(LogLevel.TRACE, category, message, data, userId, source);
  }

  debug(category: LogCategory, message: string, data?: any, userId?: string, source?: string): void {
    this.log(LogLevel.DEBUG, category, message, data, userId, source);
  }

  info(category: LogCategory, message: string, data?: any, userId?: string, source?: string): void {
    this.log(LogLevel.INFO, category, message, data, userId, source);
  }

  warn(category: LogCategory, message: string, data?: any, userId?: string, source?: string, error?: Error): void {
    this.log(LogLevel.WARN, category, message, data, userId, source, error);
  }

  error(category: LogCategory, message: string, data?: any, userId?: string, source?: string, error?: Error): void {
    this.log(LogLevel.ERROR, category, message, data, userId, source, error);
  }

  fatal(category: LogCategory, message: string, data?: any, userId?: string, source?: string, error?: Error): void {
    this.log(LogLevel.FATAL, category, message, data, userId, source, error);
  }

  /**
   * Основной метод логирования
   */
  private log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    data?: any,
    userId?: string,
    source?: string,
    error?: Error
  ): void {
    // Проверяем, включено ли логирование и соответствует ли сообщение текущему уровню
    if (!this.enabled || level < this.level) {
      return;
    }

    // Создаем запись лога
    const entry: LogEntry = {
      level,
      category,
      message,
      userId,
      source,
      timestamp: Date.now(),
      data,
      error
    };

    // Добавляем в историю
    this.history.push(entry);
    
    // Обрезаем историю, если она превышает максимальный размер
    if (this.history.length > this.historySize) {
      this.history.shift();
    }

    // Уведомляем всех слушателей
    for (const listener of this.listeners) {
      try {
        listener(entry);
      } catch (listenerError) {
        // Игнорируем ошибки в слушателях
      }
    }

    // Логируем в консоль с форматированием
    this.consoleLog(entry);
  }

  /**
   * Форматирует сообщение для вывода в консоль
   */
  private consoleLog(entry: LogEntry): void {
    const options = this.defaultOptions;
    
    // Формируем префикс сообщения
    let prefix = '';
    if (options.prefix) {
      prefix += '[SaveManager] ';
    }
    if (options.timestamp) {
      const date = new Date(entry.timestamp);
      prefix += `[${date.toLocaleTimeString()}.${date.getMilliseconds().toString().padStart(3, '0')}] `;
    }
    if (options.level) {
      const levelStr = LogLevel[entry.level].padEnd(5, ' ');
      prefix += `[${levelStr}] `;
    }
    if (options.category) {
      prefix += `[${entry.category}] `;
    }
    if (options.userId && entry.userId) {
      prefix += `[User: ${entry.userId}] `;
    }
    if (options.source && entry.source) {
      prefix += `[${entry.source}] `;
    }

    // Форматируем сообщение
    const formattedMessage = `${prefix}${entry.message}`;

    // Выбираем соответствующий метод консоли
    let consoleMethod: (...args: any[]) => void;
    let consoleColor: string;
    
    switch (entry.level) {
      case LogLevel.TRACE:
        consoleMethod = console.debug;
        consoleColor = 'color: #888888';
        break;
      case LogLevel.DEBUG:
        consoleMethod = console.debug;
        consoleColor = 'color: #333333';
        break;
      case LogLevel.INFO:
        consoleMethod = console.info;
        consoleColor = 'color: #0066cc';
        break;
      case LogLevel.WARN:
        consoleMethod = console.warn;
        consoleColor = 'color: #ff9900';
        break;
      case LogLevel.ERROR:
        consoleMethod = console.error;
        consoleColor = 'color: #cc0000';
        break;
      case LogLevel.FATAL:
        consoleMethod = console.error;
        consoleColor = 'color: #990000; font-weight: bold';
        break;
      default:
        consoleMethod = console.log;
        consoleColor = '';
    }

    // Логируем с форматированием
    if (options.color && consoleColor && typeof window !== 'undefined') {
      consoleMethod(`%c${formattedMessage}`, consoleColor);
    } else {
      consoleMethod(formattedMessage);
    }

    // Логируем дополнительные данные, если они есть
    if (entry.data) {
      console.log('Данные:', entry.data);
    }

    // Логируем ошибку, если она есть
    if (entry.error) {
      console.error('Ошибка:', entry.error);
    }
  }
}

// Создаем глобальный экземпляр логгера
export const saveLogger = new SaveLogger();

// Добавляем слушателя для отправки логов в localStorage для просмотра в инструментах разработчика
if (typeof window !== 'undefined' && window.localStorage) {
  saveLogger.addListener((entry) => {
    try {
      // Сохраняем только ошибки и предупреждения
      if (entry.level >= LogLevel.WARN) {
        const logs = JSON.parse(localStorage.getItem('save_manager_logs') || '[]');
        logs.push({
          level: LogLevel[entry.level],
          category: entry.category,
          message: entry.message,
          timestamp: entry.timestamp,
          userId: entry.userId,
          source: entry.source
        });
        
        // Ограничиваем количество сохраненных логов
        if (logs.length > 100) {
          logs.shift();
        }
        
        localStorage.setItem('save_manager_logs', JSON.stringify(logs));
      }
    } catch (e) {
      // Игнорируем ошибки при сохранении логов
    }
  });
}

// Экспортируем дополнительные удобные функции для логирования
export const log = {
  trace: saveLogger.trace.bind(saveLogger),
  debug: saveLogger.debug.bind(saveLogger),
  info: saveLogger.info.bind(saveLogger),
  warn: saveLogger.warn.bind(saveLogger),
  error: saveLogger.error.bind(saveLogger),
  fatal: saveLogger.fatal.bind(saveLogger)
};

export default saveLogger; 