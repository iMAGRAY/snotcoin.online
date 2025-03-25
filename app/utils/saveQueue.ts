/**
 * Утилита для управления очередью сохранений игровых данных
 */

// Тип задачи в очереди сохранений
type SaveTask = () => Promise<void>;

/**
 * Элемент очереди
 */
interface QueueItem {
  task: () => Promise<void>;
  priority: number;
  timestamp: number;
  resolve: (value: void | PromiseLike<void>) => void;
  reject: (reason?: any) => void;
}

/**
 * Очередь сохранений с приоритетами
 */
class SaveQueue {
  private items: QueueItem[] = [];
  private isProcessing: boolean = false;
  private maxConcurrent: number = 1;
  private activeCount: number = 0;
  private isShuttingDown: boolean = false;
  private maxRetries: number = 3;
  
  /**
   * Добавляет задачу в очередь
   * @param task Задача для выполнения
   * @param priority Приоритет задачи (меньше = выше приоритет)
   * @returns Promise, который разрешится, когда задача будет выполнена
   */
  enqueue<T>(task: () => Promise<T>, priority: number = 5): Promise<T> {
    // Проверяем, не закрывается ли очередь
    if (this.isShuttingDown) {
      return Promise.reject(new Error('Queue is shutting down'));
    }
    
    // Создаем и возвращаем Promise
    return new Promise<T>((resolve, reject) => {
      // Оборачиваем задачу, чтобы отслеживать её выполнение
      const wrappedTask = async (): Promise<void> => {
        let retries = 0;
        while (retries <= this.maxRetries) {
          try {
            const result = await task();
            resolve(result);
            return;
          } catch (error) {
            retries++;
            if (retries > this.maxRetries) {
              reject(error);
              return;
            }
            // Экспоненциальная задержка перед повторной попыткой
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, retries - 1)));
          }
        }
      };
      
      // Добавляем задачу в очередь
      this.items.push({
        task: wrappedTask,
        priority,
        timestamp: Date.now(),
        resolve: resolve as any,
        reject
      });
      
      // Сортируем очередь по приоритету
      this.items.sort((a, b) => {
        // Сначала по приоритету
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        // Затем по времени (FIFO)
        return a.timestamp - b.timestamp;
      });
      
      // Запускаем обработку, если она еще не идет
      if (!this.isProcessing) {
        this.processNext();
      }
    });
  }
  
  /**
   * Обрабатывает следующую задачу в очереди
   */
  private processNext(): void {
    // Если нет задач или достигнут лимит параллельных задач, выходим
    if (this.items.length === 0 || this.activeCount >= this.maxConcurrent) {
      this.isProcessing = false;
      return;
    }
    
    // Берем следующую задачу из очереди
    const item = this.items.shift();
    if (!item) {
      this.isProcessing = false;
      return;
    }
    
    // Устанавливаем флаг обработки
    this.isProcessing = true;
    this.activeCount++;
    
    // Запускаем задачу
    setTimeout(() => {
      item.task().catch(item.reject);
      this.processNext();
    }, 0);
  }
  
  /**
   * Останавливает очередь
   */
  shutdown(): Promise<void> {
    this.isShuttingDown = true;
    
    // Ждем завершения всех активных задач
    if (this.activeCount === 0) {
      return Promise.resolve();
    }
    
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.activeCount === 0) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }
  
  /**
   * Очищает очередь
   */
  clear(): void {
    // Отклоняем все ожидающие задачи
    for (const item of this.items) {
      item.reject(new Error('Queue cleared'));
    }
    this.items = [];
  }
  
  /**
   * Возвращает количество задач в очереди
   */
  get size(): number {
    return this.items.length;
  }
  
  /**
   * Проверяет, есть ли активные задачи
   */
  get isActive(): boolean {
    return this.isProcessing || this.activeCount > 0;
  }
  
  /**
   * Устанавливает максимальное количество параллельных задач
   */
  setMaxConcurrent(value: number): void {
    this.maxConcurrent = Math.max(1, value);
    
    // Запускаем дополнительные задачи, если можно
    while (this.activeCount < this.maxConcurrent && this.items.length > 0) {
      this.processNext();
    }
  }
  
  /**
   * Возвращает количество активных задач
   */
  activeTasksCount(): number {
    return this.activeCount;
  }
  
  /**
   * Проверяет, есть ли задачи в очереди или активные задачи
   */
  hasActiveTasks(): boolean {
    return this.items.length > 0 || this.activeCount > 0;
  }
  
  /**
   * Ожидает завершения всех активных задач
   * @param timeoutMs Таймаут в миллисекундах
   */
  async waitForCompletion(timeoutMs: number = 10000): Promise<boolean> {
    if (!this.hasActiveTasks()) {
      return true;
    }
    
    return new Promise<boolean>((resolve) => {
      const checkInterval = 100; // 100 мс между проверками
      let totalWait = 0;
      
      const checkComplete = () => {
        if (!this.hasActiveTasks()) {
          resolve(true);
          return;
        }
        
        totalWait += checkInterval;
        if (totalWait >= timeoutMs) {
          resolve(false); // Тайм-аут
          return;
        }
        
        setTimeout(checkComplete, checkInterval);
      };
      
      checkComplete();
    });
  }
}

// Создаем и экспортируем экземпляр очереди
export const saveQueue = new SaveQueue();

// Типы для обработки сжатых данных
export interface CompressedGameState {
  _isCompressed: boolean;
  _compressedData: string;
  _originalSize: number;
  _compressedSize: number;
  _compression: string;
  _compressedAt: string;
  _integrity: {
    userId: string;
    saveVersion?: number;
    snot?: number;
    snotCoins?: number;
  };
}

/**
 * Проверяет, является ли объект сжатым состоянием игры
 */
export function isCompressedGameState(data: any): data is CompressedGameState {
  return (
    data &&
    typeof data === 'object' &&
    data._isCompressed === true &&
    typeof data._compressedData === 'string' &&
    typeof data._originalSize === 'number' &&
    typeof data._compressedSize === 'number'
  );
}

/**
 * Распаковывает сжатое состояние игры
 */
export async function decompressGameState(compressedState: CompressedGameState): Promise<any> {
  try {
    const LZString = await import('lz-string');
    
    if (compressedState._compression === 'lz-string-utf16') {
      const decompressed = LZString.decompressFromUTF16(compressedState._compressedData);
      
      if (!decompressed) {
        throw new Error('Decompress failed - empty result');
      }
      
      return JSON.parse(decompressed);
    }
    
    throw new Error(`Неизвестный алгоритм сжатия: ${compressedState._compression}`);
  } catch (error) {
    console.error('Ошибка при распаковке данных:', error);
    throw new Error('Failed to decompress game state');
  }
}

