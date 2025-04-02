/**
 * indexedDBService.ts
 * Сервис для работы с IndexedDB в качестве альтернативного хранилища для игровых данных
 */

// Настройки базы данных
const DB_NAME = 'snotcoin_db';
const DB_VERSION = 1;
const STORE_GAME_DATA = 'game_data';
const STORE_BACKUPS = 'backups';

// Глобальная переменная для хранения соединения с базой данных
let dbInstance: IDBDatabase | null = null;
// Флаг инициализации базы данных
let isDbInitialized = false;
// Максимальное количество попыток инициализации
const MAX_INIT_ATTEMPTS = 3;
// Текущее количество попыток
let initAttempts = 0;

/**
 * Проверяет доступность IndexedDB
 */
export const isIndexedDBAvailable = (): boolean => {
  return typeof window !== 'undefined' && 'indexedDB' in window;
};

/**
 * Инициализирует базу данных IndexedDB
 */
export const initDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      reject(new Error('IndexedDB не поддерживается в этом браузере'));
      return;
    }

    // Если соединение уже установлено, возвращаем его
    if (dbInstance && isDbInitialized) {
      resolve(dbInstance);
      return;
    }

    console.log(`[indexedDBService] Создание/обновление базы данных до версии ${DB_VERSION} (попытка ${initAttempts + 1}/${MAX_INIT_ATTEMPTS})`);
    
    // Увеличиваем счетчик попыток
    initAttempts++;
    
    // Открываем или создаем базу данных
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      const error = (event.target as IDBRequest).error;
      console.error('[indexedDBService] Ошибка при открытии базы данных:', error);
      
      // Если достигли максимального количества попыток, отклоняем с ошибкой
      if (initAttempts >= MAX_INIT_ATTEMPTS) {
        console.error('[indexedDBService] Превышено максимальное количество попыток инициализации');
        reject(error);
      } else {
        // Иначе запускаем повторную попытку после небольшой задержки
        setTimeout(() => {
          initDatabase().then(resolve).catch(reject);
        }, 500);
      }
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBRequest).result as IDBDatabase;
      
      // Создаем хранилища объектов, если их еще нет
      if (!db.objectStoreNames.contains(STORE_GAME_DATA)) {
        db.createObjectStore(STORE_GAME_DATA, { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains(STORE_BACKUPS)) {
        const backupStore = db.createObjectStore(STORE_BACKUPS, { keyPath: 'key' });
        backupStore.createIndex('userId', 'userId', { unique: false });
        backupStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      const db = (event.target as IDBRequest).result as IDBDatabase;
      dbInstance = db;
      isDbInitialized = true;
      initAttempts = 0;
      
      // Обработчик для закрытия соединения при ошибках
      db.onerror = (event) => {
        console.error('[indexedDBService] Ошибка базы данных:', (event.target as IDBRequest).error);
      };
      
      resolve(db);
    };
  });
};

/**
 * Возвращает соединение с базой данных, инициализируя его при необходимости
 */
const getDatabase = async (): Promise<IDBDatabase> => {
  if (!dbInstance || !isDbInitialized) {
    try {
      return await initDatabase();
    } catch (error) {
      console.error('[indexedDBService] Не удалось получить соединение с базой данных:', error);
      // Перехватываем ошибки, связанные с /database
      if (error instanceof Error && 
          (error.message.includes('/database') || 
           error.message.includes('404'))) {
        console.warn('[indexedDBService] Перехвачена ошибка 404 для /database, используем резервное решение');
        // Здесь можно реализовать резервное решение, например, использование localStorage
      }
      throw error;
    }
  }
  return dbInstance;
};

/**
 * Сохраняет игровые данные в IndexedDB
 * @param userId ID пользователя
 * @param data Данные для сохранения
 * @param version Версия данных
 */
