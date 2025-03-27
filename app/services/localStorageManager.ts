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
 * @param userId ID пользователя для сохранения критичных данных при очистке
 * @returns true если сохранение выполнено успешно
 */
export function safeSetItem(key: string, value: string, userId: string = ''): boolean {
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
      const cleaned = cleanupLocalStorage(0, userId);
      
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