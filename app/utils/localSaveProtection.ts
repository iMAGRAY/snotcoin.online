/**
 * Модуль для защищенного локального хранения данных игры
 * Обеспечивает шифрование данных в localStorage и проверку целостности
 */

import { GameState, ExtendedGameState } from '../types/gameTypes';

const STORAGE_PREFIX = 'snotcoin_secure_';
const METADATA_KEY = 'last_sync_metadata';
const INTEGRITY_SALT = 'sn0tc01n_integrity_2023';

/**
 * Создает хеш для проверки целостности данных
 * @param data Данные для хеширования
 * @param userId ID пользователя для соли
 * @returns Хеш данных
 */
function createIntegrityHash(data: string, userId: string): string {
  try {
    // Простая хеш-функция для браузера
    // В реальном приложении используйте более надежные методы
    let hash = 0;
    const salt = INTEGRITY_SALT + userId;
    const stringToHash = data + salt;
    
    for (let i = 0; i < stringToHash.length; i++) {
      const char = stringToHash.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return hash.toString(16).padStart(8, '0');
  } catch (error) {
    console.error('[localSaveProtection] Ошибка создания хеша:', error);
    return '';
  }
}

/**
 * Шифрует строку для хранения в localStorage
 * Использует простое обратимое шифрование для защиты от ручного редактирования
 * @param text Строка для шифрования
 * @param userId ID пользователя как часть ключа
 * @returns Зашифрованная строка
 */
function encryptForLocalStorage(text: string, userId: string): string {
  try {
    // Простое обратимое шифрование для браузера
    // Для продакшена рекомендуется использовать SubtleCrypto API
    const key = (INTEGRITY_SALT + userId).split('').map(c => c.charCodeAt(0));
    let result = '';
    
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      // Безопасное получение ключа с проверкой индекса
      const keyIndex = i % key.length;
      const keyChar = key[keyIndex] || 0; // В случае ошибки используем 0
      // XOR шифрование с ключом
      const encryptedChar = (charCode ^ keyChar).toString(16).padStart(4, '0');
      result += encryptedChar;
    }
    
    return result;
  } catch (error) {
    console.error('[localSaveProtection] Ошибка шифрования:', error);
    return '';
  }
}

/**
 * Дешифрует строку из localStorage
 * @param encrypted Зашифрованная строка
 * @param userId ID пользователя как часть ключа
 * @returns Расшифрованная строка
 */
function decryptFromLocalStorage(encrypted: string, userId: string): string {
  try {
    // Обратное шифрование
    const key = (INTEGRITY_SALT + userId).split('').map(c => c.charCodeAt(0));
    let result = '';
    
    for (let i = 0; i < encrypted.length; i += 4) {
      const encHex = encrypted.substr(i, 4);
      const encChar = parseInt(encHex, 16);
      // Безопасное получение ключа с проверкой индекса
      const keyIndex = (i / 4) % key.length;
      const keyChar = key[Math.floor(keyIndex)] || 0; // Округляем индекс и используем 0 при ошибке
      // XOR дешифрование с тем же ключом
      result += String.fromCharCode(encChar ^ keyChar);
    }
    
    return result;
  } catch (error) {
    console.error('[localSaveProtection] Ошибка дешифрования:', error);
    return '';
  }
}

/**
 * Защищенно сохраняет игровое состояние в localStorage
 * @param userId ID пользователя
 * @param gameState Состояние игры для сохранения
 * @returns Успех операции
 */
