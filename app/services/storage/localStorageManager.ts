/**
 * Проверяет доступность localStorage
 * @returns true если localStorage доступен, иначе false
 */
export const isLocalStorageAvailable = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Получает список всех сохранений пользователя из localStorage
 * @param userId ID пользователя
 * @returns Массив объектов сохранений
 */
export const getAllUserSaves = (userId: string): {key: string, data: any, timestamp: number}[] => {
  if (!isLocalStorageAvailable()) return [];
  
  const saves: {key: string, data: any, timestamp: number}[] = [];
  
  try {
    // Перебираем все ключи в localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      // Находим сохранения, относящиеся к этому пользователю
      if ((key.startsWith(`gameState_${userId}`) && !key.includes('_meta') && !key.includes('_lastSaved')) || 
          key.startsWith(`backup_${userId}_`)) {
        
        try {
          const rawData = localStorage.getItem(key);
          if (!rawData) continue;
          
          const data = JSON.parse(rawData);
          
          // Извлекаем timestamp из ключа резервной копии или используем timestamp из данных
          let timestamp = 0;
          if (key.startsWith('backup_')) {
            const timeStr = key.split('_').pop();
            timestamp = timeStr ? parseInt(timeStr) : 0;
          } else {
            // Для обычных сохранений используем _lastSaved или текущее время
            const metaKey = `${key}_meta`;
            const metaData = localStorage.getItem(metaKey);
            if (metaData) {
              const meta = JSON.parse(metaData);
              timestamp = meta.lastSaved ? new Date(meta.lastSaved).getTime() : 0;
            } else if (data._lastSaved) {
              timestamp = new Date(data._lastSaved).getTime();
            }
          }
          
          saves.push({
            key,
            data,
            timestamp
          });
        } catch (parseError) {
          console.error(`[localStorageManager] Ошибка при обработке сохранения ${key}:`, parseError);
        }
      }
    }
    
    // Сортируем сохранения по времени, самые новые первыми
    saves.sort((a, b) => b.timestamp - a.timestamp);
    
    return saves;
  } catch (error) {
    console.error(`[localStorageManager] Ошибка при получении сохранений для ${userId}:`, error);
    return [];
  }
}; 