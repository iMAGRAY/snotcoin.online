/**
 * Сервис для управления очередью сохранений
 * Обеспечивает буферизацию и оптимизацию операций сохранения
 */
import type { ExtendedGameState } from '../../types/gameTypes';
import * as api from '../api/apiService';
import { getMemoryStore } from '../storage/memoryStorageService';
import { saveGameState } from '../dataServiceModular';

// Тип элемента очереди сохранений
interface SaveQueueItem {
  userId: string;
  gameState: ExtendedGameState;
  priority: number;
  timestamp: number;
  retryCount: number;
  isCritical: boolean;
}

// Очередь сохранений
let saveQueue: SaveQueueItem[] = [];

// Флаг для отслеживания выполнения пакетного сохранения
let isBatchProcessing = false;

// Таймер для отложенного пакетного сохранения
let batchSaveTimer: NodeJS.Timeout | null = null;

// Максимальное количество повторных попыток сохранения
const MAX_RETRY_COUNT = 3;

// Временной интервал между пакетными сохранениями (5 секунд)
const BATCH_SAVE_INTERVAL = 5000;

/**
 * Добавляет задачу сохранения в очередь
 * @param userId ID пользователя
 * @param gameState Состояние игры
 * @param priority Приоритет (больше - выше)
 * @param isCritical Флаг критичности сохранения
 */
export const addSaveToQueue = (
  userId: string,
  gameState: ExtendedGameState,
  priority = 0,
  isCritical = false
): void => {
  try {
    if (!userId || !gameState) {
      console.warn('[SaveQueue] Попытка добавить некорректные данные в очередь сохранений');
      return;
    }
    
    // Обновляем существующий элемент в очереди или добавляем новый
    const existingItemIndex = saveQueue.findIndex(item => item.userId === userId);
    
    if (existingItemIndex >= 0) {
      // Обновляем существующую запись
      const existingItem = saveQueue[existingItemIndex];
      
      // Если новый приоритет выше, или это критическое сохранение, обновляем
      if (priority > existingItem.priority || isCritical) {
        saveQueue[existingItemIndex] = {
          userId,
          gameState,
          priority: Math.max(priority, existingItem.priority),
          timestamp: Date.now(),
          retryCount: 0,
          isCritical: existingItem.isCritical || isCritical
        };
        
        console.log(`[SaveQueue] Обновлен элемент очереди сохранений для ${userId}`);
      }
    } else {
      // Создаем новую запись
      saveQueue.push({
        userId,
        gameState,
        priority,
        timestamp: Date.now(),
        retryCount: 0,
        isCritical
      });
      
      console.log(`[SaveQueue] Добавлен новый элемент в очередь сохранений для ${userId}`);
    }
    
    // Запускаем отложенное пакетное сохранение, если оно еще не запущено
    if (!isBatchProcessing && !batchSaveTimer) {
      batchSaveTimer = setTimeout(() => {
        processBatchSaves();
        batchSaveTimer = null;
      }, BATCH_SAVE_INTERVAL);
      
      console.log(`[SaveQueue] Запланировано пакетное сохранение через ${BATCH_SAVE_INTERVAL}мс`);
    }
  } catch (error) {
    console.error('[SaveQueue] Ошибка при добавлении элемента в очередь сохранений:', error);
  }
};

/**
 * Обрабатывает пакетное сохранение
 */
export async function processBatchSaves(): Promise<void> {
  if (saveQueue.length === 0) {
    console.log('[SaveQueue] Очередь сохранений пуста');
    return;
  }

  console.log(`[SaveQueue] Начало обработки пакетного сохранения, элементов в очереди: ${saveQueue.length}`);
  
  const results: { userId: string; success: boolean }[] = [];
  const processedUsers = new Set<string>();
  
  // Сортируем очередь по приоритету
  saveQueue.sort((a, b) => b.priority - a.priority);
  
  // Обрабатываем каждый элемент очереди
  for (const item of saveQueue) {
    const { userId, gameState, priority, isCritical } = item;
    
    // Пропускаем, если пользователь уже обработан
    if (processedUsers.has(userId)) {
      console.log(`[SaveQueue] Пропускаем дублирующее сохранение для ${userId}`);
      continue;
    }
    
    try {
      console.log(`[SaveQueue] Обработка сохранения для ${userId}`);
      
      // Проверяем минимальный интервал между сохранениями
      const now = Date.now();
      const lastSaveTime = getMemoryStore().getLastSaveTime(userId);
      const MIN_SAVE_INTERVAL = isCritical ? 2000 : 5000;
      
      if (now - lastSaveTime < MIN_SAVE_INTERVAL) {
        console.log(`[SaveQueue] Слишком частые сохранения для ${userId}, ожидаем ${MIN_SAVE_INTERVAL - (now - lastSaveTime)}мс`);
        continue;
      }
      
      // Сохраняем состояние
      await saveGameState(userId, gameState, isCritical);
      
      results.push({ userId, success: true });
      processedUsers.add(userId);
      
      console.log(`[SaveQueue] Успешное сохранение для ${userId}`);
    } catch (error) {
      console.error(`[SaveQueue] Ошибка при сохранении для ${userId}:`, error);
      results.push({ userId, success: false });
    }
  }
  
  // Очищаем обработанные элементы из очереди
  saveQueue = saveQueue.filter(item => !processedUsers.has(item.userId));
  
  // Выводим статистику
  const successCount = results.filter(r => r.success).length;
  console.log(`[SaveQueue] Пакетное сохранение завершено, успешных: ${successCount}/${results.length}, осталось элементов: ${saveQueue.length}`);
}

/**
 * Проверяет наличие ожидающих изменений для пользователя
 * @param userId ID пользователя
 * @returns true если есть ожидающие изменения, иначе false
 */
export const hasPendingChanges = (userId: string): boolean => {
  return saveQueue.some(item => item.userId === userId);
};

/**
 * Получает количество ожидающих сохранений
 * @returns Количество элементов в очереди
 */
export const getPendingSavesCount = (): number => {
  return saveQueue.length;
};

/**
 * Очищает очередь сохранений
 */
export const clearSaveQueue = (): void => {
  saveQueue.length = 0;
  
  // Очищаем таймер, если он установлен
  if (batchSaveTimer) {
    clearTimeout(batchSaveTimer);
    batchSaveTimer = null;
  }
  
  console.log('[SaveQueue] Очередь сохранений очищена');
};

/**
 * Отменяет все ожидающие сохранения для пользователя
 * @param userId ID пользователя
 * @returns Количество отмененных сохранений
 */
export const cancelSavesForUser = (userId: string): number => {
  const initialCount = saveQueue.length;
  
  // Фильтруем очередь, оставляя только элементы для других пользователей
  const filteredQueue = saveQueue.filter(item => item.userId !== userId);
  
  // Заменяем содержимое очереди
  saveQueue.length = 0;
  saveQueue.push(...filteredQueue);
  
  const canceledCount = initialCount - saveQueue.length;
  
  if (canceledCount > 0) {
    console.log(`[SaveQueue] Отменено ${canceledCount} сохранений для пользователя ${userId}`);
  }
  
  return canceledCount;
}; 