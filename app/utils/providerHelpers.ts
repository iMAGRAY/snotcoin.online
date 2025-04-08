'use client';

/**
 * Утилиты для безопасной работы с провайдерами
 */

/**
 * Проверяет наличие метода getProvider у объекта
 */
export const hasGetProviderMethod = (obj: any): boolean => {
  return obj && typeof obj.getProvider === 'function';
};

/**
 * Безопасно вызывает getProvider с fallback на defaultProvider
 */
export const safeGetProvider = (obj: any, defaultProvider?: any): any => {
  if (hasGetProviderMethod(obj)) {
    try {
      return obj.getProvider();
    } catch (error) {
      console.error('[providerHelpers] Ошибка при вызове getProvider:', error);
      return defaultProvider;
    }
  }
  return defaultProvider;
};

/**
 * Проверяет, является ли объект валидным Ethereum провайдером по стандарту EIP-1193
 */
export const isValidEthereumProvider = (provider: any): boolean => {
  // EIP-1193 провайдер должен иметь метод request
  if (!provider || typeof provider.request !== 'function') {
    return false;
  }
  
  return true;
};

/**
 * Проверяет статус соединения с провайдером
 * @returns Promise, который резолвится в true, если соединение активно, иначе в false
 */
export const checkProviderConnection = async (provider: any): Promise<boolean> => {
  if (!isValidEthereumProvider(provider)) {
    return false;
  }
  
  try {
    // Пробуем выполнить базовый запрос для проверки соединения
    await provider.request({ method: 'eth_chainId' });
    return true;
  } catch (error) {
    console.warn('[providerHelpers] Ошибка при проверке соединения с провайдером:', error);
    return false;
  }
};

/**
 * Возвращает сообщение об ошибке на основе типа провайдера и ошибки
 */
export const getProviderErrorMessage = (provider: any, error: any): string => {
  // Если ошибка содержит сообщение, используем его
  if (error && error.message) {
    return error.message;
  }
  
  // Общая ошибка, если провайдер недоступен
  if (!provider) {
    return 'Провайдер недоступен';
  }
  
  // Общая ошибка подключения
  return 'Ошибка при взаимодействии с провайдером';
};

/**
 * Создает обертку над объектом подключения для безопасного обращения к провайдеру
 */
export const createSafeConnector = (connection: any): any => {
  if (!connection) return null;
  
  // Если нет объекта connector или он не является объектом, возвращаем оригинальное подключение
  if (!connection.connector || typeof connection.connector !== 'object') {
    return connection;
  }
  
  // Создаем безопасную обертку над connector
  const safeConnector = {
    ...connection.connector,
    getProvider: () => {
      // Если есть оригинальный метод getProvider, пытаемся его вызвать
      if (typeof connection.connector.getProvider === 'function') {
        try {
          return connection.connector.getProvider();
        } catch (error) {
          console.error('[safeConnector] Ошибка при вызове getProvider:', error);
          
          // Если метод выбросил исключение, возвращаем fallback-провайдер
          if (window && (window as any).ethereum) {
            console.log('[safeConnector] Используем window.ethereum как fallback');
            return (window as any).ethereum;
          }
          
          // Возвращаем заглушку провайдера, если все остальное не сработало
          return {
            request: async ({ method, params }: { method: string; params?: any[] }) => {
              console.warn(`[safeConnector] Вызов метода ${method} на заглушке провайдера`);
              throw new Error('Provider is not available');
            }
          };
        }
      }
      
      // Если метод getProvider отсутствует, но есть window.ethereum, используем его
      if (window && (window as any).ethereum) {
        console.log('[safeConnector] Используем window.ethereum как fallback (метод getProvider отсутствует)');
        return (window as any).ethereum;
      }
      
      // Если ничего не помогло, возвращаем заглушку
      console.warn('[safeConnector] Не удалось получить провайдер, возвращаем заглушку');
      return {
        request: async ({ method, params }: { method: string; params?: any[] }) => {
          console.warn(`[safeConnector] Вызов метода ${method} на заглушке провайдера`);
          throw new Error('Provider is not available');
        }
      };
    }
  };
  
  // Возвращаем новый объект connection с безопасной оберткой
  return {
    ...connection,
    connector: safeConnector
  };
};

/**
 * Проверяет объект подключения и, если необходимо, оборачивает его в безопасную обертку
 */
export const getSafeConnection = (connection: any): any => {
  if (!connection) return null;
  
  try {
    // Проверяем, есть ли у connector метод getProvider
    if (connection.connector && typeof connection.connector.getProvider !== 'function') {
      // Если метода нет, возвращаем безопасную обертку
      return createSafeConnector(connection);
    }
    
    // Проверяем, работает ли метод getProvider
    if (connection.connector && typeof connection.connector.getProvider === 'function') {
      try {
        // Пробуем вызвать метод getProvider
        connection.connector.getProvider();
        // Если все в порядке, возвращаем исходный объект
        return connection;
      } catch (error) {
        // Если метод выбросил исключение, возвращаем безопасную обертку
        console.error('[getSafeConnection] Ошибка при вызове getProvider:', error);
        return createSafeConnector(connection);
      }
    }
    
    // Если никаких проблем не обнаружено, возвращаем исходный объект
    return connection;
  } catch (error) {
    console.error('[getSafeConnection] Ошибка при проверке подключения:', error);
    return createSafeConnector(connection);
  }
};

/**
 * Проверяет, имеет ли объект wallet.ethProvider
 */
export const hasWalletEthProvider = (obj: any): boolean => {
  return obj && obj.wallet && obj.wallet.ethProvider && isValidEthereumProvider(obj.wallet.ethProvider);
};

/**
 * Получает подходящий провайдер из объекта Farcaster или SDK
 */
export const getFarcasterProvider = (obj: any): any => {
  // Проверяем wallet.ethProvider (рекомендуемый способ по документации)
  if (hasWalletEthProvider(obj)) {
    return obj.wallet.ethProvider;
  }
  
  // Проверяем getProvider метод
  if (hasGetProviderMethod(obj)) {
    try {
      const provider = obj.getProvider();
      if (isValidEthereumProvider(provider)) {
        return provider;
      }
    } catch (error) {
      console.warn('[providerHelpers] Ошибка при вызове getProvider:', error);
    }
  }
  
  // Если ничего не подошло, возвращаем null
  return null;
}; 