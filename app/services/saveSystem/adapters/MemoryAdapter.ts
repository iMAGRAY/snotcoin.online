/**
 * Адаптер для хранения данных в памяти (оперативная память браузера)
 * Реализует интерфейс StorageAdapter для сохранения и загрузки данных
 */
import { 
  StorageType, 
  StorageAdapter, 
  SaveResult, 
  LoadResult, 
  SaveOptions,
  LoadOptions
} from '../types';
import { ExtendedGameState } from '../../../types/gameTypes';

export class MemoryAdapter implements StorageAdapter {
  // Хранилище данных, использует Map для быстрого доступа по ключу
  private storage: Map<string, {
    data: ExtendedGameState,
    timestamp: number,
    version: number
  }> = new Map();
  
  // Хранение резервных копий для каждого пользователя
  private backups: Map<string, Array<{
    data: ExtendedGameState,
    timestamp: number,
    version: number
  }>> = new Map();
  
  /**
   * Возвращает тип хранилища
   */
  getType(): StorageType {
    return StorageType.MEMORY;
  }
  
  /**
   * Проверяет доступность хранилища
   */
  exists(key: string): Promise<boolean> {
    return Promise.resolve(true); // Хранилище в памяти всегда доступно
  }
  
  /**
   * Сохраняет игровое состояние в память
   */
  async save(
    userId: string, 
    state: ExtendedGameState, 
    options: SaveOptions = {}
  ): Promise<SaveResult> {
    const startTime = Date.now();
    
    try {
      // Создаем глубокую копию состояния для сохранения
      const stateCopy = JSON.parse(JSON.stringify(state));
      const version = (state._saveVersion || 0) + 1;
      
      // Сохраняем копию в хранилище
      this.storage.set(userId, {
        data: stateCopy,
        timestamp: Date.now(),
        version
      });
      
      // Если требуется создать резервную копию
      if (options.createBackup) {
        this.createBackup(userId, stateCopy, version);
      }
      
      // Если требуется очистка данных
      if (options.forceClear) {
        this.cleanupBackups(userId);
      }
      
      return {
        success: true,
        timestamp: Date.now(),
        source: StorageType.MEMORY,
        duration: Date.now() - startTime,
        dataSize: JSON.stringify(state).length
      };
    } catch (error) {
      return {
        success: false,
        timestamp: Date.now(),
        source: StorageType.MEMORY,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };
    }
  }
  
  /**
   * Загружает игровое состояние из памяти
   */
  async load(
    userId: string, 
    options: LoadOptions = {}
  ): Promise<LoadResult> {
    const startTime = Date.now();
    
    try {
      // Проверяем наличие данных в хранилище
      const storedData = this.storage.get(userId);
      
      if (!storedData) {
        // Если данных нет и разрешено восстановление из бэкапа
        if (options.fallbackToDefault) {
          const backup = this.getLatestBackup(userId);
          
          if (backup) {
            return {
              success: true,
              timestamp: backup.timestamp,
              source: StorageType.MEMORY,
              data: backup.data,
              wasRepaired: true,
              duration: Date.now() - startTime
            };
          }
        }
        
        return {
          success: false,
          timestamp: Date.now(),
          source: StorageType.MEMORY,
          error: 'Данные не найдены',
          duration: Date.now() - startTime
        };
      }
      
      // Создаем глубокую копию данных
      const dataCopy = JSON.parse(JSON.stringify(storedData.data));
      
      return {
        success: true,
        timestamp: storedData.timestamp,
        source: StorageType.MEMORY,
        data: dataCopy,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        timestamp: Date.now(),
        source: StorageType.MEMORY,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };
    }
  }
  
  /**
   * Удаляет сохранение пользователя из памяти
   */
  async delete(userId: string): Promise<boolean> {
    try {
      // Удаляем данные и бэкапы пользователя
      this.storage.delete(userId);
      this.backups.delete(userId);
      
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Очищает все данные адаптера
   */
  async clear(): Promise<boolean> {
    try {
      this.storage.clear();
      this.backups.clear();
      
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Создает резервную копию состояния
   */
  private createBackup(userId: string, state: ExtendedGameState, version: number): void {
    // Получаем текущий список бэкапов или создаем новый
    let userBackups = this.backups.get(userId);
    
    if (!userBackups) {
      userBackups = [];
      this.backups.set(userId, userBackups);
    }
    
    // Добавляем новый бэкап
    userBackups.push({
      data: state,
      timestamp: Date.now(),
      version
    });
    
    // Ограничиваем количество бэкапов
    this.cleanupBackups(userId);
  }
  
  /**
   * Получает последний бэкап пользователя
   */
  private getLatestBackup(userId: string): {
    data: ExtendedGameState, 
    timestamp: number,
    version: number
  } | null {
    const userBackups = this.backups.get(userId);
    
    if (!userBackups || userBackups.length === 0) {
      return null;
    }
    
    // Сортируем бэкапы по времени (от новых к старым)
    return userBackups.sort((a, b) => b.timestamp - a.timestamp)[0];
  }
  
  /**
   * Очищает старые бэкапы
   */
  private cleanupBackups(userId: string): void {
    const userBackups = this.backups.get(userId);
    
    if (!userBackups || userBackups.length === 0) {
      return;
    }
    
    // Ограничиваем количество бэкапов (оставляем только 5 последних)
    const MAX_BACKUPS = 5;
    
    if (userBackups.length > MAX_BACKUPS) {
      // Сортируем по времени и оставляем только MAX_BACKUPS
      userBackups.sort((a, b) => b.timestamp - a.timestamp);
      this.backups.set(userId, userBackups.slice(0, MAX_BACKUPS));
    }
  }
} 