export const saveGameData = async (userId: string, data: any, version: number): Promise<void> => {
  try {
    const db = await getDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_GAME_DATA, 'readwrite');
      const store = transaction.objectStore(STORE_GAME_DATA);
      
      // Подготавливаем данные для сохранения
      const saveData = {
        id: userId,
        data,
        lastUpdated: Date.now(),
        version
      };
      
      const request = store.put(saveData);
      
      request.onerror = (event) => {
        const error = (event.target as IDBRequest).error;
        console.error(`[indexedDBService] Ошибка при сохранении данных для ${userId}:`, error);
        reject(error);
      };
      
      request.onsuccess = () => {
        console.log(`[indexedDBService] Данные успешно сохранены для ${userId}`);
        resolve();
      };
      
      transaction.oncomplete = () => {
        resolve();
      };
      
      transaction.onerror = (event) => {
        const error = (event.target as IDBRequest).error;
        console.error(`[indexedDBService] Ошибка транзакции при сохранении данных для ${userId}:`, error);
        reject(error);
      };
    });
  } catch (error) {
    console.error(`[indexedDBService] Не удалось сохранить данные для ${userId}:`, error);
    throw error;
  }
};

/**
 * Получает игровые данные из IndexedDB
 * @param userId ID пользователя
 */
export const getGameData = async (userId: string): Promise<any | null> => {
  try {
    const db = await getDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_GAME_DATA, 'readonly');
      const store = transaction.objectStore(STORE_GAME_DATA);
      
      const request = store.get(userId);
      
      request.onerror = (event) => {
        const error = (event.target as IDBRequest).error;
        console.error(`[indexedDBService] Ошибка при получении данных для ${userId}:`, error);
        reject(error);
      };
      
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          console.log(`[indexedDBService] Данные успешно загружены для ${userId}`);
          resolve(result.data);
        } else {
          console.log(`[indexedDBService] Данные не найдены для ${userId}`);
          resolve(null);
        }
      };
    });
  } catch (error) {
    console.error(`[indexedDBService] Не удалось получить данные для ${userId}:`, error);
    return null;
  }
};

/**
 * Удаляет игровые данные пользователя из IndexedDB
 * @param userId ID пользователя
 */
export const deleteUserData = async (userId: string): Promise<void> => {
  try {
    const db = await getDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_GAME_DATA, STORE_BACKUPS], 'readwrite');
      const gameStore = transaction.objectStore(STORE_GAME_DATA);
      const backupStore = transaction.objectStore(STORE_BACKUPS);
      const backupIndex = backupStore.index('userId');
      
      // Удаляем основные данные
      const deleteRequest = gameStore.delete(userId);
      
      deleteRequest.onerror = (event) => {
        const error = (event.target as IDBRequest).error;
        console.error(`[indexedDBService] Ошибка при удалении данных для ${userId}:`, error);
        reject(error);
      };
      
      // Получаем и удаляем все резервные копии
      const backupsRequest = backupIndex.getAll(userId);
      
      backupsRequest.onsuccess = () => {
        const backups = backupsRequest.result;
        
        backups.forEach((backup) => {
          backupStore.delete(backup.key);
        });
        
        console.log(`[indexedDBService] Удалено ${backups.length} резервных копий для ${userId}`);
      };
      
      transaction.oncomplete = () => {
        console.log(`[indexedDBService] Данные успешно удалены для ${userId}`);
        resolve();
      };
      
      transaction.onerror = (event) => {
        const error = (event.target as IDBRequest).error;
        console.error(`[indexedDBService] Ошибка транзакции при удалении данных для ${userId}:`, error);
        reject(error);
      };
    });
  } catch (error) {
    console.error(`[indexedDBService] Не удалось удалить данные для ${userId}:`, error);
    throw error;
  }
};

/**
 * Создает резервную копию игровых данных
 * @param userId ID пользователя
 * @param data Данные для резервной копии
 * @param version Версия данных
 * @param timestamp Временная метка (если не указана, используется текущее время)
 */
