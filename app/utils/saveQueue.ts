/**
 * Утилита для управления очередью сохранений игровых данных
 */

// Тип задачи в очереди сохранений
type SaveTask = () => Promise<void>;

/**
 * Класс для управления очередью сохранений с защитой от перегрузки
 */
class SaveQueue {
  private queue: SaveTask[] = [];
  private isProcessing: boolean = false;
  private maxConcurrent: number = 2;
  private activeCount: number = 0;
  private maxRetries: number = 3;
  
  /**
   * Добавляет задачу в очередь и начинает обработку, если она не запущена
   * @param task Задача для выполнения
   * @returns Промис, который разрешится после выполнения задачи
   */
  enqueue(task: SaveTask): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const wrappedTask = async () => {
        let retries = 0;
        while (retries <= this.maxRetries) {
          try {
            await task();
            resolve();
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
      
      this.queue.push(wrappedTask);
      this.processQueue();
    });
  }
  
  /**
   * Обрабатывает очередь задач с ограничением на количество одновременных операций
   */
  private processQueue(): void {
    if (this.isProcessing || this.queue.length === 0 || this.activeCount >= this.maxConcurrent) {
      return;
    }
    
    this.isProcessing = true;
    
    const processNext = async () => {
      if (this.queue.length === 0) {
        this.isProcessing = false;
        return;
      }
      
      if (this.activeCount < this.maxConcurrent) {
        const task = this.queue.shift();
        if (task) {
          this.activeCount++;
          
          try {
            await task();
          } catch (error) {
            console.error('Ошибка выполнения задачи:', error);
          } finally {
            this.activeCount--;
            // Продолжаем обработку очереди
            processNext();
          }
        }
      }
      
      // Если есть еще задачи и не достигнут лимит одновременных операций, 
      // запускаем следующую задачу
      if (this.queue.length > 0 && this.activeCount < this.maxConcurrent) {
        processNext();
      } else if (this.activeCount === 0) {
        this.isProcessing = false;
      }
    };
    
    // Запускаем обработку очереди
    processNext();
  }
  
  /**
   * Очищает очередь задач
   */
  clear(): void {
    this.queue = [];
  }
  
  /**
   * Возвращает количество задач в очереди
   */
  size(): number {
    return this.queue.length;
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
    return this.queue.length > 0 || this.activeCount > 0;
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

// Экспортируем единственный экземпляр очереди для использования в приложении
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
    fid: number;
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

