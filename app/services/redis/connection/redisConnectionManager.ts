/**
 * Менеджер соединения с Redis
 */

import { Redis, RedisOptions } from 'ioredis';
import { RedisSettings } from '../types/redisTypes';
import { TIMEOUTS, MAX_CONNECTION_ATTEMPTS, HEALTH_CHECK_INTERVAL } from '../utils/constants';

/**
 * Класс для управления соединением с Redis
 */
export class RedisConnectionManager {
  /** Клиент для работы с Redis */
  private client: Redis | null = null;
  /** Текущее состояние соединения */
  private connected: boolean = false;
  /** Счетчик попыток соединения */
  private connectionAttempts: number = 0;
  /** Интервал проверки соединения */
  private healthCheckInterval: NodeJS.Timeout | null = null;
  /** Последняя ошибка */
  private lastError: Error | null = null;
  /** Время последней ошибки */
  private lastErrorTime: Date | null = null;
  /** Функции-обработчики успешного соединения */
  private onConnectHandlers: Array<() => void> = [];
  /** Функции-обработчики разрыва соединения */
  private onDisconnectHandlers: Array<() => void> = [];
  /** Функции-обработчики ошибок */
  private onErrorHandlers: Array<(error: Error) => void> = [];
  /** Настройки соединения */
  private settings: RedisSettings;
  /** Флаг инициализации в процессе */
  private initializationInProgress: boolean = false;
  
  /**
   * Создает менеджер соединения с Redis
   * @param settings Настройки соединения
   */
  constructor(settings?: Partial<RedisSettings>) {
    // Используем значения по умолчанию из ENV или заданные настройки
    this.settings = {
      host: settings?.host || process.env.REDIS_HOST || 'localhost',
      port: settings?.port || Number(process.env.REDIS_PORT) || 6379,
      password: settings?.password || process.env.REDIS_PASSWORD,
      connectionTimeout: settings?.connectionTimeout || TIMEOUTS.OPERATION,
      maxRetriesPerRequest: settings?.maxRetriesPerRequest || 3
    };
  }
  
  /**
   * Инициализирует соединение с Redis
   */
  public async initialize(): Promise<boolean> {
    try {
      // Если клиент уже существует, переиспользуем его
      if (this.client && this.connected) {
        return true;
      }
      
      // Настраиваем клиент Redis
      const client = await this.setupConnection();
      
      // Устанавливаем обработчики событий
      this.setupEventHandlers(client);
      
      // Запускаем проверку здоровья соединения
      this.startHealthCheck();
      
      // Сохраняем клиент и обновляем состояние
      this.client = client;
      this.connected = true;
      this.connectionAttempts = 0;
      
      console.log('[Redis] Соединение установлено');
      return true;
    } catch (error) {
      this.handleError(error as Error);
      return false;
    }
  }
  
