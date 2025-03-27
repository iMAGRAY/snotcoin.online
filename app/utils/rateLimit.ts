/**
 * Простая утилита для контроля частоты запросов от клиентов
 * Использует память процесса, поэтому работает только в рамках одного экземпляра сервера
 * Для production-среды рекомендуется использовать Redis или подобные решения
 */

// Хранилище счетчиков запросов
const rateLimitStore: Record<string, {
  count: number;
  resetTime: number;
}> = {};

// Очистка старых записей каждые 5 минут
const CLEANUP_INTERVAL = 5 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const key in rateLimitStore) {
    if (rateLimitStore[key].resetTime < now) {
      delete rateLimitStore[key];
    }
  }
}, CLEANUP_INTERVAL);

/**
 * Проверяет, не превышен ли лимит запросов для данного ключа
 * @param key Уникальный ключ для идентификации клиента (например, userId)
 * @param limit Максимальное количество запросов в окне
 * @param windowMs Размер временного окна в миллисекундах
 * @returns Объект с информацией о результате проверки
 */
export async function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const resetTime = Math.floor(now / windowMs) * windowMs + windowMs;
  
  // Создаем новую запись, если ключ не существует или истекло предыдущее окно
  if (!rateLimitStore[key] || rateLimitStore[key].resetTime <= now) {
    rateLimitStore[key] = {
      count: 1,
      resetTime
    };
    return {
      success: true,
      remaining: limit - 1,
      reset: resetTime
    };
  }
  
  // Инкрементируем счетчик, если не превышен лимит
  if (rateLimitStore[key].count < limit) {
    rateLimitStore[key].count++;
    return {
      success: true,
      remaining: limit - rateLimitStore[key].count,
      reset: resetTime
    };
  }
  
  // Лимит превышен
  return {
    success: false,
    remaining: 0,
    reset: rateLimitStore[key].resetTime
  };
} 