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

  // Патчим Wagmi, если он есть
  patchWagmiForFarcaster();
}

/**
 * Рекурсивно ищет объекты 'ee' в глобальном объекте и добавляет к ним getProvider
 */
function patchAllEeObjects(obj: any, depth: number = 0, maxDepth: number = 5, visited = new Set()) {
  if (!obj || depth > maxDepth || visited.has(obj)) return;
  visited.add(obj);

  // Проверяем, является ли объект ee объектом
  if (obj.name === 'ee' || obj.id === 'ee' || obj.__name === 'ee') {
    patchEeObject(obj);
  }

  // Для каждого свойства объекта
  for (const key in obj) {
    try {
      const value = obj[key];
      
      // Если это объект, проверяем его
      if (value && typeof value === 'object') {
        // Если ключ == 'ee', добавляем getProvider, если нужно
        if (key === 'ee' || key === '_ee') {
          patchEeObject(value);
          
          // Проверяем, успешно ли добавили метод
          if (typeof value.getProvider !== 'function') {
            console.warn('[farcasterPatch] Не удалось добавить getProvider к объекту ee', value);
          }
        }
        
        // Ищем также объекты с именем ee или полем name = 'ee'
        if (value.name === 'ee' || value.id === 'ee' || value.__name === 'ee') {
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
  
  console.log('[farcasterPatch] Патчим объект ee, добавляя getProvider', ee);
  
  try {
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
    
    // Проверяем, успешно ли добавили метод
    if (typeof ee.getProvider !== 'function') {
      console.warn('[farcasterPatch] Не удалось добавить getProvider к объекту ee после попытки патча');
      
      // Попробуем использовать defineProperty
      try {
        Object.defineProperty(ee, 'getProvider', {
          value: async function() {
            if (window && (window as any).ethereum) {
              return (window as any).ethereum;
            }
            throw new Error('Provider not available');
          },
          writable: true,
          configurable: true
        });
      } catch (error) {
        console.error('[farcasterPatch] Ошибка при использовании defineProperty:', error);
      }
    }
  } catch (error) {
    console.error('[farcasterPatch] Критическая ошибка при патче ee объекта:', error);
  }
}

/**
 * Патчит Wagmi коннектор, добавляя проверку на wallet.ethProvider от Farcaster
 */
function patchWagmiConnector(connector: any) {
  if (!connector) return connector;
  
  // Если у коннектора нет getProvider, добавляем
  if (typeof connector.getProvider !== 'function') {
    console.log('[farcasterPatch] Добавляем getProvider к Wagmi коннектору');
    
    connector.getProvider = async function() {
      // Если есть готовый провайдер, возвращаем его
      if (connector.provider) {
        return connector.provider;
      }
      
      // Проверяем window.farcaster
      if (typeof window !== 'undefined' && (window as any).farcaster) {
        const farcaster = (window as any).farcaster;
        
        // Проверяем wallet.ethProvider (рекомендуемый способ)
        if (farcaster.wallet && farcaster.wallet.ethProvider) {
          return farcaster.wallet.ethProvider;
        }
        
        // Проверяем SDK
        if (farcaster.sdk && farcaster.sdk.wallet && farcaster.sdk.wallet.ethProvider) {
          return farcaster.sdk.wallet.ethProvider;
        }
        
        // Если у farcaster есть getProvider, вызываем его
        if (typeof farcaster.getProvider === 'function') {
          try {
            return await farcaster.getProvider();
          } catch (error) {
            console.warn('[farcasterPatch] Ошибка при вызове farcaster.getProvider:', error);
          }
        }
      }
      
      // Fallback на window.ethereum
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        return (window as any).ethereum;
      }
      
      // Если ничего не сработало, возвращаем null
      console.warn('[farcasterPatch] Не удалось найти провайдер для Wagmi коннектора');
      return null;
    };
  } else {
    // Если getProvider уже существует, создаем обертку, которая перехватывает ошибки
    const originalGetProvider = connector.getProvider;
    
    connector.getProvider = async function() {
      try {
        const provider = await originalGetProvider.call(this);
        if (provider) return provider;
      } catch (error) {
        console.warn('[farcasterPatch] Ошибка при вызове оригинального getProvider в Wagmi:', error);
      }
      
      // Fallback логика
      console.log('[farcasterPatch] Используем fallback логику для Wagmi коннектора');
      
      // Проверяем window.farcaster
      if (typeof window !== 'undefined' && (window as any).farcaster) {
        const farcaster = (window as any).farcaster;
        
        // Проверяем wallet.ethProvider (рекомендуемый способ)
        if (farcaster.wallet && farcaster.wallet.ethProvider) {
          return farcaster.wallet.ethProvider;
        }
      }
      
      // Fallback на window.ethereum
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        return (window as any).ethereum;
      }
      
      return null;
    };
  }
  
  return connector;
}

/**
 * Патчит все коннекторы в Wagmi конфигурации
 */
function patchWagmiConfig(config: any) {
  if (!config) return config;
  
  // Патчим коннекторы
  if (config.connectors && Array.isArray(config.connectors)) {
    console.log('[farcasterPatch] Патчим коннекторы Wagmi');
    config.connectors = config.connectors.map(patchWagmiConnector);
  }
  
  return config;
}

/**
 * Патчит Wagmi для работы с Farcaster
 */
function patchWagmiForFarcaster() {
  if (typeof window === 'undefined') return;

  // Монипулируем функцию создания конфигурации
  const originalCreateConfig = (window as any).wagmi?.createConfig;
  if (originalCreateConfig && typeof originalCreateConfig === 'function') {
    (window as any).wagmi.createConfig = function(...args: any[]) {
      const config = originalCreateConfig.apply(this, args);
      return patchWagmiConfig(config);
    };
  }
  
  // Патчим глобальный конфиг Wagmi, если он уже создан
  if ((window as any).wagmi?.config) {
    patchWagmiConfig((window as any).wagmi.config);
  }
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
  
  // Отслеживаем появление Wagmi
  const wagmiInterval = setInterval(() => {
    if ((window as any).wagmi) {
      patchWagmiForFarcaster();
      clearInterval(wagmiInterval);
    }
  }, 500);
  
  // Через 30 секунд прекращаем попытки найти Wagmi
  setTimeout(() => clearInterval(wagmiInterval), 30000);
}

/**
 * Хук для React компонентов, который обеспечивает корректную работу с ee объектами
 * Вызывайте эту функцию в useEffect в любом компоненте, который работает с ee.getProvider
 */
export function useFarcasterPatch() {
  if (typeof window === 'undefined') return;
  
  // Применяем патчи к Farcaster SDK
  applyFarcasterPatches();
  
  // Ищем ee объекты в окружении текущего компонента
  if (window) {
    patchAllEeObjects(window);
    
    // Дополнительно ищем объекты в специфических местах, где может быть ee
    try {
      // Проверяем farcaster объект
      if ((window as any).farcaster) {
        const farcaster = (window as any).farcaster;
        
        // Проверяем явно farcaster.ee
        if (farcaster.ee && typeof farcaster.ee === 'object') {
          patchEeObject(farcaster.ee);
        }
        
        // Проверяем ee в SDK
        if (farcaster.sdk && farcaster.sdk.ee) {
          patchEeObject(farcaster.sdk.ee);
        }
      }
      
      // Мониторим изменения, чтобы патчить динамически создаваемые ee объекты
      setupEeObjectsMonitoring();
    } catch (error) {
      console.warn('[farcasterPatch] Ошибка при расширенном поиске ee объектов:', error);
    }
  }
}

/**
 * Настраивает мониторинг для отслеживания создания ee объектов
 */
function setupEeObjectsMonitoring() {
  if (typeof window === 'undefined') return;
  
  try {
    // Функция для периодической проверки
    const checkForEeObjects = () => {
      // Проверяем farcaster объект
      if ((window as any).farcaster) {
        const farcaster = (window as any).farcaster;
        
        // Проверяем явно farcaster.ee
        if (farcaster.ee && typeof farcaster.ee === 'object' && typeof farcaster.ee.getProvider !== 'function') {
          console.log('[farcasterPatch] Обнаружен динамически созданный ee объект, применяем патч');
          patchEeObject(farcaster.ee);
        }
      }
      
      // Проверяем глобальные объекты, в которых может быть ee
      patchAllEeObjects(window);
    };
    
    // Запускаем проверку каждые 500мс для отслеживания динамического создания объектов
    const intervalId = setInterval(checkForEeObjects, 500);
    
    // Останавливаем проверку через 30 секунд, чтобы не расходовать ресурсы
    setTimeout(() => {
      clearInterval(intervalId);
    }, 30000);
    
    // Патчим глобальный объект, чтобы отслеживать создание ee объектов
    if ((window as any).farcaster) {
      const originalFarcaster = (window as any).farcaster;
      
      // Наблюдаем за изменениями свойств объекта farcaster
      try {
        // Определяем прокси для перехвата доступа к свойствам
        const farcasterProxy = new Proxy(originalFarcaster, {
          set(target, prop, value) {
            // Если устанавливается свойство ee, патчим его
            if (prop === 'ee' && value && typeof value === 'object') {
              console.log('[farcasterPatch] Перехвачено создание ee объекта через farcaster.ee');
              patchEeObject(value);
            }
            
            // Устанавливаем свойство в исходном объекте
            target[prop as string] = value;
            return true;
          }
        });
        
        // Заменяем глобальный объект на прокси
        // Примечание: это может не сработать во всех браузерах или средах
        (window as any).farcaster = farcasterProxy;
      } catch (error) {
        console.warn('[farcasterPatch] Ошибка при создании прокси для farcaster:', error);
      }
    }
  } catch (error) {
    console.error('[farcasterPatch] Ошибка при настройке мониторинга ee объектов:', error);
  }
} 