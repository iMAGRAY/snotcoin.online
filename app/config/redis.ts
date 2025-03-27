/**
 * Конфигурация для Redis
 * Используется для кэширования игровых состояний
 */

/**
 * Настройки Redis
 */
export interface RedisConfig {
  // Хост Redis
  host: string;
  
  // Порт Redis
  port: number;
  
  // Пароль для аутентификации
  password?: string;
  
  // Использовать TLS/SSL
  tls?: boolean | {
    rejectUnauthorized?: boolean;
    ca?: string[];
    cert?: string;
    key?: string;
  };
  
  // Номер базы данных
  db?: number;
  
  // Префикс для ключей
  keyPrefix?: string;
  
  // Максимальное количество соединений в пуле
  maxConnections?: number;
  
  // Таймаут соединения в миллисекундах
  connectionTimeout?: number;
  
  // Таймаут операций в миллисекундах
  operationTimeout?: number;
  
  // Автоматически переподключаться при ошибке
  autoReconnect?: boolean;
  
  // Максимальное количество попыток переподключения
  maxReconnectAttempts?: number;
  
  // Интервал между попытками переподключения
  reconnectInterval?: number;
  
  // Стратегия повторных попыток подключения
  retryStrategy?: (times: number) => number;
}

/**
 * Время жизни различных типов данных в кэше (в секундах)
 */
export enum CacheTTL {
  // Критические данные (инвентарь, улучшения)
  CRITICAL = 3600 * 24 * 30,  // 30 дней
  
  // Полное состояние игры
  FULL_STATE = 3600 * 24 * 7,  // 7 дней
  
  // Дельты изменений
  DELTAS = 3600 * 24 * 3,     // 3 дня
  
  // Список дельт
  DELTA_LIST = 3600 * 24 * 7,  // 7 дней
  
  // Метаданные пользователя
  USER_METADATA = 3600 * 3,     // 3 часа
  
  // Метаданные игры
  METADATA = 3600 * 24 * 30,  // 30 дней
  
  // Временные данные
  TEMPORARY = 300,  // 5 минут
  
  // Сессионные данные
  SESSION = 1800,  // 30 минут
  
  // Долгосрочное хранение
  PERMANENT = 2592000  // 30 дней
}

/**
 * Префиксы для ключей в Redis
 */
export enum RedisPrefix {
  // Игровые состояния
  GAME_STATE = "game:state:",
  
  // Дельты изменений
  DELTA = "game:delta:",
  
  // Список дельт
  DELTA_LIST = "game:delta:list:",
  
  // Состояние сессии
  SESSION = "user:session:",
  
  // Метаданные пользователя
  USER = "user:metadata:",
  
  // Метаданные игры
  META = "game:meta:",
  
  // Временные данные
  TEMP = "temp:",
  
  // Статистика
  STATS = "stats:",
  
  // Очереди
  QUEUE = "queue:",
  
  // Блокировки
  LOCK = "lock:"
}

/**
 * Конфигурация Redis по умолчанию
 */
export const defaultRedisConfig: RedisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  password: process.env.REDIS_PASSWORD || "",
  tls: process.env.REDIS_USE_TLS === "true",
  db: parseInt(process.env.REDIS_DB || "0", 10),
  keyPrefix: process.env.REDIS_KEY_PREFIX || "snotcoin:",
  maxConnections: parseInt(process.env.REDIS_MAX_CONNECTIONS || "10", 10),
  connectionTimeout: parseInt(process.env.REDIS_CONNECTION_TIMEOUT || "10000", 10),
  operationTimeout: parseInt(process.env.REDIS_OPERATION_TIMEOUT || "5000", 10),
  autoReconnect: true,
  maxReconnectAttempts: parseInt(process.env.REDIS_MAX_RECONNECT_ATTEMPTS || "5", 10),
  reconnectInterval: parseInt(process.env.REDIS_RECONNECT_INTERVAL || "1000", 10),
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 1000, 5000);
    return delay;
  }
};

/**
 * Экспортируем конфигурацию для использования в других модулях
 */
// Проверяем, включен ли Redis через переменную окружения
// По умолчанию Redis включен, если явно не отключен в переменной окружения
export const REDIS_ENABLED = process.env.REDIS_ENABLED !== 'false';

// Если Redis отключен, возвращаем пустую конфигурацию с пустым хостом
const disabledConfig: RedisConfig = {
  ...defaultRedisConfig,
  host: '',  // Пустой хост отключает попытки подключения
  port: 6379,
  autoReconnect: false,
  maxReconnectAttempts: 0,
  connectionTimeout: 1000
};

// Экспортируем итоговую конфигурацию с учетом включения/отключения Redis
export const REDIS_CONFIG = REDIS_ENABLED ? defaultRedisConfig : disabledConfig; 