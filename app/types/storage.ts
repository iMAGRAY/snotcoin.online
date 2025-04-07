// Базовые типы для игры
export interface GameState {
  version: number;
  userId: string;
  inventory: {
    snot: number;
    [key: string]: number;
  };
  stats: {
    totalSnot: number;
    totalChestsOpened: number;
    [key: string]: number;
  };
  achievements: {
    [key: string]: boolean;
  };
  lastUpdate: number;
}

export interface StorageData {
  userId: string;
  gameState: GameState;
  timestamp: number;
  version: number;
  checksum: string;
}

export interface StorageOptions {
  useLocalCache?: boolean;
  priority?: 'high' | 'medium' | 'low';
  ttl?: number;
}

export interface SaveQueue {
  high: StorageData[];
  medium: StorageData[];
  low: StorageData[];
  processingDelay: number;
}

export interface QueueOptions {
  maxSize: number;
  processingInterval: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface SyncStrategy {
  shouldSync: (data: StorageData) => boolean;
  priority: number;
  batchSize: number;
  retryAttempts: number;
}

export interface SyncJob {
  userId: string;
  strategy: SyncStrategy;
  attempts: number;
  lastAttempt: number;
}

export interface Chest {
  id: number
  name: string
  image: string
  requiredSnot: number
  reward: () => number
  description: string
}

// Add any other storage-related types here if needed

