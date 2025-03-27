/**
 * localStorageManager.ts
 * Модуль для управления localStorage с функциями контроля размера, очистки и работы с резервными копиями
 */

/**
 * Вычисляет размер localStorage и процент заполнения
 * @returns {size: number, percent: number} Объект с размером в байтах и процентом заполнения
 */
export function getLocalStorageSize(): { size: number; percent: number } {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { size: 0, percent: 0 };
  }
  
  try {
    // Расчет примерного размера localStorage
    let totalSize = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key) || '';
        totalSize += key.length + value.length;
      }
    }
    
    // Примерный размер в байтах (2 байта на символ в UTF-16)
    const sizeInBytes = totalSize * 2;
    // Типичный размер квоты localStorage ~5MB
    const estimatedQuota = 5 * 1024 * 1024;
    const usagePercent = (sizeInBytes / estimatedQuota) * 100;
    
    return { 
      size: sizeInBytes, 
      percent: usagePercent 
    };
  } catch (error) {
    console.error('[localStorageManager] Ошибка при расчете размера localStorage:', error);
    return { size: 0, percent: 0 };
  }
}

/**
 * Очищает localStorage от ненужных данных при превышении указанного порога заполнения
 * @param threshold Порог заполнения в процентах (0-100)
 * @param userId ID текущего пользователя для сохранения его критичных данных
 * @returns true если очистка выполнена, false если очистка не требуется или произошла ошибка
 */
export function cleanupLocalStorage(threshold: number = 80, userId: string = ''): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }
  
  try {
    const { size: sizeInBytes, percent: usagePercent } = getLocalStorageSize();
    
    console.log(`[localStorageManager] Использование localStorage: ${(sizeInBytes / 1024 / 1024).toFixed(2)}MB (${usagePercent.toFixed(2)}%)`);
    
    // Если хранилище заполнено менее чем на указанный порог, очистка не требуется
    if (usagePercent < threshold) {
      return false;
    }
    
    console.warn(`[localStorageManager] Критическое заполнение localStorage: ${usagePercent.toFixed(2)}%, выполняется агрессивная очистка`);
    
    // Список ключей, которые нужно сохранить в любом случае
    const criticalKeys = [
      'user_id',
      'userId',
      'game_id',
      'auth_token',
      'auth_token_type',
      'isAuthenticated',
      'id_sync_performed'
    ];
    
    // Если userId не пустой, добавляем ключи резервных копий для него
    if (userId) {
      criticalKeys.push(`backup_${userId}_latest`);
    }
    
    // Собираем все ключи для удаления
    const keysToRemove: string[] = [];
    const keysToKeep: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        // Проверяем, не является ли ключ критичным
        if (criticalKeys.includes(key)) {
          keysToKeep.push(key);
          continue;
        }
        
        // Сохраняем последнюю резервную копию текущего пользователя, если userId указан
        if (userId && key === `backup_${userId}_latest`) {
          keysToKeep.push(key);
          continue;
        }
        
        // Получаем фактическое значение последней резервной копии
        const latestBackupKey = userId ? localStorage.getItem(`backup_${userId}_latest`) : null;
        if (latestBackupKey && key === latestBackupKey) {
          keysToKeep.push(key);
          continue;
        }
        
        // Все остальные ключи помечаем на удаление
        keysToRemove.push(key);
      }
    }
    
    // Удаляем все помеченные ключи
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
    
    // Подсчитываем новый размер после очистки
    const { size: newSizeInBytes, percent: newUsagePercent } = getLocalStorageSize();
    
    console.log(`[localStorageManager] Очистка localStorage выполнена. Удалено ${keysToRemove.length} ключей. Новое использование: ${(newSizeInBytes / 1024 / 1024).toFixed(2)}MB (${newUsagePercent.toFixed(2)}%)`);
    console.log(`[localStorageManager] Сохранено ${keysToKeep.length} критичных ключей`);
    
    return true;
  } catch (error) {
    console.error('[localStorageManager] Ошибка при очистке localStorage:', error);
    return false;
  }
}

/**
 * Сохраняет данные в localStorage с проверкой доступного пространства
 * Если пространства недостаточно, выполняет очистку
 * @param key Ключ для сохранения
 * @param value Значение для сохранения
 * @param cleanupIfNeeded Флаг, указывающий, нужно ли выполнять очистку при нехватке места
 * @returns true если сохранение выполнено успешно
 */