export function secureLocalSave(userId: string, gameState: GameState | ExtendedGameState): boolean {
  try {
    if (!userId || !gameState) {
      console.error('[localSaveProtection] Отсутствует userId или gameState для сохранения');
      return false;
    }
    
    // Проверка критичных полей
    if (!gameState.inventory || typeof gameState.inventory !== 'object') {
      console.error('[localSaveProtection] Некорректная структура gameState.inventory');
      return false;
    }
    
    // Глубокая проверка критичных полей перед сохранением
    const { snot, snotCoins, containerSnot } = gameState.inventory;
    
    // Проверяем и корректируем критичные поля
    let modifiedState = { ...gameState };
    let wasFixed = false;
    
    // Выводим значения для отладки
    console.log('[localSaveProtection] Проверка состояния перед сохранением:', {
      snot,
      snotCoins,
      containerSnot,
      userId,
      времяСохранения: new Date().toISOString()
    });
    
    // Проверка типов критических ресурсов, исправление при необходимости
    if (typeof snot !== 'number' || isNaN(snot)) {
      console.warn('[localSaveProtection] Обнаружено некорректное значение snot:', snot);
      modifiedState = {
        ...modifiedState,
        inventory: {
          ...modifiedState.inventory,
          snot: 0 // Безопасное значение при отсутствии
        }
      };
      wasFixed = true;
    }
    
    // Проверка snotCoins
    if (typeof snotCoins !== 'number' || isNaN(snotCoins)) {
      console.warn('[localSaveProtection] Обнаружено некорректное значение snotCoins:', snotCoins);
      modifiedState = {
        ...modifiedState,
        inventory: {
          ...modifiedState.inventory,
          snotCoins: 0 // Безопасное значение при отсутствии
        }
      };
      wasFixed = true;
    }
    
    // Проверка containerSnot
    if (typeof containerSnot !== 'number' || isNaN(containerSnot)) {
      console.warn('[localSaveProtection] Обнаружено некорректное значение containerSnot:', containerSnot);
      modifiedState = {
        ...modifiedState,
        inventory: {
          ...modifiedState.inventory,
          containerSnot: 0 // Безопасное значение при отсутствии
        }
      };
      wasFixed = true;
    }
    
    // Проверка _lastCollectOperation
    if ((gameState as any)._lastCollectOperation) {
      // Проверяем, что последняя операция сбора актуальна (меньше 1 минуты назад)
      const collectOperation = (gameState as any)._lastCollectOperation;
      const collectTime = new Date(collectOperation.time).getTime();
      const now = Date.now();
      const collectTimeDiff = now - collectTime;
      
      console.log('[localSaveProtection] Информация о последнем сборе:', {
        времяСбора: collectOperation.time,
        прошлоМс: collectTimeDiff,
        собрано: collectOperation.amount,
        snot: gameState.inventory.snot
      });
    }
    
    // Добавляем информацию, если состояние было исправлено
    if (wasFixed) {
      modifiedState = {
        ...modifiedState,
        _wasRepaired: true,
        _repairedAt: Date.now(),
        _repairedFields: ['inventory']
      };
    }
    
    // Используем исправленное состояние для сохранения
    const stateToSave = modifiedState;
    
    // Создаем аварийную копию перед основным сохранением
    try {
      // Сохраняем аварийную копию в sessionStorage
      const stateJson = JSON.stringify(stateToSave);
      sessionStorage.setItem(`emergency_backup_${userId}`, stateJson);
      
      console.log('[localSaveProtection] Создана аварийная копия состояния перед сохранением');
    } catch (backupError) {
      console.warn('[localSaveProtection] Не удалось создать аварийную копию:', backupError);
    }
    
    // Выводим подробную информацию о сохраняемых данных для отладки
    console.log('[localSaveProtection] Сохраняем игровое состояние:', {
      userId,
      snot: stateToSave.inventory.snot,
      containerSnot: stateToSave.inventory.containerSnot,
      wasFixed,
      timestamp: new Date().toISOString()
    });
    
    // Обновляем метаданные локального сохранения
    const now = Date.now();
    const saveMetadata = {
      lastLocalSaveTime: now,
      lastServerSyncTime: stateToSave._lastSaved ? new Date(stateToSave._lastSaved).getTime() : null,
      saveVersion: stateToSave._saveVersion || 1,
      userId: userId
    };
    
    // Добавляем дополнительное поле со временем сохранения в само состояние
    const stateWithTimestamp = {
      ...stateToSave,
      _lastModified: now,
      _localSaveTimestamp: now
    };
    
    // Преобразуем игровое состояние в строку
    const gameStateJson = JSON.stringify(stateWithTimestamp);
    
    // Создаем хеш для проверки целостности
    const integrityHash = createIntegrityHash(gameStateJson, userId);
    
    // Создаем финальную строку с хешем
    const dataWithIntegrity = JSON.stringify({
      data: gameStateJson,
      hash: integrityHash,
      timestamp: now
    });
    
    // Шифруем данные для хранения
    const encryptedData = encryptForLocalStorage(dataWithIntegrity, userId);
    
    try {
      // Сначала сохраняем копию предыдущего состояния как резервную (если оно есть)
      const previousData = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
      if (previousData) {
        localStorage.setItem(`${STORAGE_PREFIX}${userId}_backup`, previousData);
      }
      
      // Сохраняем в localStorage
      localStorage.setItem(`${STORAGE_PREFIX}${userId}`, encryptedData);
      localStorage.setItem(`${STORAGE_PREFIX}${METADATA_KEY}_${userId}`, JSON.stringify(saveMetadata));
      
      // Проверяем, что сохранение прошло успешно
      const savedData = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
      if (savedData !== encryptedData) {
        console.error('[localSaveProtection] Проверка сохранения не прошла. Данные не совпадают');
        return false;
      }
      
      // Дополнительная проверка - дешифруем и проверяем сохраненные данные
      try {
        const decryptedData = decryptFromLocalStorage(savedData, userId);
        if (!decryptedData) {
          console.error('[localSaveProtection] Не удалось дешифровать сохраненные данные');
          return false;
        }
        
        // Сверяем хеш сохраненных данных
        const parsedData = JSON.parse(decryptedData);
        const savedHash = parsedData.hash;
        const computedHash = createIntegrityHash(parsedData.data, userId);
        
        if (savedHash !== computedHash) {
          console.error('[localSaveProtection] Хеш сохраненных данных не соответствует ожидаемому');
          return false;
        }
        
        console.log('[localSaveProtection] Проверка сохранения успешна');
      } catch (verifyError) {
        console.error('[localSaveProtection] Ошибка при проверке сохраненных данных:', verifyError);
        // Продолжаем выполнение, так как основное сохранение прошло успешно
      }
      
      return true;
    } catch (storageError) {
      // Если возникла ошибка при сохранении (например, localStorage переполнен)
      console.error('[localSaveProtection] Ошибка при записи в localStorage:', storageError);
      
      // Пробуем использовать sessionStorage как запасной вариант
      try {
        sessionStorage.setItem(`${STORAGE_PREFIX}${userId}_emergency`, encryptedData);
        console.log('[localSaveProtection] Данные сохранены в sessionStorage как аварийная копия');
      } catch (emergencyError) {
        console.error('[localSaveProtection] Не удалось создать аварийную копию:', emergencyError);
      }
      
      return false;
    }
  } catch (error) {
    console.error('[localSaveProtection] Ошибка при локальном сохранении:', error);
    return false;
  }
}

