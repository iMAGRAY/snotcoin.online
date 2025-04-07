/**
 * Адаптер для работы с IndexedDB
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

// Константы для работы с IndexedDB
const DB_NAME = 'SnotCoinGameStorage';
const DB_VERSION = 1;
const GAME_STATE_STORE = 'gameState';
const BACKUP_STORE = 'backups';

export class IndexedDBAdapter implements StorageAdapter {
  private db: IDBDatabase | null = null;
  private isInitialized: boolean = false;
  private initPromise: Promise<boolean> | null = null;
  
  constructor() {
    // В конструкторе ничего не делаем, инициализация при первом использовании
  }
  
  /**
   * Возвращает тип хранилища
   */
  getType(): StorageType {
    return StorageType.INDEXED_DB;
  }
  
  /**
   * Проверяет доступность хранилища и инициализирует его при необходимости
   */
  async exists(key: string): Promise<boolean> {
    try {
      if (typeof window === 'undefined' || !window.indexedDB) {
        return false;
      }
      
      // Инициализируем базу данных
      await this.initDatabase();
      
      return this.isInitialized;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Инициализирует базу данных IndexedDB
   */
  private async initDatabase(): Promise<boolean> {
    // Если база уже инициализирована или инициализация идет, возвращаем текущий промис
    if (this.isInitialized) return true;
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = new Promise<boolean>((resolve) => {
      try {
        if (typeof window === 'undefined' || !window.indexedDB) {
          return resolve(false);
        }
        
        // Открываем базу данных
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        // Обработчик обновления структуры базы данных
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          
          // Создаем хранилище для игровых состояний, если его еще нет
          if (!db.objectStoreNames.contains(GAME_STATE_STORE)) {
            const store = db.createObjectStore(GAME_STATE_STORE, { keyPath: 'userId' });
            store.createIndex('lastModified', 'lastModified', { unique: false });
          }
          
          // Создаем хранилище для резервных копий
          if (!db.objectStoreNames.contains(BACKUP_STORE)) {
            const backupStore = db.createObjectStore(BACKUP_STORE, { keyPath: 'id', autoIncrement: true });
            backupStore.createIndex('userId', 'userId', { unique: false });
            backupStore.createIndex('timestamp', 'timestamp', { unique: false });
          }
        };
        
        // Обработчик успешного открытия базы
        request.onsuccess = (event) => {
          this.db = (event.target as IDBOpenDBRequest).result;
          this.isInitialized = true;
          resolve(true);
        };
        
        // Обработчик ошибки
        request.onerror = () => {
          resolve(false);
        };
      } catch (error) {
        resolve(false);
      }
    });
    
    return this.initPromise;
  }
  
  /**
   * Сохраняет игровое состояние в IndexedDB
   */
  async save(
    userId: string, 
    state: ExtendedGameState, 
    options: SaveOptions = {}
  ): Promise<SaveResult> {
    const startTime = Date.now();
    
    try {
      // Инициализируем базу данных
      const initialized = await this.initDatabase();
      
      if (!initialized || !this.db) {
        throw new Error('Не удалось инициализировать IndexedDB');
      }
      
      // Подготавливаем данные для сохранения
      const dataToSave = {
        userId,
        state,
        lastModified: Date.now(),
        version: state._saveVersion || 0
      };
      
      // Начинаем транзакцию
      const transaction = this.db.transaction([GAME_STATE_STORE], 'readwrite');
      const store = transaction.objectStore(GAME_STATE_STORE);
      
      // Сохраняем данные
      const putRequest = store.put(dataToSave);
      
      // Ожидаем завершения сохранения
      await new Promise<void>((resolve, reject) => {
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      
      // Если требуется создать резервную копию
      if (options.createBackup) {
        await this.createBackup(userId, state);
      }
      
      return {
        success: true,
        timestamp: Date.now(),
        source: StorageType.INDEXED_DB,
        duration: Date.now() - startTime,
        dataSize: JSON.stringify(state).length
      };
    } catch (error) {
      return {
        success: false,
        timestamp: Date.now(),
        source: StorageType.INDEXED_DB,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };
    }
  }
  
  /**
   * Загружает игровое состояние из IndexedDB
   */
  async load(
    userId: string, 
    options: LoadOptions = {}
  ): Promise<LoadResult> {
    const startTime = Date.now();
    
    try {
      // Инициализируем базу данных
      const initialized = await this.initDatabase();
      
      if (!initialized || !this.db) {
        throw new Error('Не удалось инициализировать IndexedDB');
      }
      
      // Начинаем транзакцию
      const transaction = this.db.transaction([GAME_STATE_STORE], 'readonly');
      const store = transaction.objectStore(GAME_STATE_STORE);
      
      // Получаем данные
      const getRequest = store.get(userId);
      
      // Ожидаем завершения загрузки
      const result = await new Promise<any>((resolve, reject) => {
        getRequest.onsuccess = () => resolve(getRequest.result);
        getRequest.onerror = () => reject(getRequest.error);
      });
      
      // Если данные не найдены и разрешено восстановление из бэкапа
      if (!result && options.fallbackToDefault) {
        const backup = await this.getLatestBackup(userId);
        
        if (backup) {
          return {
            success: true,
            timestamp: backup.timestamp,
            source: StorageType.INDEXED_DB,
            data: backup.state,
            wasRepaired: true,
            duration: Date.now() - startTime
          };
        }
        
        return {
          success: false,
          timestamp: Date.now(),
          source: StorageType.INDEXED_DB,
          error: 'Данные не найдены',
          duration: Date.now() - startTime
        };
      }
      
      // Если данные найдены
      if (result && result.state) {
        return {
          success: true,
          timestamp: result.lastModified,
          source: StorageType.INDEXED_DB,
          data: result.state,
          duration: Date.now() - startTime
        };
      }
      
      return {
        success: false,
        timestamp: Date.now(),
        source: StorageType.INDEXED_DB,
        error: 'Данные не найдены',
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        timestamp: Date.now(),
        source: StorageType.INDEXED_DB,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };
    }
  }
  
  /**
   * Удаляет сохранение пользователя из IndexedDB
   */
  async delete(userId: string): Promise<boolean> {
    try {
      // Инициализируем базу данных
      const initialized = await this.initDatabase();
      
      if (!initialized || !this.db) {
        return false;
      }
      
      // Начинаем транзакцию для удаления основного состояния
      const transaction = this.db.transaction([GAME_STATE_STORE], 'readwrite');
      const store = transaction.objectStore(GAME_STATE_STORE);
      
      // Удаляем данные
      const deleteRequest = store.delete(userId);
      
      // Ожидаем завершения удаления
      await new Promise<void>((resolve, reject) => {
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => reject(deleteRequest.error);
      });
      
      // Удаляем резервные копии
      await this.deleteBackups(userId);
      
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
      // Инициализируем базу данных
      const initialized = await this.initDatabase();
      
      if (!initialized || !this.db) {
        return false;
      }
      
      // Начинаем транзакцию для очистки всех хранилищ
      const transaction = this.db.transaction([GAME_STATE_STORE, BACKUP_STORE], 'readwrite');
      const stateStore = transaction.objectStore(GAME_STATE_STORE);
      const backupStore = transaction.objectStore(BACKUP_STORE);
      
      // Очищаем хранилища
      stateStore.clear();
      backupStore.clear();
      
      // Ожидаем завершения транзакции
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Создает резервную копию состояния в IndexedDB
   */
  private async createBackup(userId: string, state: ExtendedGameState): Promise<void> {
    try {
      if (!this.db) return;
      
      // Начинаем транзакцию
      const transaction = this.db.transaction([BACKUP_STORE], 'readwrite');
      const store = transaction.objectStore(BACKUP_STORE);
      
      // Подготавливаем данные для сохранения
      const backupData = {
        userId,
        state,
        timestamp: Date.now(),
        version: state._saveVersion || 0
      };
      
      // Сохраняем резервную копию
      store.add(backupData);
      
      // Очищаем старые резервные копии
      await this.cleanupBackups(userId);
    } catch (error) {
      // Игнорируем ошибки при создании бэкапа
    }
  }
  
  /**
   * Получает последнюю резервную копию пользователя
   */
  private async getLatestBackup(userId: string): Promise<{
    state: ExtendedGameState, 
    timestamp: number
  } | null> {
    try {
      if (!this.db) return null;
      
      // Начинаем транзакцию
      const transaction = this.db.transaction([BACKUP_STORE], 'readonly');
      const store = transaction.objectStore(BACKUP_STORE);
      const index = store.index('userId');
      
      // Получаем все бэкапы пользователя
      const request = index.getAll(userId);
      
      // Ожидаем завершения запроса
      const backups = await new Promise<any[]>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      // Если бэкапов нет
      if (!backups || backups.length === 0) {
        return null;
      }
      
      // Сортируем по времени (от новых к старым) и возвращаем последний
      backups.sort((a, b) => b.timestamp - a.timestamp);
      
      return {
        state: backups[0].state,
        timestamp: backups[0].timestamp
      };
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Очищает старые резервные копии пользователя
   */
  private async cleanupBackups(userId: string): Promise<void> {
    try {
      if (!this.db) return;
      
      // Начинаем транзакцию
      const transaction = this.db.transaction([BACKUP_STORE], 'readwrite');
      const store = transaction.objectStore(BACKUP_STORE);
      const index = store.index('userId');
      
      // Получаем все бэкапы пользователя
      const request = index.getAll(userId);
      
      // Ожидаем завершения запроса
      const backups = await new Promise<any[]>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      // Если бэкапов менее 5, ничего не делаем
      const MAX_BACKUPS = 5;
      if (!backups || backups.length <= MAX_BACKUPS) {
        return;
      }
      
      // Сортируем по времени (от новых к старым)
      backups.sort((a, b) => b.timestamp - a.timestamp);
      
      // Удаляем старые бэкапы (оставляем только MAX_BACKUPS)
      const backupsToDelete = backups.slice(MAX_BACKUPS);
      
      for (const backup of backupsToDelete) {
        store.delete(backup.id);
      }
    } catch (error) {
      // Игнорируем ошибки при очистке бэкапов
    }
  }
  
  /**
   * Удаляет все резервные копии пользователя
   */
  private async deleteBackups(userId: string): Promise<void> {
    try {
      if (!this.db) return;
      
      // Начинаем транзакцию
      const transaction = this.db.transaction([BACKUP_STORE], 'readwrite');
      const store = transaction.objectStore(BACKUP_STORE);
      const index = store.index('userId');
      
      // Получаем все бэкапы пользователя
      const request = index.getAll(userId);
      
      // Ожидаем завершения запроса
      const backups = await new Promise<any[]>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      // Если бэкапов нет
      if (!backups || backups.length === 0) {
        return;
      }
      
      // Удаляем все бэкапы
      for (const backup of backups) {
        store.delete(backup.id);
      }
    } catch (error) {
      // Игнорируем ошибки при удалении бэкапов
    }
  }
} 