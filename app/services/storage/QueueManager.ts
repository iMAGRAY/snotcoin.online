import { StorageData } from './StorageService';
import { redisClient } from '@/app/lib/redis';

interface SaveQueue {
  high: StorageData[];
  medium: StorageData[];
  low: StorageData[];
  processingDelay: number;
}

interface QueueOptions {
  maxSize: number;
  processingInterval: number;
  retryAttempts: number;
  retryDelay: number;
}

export class QueueManager {
  private static instance: QueueManager;
  private queue: SaveQueue = {
    high: [],
    medium: [],
    low: [],
    processingDelay: 1000
  };
  private processing: boolean = false;
  private processInterval: NodeJS.Timeout | null = null;

  private readonly options: QueueOptions = {
    maxSize: 1000,
    processingInterval: 1000,
    retryAttempts: 3,
    retryDelay: 5000
  };

  private constructor() {
    this.startProcessing();
  }

  static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager();
    }
    return QueueManager.instance;
  }

  private startProcessing(): void {
    if (this.processInterval) {
      clearInterval(this.processInterval);
    }

    this.processInterval = setInterval(() => {
      this.processQueue();
    }, this.options.processingInterval);
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;

    this.processing = true;
    try {
      // Обрабатываем очереди в порядке приоритета
      await this.processQueueByPriority('high');
      await this.processQueueByPriority('medium');
      await this.processQueueByPriority('low');
    } finally {
      this.processing = false;
    }
  }

  private async processQueueByPriority(priority: keyof Omit<SaveQueue, 'processingDelay'>): Promise<void> {
    const queue = this.queue[priority];
    if (queue.length === 0) return;

    const batch = queue.splice(0, Math.min(10, queue.length));
    
    for (const data of batch) {
      try {
        // Сохраняем в Redis
        await redisClient.setex(
          `game:state:${data.userId}`,
          3600,
          JSON.stringify(data)
        );

        // Отмечаем успешное сохранение
        localStorage.setItem(`save_success_${data.userId}`, Date.now().toString());
      } catch (error) {
        console.error(`Ошибка обработки очереди для пользователя ${data.userId}:`, error);
        
        // Возвращаем в очередь для повторной попытки
        const retryCount = parseInt(localStorage.getItem(`retry_count_${data.userId}`) || '0');
        if (retryCount < this.options.retryAttempts) {
          localStorage.setItem(`retry_count_${data.userId}`, (retryCount + 1).toString());
          setTimeout(() => {
            this.queue[priority].push(data);
          }, this.options.retryDelay);
        } else {
          // Логируем критическую ошибку
          console.error(`Превышено количество попыток сохранения для пользователя ${data.userId}`);
          localStorage.removeItem(`retry_count_${data.userId}`);
        }
      }
    }
  }

  addToQueue(data: StorageData, priority: keyof Omit<SaveQueue, 'processingDelay'> = 'medium'): void {
    // Проверяем размер очереди
    if (this.queue[priority].length >= this.options.maxSize) {
      console.warn(`Очередь ${priority} переполнена, удаляем старые записи`);
      this.queue[priority] = this.queue[priority].slice(-this.options.maxSize);
    }

    this.queue[priority].push(data);
  }

  clearQueue(priority?: keyof Omit<SaveQueue, 'processingDelay'>): void {
    if (priority) {
      this.queue[priority] = [];
    } else {
      this.queue.high = [];
      this.queue.medium = [];
      this.queue.low = [];
    }
  }

  getQueueStatus(): Record<keyof Omit<SaveQueue, 'processingDelay'>, number> {
    return {
      high: this.queue.high.length,
      medium: this.queue.medium.length,
      low: this.queue.low.length
    };
  }

  setProcessingDelay(delay: number): void {
    this.queue.processingDelay = delay;
    this.startProcessing(); // Перезапускаем обработку с новым интервалом
  }

  getProcessingDelay(): number {
    return this.queue.processingDelay;
  }
}

export const queueManager = QueueManager.getInstance(); 