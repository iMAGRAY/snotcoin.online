/**
 * Модуль для работы с Redis
 */

// Основные сервисы
export { redisService } from './core/redisService';
export { RedisService } from './core/redisService';
export { RedisServiceFactory, getRedisService } from './core/redisServiceFactory';

// Компоненты кэширования
export { redisCacheAdapter } from './cache/redisCacheAdapter';
export { memoryCacheManager } from './cache/memoryCacheManager';

// Компоненты соединения
export { redisConnectionManager } from './connection/redisConnectionManager';

// Компоненты синхронизации
export { gameStateSynchronizer } from './sync/gameStateSynchronizer';

// Типы и константы
export * from './types/redisTypes';
export * from './utils/constants'; 