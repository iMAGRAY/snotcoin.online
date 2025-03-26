type GlobalObjects = {
  __unmountInProgress: Record<string, boolean>;
  __unmountEffects: Record<string, boolean>;
  __initializeInProgress: Record<string, boolean>;
  __lastLoadAttempts: Record<string, number>;
};

declare global {
  interface Window extends GlobalObjects {
    [key: string]: any;
  }
}

/**
 * Функция для безопасной инициализации глобальных объектов
 */
export function ensureGlobalObject<T>(key: string, defaultValue: T = {} as T): T {
  if (typeof window === 'undefined') return defaultValue;
  
  if (!window[key]) {
    window[key] = defaultValue;
  }
  
  return window[key];
}

/**
 * Функция для безопасного доступа к глобальным объектам
 */
export function safeGetGlobalObject<T>(key: string, defaultValue: T = {} as T): T {
  if (typeof window === 'undefined') return defaultValue;
  
  return window[key] || defaultValue;
}

/**
 * Подготавливает состояние для сохранения, удаляя циклические ссылки
 */
export function prepareStateForSaving(state: any): any {
  const stateToSave = { ...state };
  
  // Удаляем временные поля
  delete stateToSave._isSavingInProgress;
  delete stateToSave._skipSave;
  delete stateToSave._lastSaveError;
  delete stateToSave._isBeforeUnloadSave;
  
  return stateToSave;
} 