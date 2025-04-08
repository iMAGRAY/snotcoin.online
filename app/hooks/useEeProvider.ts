'use client';

import { useState, useEffect, useCallback } from 'react';
import { useFarcasterPatch } from '../utils/farcasterPatches';
import { isValidEthereumProvider } from '../utils/providerHelpers';

interface UseEeProviderOptions {
  autoConnect?: boolean;
  fallbackToWindow?: boolean;
}

interface UseEeProviderResult {
  provider: any;
  isLoading: boolean;
  error: string | null;
  connectWallet: () => Promise<any[]>;
  isReady: boolean;
}

/**
 * Хук для работы с ee.getProvider из Farcaster SDK
 */
export function useEeProvider(options: UseEeProviderOptions = {}): UseEeProviderResult {
  const [provider, setProvider] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState<boolean>(false);
  
  // Создаем таймер для обновления
  const [retryCount, setRetryCount] = useState<number>(0);
  const MAX_RETRIES = 5;
  
  const { autoConnect = true, fallbackToWindow = true } = options;
  
  // Применяем патч для Farcaster SDK
  useFarcasterPatch();
  
  // Функция для безопасного получения ee.getProvider
  const getEeProvider = useCallback(async (): Promise<any> => {
    try {
      // Проверка наличия window объекта
      if (typeof window === 'undefined') {
        throw new Error('window is not defined');
      }
      
      // Проверка наличия Farcaster SDK
      const farcaster = (window as any).farcaster;
      if (!farcaster) {
        throw new Error('Farcaster SDK не доступен');
      }
      
      // Проверка наличия ee объекта
      if (!farcaster.ee) {
        throw new Error('Объект ee не доступен в Farcaster SDK');
      }
      
      // Проверка наличия метода getProvider у ee
      if (typeof farcaster.ee.getProvider !== 'function') {
        throw new Error('Метод ee.getProvider не доступен');
      }
      
      // Вызов метода getProvider
      const eeProvider = await farcaster.ee.getProvider();
      
      // Проверка валидности провайдера
      if (!isValidEthereumProvider(eeProvider)) {
        throw new Error('ee.getProvider вернул невалидный провайдер');
      }
      
      return eeProvider;
    } catch (error: any) {
      console.warn('[useEeProvider] Ошибка при получении ee.getProvider:', error.message);
      
      // Если разрешено использовать window.ethereum как fallback
      if (fallbackToWindow && typeof window !== 'undefined' && (window as any).ethereum) {
        console.log('[useEeProvider] Используем window.ethereum как fallback');
        return (window as any).ethereum;
      }
      
      throw error;
    }
  }, [fallbackToWindow]);
  
  // Функция для инициализации провайдера
  const initializeProvider = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const eeProvider = await getEeProvider();
      
      setProvider(eeProvider);
      setIsReady(true);
      setRetryCount(0);
      return eeProvider;
    } catch (error: any) {
      console.error('[useEeProvider] Ошибка при инициализации провайдера:', error.message);
      setError(error.message);
      
      // Ограничиваем количество повторных попыток
      if (retryCount < MAX_RETRIES) {
        // Экспоненциальная задержка перед повторной попыткой
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
        }, delay);
      }
      
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [getEeProvider, retryCount]);
  
  // Функция для подключения кошелька
  const connectWallet = useCallback(async (): Promise<any[]> => {
    try {
      if (!provider) {
        const newProvider = await initializeProvider();
        if (!newProvider) {
          throw new Error('Не удалось инициализировать провайдер');
        }
      }
      
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      return accounts || [];
    } catch (error: any) {
      console.error('[useEeProvider] Ошибка при подключении кошелька:', error.message);
      setError(`Ошибка подключения: ${error.message}`);
      return [];
    }
  }, [provider, initializeProvider]);
  
  // Эффект для инициализации провайдера
  useEffect(() => {
    if (!provider || retryCount > 0) {
      initializeProvider();
    }
  }, [provider, initializeProvider, retryCount]);
  
  // Эффект для автоподключения
  useEffect(() => {
    if (autoConnect && provider && isReady) {
      connectWallet().catch(err => {
        console.warn('[useEeProvider] Ошибка при автоподключении:', err);
      });
    }
  }, [autoConnect, provider, isReady, connectWallet]);
  
  return {
    provider,
    isLoading,
    error,
    connectWallet,
    isReady
  };
}

export default useEeProvider; 