export const createBackup = async (
  userId: string, 
  data: any, 
  version: number,
  timestamp: number = Date.now()
): Promise<void> => {
  try {
    const db = await getDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_BACKUPS, 'readwrite');
      const store = transaction.objectStore(STORE_BACKUPS);
      
      // Создаем ключ для резервной копии
      const backupKey = `backup_${userId}_${timestamp}`;
      
      // Подготавливаем данные для сохранения
      const backupData = {
        key: backupKey,
        userId,
        data,
        timestamp,
        version
      };
      
      const request = store.put(backupData);
      
      request.onerror = (event) => {
        const error = (event.target as IDBRequest).error;
        console.error(`[indexedDBService] Ошибка при создании резервной копии для ${userId}:`, error);
        reject(error);
      };
      
      request.onsuccess = () => {
        console.log(`[indexedDBService] Резервная копия успешно создана для ${userId}`);
        resolve();
      };
      
      transaction.oncomplete = () => {
        resolve();
      };
      
      transaction.onerror = (event) => {
        const error = (event.target as IDBRequest).error;
        console.error(`[indexedDBService] Ошибка транзакции при создании резервной копии для ${userId}:`, error);
        reject(error);
      };
    });
  } catch (error) {
    console.error(`[indexedDBService] Не удалось создать резервную копию для ${userId}:`, error);
    throw error;
  }
};

/**
 * Получает последнюю резервную копию пользователя
 * @param userId ID пользователя
 */
export const getLatestBackup = async (userId: string): Promise<any | null> => {
  try {
    const db = await getDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_BACKUPS, 'readonly');
      const store = transaction.objectStore(STORE_BACKUPS);
      const index = store.index('userId');
      
      // Получаем все резервные копии пользователя
      const request = index.getAll(userId);
      
      request.onerror = (event) => {
        const error = (event.target as IDBRequest).error;
        console.error(`[indexedDBService] Ошибка при получении резервных копий для ${userId}:`, error);
        reject(error);
      };
      
      request.onsuccess = () => {
        const backups = request.result;
        
        if (backups && backups.length > 0) {
          // Сортируем по времени (самые новые первые)
          backups.sort((a, b) => b.timestamp - a.timestamp);
          
          console.log(`[indexedDBService] Найдено ${backups.length} резервных копий для ${userId}, последняя от ${new Date(backups[0].timestamp).toLocaleString()}`);
          resolve(backups[0]);
        } else {
          console.log(`[indexedDBService] Резервные копии не найдены для ${userId}`);
          resolve(null);
        }
      };
    });
  } catch (error) {
    console.error(`[indexedDBService] Не удалось получить резервные копии для ${userId}:`, error);
    return null;
  }
};

/**
 * Очищает старые резервные копии, оставляя только указанное количество самых новых
 * @param userId ID пользователя
 * @param maxBackups Максимальное количество сохраняемых резервных копий
 */
export const cleanupBackups = async (userId: string, maxBackups: number): Promise<number> => {
  try {
    const db = await getDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_BACKUPS, 'readwrite');
      const store = transaction.objectStore(STORE_BACKUPS);
      const index = store.index('userId');
      
      // Получаем все резервные копии пользователя
      const request = index.getAll(userId);
      
      request.onerror = (event) => {
        const error = (event.target as IDBRequest).error;
        console.error(`[indexedDBService] Ошибка при получении резервных копий для очистки (${userId}):`, error);
        reject(error);
      };
      
      request.onsuccess = () => {
        const backups = request.result;
        
        if (backups && backups.length > maxBackups) {
          // Сортируем по времени (самые новые первые)
          backups.sort((a, b) => b.timestamp - a.timestamp);
          
          // Оставляем только maxBackups самых новых копий
          const backupsToRemove = backups.slice(maxBackups);
          let removedCount = 0;
          
          backupsToRemove.forEach((backup) => {
            const deleteRequest = store.delete(backup.key);
            
            deleteRequest.onsuccess = () => {
              removedCount++;
            };
          });
          
          transaction.oncomplete = () => {
            console.log(`[indexedDBService] Удалено ${removedCount} старых резервных копий для ${userId}`);
            resolve(removedCount);
          };
          
          transaction.onerror = (event) => {
            const error = (event.target as IDBRequest).error;
            console.error(`[indexedDBService] Ошибка при удалении старых резервных копий (${userId}):`, error);
            reject(error);
          };
        } else {
          // Нечего удалять
          resolve(0);
        }
      };
    });
  } catch (error) {
    console.error(`[indexedDBService] Не удалось очистить резервные копии для ${userId}:`, error);
    return 0;
  }
};

