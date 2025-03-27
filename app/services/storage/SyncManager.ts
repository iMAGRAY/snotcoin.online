import { redisClient } from '@/app/lib/redis';
import { prisma } from '@/app/lib/prisma';
import type { StorageData } from '@/app/types/storage';

interface SyncStrategy {
  shouldSync: (data: StorageData) => boolean;
  priority: number;
  batchSize: number;
  retryAttempts: number;
}

interface SyncJob {
  userId: string;
  strategy: SyncStrategy;
  attempts: number;
  lastAttempt: number;
}

export class SyncManager {
  private static instance: SyncManager;
  private syncQueue: Map<string, SyncJob> = new Map();
  private isProcessing: boolean = false;
  private syncInterval: NodeJS.Timeout | null = null;

  private readonly strategies: Record<string, SyncStrategy> = {
    immediate: {
      shouldSync: () => true,
      priority: 1,
      batchSize: 1,
      retryAttempts: 3
    },
    batch: {
      shouldSync: (data: StorageData) => {
        const lastSync = localStorage.getItem(`last_sync_${data.userId}`);
        if (!lastSync) return true;
        return Date.now() - parseInt(lastSync) > 5 * 60 * 1000; // 5 минут
      },
      priority: 2,
      batchSize: 50,
      retryAttempts: 5
    },
    background: {
      shouldSync: (data: StorageData) => {
        const lastSync = localStorage.getItem(`last_sync_${data.userId}`);
        if (!lastSync) return true;
        return Date.now() - parseInt(lastSync) > 30 * 60 * 1000; // 30 минут
      },
      priority: 3,
      batchSize: 100,
      retryAttempts: 10
    }
  };

  private constructor() {
    this.startSyncInterval();
  }

  static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  private startSyncInterval(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      this.processSyncQueue();
    }, 1000 * 60); // Каждую минуту
  }

  private async processSyncQueue(): Promise<void> {
    if (this.isProcessing || this.syncQueue.size === 0) return;

    this.isProcessing = true;
    const jobs = Array.from(this.syncQueue.values())
      .sort((a, b) => a.strategy.priority - b.strategy.priority);

    try {
      for (const job of jobs) {
        if (job.attempts >= job.strategy.retryAttempts) {
          this.syncQueue.delete(job.userId);
          continue;
        }

        const localData = localStorage.getItem(`game_state_${job.userId}`);
        if (!localData) {
          this.syncQueue.delete(job.userId);
          continue;
        }

        const data = JSON.parse(localData) as StorageData;
        
        if (!job.strategy.shouldSync(data)) {
          continue;
        }

        try {
          // Синхронизация с Redis
          await redisClient.setex(
            `game:state:${job.userId}`,
            3600,
            JSON.stringify(data)
          );

          // Синхронизация с PostgreSQL
          await prisma.gameState.upsert({
            where: { userId: job.userId },
            update: {
              state: JSON.stringify(data.gameState),
              version: data.version,
              checksum: data.checksum,
              updatedAt: new Date(data.timestamp)
            },
            create: {
              userId: job.userId,
              state: JSON.stringify(data.gameState),
              version: data.version,
              checksum: data.checksum,
              createdAt: new Date(data.timestamp),
              updatedAt: new Date(data.timestamp)
            }
          });

          // Обновляем время последней синхронизации
          localStorage.setItem(`last_sync_${job.userId}`, Date.now().toString());
          this.syncQueue.delete(job.userId);
        } catch (error) {
          console.error(`Ошибка синхронизации для пользователя ${job.userId}:`, error);
          job.attempts++;
          job.lastAttempt = Date.now();
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  addToSyncQueue(userId: string, strategy: keyof typeof this.strategies = 'batch'): void {
    if (!this.syncQueue.has(userId)) {
      const selectedStrategy = this.strategies[strategy];
      if (!selectedStrategy) return;

      this.syncQueue.set(userId, {
        userId,
        strategy: selectedStrategy,
        attempts: 0,
        lastAttempt: 0
      });
    }
  }

  async forceSyncNow(userId: string): Promise<boolean> {
    try {
      const localData = localStorage.getItem(`game_state_${userId}`);
      if (!localData) return false;

      const data = JSON.parse(localData) as StorageData;
      
      // Синхронизация с Redis
      await redisClient.setex(
        `game:state:${userId}`,
        3600,
        JSON.stringify(data)
      );

      // Синхронизация с PostgreSQL
      await prisma.gameState.upsert({
        where: { userId },
        update: {
          state: JSON.stringify(data.gameState),
          version: data.version,
          checksum: data.checksum,
          updatedAt: new Date(data.timestamp)
        },
        create: {
          userId,
          state: JSON.stringify(data.gameState),
          version: data.version,
          checksum: data.checksum,
          createdAt: new Date(data.timestamp),
          updatedAt: new Date(data.timestamp)
        }
      });

      localStorage.setItem(`last_sync_${userId}`, Date.now().toString());
      return true;
    } catch (error) {
      console.error(`Ошибка принудительной синхронизации для пользователя ${userId}:`, error);
      return false;
    }
  }

  clearSyncQueue(): void {
    this.syncQueue.clear();
  }

  getSyncStatus(userId: string): { inQueue: boolean; attempts: number; lastAttempt: number } {
    const job = this.syncQueue.get(userId);
    return {
      inQueue: !!job,
      attempts: job?.attempts || 0,
      lastAttempt: job?.lastAttempt || 0
    };
  }
}

export const syncManager = SyncManager.getInstance(); 