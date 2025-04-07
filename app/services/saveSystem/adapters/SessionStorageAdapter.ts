/**
 * Адаптер для работы с sessionStorage
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
import { encryptData, decryptData } from '../utils';
import { ExtendedGameState } from '../../../types/gameTypes';

// Префикс для ключей в sessionStorage
const STORAGE_KEY_PREFIX = 'snotcoin_session_state_';

export class SessionStorageAdapter implements StorageAdapter {
  /**
   * Возвращает тип хранилища
   */
  getType(): StorageType {
    return StorageType.SESSION;
  }
  
  /**
   * Проверяет доступность хранилища
   */
  exists(key: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        if (typeof window === 'undefined' || !window.sessionStorage) {
          return resolve(false);
        }
        
        // Проверяем доступность sessionStorage
        const testKey = `${STORAGE_KEY_PREFIX}test`;
        sessionStorage.setItem(testKey, '1');
        const testValue = sessionStorage.getItem(testKey);
        sessionStorage.removeItem(testKey);
        
        resolve(testValue === '1');
      } catch (error) {
        // sessionStorage может быть недоступен из-за настроек приватности
        resolve(false);
      }
    });
  }
  
  /**
   * Сохраняет игровое состояние в sessionStorage
   */
  async save(
    userId: string, 
    state: ExtendedGameState, 
    options: SaveOptions = {}
  ): Promise<SaveResult> {
    const startTime = Date.now();
    
    try {
      if (typeof window === 'undefined' || !window.sessionStorage) {
        throw new Error('sessionStorage недоступен');
      }
      
      // Формируем ключ для хранения
      const key = this.getStorageKey(userId);
      
      // Подготавливаем данные
      let dataToSave = JSON.stringify(state);
      const dataSize = dataToSave.length;
      
      // Шифруем данные если нужно
      if (options.encrypt) {
        dataToSave = encryptData(dataToSave, userId);
      }
      
      // Сохраняем в sessionStorage
      sessionStorage.setItem(key, dataToSave);
      
      return {
        success: true,
        timestamp: Date.now(),
        source: StorageType.SESSION,
        duration: Date.now() - startTime,
        dataSize
      };
    } catch (error) {
      return {
        success: false,
        timestamp: Date.now(),
        source: StorageType.SESSION,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };
    }
  }
  
  /**
   * Загружает игровое состояние из sessionStorage
   */
  async load(
    userId: string, 
    options: LoadOptions = {}
  ): Promise<LoadResult> {
    const startTime = Date.now();
    
    try {
      if (typeof window === 'undefined' || !window.sessionStorage) {
        throw new Error('sessionStorage недоступен');
      }
      
      // Формируем ключ для загрузки
      const key = this.getStorageKey(userId);
      
      // Проверяем наличие данных
      const rawData = sessionStorage.getItem(key);
      
      if (!rawData) {
        return {
          success: false,
          timestamp: Date.now(),
          source: StorageType.SESSION,
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
        source: StorageType.SESSION,
        data: gameState,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        timestamp: Date.now(),
        source: StorageType.SESSION,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };
    }
  }
  
  /**
   * Удаляет сохранение пользователя из sessionStorage
   */
  async delete(userId: string): Promise<boolean> {
    try {
      if (typeof window === 'undefined' || !window.sessionStorage) {
        return false;
      }
      
      // Удаляем сохранение
      const key = this.getStorageKey(userId);
      sessionStorage.removeItem(key);
      
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
      if (typeof window === 'undefined' || !window.sessionStorage) {
        return false;
      }
      
      // Удаляем только данные с нашим префиксом
      const keysToRemove: string[] = [];
      
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        
        if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      
      // Удаляем все найденные ключи
      keysToRemove.forEach(key => sessionStorage.removeItem(key));
      
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
} 