/**
 * Получает информацию о размере хранилища для пользователя
 * @param userId ID пользователя
 */
export const getStorageInfo = async (userId: string): Promise<{ size: number; count: number }> => {
  try {
    const db = await getDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_GAME_DATA, STORE_BACKUPS], 'readonly');
      const gameStore = transaction.objectStore(STORE_GAME_DATA);
      const backupStore = transaction.objectStore(STORE_BACKUPS);
      const backupIndex = backupStore.index('userId');
      
      // Получаем основные данные
      const gameRequest = gameStore.get(userId);
      let gameDataSize = 0;
      
      gameRequest.onsuccess = () => {
        const result = gameRequest.result;
        if (result) {
          const jsonData = JSON.stringify(result);
          gameDataSize = jsonData.length;
        }
      };
      
      // Получаем все резервные копии
      const backupsRequest = backupIndex.getAll(userId);
      let backupsSize = 0;
      let backupsCount = 0;
      
      backupsRequest.onsuccess = () => {
        const backups = backupsRequest.result;
        backupsCount = backups.length;
        
        backups.forEach((backup) => {
          const jsonData = JSON.stringify(backup);
          backupsSize += jsonData.length;
        });
      };
      
      transaction.oncomplete = () => {
        const totalSize = gameDataSize + backupsSize;
        console.log(`[indexedDBService] Размер данных для ${userId}: ${totalSize} байт, ${backupsCount} резервных копий`);
        resolve({ size: totalSize, count: backupsCount + (gameDataSize > 0 ? 1 : 0) });
      };
      
      transaction.onerror = (event) => {
        const error = (event.target as IDBRequest).error;
        console.error(`[indexedDBService] Ошибка при получении информации о хранилище для ${userId}:`, error);
        reject(error);
      };
    });
  } catch (error) {
    console.error(`[indexedDBService] Не удалось получить информацию о хранилище для ${userId}:`, error);
    return { size: 0, count: 0 };
  }
};

/**
 * Получает все сохранения игры для пользователя из IndexedDB
 * @param userId ID пользователя
 * @returns Массив объектов сохранений
 */
export const getAllUserSaves = async (userId: string): Promise<Array<{
  id: string;
  data: any;
  lastUpdated: number;
  version: number;
}>> => {
  try {
    const db = await getDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_GAME_DATA, 'readonly');
      const store = transaction.objectStore(STORE_GAME_DATA);
      
      // Поиск сохранений для конкретного пользователя
      const results: Array<{
        id: string;
        data: any;
        lastUpdated: number;
        version: number;
      }> = [];
      
      // Перебираем все сохранения в хранилище
      const cursorRequest = store.openCursor();
      
      cursorRequest.onerror = (event) => {
        const error = (event.target as IDBRequest).error;
        console.error(`[indexedDBService] Ошибка при получении сохранений для ${userId}:`, error);
        reject(error);
      };
      
      cursorRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        
        // Если курсор существует, обрабатываем текущую запись
        if (cursor) {
          const saveData = cursor.value;
          
          // Проверяем, принадлежит ли сохранение этому пользователю
          if (saveData.id === userId) {
            results.push({
              id: saveData.id,
              data: saveData.data,
              lastUpdated: saveData.lastUpdated,
              version: saveData.version || 1
            });
          }
          
          // Переходим к следующей записи
          cursor.continue();
        } else {
          // Курсор закончился, возвращаем результаты
          console.log(`[indexedDBService] Найдено ${results.length} сохранений для ${userId}`);
          
          // Сортируем по времени последнего обновления (сначала новые)
          results.sort((a, b) => b.lastUpdated - a.lastUpdated);
          
          resolve(results);
        }
      };
    });
  } catch (error) {
    console.error(`[indexedDBService] Не удалось получить сохранения для ${userId}:`, error);
    return [];
  }
}; 