/**
 * Дешифрует и загружает данные из защищенного локального хранилища
 * @param userId ID пользователя
 * @returns Загруженное состояние игры или null при ошибке
 */
export function secureLocalLoad(userId: string): GameState | null {
  try {
    if (!userId || typeof window === 'undefined' || !window.localStorage) {
      return null;
    }

    const storageKey = `${STORAGE_PREFIX}${userId}`;
    const data = localStorage.getItem(storageKey);

    if (!data) {
      console.log(`[localSaveProtection] Нет сохраненных данных для ${userId}`);
      return null;
    }

    // Дешифруем данные
    const decrypted = decryptFromLocalStorage(data, userId);
    
    if (!decrypted) {
      console.error(`[localSaveProtection] Не удалось дешифровать данные для ${userId}`);
      return null;
    }

    // Парсим JSON
    let gameState: GameState;
    try {
      gameState = JSON.parse(decrypted);
    } catch (parseError) {
      console.error(`[localSaveProtection] Ошибка парсинга JSON:`, parseError);
      return null;
    }

    // Проверяем базовую структуру данных
    if (!gameState || typeof gameState !== 'object') {
      console.error(`[localSaveProtection] Некорректная структура загруженных данных`);
      return null;
    }

    // Проверяем хеш целостности, если он есть
    if (gameState._integrityHash) {
      const originalHash = gameState._integrityHash;
      
      // Временно удаляем хеш для проверки (чтобы не включать его в новый расчет)
      delete gameState._integrityHash;
      
      // Создаем новый хеш из текущих данных
      const jsonStr = JSON.stringify(gameState);
      const calculatedHash = createIntegrityHash(jsonStr, userId);
      
      // Восстанавливаем оригинальный хеш в объекте
      gameState._integrityHash = originalHash;
      
      // Проверяем совпадение хешей
      if (originalHash !== calculatedHash) {
        console.warn(`[localSaveProtection] Нарушена целостность данных для ${userId}. Оригинальный хеш: ${originalHash}, рассчитанный: ${calculatedHash}`);
        // Но продолжаем загрузку с пометкой
        gameState._integrityFailed = true;
      }
    }

    return gameState;
  } catch (error) {
    console.error(`[localSaveProtection] Ошибка загрузки из localStorage:`, error);
    return null;
  }
}

