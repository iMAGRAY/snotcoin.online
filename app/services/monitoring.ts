/**
 * Утилита для мониторинга сохранений игры
 */

import { apiLogger as logger } from '../lib/logger';

// Интерфейс для статистики сохранений
interface SaveStats {
  totalSaves: number;
  successfulSaves: number;
  failedSaves: number;
  concurrentSaves: number;
  providerStats: Record<string, {
    total: number;
    success: number;
    failed: number;
  }>;
  lastSaveTime: number;
}

// Глобальная статистика
const saveStats: SaveStats = {
  totalSaves: 0,
  successfulSaves: 0,
  failedSaves: 0,
  concurrentSaves: 0,
  providerStats: {},
  lastSaveTime: Date.now()
};

/**
 * Фиксирует попытку сохранения
 * @param userId ID пользователя
 * @param provider Провайдер аутентификации
 * @param success Успешно ли выполнено сохранение
 * @param isConcurrent Конкурентное ли это сохранение
 */
export function recordSaveAttempt(
  userId: string, 
  provider: string = 'unknown', 
  success: boolean = true, 
  isConcurrent: boolean = false
) {
  try {
    // Увеличиваем общие счетчики
    saveStats.totalSaves++;
    
    if (success) {
      saveStats.successfulSaves++;
    } else {
      saveStats.failedSaves++;
    }
    
    if (isConcurrent) {
      saveStats.concurrentSaves++;
    }
    
    // Обновляем время последнего сохранения
    saveStats.lastSaveTime = Date.now();
    
    // Статистика по провайдерам
    if (!saveStats.providerStats[provider]) {
      saveStats.providerStats[provider] = {
        total: 0,
        success: 0,
        failed: 0
      };
    }
    
    saveStats.providerStats[provider].total++;
    
    if (success) {
      saveStats.providerStats[provider].success++;
    } else {
      saveStats.providerStats[provider].failed++;
    }
    
    // Каждые 100 сохранений логируем статистику
    if (saveStats.totalSaves % 100 === 0) {
      logger.info('Статистика сохранений игры', { 
        stats: saveStats,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    // В случае ошибки просто логируем её
    logger.error('Ошибка при записи статистики сохранений', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Получает текущую статистику сохранений
 * @returns Копия объекта со статистикой
 */
export function getSaveStats(): SaveStats {
  // Возвращаем копию объекта
  return JSON.parse(JSON.stringify(saveStats));
}

/**
 * Сбрасывает статистику сохранений
 */
export function resetSaveStats() {
  saveStats.totalSaves = 0;
  saveStats.successfulSaves = 0;
  saveStats.failedSaves = 0;
  saveStats.concurrentSaves = 0;
  saveStats.providerStats = {};
  saveStats.lastSaveTime = Date.now();
  
  logger.info('Статистика сохранений сброшена', {
    timestamp: new Date().toISOString()
  });
}

// Экспортируем интерфейс и функции
export type { SaveStats }; 