export function safeSetItem(key: string, value: string, cleanupIfNeeded: boolean = false): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }
  
  try {
    // Пробуем сохранить данные
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    // Если произошла ошибка квоты, пытаемся очистить хранилище
    if (error instanceof DOMException && 
        (error.name === 'QuotaExceededError' || 
         error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
      
      console.warn('[localStorageManager] Ошибка квоты localStorage, выполняется экстренная очистка');
      
      // Выполняем агрессивную очистку с высоким порогом (заставляем очистить)
      if (cleanupIfNeeded) {
        const cleaned = cleanupLocalStorage(0);
        
        if (cleaned) {
          // Повторно пытаемся сохранить после очистки
          try {
            localStorage.setItem(key, value);
            return true;
          } catch (secondError) {
            console.error('[localStorageManager] Не удалось сохранить данные даже после очистки:', secondError);
            return false;
          }
        }
      }
    }
    
    console.error('[localStorageManager] Ошибка при сохранении в localStorage:', error);
    return false;
  }
}

/**
 * Получает список всех ключей резервных копий для пользователя
 * @param userId ID пользователя
 * @returns Массив ключей
 */
export function getUserBackupKeys(userId: string): string[] {
  if (!userId || typeof window === 'undefined' || !window.localStorage) {
    return [];
  }
  
  const backupKeys: string[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(`backup_${userId}_`)) {
      backupKeys.push(key);
    }
  }
  
  return backupKeys;
}

/**
 * Удаляет все резервные копии, кроме последних N штук
 * @param userId ID пользователя
 * @param keepCount Количество копий, которые нужно оставить
 * @returns Количество удаленных копий
 */
export function cleanupUserBackups(userId: string, keepCount: number = 2): number {
  if (!userId || typeof window === 'undefined' || !window.localStorage) {
    return 0;
  }
  
  try {
    // Получаем все ключи резервных копий пользователя
    const backupKeys = getUserBackupKeys(userId);
    
    // Исключаем маркер последней копии
    const dataKeys = backupKeys.filter(key => !key.endsWith('_latest'));
    
    // Если копий меньше или равно указанному количеству, ничего не удаляем
    if (dataKeys.length <= keepCount) {
      return 0;
    }
    
    // Сортируем по времени (старые первыми)
    dataKeys.sort((a, b) => {
      const timeA = parseInt(a.split('_').pop() || '0', 10);
      const timeB = parseInt(b.split('_').pop() || '0', 10);
      return timeA - timeB;
    });
    
    // Определяем, сколько копий нужно удалить
    const keysToDelete = dataKeys.slice(0, dataKeys.length - keepCount);
    
    // Удаляем лишние копии
    for (const key of keysToDelete) {
      localStorage.removeItem(key);
    }
    
    return keysToDelete.length;
  } catch (error) {
    console.error('[localStorageManager] Ошибка при очистке резервных копий:', error);
    return 0;
  }
}

/**
 * Получает резервную копию из localStorage по ключу
 * @param backupKey Ключ резервной копии
 * @returns Данные резервной копии или null
 */
export const getBackup = (backupKey: string): any | null => {
  try {
    const backupJson = localStorage.getItem(backupKey);
    if (!backupJson) return null;
    
    return JSON.parse(backupJson);
  } catch (error) {
    console.error('[localStorageManager] Ошибка при получении резервной копии:', error);
    return null;
  }
};

/**
 * Получает последнюю резервную копию пользователя
 * @param userId ID пользователя
 * @returns Данные последней резервной копии или null
 */
export const getLatestBackup = (userId: string): any | null => {
  try {
    // Проверяем наличие прямой ссылки на последнюю резервную копию
    const latestKey = localStorage.getItem(`backup_${userId}_latest`);
    
    if (latestKey) {
      const backup = getBackup(latestKey);
      if (backup) {
        return backup;
      }
    }
    
    // Если прямая ссылка не работает, ищем по всем ключам
    let latestTimestamp = 0;
    let latestBackup = null;
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`backup_${userId}_`) && !key.endsWith('_latest') && !key.endsWith('_meta')) {
        const backup = getBackup(key);
        
        if (backup && backup.timestamp > latestTimestamp) {
          latestTimestamp = backup.timestamp;
          latestBackup = backup;
        }
      }
    }
    
    return latestBackup;
  } catch (error) {
    console.error('[localStorageManager] Ошибка при получении последней резервной копии:', error);
    return null;
  }
};

/**
 * Получает все резервные копии пользователя
 * @param userId ID пользователя
 * @returns Массив резервных копий
 */
export const getUserBackups = (userId: string): any[] => {
  try {
    const backups = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`backup_${userId}_`) && !key.endsWith('_latest') && !key.endsWith('_meta')) {
        const backup = getBackup(key);
        if (backup) {
          backups.push({
            key,
            ...backup
          });
        }
      }
    }
    
    // Сортируем по времени (новые в начале)
    backups.sort((a, b) => b.timestamp - a.timestamp);
    
    return backups;
  } catch (error) {
    console.error('[localStorageManager] Ошибка при получении резервных копий:', error);
    return [];
  }
};

/**
 * Очищает старые резервные копии, оставляя только указанное количество самых новых
 * @param userId ID пользователя
 * @param maxBackups Максимальное количество сохраняемых резервных копий
 * @returns Количество удаленных резервных копий
 */
