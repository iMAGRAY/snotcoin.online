'use client';

/**
 * Патчи для Wagmi коннекторов, работающих с Farcaster
 */

/**
 * Патчит Wagmi коннектор, добавляя проверку на wallet.ethProvider
 */
export function patchWagmiConnector(connector: any) {
  if (!connector) return connector;
  
  // Если у коннектора нет getProvider, добавляем
  if (typeof connector.getProvider !== 'function') {
    console.log('[wagmiPatches] Добавляем getProvider к Wagmi коннектору');
    
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
            console.warn('[wagmiPatches] Ошибка при вызове farcaster.getProvider:', error);
          }
        }
      }
      
      // Fallback на window.ethereum
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        return (window as any).ethereum;
      }
      
      // Если ничего не сработало, возвращаем пустой объект
      console.warn('[wagmiPatches] Не удалось найти провайдер для Wagmi коннектора');
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
        console.warn('[wagmiPatches] Ошибка при вызове оригинального getProvider:', error);
      }
      
      // Fallback логика
      console.log('[wagmiPatches] Используем fallback логику для Wagmi коннектора');
      
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
export function patchWagmiConfig(config: any) {
  if (!config) return config;
  
  // Патчим коннекторы
  if (config.connectors && Array.isArray(config.connectors)) {
    console.log('[wagmiPatches] Патчим коннекторы Wagmi');
    config.connectors = config.connectors.map(patchWagmiConnector);
  }
  
  return config;
}

/**
 * Инициализирует патчи для Wagmi
 */
export function initWagmiPatches() {
  if (typeof window === 'undefined') return;
  
  // Проверяем наличие объекта wagmi в window
  const interval = setInterval(() => {
    if ((window as any).wagmi) {
      console.log('[wagmiPatches] Найден объект wagmi, применяем патчи');
      
      try {
        const wagmi = (window as any).wagmi;
        
        // Патчим config, если он есть
        if (wagmi.config) {
          patchWagmiConfig(wagmi.config);
        }
        
        // Патчим другие объекты wagmi при необходимости
        // ...
        
        clearInterval(interval);
      } catch (error) {
        console.error('[wagmiPatches] Ошибка при патчинге wagmi:', error);
        clearInterval(interval);
      }
    }
  }, 500);
  
  // Очищаем интервал через 30 секунд, если wagmi не найден
  setTimeout(() => {
    clearInterval(interval);
  }, 30000);
} 