/**
 * Получает метаданные о последнем сохранении и синхронизации
 * @param userId ID пользователя
 * @returns Метаданные о сохранении
 */
export function getLocalSaveMetadata(userId: string): {
  lastLocalSaveTime: number;
  lastServerSyncTime: number | null;
  saveVersion: number;
  timeSinceLastSync: number;
  needsSync: boolean;
} | null {
  try {
    const metadataString = localStorage.getItem(`${STORAGE_PREFIX}${METADATA_KEY}_${userId}`);
    if (!metadataString) return null;
    
    const metadata = JSON.parse(metadataString);
    const now = Date.now();
    
    return {
      ...metadata,
      timeSinceLastSync: metadata.lastServerSyncTime ? now - metadata.lastServerSyncTime : Infinity,
      needsSync: !metadata.lastServerSyncTime || (now - metadata.lastServerSyncTime > 5 * 60 * 1000) // 5 минут
    };
  } catch (error) {
    console.error('[localSaveProtection] Ошибка при получении метаданных:', error);
    return null;
  }
}

/**
 * Проверяет необходимость синхронизации с сервером
 * @param userId ID пользователя
 * @param syncThreshold Порог времени в мс, после которого нужна синхронизация
 * @returns Нужна ли синхронизация
 */
export function needsServerSync(userId: string, syncThreshold: number = 10 * 60 * 1000): boolean {
  try {
    const metadata = getLocalSaveMetadata(userId);
    if (!metadata) return true; // Если нет метаданных, синхронизация нужна
    
    // Проверяем время с последней синхронизации
    const timeSinceLastSync = metadata.timeSinceLastSync;
    if (timeSinceLastSync > syncThreshold) {
      console.log('[localSaveProtection] Синхронизация нужна из-за времени:', {
        прошлоМинут: (timeSinceLastSync / (60 * 1000)).toFixed(2),
        порогМинут: (syncThreshold / (60 * 1000)).toFixed(2)
      });
      return true;
    }
    
    // Проверяем локальное сохранение
    const localData = secureLocalLoad(userId);
    if (!localData) return true; // Если нет локальных данных, синхронизация нужна
    
    return false;
  } catch (error) {
    console.error('[localSaveProtection] Ошибка при проверке необходимости синхронизации:', error);
    return true; // При ошибке лучше синхронизировать на всякий случай
  }
}

/**
 * Обновляет метаданные о последней синхронизации с сервером
 * @param userId ID пользователя
 * @param serverSaveTime Время синхронизации с сервером
 * @param saveVersion Версия сохранения
 */
