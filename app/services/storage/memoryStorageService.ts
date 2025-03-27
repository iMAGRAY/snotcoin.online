import type { ExtendedGameState } from "../../types/gameTypes";

// Типы для кэша
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: number;
  integrity: boolean;
}

// Интерфейс для резервной копии
interface BackupEntry<T> {
  data: T;
  timestamp: number;
}

// Константы для кэширования
const CACHE_TTL = 5 * 60 * 1000; // 5 минут
const MAX_CACHE_SIZE = 100;

// Кэш для данных игры
const gameStateCache = new Map<string, CacheEntry<ExtendedGameState>>();

// Отслеживание версий для предотвращения конфликтов
const stateVersions = new Map<string, number>();

// Отслеживание последних загрузок для предотвращения частых запросов
const lastLoadTimestamps = new Map<string, number>();

// Отслеживание последних сохранений для предотвращения частых запросов
const lastSaveTimestamps = new Map<string, number>();

// Хранилище резервных копий в памяти
const backupStore = new Map<string, BackupEntry<ExtendedGameState>>();

// Общее хранилище для данных в памяти
const memoryStore: Record<string, any> = {};

/**
 * Сохраняет данные в игровой кэш
 * @param userId ID пользователя
 * @param state Игровое состояние
 * @param integrity Флаг целостности данных
 */
export function saveToCache(userId: string, state: ExtendedGameState, integrity: boolean = true): void {
  try {
    gameStateCache.set(userId, {
      data: state,
      timestamp: Date.now(),
      version: state._saveVersion || 0,
      integrity
    });
    
    // Ограничиваем размер кэша
    limitCacheSize();
  } catch (error) {
    console.error(`[MemoryStorageService] Ошибка при сохранении в кэш для ${userId}:`, error);
  }
}

/**
 * Получает данные из игрового кэша
 * @param userId ID пользователя
 * @returns Кэшированное состояние или null
 */
export function getFromCache(userId: string): ExtendedGameState | null {
  try {
    const cachedEntry = gameStateCache.get(userId);
    if (!cachedEntry) return null;
    
    // Проверяем актуальность кэша
    const now = Date.now();
    if (now - cachedEntry.timestamp > CACHE_TTL) {
      gameStateCache.delete(userId);
      return null;
    }
    
    return cachedEntry.data;
  } catch (error) {
    console.error(`[MemoryStorageService] Ошибка при получении из кэша для ${userId}:`, error);
    return null;
  }
}

/**
 * Проверяет целостность кэшированных данных
 * @param userId ID пользователя
 * @returns true если данные целостны, иначе false
 */
export function checkCacheIntegrity(userId: string): boolean {
  const cachedEntry = gameStateCache.get(userId);
  return !!cachedEntry && cachedEntry.integrity;
}

/**
 * Инвалидирует кэш для пользователя
 * @param userId ID пользователя
 */
export function invalidateCache(userId: string): void {
  gameStateCache.delete(userId);
}

/**
 * Ограничивает размер кэша
 */
function limitCacheSize(): void {
  if (gameStateCache.size <= MAX_CACHE_SIZE) return;
  
  // Сортируем записи по времени последнего обновления
  const entries = Array.from(gameStateCache.entries())
    .sort((a, b) => a[1].timestamp - b[1].timestamp);
  
  // Удаляем самые старые записи
  const entriesToRemove = entries.slice(0, gameStateCache.size - MAX_CACHE_SIZE);
  for (const [key] of entriesToRemove) {
    gameStateCache.delete(key);
  }
}

/**
 * Сохраняет резервную копию состояния в памяти
 * @param userId ID пользователя
 * @param state Игровое состояние
 */
export function saveBackup(userId: string, state: ExtendedGameState): void {
  try {
    if (state && userId) {
      backupStore.set(userId, {
        data: state,
        timestamp: Date.now()
      });
      
      // Ограничиваем размер хранилища резервных копий
      if (backupStore.size > 50) {
        const entries = Array.from(backupStore.entries())
          .sort((a, b) => a[1].timestamp - b[1].timestamp);
        
        if (entries.length > 0 && entries[0]) {
          const oldestKey = entries[0][0];
          backupStore.delete(oldestKey);
        }
      }
    }
  } catch (error) {
    console.error(`[MemoryStorageService] Ошибка при создании резервной копии для ${userId}:`, error);
  }
}

/**
 * Получает резервную копию из памяти
 * @param userId ID пользователя
 * @returns Резервная копия или null
 */
export function getBackup(userId: string): ExtendedGameState | null {
  try {
    const backup = backupStore.get(userId);
    if (backup && backup.data) {
      return backup.data;
    }
    return null;
  } catch (error) {
    console.error(`[MemoryStorageService] Ошибка при получении резервной копии для ${userId}:`, error);
    return null;
  }
}

/**
 * Обновляет версию состояния
 * @param userId ID пользователя
 * @param version Версия
 */
export function updateStateVersion(userId: string, version: number): void {
  stateVersions.set(userId, version);
}

/**
 * Получает текущую версию состояния
 * @param userId ID пользователя
 * @returns Текущая версия
 */
export function getStateVersion(userId: string): number {
  return stateVersions.get(userId) || 0;
}

/**
 * Обновляет время последнего сохранения
 * @param userId ID пользователя
 */
export function updateLastSaveTime(userId: string): void {
  lastSaveTimestamps.set(userId, Date.now());
}

/**
 * Получает время последнего сохранения
 * @param userId ID пользователя
 * @returns Время последнего сохранения
 */
export function getLastSaveTime(userId: string): number {
  return lastSaveTimestamps.get(userId) || 0;
}

/**
 * Обновляет время последней загрузки
 * @param userId ID пользователя
 */
export function updateLastLoadTime(userId: string): void {
  lastLoadTimestamps.set(userId, Date.now());
}

/**
 * Получает время последней загрузки
 * @param userId ID пользователя
 * @returns Время последней загрузки
 */
export function getLastLoadTime(userId: string): number {
  return lastLoadTimestamps.get(userId) || 0;
}

/**
 * Очищает все кэши и состояния
 */
export function clearAllCaches(): void {
  gameStateCache.clear();
  lastSaveTimestamps.clear();
  lastLoadTimestamps.clear();
  stateVersions.clear();
  backupStore.clear();
  
  // Очищаем memoryStore
  Object.keys(memoryStore).forEach(key => {
    delete memoryStore[key];
  });
}

/**
 * Получает доступ к общему хранилищу данных в памяти
 */
export function getMemoryStore(): Record<string, any> {
  return memoryStore;
} 