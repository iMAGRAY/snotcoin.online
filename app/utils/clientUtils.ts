/**
 * Вспомогательные функции для работы с клиентской частью приложения
 */

/**
 * Генерирует уникальный идентификатор клиента
 * @returns Уникальный идентификатор клиента
 */
export function generateClientId(): string {
  // Если уже есть в localStorage, используем его
  if (typeof window !== 'undefined') {
    const storedClientId = localStorage.getItem('client_id');
    if (storedClientId) {
      return storedClientId;
    }
    
    // Иначе создаем новый и сохраняем
    const newClientId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    try {
      localStorage.setItem('client_id', newClientId);
    } catch (e) {
      console.warn('[ClientUtils] Не удалось сохранить client_id в localStorage');
    }
    return newClientId;
  }
  
  return `temp-${Date.now()}`;
}

/**
 * Получает информацию о текущем браузере
 * @returns Строка с информацией о браузере
 */
export function getBrowserInfo(): string {
  try {
    if (typeof window === 'undefined') return 'server';
    
    const userAgent = navigator.userAgent;
    const browserRegex = /(chrome|firefox|safari|edge|opera|trident)\/?\s*(\.?\d+(\.\d+)*)/i;
    const match = userAgent.match(browserRegex) || [];
    return match[1]?.toLowerCase() || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Получает информацию об устройстве
 * @returns Строка с информацией об устройстве
 */
export function getDeviceInfo(): string {
  try {
    if (typeof window === 'undefined') return 'server';
    
    const userAgent = navigator.userAgent;
    if (/Android/i.test(userAgent)) return 'android';
    if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios';
    if (/Windows/i.test(userAgent)) return 'windows';
    if (/Mac/i.test(userAgent)) return 'mac';
    if (/Linux/i.test(userAgent)) return 'linux';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Получает версию клиентского приложения
 * @returns Версия клиента
 */
export function getClientVersion(): string {
  if (typeof window === 'undefined') return '1.0.0';
  return (window as any).__APP_VERSION__ || '1.0.0';
} 