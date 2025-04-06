/**
 * Менеджер кэша в памяти для быстрого доступа к данным
 */

import { MAX_MEMORY_CACHE_SIZE, MEMORY_CLEANUP_INTERVAL } from '../utils/constants';
import { MemoryCacheItem, CacheStats } from '../types/redisTypes';

/**
 * Класс для управления кэшем в памяти
 */
export class MemoryCacheManager {
  /** Кэш в памяти */
  private cache: Map<string, MemoryCacheItem<any>> = new Map();
  /** Общий размер кэша в памяти в байтах */
  private totalCacheSize: number = 0;
  /** Интервал очистки кэша */
  private cleanupInterval: NodeJS.Timeout | null = null;
  /** Максимальный размер кэша */
  private maxCacheSize: number;
  /** Счетчик попаданий в кэш */
  private hitCount: number = 0;
  /** Счетчик промахов кэша */
  private missCount: number = 0;
  /** Общее количество операций */
  private operationsCount: number = 0;
  
  /**
   * Создает менеджер кэша в памяти
   * @param maxSize Максимальный размер кэша в байтах
   */
  constructor(maxSize: number = MAX_MEMORY_CACHE_SIZE) {
    this.maxCacheSize = maxSize;
    this.startCacheCleanup();
  }
  
  /**
   * Сохраняет данные в кэш
   * @param key Ключ
   * @param value Значение
   * @param ttl Время жизни в секундах
   */
  public set<T>(key: string, value: T, ttl: number = 3600): void {
    this.operationsCount++;
    
    try {
      // Если значение не определено, не сохраняем его
      if (value === undefined || value === null) {
        return;
      }
      
      // Рассчитываем размер объекта
      const size = this.estimateObjectSize(value);
      
      // Проверяем, не превышает ли размер объекта половину кэша
      if (size > this.maxCacheSize / 2) {
        console.warn(`[MemoryCache] Объект для ${key} слишком большой (${size} байт), пропускаем кэширование`);
        return;
      }
      
      // Если в кэше уже есть этот ключ, уменьшаем общий размер
      if (this.cache.has(key)) {
        this.totalCacheSize -= this.cache.get(key)!.size;
      }
      
      // Если после добавления этого объекта превысим лимит, очищаем немного места
      if (this.totalCacheSize + size > this.maxCacheSize) {
        this.pruneCache(size);
      }
      
      // Добавляем объект в кэш
      const expiry = Date.now() + ttl * 1000;
      this.cache.set(key, { data: value, expiry, size });
      this.totalCacheSize += size;
      
    } catch (error) {
      console.error(`[MemoryCache] Ошибка при сохранении ${key}:`, error);
    }
  }
  
  /**
   * Получает данные из кэша
   * @param key Ключ
   */
  public get<T>(key: string): T | undefined {
    this.operationsCount++;
    
    try {
      // Получаем элемент из кэша
      const item = this.cache.get(key);
      
      // Если элемента нет или он устарел, возвращаем undefined
      if (!item) {
        this.missCount++;
        return undefined;
      }
      
      // Проверяем срок годности
      if (item.expiry < Date.now()) {
        this.delete(key);
        this.missCount++;
        return undefined;
      }
      
      // Возвращаем данные
      this.hitCount++;
      return item.data as T;
      
    } catch (error) {
      console.error(`[MemoryCache] Ошибка при получении ${key}:`, error);
      this.missCount++;
      return undefined;
    }
  }
  
  /**
   * Удаляет данные из кэша
   * @param key Ключ
   */
  public delete(key: string): boolean {
    this.operationsCount++;
    
    try {
      // Если ключа нет, ничего не делаем
      if (!this.cache.has(key)) {
        return false;
      }
      
      // Получаем размер элемента и удаляем его
      const item = this.cache.get(key)!;
      this.totalCacheSize -= item.size;
      
      return this.cache.delete(key);
      
    } catch (error) {
      console.error(`[MemoryCache] Ошибка при удалении ${key}:`, error);
      return false;
    }
  }
  
  /**
   * Проверяет наличие ключа в кэше
   * @param key Ключ
   */
  public has(key: string): boolean {
    // Если ключа нет, возвращаем false
    if (!this.cache.has(key)) {
      return false;
    }
    
    // Проверяем срок годности
    const item = this.cache.get(key)!;
    if (item.expiry < Date.now()) {
      // Если устарел, удаляем и возвращаем false
      this.delete(key);
      return false;
    }
    
    return true;
  }
  
