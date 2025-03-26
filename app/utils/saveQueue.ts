/**
 * Утилиты для управления очередью сохранений с приоритетом
 */

import { CompressedGameState } from "../types/saveTypes";

// Определение типов
interface QueueItem {
  task: () => Promise<void>;
  priority: number;
  timestamp: number;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
}

/**
 * Проверяет, является ли объект сжатым состоянием игры
 */
export function isCompressedGameState(state: any): state is CompressedGameState {
  return state && 
         typeof state === 'object' && 
         state._isCompressed === true &&
         state.critical &&
         state.integrity;
}

class SaveQueue {
  private queue: QueueItem[] = [];
  private isProcessing = false;
  private maxConcurrent = 3; // По умолчанию максимум 3 параллельных запроса
  private activeTasksCount = 0;
  private paused = false;
  private processingTimeout: NodeJS.Timeout | null = null;

  /**
   * Устанавливает максимальное количество параллельных запросов
   */
  setMaxConcurrent(count: number): void {
    this.maxConcurrent = count;
  }

  /**
   * Добавляет задачу в очередь с приоритетом
   * @param task Задача для выполнения
   * @param priority Приоритет (меньшее значение = выше приоритет)
   * @returns Promise, который резолвится после выполнения задачи
   */
  enqueue<T>(task: () => Promise<T>, priority = 5): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        task: async () => {
          try {
            const result = await task();
            resolve(result);
          } catch (error) {
            reject(error);
          }
        },
        priority,
        timestamp: Date.now(),
        resolve,
        reject
      });

      // Запускаем обработку, если она ещё не запущена
      this.processQueue();
    });
  }

  /**
   * Запускает обработку очереди
   */
  private processQueue(): void {
    // Если уже обрабатываем или приостановлены, выходим
    if (this.isProcessing || this.paused) return;

    this.isProcessing = true;

    // Асинхронная функция для обработки
    const process = async () => {
      // Пока есть задачи в очереди и мы не достигли лимита параллельных запросов
      while (this.queue.length > 0 && this.activeTasksCount < this.maxConcurrent && !this.paused) {
        // Сортируем очередь по приоритету, затем по времени добавления
        this.queue.sort((a, b) => {
          // Сначала сравниваем по приоритету (меньшее значение = выше приоритет)
          const priorityDiff = a.priority - b.priority;
          if (priorityDiff !== 0) return priorityDiff;
          
          // Если приоритеты равны, сравниваем по времени добавления
          return a.timestamp - b.timestamp;
        });

        // Берем задачу с самым высоким приоритетом
        const item = this.queue.shift();
        if (!item) continue;

        // Увеличиваем счетчик активных задач
        this.activeTasksCount++;

        // Выполняем задачу асинхронно
        try {
          // Запускаем задачу и ожидаем ее завершения
          await item.task();
        } catch (error) {
          // В случае ошибки пишем в консоль
          console.error('[SaveQueue] Ошибка при выполнении задачи:', error);
        } finally {
          // В любом случае уменьшаем счетчик активных задач
          this.activeTasksCount--;
        }
      }

      // Если очередь пуста или мы на паузе, останавливаем обработку
      if (this.queue.length === 0 || this.paused) {
        this.isProcessing = false;
        if (this.processingTimeout) {
          clearTimeout(this.processingTimeout);
          this.processingTimeout = null;
        }
      } else {
        // Продолжаем обработку через короткий промежуток времени
        this.processingTimeout = setTimeout(() => process(), 100);
      }
    };

    // Запускаем обработку
    process().catch(error => {
      console.error('[SaveQueue] Критическая ошибка при обработке очереди:', error);
      this.isProcessing = false;
    });
  }

  /**
   * Приостанавливает обработку очереди
   */
  pause(): void {
    this.paused = true;
  }

  /**
   * Возобновляет обработку очереди
   */
  resume(): void {
    if (this.paused) {
      this.paused = false;
      // Если есть задачи в очереди, запускаем обработку
      if (this.queue.length > 0 && !this.isProcessing) {
        this.processQueue();
      }
    }
  }

  /**
   * Очищает всю очередь, отклоняя все ожидающие задачи
   */
  clear(): void {
    // Создаем копию очереди
    const queueCopy = [...this.queue];
    
    // Очищаем очередь
    this.queue = [];
    
    // Отклоняем все задачи
    queueCopy.forEach(item => {
      item.reject(new Error('Queue cleared'));
    });
  }

  /**
   * Возвращает количество задач в очереди
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Возвращает статус очереди
   */
  status(): {
    queueSize: number;
    activeTasks: number;
    paused: boolean;
    isProcessing: boolean;
  } {
    return {
      queueSize: this.queue.length,
      activeTasks: this.activeTasksCount,
      paused: this.paused,
      isProcessing: this.isProcessing
    };
  }
}

// Экспортируем одиночный экземпляр очереди сохранений для использования во всем приложении
export const saveQueue = new SaveQueue();

// Экспортируем класс для возможности создания дополнительных экземпляров
export default SaveQueue;