export const cleanupBackups = (userId: string, maxBackups: number): number => {
  try {
    const backups = getUserBackups(userId);
    
    // Если копий меньше или равно указанному количеству, ничего не делаем
    if (backups.length <= maxBackups) {
      return 0;
    }
    
    // Оставляем только maxBackups самых новых копий
    const backupsToRemove = backups.slice(maxBackups);
    let removedCount = 0;
    
    backupsToRemove.forEach(backup => {
      try {
        localStorage.removeItem(backup.key);
        removedCount++;
      } catch (error) {
        console.error(`[localStorageManager] Ошибка при удалении резервной копии ${backup.key}:`, error);
      }
    });
    
    console.log(`[localStorageManager] Удалено ${removedCount} старых резервных копий для ${userId}`);
    return removedCount;
  } catch (error) {
    console.error(`[localStorageManager] Ошибка при очистке резервных копий для ${userId}:`, error);
    return 0;
  }
};

/**
 * Очищает localStorage, удаляя старые данные и резервные копии
 * @param userId ID пользователя (если указан, будет сохранен)
 * @param threshold Порог заполнения, после которого выполняется очистка (0.0 - 1.0)
 * @param maxUserBackups Максимальное количество резервных копий для текущего пользователя
 */
export const aggressiveCleanupLocalStorage = (
  userId?: string,
  threshold: number = 0.8,
  maxUserBackups: number = 3
): void => {
  try {
    // Получаем информацию о размере хранилища
    const { percent } = getLocalStorageSize();
    
    // Если заполнение ниже порога, ничего не делаем
    if (percent < threshold * 100) {
      return;
    }
    
    console.log(`[localStorageManager] Очистка localStorage (заполнение: ${percent.toFixed(2)}%, порог: ${(threshold * 100).toFixed(2)}%)`);
    
    // Удаляем старые временные данные
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('temp_') || key.includes('_temp_'))) {
        localStorage.removeItem(key);
      }
    }
    
    // Если заполнение всё ещё выше порога, удаляем резервные копии других пользователей
    if (getLocalStorageSize().percent >= threshold * 100) {
      // Собираем уникальные ID пользователей из резервных копий
      const userIds = new Set<string>();
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('backup_')) {
          const parts = key.split('_');
          if (parts.length >= 3 && parts[1]) {
            userIds.add(parts[1]);
          }
        }
      }
      
      // Если есть текущий пользователь, исключаем его из списка
      if (userId) {
        userIds.delete(userId);
      }
      
      // Удаляем резервные копии других пользователей
      userIds.forEach(otherUserId => {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && key.includes(`_${otherUserId}_`)) {
            localStorage.removeItem(key);
          }
        }
      });
      
      console.log(`[localStorageManager] Удалены резервные копии ${userIds.size} других пользователей`);
    }
    
    // Если заполнение всё ещё выше порога и есть текущий пользователь, очищаем его старые резервные копии
    if (userId && getLocalStorageSize().percent >= threshold * 100) {
      cleanupBackups(userId, maxUserBackups);
    }
    
    // Если заполнение всё ещё выше порога, удаляем самые старые данные
    if (getLocalStorageSize().percent >= threshold * 100) {
      const keys = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          keys.push(key);
        }
      }
      
      // Определяем, сколько ключей нужно удалить для достижения порога в 70%
      const targetPercent = 70;
      const currentSize = getLocalStorageSize();
      const targetSize = (targetPercent / 100) * (5 * 1024 * 1024); // Используем оценку размера localStorage
      const sizeToRemove = currentSize.size - targetSize;
      
      if (sizeToRemove > 0) {
        let removedSize = 0;
        
        // Сортируем ключи по размеру (от больших к меньшим)
        const keysWithSize = keys.map(key => {
          const value = localStorage.getItem(key) || '';
          return { key, size: value.length * 2 }; // Приблизительный размер в байтах
        }).sort((a, b) => b.size - a.size);
        
        // Удаляем ключи, пока не достигнем желаемого размера
        for (const { key, size } of keysWithSize) {
          // Не удаляем данные текущего пользователя, если он указан
          if (userId && (
            key === `gameState_${userId}` || 
            key === `game_state_${userId}` || 
            key === `backup_${userId}_latest`)) {
            continue;
          }
          
          localStorage.removeItem(key);
          removedSize += size;
          
          // Если удалили достаточно данных, останавливаемся
          if (removedSize >= sizeToRemove) {
            break;
          }
        }
        
        console.log(`[localStorageManager] Удалено ${removedSize} байт данных для достижения целевого заполнения ${targetPercent}%`);
      }
    }
    
    // Выводим итоговую информацию
    const finalSize = getLocalStorageSize();
    console.log(`[localStorageManager] Очистка завершена. Новое заполнение: ${finalSize.percent.toFixed(2)}%`);
  } catch (error) {
    console.error('[localStorageManager] Ошибка при очистке localStorage:', error);
  }
}; 