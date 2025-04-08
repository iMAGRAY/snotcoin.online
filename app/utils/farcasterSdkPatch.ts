'use client';

/**
 * Патч для Farcaster SDK для обеспечения совместимости
 */

/**
 * Применяет патчи к глобальному объекту Farcaster
 */
export function applyFarcasterPatches() {
  if (typeof window === 'undefined') return;

  // Получаем текущий объект farcaster из window
  const farcaster = (window as any).farcaster;
  if (!farcaster) return;

  console.log('[farcasterPatch] Применение патчей к Farcaster SDK');

  // Добавляем метод getProvider, если он отсутствует
  if (typeof farcaster.getProvider !== 'function') {
    console.log('[farcasterPatch] Добавление метода getProvider');
    
    farcaster.getProvider = async function() {
      // Приоритет 1: wallet.ethProvider
      if (farcaster.wallet && farcaster.wallet.ethProvider) {
        return farcaster.wallet.ethProvider;
      }
      
      // Приоритет 2: SDK с wallet.ethProvider
      if (farcaster.sdk && farcaster.sdk.wallet && farcaster.sdk.wallet.ethProvider) {
        return farcaster.sdk.wallet.ethProvider;
      }
      
      // Приоритет 3: window.ethereum
      if ((window as any).ethereum) {
        return (window as any).ethereum;
      }
      
      // Возвращаем заглушку, если ничего не найдено
      console.warn('[farcasterPatch] Не удалось найти провайдер, возвращаем заглушку');
      return {
        request: async ({ method, params }: { method: string, params?: any[] }) => {
          throw new Error(`Provider not available. Method: ${method}`);
        }
      };
    };
  }

  // Патчим все ee объекты, которые могут быть использованы в коде
  patchAllEeObjects(window);
}

/**
 * Рекурсивно ищет объекты 'ee' в глобальном объекте и добавляет к ним getProvider
 */
function patchAllEeObjects(obj: any, depth: number = 0, maxDepth: number = 3, visited = new Set()) {
  if (!obj || depth > maxDepth || visited.has(obj)) return;
  visited.add(obj);

  // Для каждого свойства объекта
  for (const key in obj) {
    try {
      const value = obj[key];
      
      // Если это объект, проверяем его
      if (value && typeof value === 'object') {
        // Если ключ == 'ee', добавляем getProvider, если нужно
        if (key === 'ee' || key === '_ee') {
          patchEeObject(value);
        }
        
        // Рекурсивно проверяем вложенные объекты
        patchAllEeObjects(value, depth + 1, maxDepth, visited);
      }
    } catch (error) {
      // Игнорируем ошибки доступа к свойствам
    }
  }
}

/**
 * Добавляет метод getProvider к объекту ee
 */
function patchEeObject(ee: any) {
  if (!ee || typeof ee !== 'object') return;
  
  // Если метод getProvider уже есть, не трогаем
  if (typeof ee.getProvider === 'function') return;
  
  console.log('[farcasterPatch] Патчим объект ee, добавляя getProvider');
  
  // Добавляем getProvider метод к объекту ee
  ee.getProvider = async function() {
    // Проверяем все возможные пути к провайдеру
    if (window && (window as any).farcaster) {
      const farcaster = (window as any).farcaster;
      
      // Пробуем получить провайдер через официальный API
      if (farcaster.wallet && farcaster.wallet.ethProvider) {
        return farcaster.wallet.ethProvider;
      }
      
      // Пробуем получить провайдер через SDK
      if (farcaster.sdk && farcaster.sdk.wallet && farcaster.sdk.wallet.ethProvider) {
        return farcaster.sdk.wallet.ethProvider;
      }
      
      // Если у farcaster есть метод getProvider, вызываем его
      if (typeof farcaster.getProvider === 'function') {
        try {
          return await farcaster.getProvider();
        } catch (error) {
          console.warn('[farcasterPatch] Ошибка при вызове farcaster.getProvider:', error);
        }
      }
    }
    
    // Fallback на window.ethereum
    if (window && (window as any).ethereum) {
      return (window as any).ethereum;
    }
    
    // Если ничего не сработало, создаем заглушку
    console.warn('[farcasterPatch] Не удалось найти провайдер для ee, возвращаем заглушку');
    return {
      request: async ({ method, params }: { method: string, params?: any[] }) => {
        throw new Error(`ee.Provider not available. Method: ${method}`);
      }
    };
  };
}

/**
 * Инициализирует патчи при загрузке страницы
 */
export function initFarcasterPatches() {
  if (typeof window === 'undefined') return;
  
  // Применяем патчи сразу
  applyFarcasterPatches();
  
  // Создаем MutationObserver для отслеживания изменений в DOM
  const observer = new MutationObserver(() => {
    applyFarcasterPatches();
  });
  
  // Запускаем отслеживание добавления новых скриптов
  observer.observe(document.documentElement, { 
    childList: true, 
    subtree: true 
  });
  
  // Также применяем патчи при загрузке страницы и после загрузки контента
  window.addEventListener('DOMContentLoaded', applyFarcasterPatches);
  window.addEventListener('load', applyFarcasterPatches);
} 