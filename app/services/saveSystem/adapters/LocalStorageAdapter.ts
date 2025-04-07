/**
 * Адаптер для работы с localStorage
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
import { encryptData, decryptData, compressData, decompressData } from '../utils';
import { ExtendedGameState } from '../../../types/gameTypes';

// Префикс для ключей в localStorage
const STORAGE_KEY_PREFIX = 'snotcoin_game_state_';

export class LocalStorageAdapter implements StorageAdapter {
  /**
   * Возвращает тип хранилища
   */
  getType(): StorageType {
    return StorageType.LOCAL;
  }
  
  /**
   * Проверяет доступность хранилища
   */
  exists(key: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        if (typeof window === 'undefined' || !window.localStorage) {
          return resolve(false);
        }
        
        // Проверяем доступность localStorage
        const testKey = `${STORAGE_KEY_PREFIX}test`;
        localStorage.setItem(testKey, '1');
        const testValue = localStorage.getItem(testKey);
        localStorage.removeItem(testKey);
        
        resolve(testValue === '1');
      } catch (error) {
        // localStorage может быть недоступен из-за настроек приватности или квоты
        resolve(false);
      }
    });
  }
  
  /**
   * Сохраняет игровое состояние в localStorage
   */
  async save(
    userId: string, 
    state: ExtendedGameState, 
    options: SaveOptions = {}
  ): Promise<SaveResult> {
    const startTime = Date.now();
    
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        throw new Error('localStorage недоступен');
      }
      
      // Формируем ключ для хранения
      const key = this.getStorageKey(userId);
      
      // Подготавливаем данные
      let dataToSave = JSON.stringify(state);
      const dataSize = dataToSave.length;
      
      // Сжимаем данные если нужно
      if (options.compress) {
        dataToSave = await compressData(dataToSave);
      }
      
      // Шифруем данные если нужно
      if (options.encrypt) {
        dataToSave = encryptData(dataToSave, userId);
      }
      
      // Сохраняем в localStorage
      localStorage.setItem(key, dataToSave);
      
      // Если необходимо создать резервную копию
      if (options.createBackup) {
        const backupKey = `${key}_backup_${Date.now()}`;
        localStorage.setItem(backupKey, dataToSave);
        
        // Ограничиваем количество резервных копий (оставляем только 3 последние)
        this.cleanupBackups(userId);
      }
      
      return {
        success: true,
        timestamp: Date.now(),
        source: StorageType.LOCAL,
        duration: Date.now() - startTime,
        dataSize
      };
    } catch (error) {
      return {
        success: false,
        timestamp: Date.now(),
        source: StorageType.LOCAL,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };
    }
  }
  
  /**
   * Загружает игровое состояние из localStorage
   */
  async load(
    userId: string, 
    options: LoadOptions = {}
  ): Promise<LoadResult> {
    const startTime = Date.now();
    
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        throw new Error('localStorage недоступен');
      }
      
      // Формируем ключ для загрузки
      const key = this.getStorageKey(userId);
      
      // Проверяем наличие данных
      const rawData = localStorage.getItem(key);
      
      if (!rawData) {
        // Пробуем загрузить из резервной копии
        const backup = this.loadFromBackup(userId);
        
        if (backup) {
          return {
            success: true,
            timestamp: Date.now(),
            source: StorageType.LOCAL,
            data: backup,
            wasRepaired: true,
            duration: Date.now() - startTime
          };
        }
        
        return {
          success: false,
          timestamp: Date.now(),
          source: StorageType.LOCAL,
          error: 'Данные не найдены',
          duration: Date.now() - startTime
        };
      }
      
      // Расшифровываем данные
      let processedData = rawData;
      
      try {
        // Пробуем расшифровать (предполагая, что данные зашифрованы)
        processedData = decryptData(processedData, userId);
      } catch (error) {
        // Если расшифровка не удалась, возможно, данные не были зашифрованы
        processedData = rawData;
      }
      
      try {
        // Пробуем распаковать (предполагая, что данные сжаты)
        processedData = await decompressData(processedData);
      } catch (error) {
        // Если распаковка не удалась, возможно, данные не были сжаты
        // Используем данные после расшифровки или исходные
      }
      
      // Парсим JSON
      let gameState: ExtendedGameState;
      
      try {
        gameState = JSON.parse(processedData);
      } catch (error) {
        throw new Error('Неверный формат данных');
      }
      
      // Проверяем структуру загруженных данных
      if (!gameState || typeof gameState !== 'object') {
        throw new Error('Некорректная структура данных');
      }
      
      return {
        success: true,
        timestamp: Date.now(),
        source: StorageType.LOCAL,
        data: gameState,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        timestamp: Date.now(),
        source: StorageType.LOCAL,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };
    }
  }
  
  /**
   * Удаляет сохранение пользователя из localStorage
   */
  async delete(userId: string): Promise<boolean> {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return false;
      }
      
      // Удаляем основное сохранение
      const key = this.getStorageKey(userId);
      localStorage.removeItem(key);
      
      // Удаляем все резервные копии
      for (let i = 0; i < localStorage.length; i++) {
        const storageKey = localStorage.key(i);
        
        if (storageKey && storageKey.startsWith(`${key}_backup_`)) {
          localStorage.removeItem(storageKey);
        }
      }
      
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
      if (typeof window === 'undefined' || !window.localStorage) {
        return false;
      }
      
      // Удаляем только данные с нашим префиксом
      const keysToRemove: string[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        
        if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      
      // Удаляем все найденные ключи
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Формирует ключ для хранения
   */
  private getStorageKey(userId: string): string {
    return `${STORAGE_KEY_PREFIX}${userId}`;
  }
  
  /**
   * Загружает данные из резервной копии
   */
  private loadFromBackup(userId: string): ExtendedGameState | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return null;
      }
      
      const baseKey = this.getStorageKey(userId);
      let latestBackup: string | null = null;
      let latestTime = 0;
      
      // Ищем все резервные копии
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        
        if (key && key.startsWith(`${baseKey}_backup_`)) {
          // Извлекаем временную метку
          const timestamp = parseInt(key.split('_backup_')[1], 10);
          
          if (timestamp > latestTime) {
            latestTime = timestamp;
            latestBackup = key;
          }
        }
      }
      
      // Если нашли резервную копию, загружаем ее
      if (latestBackup) {
        const backupData = localStorage.getItem(latestBackup);
        
        if (backupData) {
          try {
            // Обрабатываем аналогично основному загрузчику
            let processedData = backupData;
            
            try {
              processedData = decryptData(processedData, userId);
            } catch (error) {
              processedData = backupData;
            }
            
            try {
              processedData = decompressData(processedData);
            } catch (error) {
              // Используем данные после расшифровки
            }
            
            return JSON.parse(processedData);
          } catch (error) {
            // В случае ошибки парсинга
            return null;
          }
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Очищает старые резервные копии
   */
  private cleanupBackups(userId: string): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }
      
      const baseKey = this.getStorageKey(userId);
      const backups: {key: string, time: number}[] = [];
      
      // Собираем все резервные копии
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        
        if (key && key.startsWith(`${baseKey}_backup_`)) {
          const timestamp = parseInt(key.split('_backup_')[1], 10);
          backups.push({key, time: timestamp});
        }
      }
      
      // Сортируем по времени (от новых к старым)
      backups.sort((a, b) => b.time - a.time);
      
      // Оставляем только 3 последние копии
      const MAX_BACKUPS = 3;
      
      if (backups.length > MAX_BACKUPS) {
        backups.slice(MAX_BACKUPS).forEach(backup => {
          localStorage.removeItem(backup.key);
        });
      }
    } catch (error) {
      // Игнорируем ошибки при очистке бэкапов
    }
  }
} 