export function updateSyncMetadata(userId: string, serverSaveTime: number | string, saveVersion: number): void {
  try {
    const metadataString = localStorage.getItem(`${STORAGE_PREFIX}${METADATA_KEY}_${userId}`);
    let metadata = metadataString ? JSON.parse(metadataString) : { userId };
    
    // Обновляем время последней синхронизации
    metadata.lastServerSyncTime = typeof serverSaveTime === 'string' 
      ? new Date(serverSaveTime).getTime() 
      : serverSaveTime;
    
    // Обновляем версию сохранения
    metadata.saveVersion = saveVersion;
    
    // Получаем текущее состояние для записи информации
    const currentState = secureLocalLoad(userId);
    if (currentState && currentState.inventory) {
      // Логируем обновление метаданных
      console.log('[localSaveProtection] Обновлены метаданные синхронизации:', {
        userId,
        времяСинхронизации: new Date(metadata.lastServerSyncTime).toISOString(),
        версия: metadata.saveVersion
      });
    }
    
    // Сохраняем обновленные метаданные
    localStorage.setItem(`${STORAGE_PREFIX}${METADATA_KEY}_${userId}`, JSON.stringify(metadata));
  } catch (error) {
    console.error('[localSaveProtection] Ошибка при обновлении метаданных синхронизации:', error);
  }
}

/**
 * Пытается восстановить данные из резервной копии, если основное сохранение повреждено
 * @param userId ID пользователя
 * @returns Восстановленное состояние или null при неудаче
 */
export function recoverFromBackup(userId: string): GameState | null {
  try {
    console.log('[localSaveProtection] Попытка восстановления из резервной копии для', userId);
    
    // Проверяем наличие резервной копии
    const backupData = localStorage.getItem(`${STORAGE_PREFIX}${userId}_backup`);
    if (!backupData) {
      console.warn('[localSaveProtection] Резервная копия не найдена');
      
      // Проверяем аварийную копию в sessionStorage
      const emergencyData = sessionStorage.getItem(`${STORAGE_PREFIX}${userId}_emergency`);
      if (!emergencyData) {
        console.warn('[localSaveProtection] Аварийная копия также не найдена');
        return null;
      }
      
      // Пытаемся восстановить из аварийной копии
      try {
        const decryptedData = decryptFromLocalStorage(emergencyData, userId);
        if (!decryptedData) {
          console.error('[localSaveProtection] Ошибка дешифрования аварийной копии');
          return null;
        }
        
        // Парсим данные и получаем игровое состояние с хешем
        const parsedData = JSON.parse(decryptedData);
        const { data, hash } = parsedData;
        
        // Проверяем целостность данных
        const computedHash = createIntegrityHash(data, userId);
        if (computedHash !== hash) {
          console.error('[localSaveProtection] Нарушена целостность аварийной копии');
          return null;
        }
        
        // Парсим игровое состояние
        const gameState = JSON.parse(data) as GameState;
        
        // Сохраняем восстановленное состояние как основное
        secureLocalSave(userId, gameState);
        
        console.log('[localSaveProtection] Успешно восстановлено из аварийной копии');
        return gameState;
      } catch (emergencyError) {
        console.error('[localSaveProtection] Ошибка при восстановлении из аварийной копии:', emergencyError);
        return null;
      }
    }
    
    // Пытаемся восстановить из обычной резервной копии
    try {
      const decryptedData = decryptFromLocalStorage(backupData, userId);
      if (!decryptedData) {
        console.error('[localSaveProtection] Ошибка дешифрования резервной копии');
        return null;
      }
      
      // Парсим данные и получаем игровое состояние с хешем
      const parsedData = JSON.parse(decryptedData);
      const { data, hash } = parsedData;
      
      // Проверяем целостность данных
      const computedHash = createIntegrityHash(data, userId);
      if (computedHash !== hash) {
        console.error('[localSaveProtection] Нарушена целостность резервной копии');
        return null;
      }
      
      // Парсим игровое состояние
      const gameState = JSON.parse(data) as GameState;
      
      // Сохраняем восстановленное состояние как основное
      secureLocalSave(userId, gameState);
      
      console.log('[localSaveProtection] Успешно восстановлено из резервной копии');
      return gameState;
    } catch (backupError) {
      console.error('[localSaveProtection] Ошибка при восстановлении из резервной копии:', backupError);
      return null;
    }
  } catch (error) {
    console.error('[localSaveProtection] Общая ошибка при восстановлении:', error);
    return null;
  }
} 