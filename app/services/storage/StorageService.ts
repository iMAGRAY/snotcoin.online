import { createHash } from 'crypto';
import { redisClient } from '../../lib/redis';
import { prisma } from '../../lib/prisma';
import { ExtendedGameState } from '../../types/gameTypes';
import { encryptGameSave } from '../../utils/saveEncryption';

// Интерфейс для данных хранилища
export interface StorageData {
  userId: string;
  gameState: ExtendedGameState;
  version: number;
  checksum: string;
  timestamp: number;
}

// Интерфейс для результата операций хранилища
interface StorageResult<T> {
  success: boolean;
  data: T;
  error?: string;
}

const REDIS_PREFIX = 'game:state:';
const LOCAL_STORAGE_PREFIX = 'game_state_';
const BATCH_SIZE = 100;
const DEFAULT_TTL = 3600; // 1 час

interface StorageOptions {
  useLocalCache?: boolean;
  useRedisCache?: boolean;
  priority?: 'high' | 'medium' | 'low';
  ttl?: number;
}

export class StorageService {
  private static instance: StorageService;
  private saveQueue: Map<string, NodeJS.Timeout> = new Map();
  private processingQueue: boolean = false;

  private constructor() {}

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  private generateChecksum(data: ExtendedGameState): string {
    return createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex');
  }

  private async saveToLocalStorage(key: string, data: StorageData): Promise<void> {
    try {
      localStorage.setItem(
        `${LOCAL_STORAGE_PREFIX}${key}`,
        JSON.stringify(data)
      );
    } catch (error) {
      console.error('Ошибка сохранения в localStorage:', error);
      // При переполнении очищаем старые данные
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        this.cleanupLocalStorage();
      }
    }
  }

  private async saveToRedis(key: string, data: StorageData, ttl: number): Promise<void> {
    try {
      await redisClient.setex(
        `${REDIS_PREFIX}${key}`,
        ttl,
        JSON.stringify(data)
      );
    } catch (error) {
      console.error('Ошибка сохранения в Redis:', error);
    }
  }

  private async saveToPostgres(data: StorageData): Promise<void> {
    try {
      await prisma.progress.upsert({
        where: { user_id: data.userId },
        update: {
          gameState: data.gameState as any,
          version: data.version,
          updated_at: new Date(data.timestamp)
        },
        create: {
          user_id: data.userId,
          gameState: data.gameState as any,
          version: data.version,
          created_at: new Date(data.timestamp),
          updated_at: new Date(data.timestamp)
        }
      });
    } catch (error) {
      console.error('Ошибка сохранения в PostgreSQL:', error);
      throw error;
    }
  }

  private cleanupLocalStorage(): void {
    const keys = Object.keys(localStorage);
    const gameStateKeys = keys.filter(key => key.startsWith(LOCAL_STORAGE_PREFIX));
    
    if (gameStateKeys.length > BATCH_SIZE) {
      // Сортируем по времени последнего обновления
      const sortedKeys = gameStateKeys
        .map(key => ({
          key,
          data: JSON.parse(localStorage.getItem(key) || '{}')
        }))
        .sort((a, b) => b.data.timestamp - a.data.timestamp);

      // Удаляем старые записи
      sortedKeys
        .slice(BATCH_SIZE)
        .forEach(item => localStorage.removeItem(item.key));
    }
  }

  async save(
    userId: string,
    gameState: ExtendedGameState,
    options: StorageOptions = {}
  ): Promise<void> {
    const {
      useLocalCache = true,
      useRedisCache = true,
      priority = 'medium',
      ttl = DEFAULT_TTL
    } = options;

    // Отменяем предыдущее отложенное сохранение
    const previousTimeout = this.saveQueue.get(userId);
    if (previousTimeout) {
      clearTimeout(previousTimeout);
    }

    const data: StorageData = {
      userId,
      gameState,
      timestamp: Date.now(),
      version: gameState._saveVersion || 1,
      checksum: this.generateChecksum(gameState)
    };

    // Немедленно сохраняем в localStorage
    if (useLocalCache) {
      await this.saveToLocalStorage(userId, data);
    }

    // Планируем сохранение в Redis и PostgreSQL
    const delay = priority === 'high' ? 0 : priority === 'medium' ? 1000 : 5000;
    
    const timeout = setTimeout(async () => {
      try {
        // Сохраняем в Redis если нужно
        if (useRedisCache) {
          await this.saveToRedis(userId, data, ttl);
        }
        
        // Сохраняем в PostgreSQL
        await this.saveToPostgres(data);
        
        this.saveQueue.delete(userId);
      } catch (error) {
        console.error('Ошибка при сохранении:', error);
      }
    }, delay);

    this.saveQueue.set(userId, timeout);
  }

  async load(userId: string): Promise<ExtendedGameState | null> {
    try {
      // Сначала проверяем localStorage
      const localData = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${userId}`);
      if (localData) {
        const parsed = JSON.parse(localData) as StorageData;
        return parsed.gameState;
      }

      // Затем проверяем Redis
      const redisData = await redisClient.get(`${REDIS_PREFIX}${userId}`);
      if (redisData) {
        const parsed = JSON.parse(redisData) as StorageData;
        return parsed.gameState;
      }

      // Наконец, загружаем из PostgreSQL
      const progress = await prisma.progress.findUnique({
        where: { user_id: userId }
      });

      if (progress) {
        // Кэшируем данные в Redis
        const data: StorageData = {
          userId,
          gameState: progress.gameState ? (progress.gameState as any) : null,
          timestamp: progress.updated_at.getTime(),
          version: progress.version,
          checksum: this.generateChecksum(progress.gameState as any)
        };
        
        await this.saveToRedis(userId, data, DEFAULT_TTL);
        return progress.gameState ? (progress.gameState as any) : null;
      }

      return null;
    } catch (error) {
      console.error('Ошибка при загрузке данных:', error);
      return null;
    }
  }

  /**
   * Сохраняет прогресс в постоянное хранилище
   * @param data Данные для сохранения
   */
  async saveProgress(data: StorageData): Promise<StorageResult<boolean>> {
    try {
      // Создаем зашифрованную версию сохранения
      const { encryptedSave } = encryptGameSave(data.gameState, data.userId);
      
      // Используем upsert для создания или обновления записи
      await prisma.progress.upsert({
        where: { user_id: data.userId },
        update: {
          gameState: data.gameState as any,
          encryptedState: encryptedSave,
          version: data.version,
          updated_at: new Date()
        },
        create: {
          user_id: data.userId,
          gameState: data.gameState as any,
          encryptedState: encryptedSave,
          version: data.version,
          created_at: new Date(),
          updated_at: new Date()
        }
      });

      return { success: true, data: true };
    } catch (error) {
      console.error('Ошибка при сохранении прогресса:', error);
      return { success: false, data: false };
    }
  }
}

export const storageService = StorageService.getInstance(); 