  /**
   * Очищает весь кэш
   */
  public clear(): void {
    this.cache.clear();
    this.totalCacheSize = 0;
  }
  
  /**
   * Очищает кэш для конкретного пользователя
   * @param userId ID пользователя
   */
  public clearForUser(userId: string): void {
    let keysToDelete: string[] = [];
    
    // Находим все ключи, связанные с этим пользователем
    this.cache.forEach((_, key) => {
      if (key.includes(userId)) {
        keysToDelete.push(key);
      }
    });
    
    // Удаляем найденные ключи
    keysToDelete.forEach(key => this.delete(key));
    
    console.log(`[MemoryCache] Кэш для пользователя ${userId} очищен (${keysToDelete.length} элементов)`);
  }
  
  /**
   * Оценивает размер объекта в байтах
   * @param obj Объект для оценки
   */
  private estimateObjectSize(obj: any): number {
    try {
      const jsonString = JSON.stringify(obj);
      // Размер в UTF-16 (примерно 2 байта на символ) + накладные расходы
      return jsonString.length * 2 + 128;
    } catch (error) {
      console.warn('[MemoryCache] Ошибка при оценке размера объекта:', error);
      // Возвращаем большое значение для безопасности
      return 100000;
    }
  }
  
  /**
   * Удаляет наименее важные элементы из кэша
   * @param requiredSpace Требуемое пространство
   */
  private pruneCache(requiredSpace: number): void {
    // Если кэш пустой, нечего очищать
    if (this.cache.size === 0) {
      return;
    }
    
    console.log(`[MemoryCache] Очистка кэша для освобождения ${requiredSpace} байт`);
    
    // Сортируем элементы по сроку годности (сначала удаляем то, что скоро истечет)
    const items = Array.from(this.cache).sort((a, b) => a[1].expiry - b[1].expiry);
    
    let freedSpace = 0;
    const keysToDelete: string[] = [];
    
    // Удаляем элементы, пока не освободим достаточно места
    for (const [key, item] of items) {
      keysToDelete.push(key);
      freedSpace += item.size;
      
      // Проверяем, достаточно ли места освободили
      if (freedSpace >= requiredSpace || freedSpace >= this.maxCacheSize * 0.3) {
        break;
      }
    }
    
    // Удаляем выбранные элементы
    keysToDelete.forEach(key => this.delete(key));
    
    console.log(`[MemoryCache] Освобождено ${freedSpace} байт (удалено ${keysToDelete.length} элементов)`);
  }
  
  /**
   * Запускает периодическую очистку кэша
   */
  private startCacheCleanup(): void {
    // Если интервал уже запущен, останавливаем его
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Запускаем новый интервал
    this.cleanupInterval = setInterval(() => {
      try {
        const now = Date.now();
        let keysToDelete: string[] = [];
        
        // Находим все устаревшие элементы
        this.cache.forEach((item, key) => {
          if (item.expiry < now) {
            keysToDelete.push(key);
          }
        });
        
        // Удаляем устаревшие элементы
        if (keysToDelete.length > 0) {
          keysToDelete.forEach(key => this.delete(key));
          console.log(`[MemoryCache] Очищено ${keysToDelete.length} устаревших элементов`);
        }
        
        // Если кэш слишком большой, очищаем его
        if (this.totalCacheSize > this.maxCacheSize * 0.9) {
          console.log(`[MemoryCache] Кэш почти заполнен, очищаем (${this.totalCacheSize} / ${this.maxCacheSize})`);
          this.pruneCache(this.maxCacheSize * 0.3);
        }
      } catch (error) {
        console.error('[MemoryCache] Ошибка при очистке кэша:', error);
      }
    }, MEMORY_CLEANUP_INTERVAL);
  }
  
  /**
   * Останавливает периодическую очистку кэша
   */
  public stopCacheCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
  
  /**
   * Возвращает статистику кэша
   */
  public getStats(): CacheStats {
    const hitRatio = this.operationsCount > 0 
      ? this.hitCount / this.operationsCount 
      : 0;
    
    return {
      isAvailable: true,
      memoryCacheSize: this.maxCacheSize,
      itemCount: this.cache.size,
      memoryUsage: this.totalCacheSize,
      totalOperations: this.operationsCount,
      hitRatio,
      errorRate: 0 // У нас нет счетчика ошибок
    };
  }
  
  /**
   * Возвращает все ключи кэша
   */
  public getKeys(): string[] {
    return Array.from(this.cache.keys());
  }
}

// Экспортируем singleton
export const memoryCacheManager = new MemoryCacheManager(); 