  /**
   * Возвращает клиент Redis
   */
  public async getClient(): Promise<Redis | null> {
    // Если клиент не инициализирован или соединение не установлено
    if (!this.client || !this.connected) {
      console.log('[Redis] Автоматическая инициализация соединения при запросе клиента');
      
      // Блокировка для предотвращения множественных одновременных инициализаций
      if (!this.initializationInProgress) {
        try {
          this.initializationInProgress = true;
          await this.initialize();
        } catch (error) {
          console.error('[Redis] Ошибка автоматической инициализации:', error);
        } finally {
          this.initializationInProgress = false;
        }
      } else {
        // Если инициализация уже выполняется, ждем небольшое время
        console.log('[Redis] Инициализация уже выполняется, ожидание...');
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Если после инициализации клиент все равно не доступен
      if (!this.client || !this.connected) {
        console.warn('[Redis] Не удалось получить клиент после попытки инициализации');
        return null;
      }
    }
    
    return this.client;
  }
  
  /**
   * Проверяет готовность клиента Redis
   */
  public isReady(): boolean {
    return this.client !== null && this.connected;
  }
  
  /**
   * Настраивает соединение с Redis
   */
  private async setupConnection(): Promise<Redis> {
    console.log('[Redis] Установка соединения с Redis...');
    
    const redisOptions: RedisOptions = {
      host: this.settings.host,
      port: this.settings.port,
      password: this.settings.password,
      connectTimeout: this.settings.connectionTimeout,
      maxRetriesPerRequest: this.settings.maxRetriesPerRequest,
      enableAutoPipelining: true,
      retryStrategy: (times) => {
        // Экспоненциальная задержка для повторных попыток
        if (times > MAX_CONNECTION_ATTEMPTS) {
          console.error(`[Redis] Превышено максимальное количество попыток соединения (${MAX_CONNECTION_ATTEMPTS})`);
          return null; // Прекращаем попытки соединения
        }
        
        const delay = Math.min(
          TIMEOUTS.RECONNECT * Math.pow(2, times),
          60000 // Максимальное время ожидания - 1 минута
        );
        
        console.warn(`[Redis] Повторная попытка соединения через ${delay}мс (попытка ${times})`);
        return delay;
      }
    };
    
    return new Redis(redisOptions);
  }
  
  /**
   * Устанавливает обработчики событий Redis
   * @param client Клиент Redis
   */
  private setupEventHandlers(client: Redis): void {
    // Обработчик успешного соединения
    client.on('connect', () => {
      console.log('[Redis] Соединение установлено');
      this.connected = true;
      this.onConnectHandlers.forEach(handler => handler());
    });
    
    // Обработчик готовности к использованию
    client.on('ready', () => {
      console.log('[Redis] Клиент готов к использованию');
    });
    
    // Обработчик ошибок
    client.on('error', (error: Error) => {
      this.handleError(error);
    });
    
    // Обработчик закрытия соединения
    client.on('close', () => {
      console.warn('[Redis] Соединение закрыто');
      this.connected = false;
      this.onDisconnectHandlers.forEach(handler => handler());
    });
    
    // Обработчик восстановления соединения
    client.on('reconnecting', () => {
      console.log('[Redis] Попытка восстановления соединения...');
      this.connectionAttempts++;
    });
    
    // Обработчик завершения работы
    client.on('end', () => {
      console.warn('[Redis] Клиент завершил работу');
      this.connected = false;
      this.client = null;
      this.onDisconnectHandlers.forEach(handler => handler());
    });
  }
  
  /**
   * Обрабатывает ошибки Redis
   * @param error Объект ошибки
   */
  private handleError(error: Error): void {
    this.lastError = error;
    this.lastErrorTime = new Date();
    
    console.error('[Redis] Ошибка:', error.message);
    
    // Вызываем обработчики ошибок
    this.onErrorHandlers.forEach(handler => handler(error));
  }
  
  /**
   * Запускает периодическую проверку соединения
   */
  private startHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.healthCheckInterval = setInterval(async () => {
      try {
        if (this.client && this.connected) {
          const pong = await this.client.ping();
          if (pong !== 'PONG') {
            console.warn('[Redis] Неверный ответ на PING:', pong);
          }
        } else if (this.client && !this.connected) {
          // Попытка восстановить соединение
          await this.initialize();
        }
      } catch (error) {
        console.error('[Redis] Ошибка проверки соединения:', error);
        this.connected = false;
        // Не вызываем initialize() здесь, чтобы избежать цикла ошибок
      }
    }, HEALTH_CHECK_INTERVAL);
  }
  
  /**
   * Регистрирует обработчик успешного соединения
   * @param handler Функция-обработчик
   */
  public onConnect(handler: () => void): void {
    this.onConnectHandlers.push(handler);
  }
  
  /**
   * Регистрирует обработчик разрыва соединения
   * @param handler Функция-обработчик
   */
  public onDisconnect(handler: () => void): void {
    this.onDisconnectHandlers.push(handler);
  }
  
  /**
   * Регистрирует обработчик ошибок
   * @param handler Функция-обработчик
   */
  public onError(handler: (error: Error) => void): void {
    this.onErrorHandlers.push(handler);
  }
  
  /**
   * Проверяет доступность Redis
   */
  public async isAvailable(): Promise<boolean> {
    if (!this.client) {
      return false;
    }
    
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Возвращает информацию о соединении
   */
  public getConnectionInfo(): any {
    return {
      connected: this.connected,
      lastError: this.lastError ? this.lastError.message : null,
      lastErrorTime: this.lastErrorTime,
      connectionAttempts: this.connectionAttempts,
      host: this.settings.host,
      port: this.settings.port
    };
  }
  
  /**
   * Закрывает соединение с Redis
   */
  public async disconnect(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.connected = false;
    }
  }
}

// Экспортируем singleton
export const redisConnectionManager = new RedisConnectionManager(); 