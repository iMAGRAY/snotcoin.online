import Redis from 'ioredis';
import type { RedisClient } from '@/app/types/redis';

// Создаем клиент Redis с настройками
const redisClient: RedisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
  db: parseInt(process.env.REDIS_DB || '0'),
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  autoResubscribe: true,
  reconnectOnError: (err) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  }
});

// Обработка ошибок подключения
redisClient.on('error', (error) => {
  console.error('Ошибка подключения к Redis:', error);
});

// Обработка успешного подключения
redisClient.on('connect', () => {
  console.log('Успешное подключение к Redis');
});

// Обработка переподключения
redisClient.on('reconnecting', () => {
  console.log('Переподключение к Redis...');
});

export { redisClient }; 