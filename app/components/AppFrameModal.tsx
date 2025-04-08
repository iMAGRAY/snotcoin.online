'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { isValidEthereumProvider, checkProviderConnection } from '@/app/utils/providerHelpers';
import { useFarcasterPatch } from '@/app/utils/farcasterPatches';
import { useEeProvider } from '@/app/hooks/useEeProvider';

interface AppFrameModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

// Глобальная функция для патчинга ee объекта
const patchEeObject = () => {
  try {
    if (typeof window !== 'undefined' && (window as any).farcaster) {
      const farcaster = (window as any).farcaster;
      
      // Создаем объект ee, если его нет
      if (!farcaster.ee) {
        console.log('[AppFrameModal:global] Создаем объект ee');
        farcaster.ee = {};
      }
      
      // Добавляем метод getProvider, если его нет
      if (typeof farcaster.ee.getProvider !== 'function') {
        console.log('[AppFrameModal:global] Добавляем метод getProvider к объекту ee');
        
        farcaster.ee.getProvider = async function() {
          console.log('[AppFrameModal:global] ee.getProvider вызван');
          
          // Проверяем все возможные источники провайдера
          if (window && (window as any).farcaster) {
            const fc = (window as any).farcaster;
            
            if (fc.wallet && fc.wallet.ethProvider) {
              console.log('[AppFrameModal:global] Используем fc.wallet.ethProvider');
              return fc.wallet.ethProvider;
            }
            
            if (fc.sdk && fc.sdk.wallet && fc.sdk.wallet.ethProvider) {
              console.log('[AppFrameModal:global] Используем fc.sdk.wallet.ethProvider');
              return fc.sdk.wallet.ethProvider;
            }
            
            if (typeof fc.getProvider === 'function') {
              try {
                console.log('[AppFrameModal:global] Вызываем fc.getProvider()');
                const provider = await fc.getProvider();
                if (provider) return provider;
              } catch (error) {
                console.warn('[AppFrameModal:global] Ошибка при вызове fc.getProvider:', error);
              }
            }
          }
          
          if (window && (window as any).ethereum) {
            console.log('[AppFrameModal:global] Используем window.ethereum как fallback');
            return (window as any).ethereum;
          }
          
          console.warn('[AppFrameModal:global] Не удалось найти провайдер, возвращаем заглушку');
          return {
            request: async ({ method, params }: { method: string; params?: any[] }) => {
              throw new Error(`Provider not available. Method: ${method}`);
            }
          };
        };
      }
      
      return true;
    }
    return false;
  } catch (error) {
    console.error('[AppFrameModal:global] Ошибка при патчинге ee объекта:', error);
    return false;
  }
};

/**
 * Модальное окно для приложений и фреймов
 */
const AppFrameModal: React.FC<AppFrameModalProps> = ({
  isOpen,
  onClose,
  title,
  children
}) => {
  // Используем наш кастомный хук для доступа к ee.getProvider
  const {
    provider,
    isLoading,
    error,
    connectWallet,
    isReady
  } = useEeProvider({
    autoConnect: false, // Не выполняем автоподключение, даем контроль приложению
    fallbackToWindow: true // Разрешаем использовать window.ethereum как fallback
  });
  
  // Состояние соединения с провайдером
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting' | 'error'>(
    isLoading ? 'connecting' : error ? 'error' : provider ? 'connected' : 'disconnected'
  );
  
  // Обновляем статус соединения при изменении состояния хука
  useEffect(() => {
    if (isLoading) {
      setConnectionStatus('connecting');
    } else if (error) {
      setConnectionStatus('error');
    } else if (provider && isReady) {
      checkProviderConnection(provider)
        .then(isConnected => {
          setConnectionStatus(isConnected ? 'connected' : 'disconnected');
        })
        .catch(() => {
          setConnectionStatus('disconnected');
        });
    } else {
      setConnectionStatus('disconnected');
    }
  }, [isLoading, error, provider, isReady]);
  
  // Применяем патч при монтировании компонента
  useEffect(() => {
    // Патчим ee объект глобально
    patchEeObject();
    
    // Применяем общий патч для Farcaster
    useFarcasterPatch();
  }, []);
  
  // Проверяем соединение периодически
  useEffect(() => {
    if (!isOpen || !provider) return;
    
    // Проверяем соединение каждые 10 секунд
    const checkInterval = setInterval(() => {
      checkProviderConnection(provider)
        .then(isConnected => {
          setConnectionStatus(isConnected ? 'connected' : 'disconnected');
        })
        .catch(() => {
          setConnectionStatus('disconnected');
        });
    }, 10000);
    
    return () => {
      clearInterval(checkInterval);
    };
  }, [isOpen, provider]);
  
  // Функция для подключения с проверкой и обновлением статуса
  const handleConnect = useCallback(async () => {
    setConnectionStatus('connecting');
    
    try {
      const accounts = await connectWallet();
      
      if (accounts && accounts.length > 0) {
        console.log('[AppFrameModal] Подключен к аккаунту:', accounts[0]);
        setConnectionStatus('connected');
        return accounts;
      } else {
        setConnectionStatus('disconnected');
        return [];
      }
    } catch (error: any) {
      console.error('[AppFrameModal] Ошибка при подключении:', error);
      setConnectionStatus('error');
      return [];
    }
  }, [connectWallet]);
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-gray-900 text-white border-gray-700 max-w-3xl w-full max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-blue-400">{title}</DialogTitle>
        </DialogHeader>
        
        <div className="mt-4">
          {connectionStatus === 'connecting' && (
            <div className="text-yellow-400 mb-4">Подключение к провайдеру...</div>
          )}
          
          {connectionStatus === 'error' && (
            <div className="text-red-400 mb-4">
              Не удалось подключиться к провайдеру. 
              <button 
                onClick={handleConnect}
                className="ml-2 underline hover:text-red-300"
              >
                Попробовать снова
              </button>
            </div>
          )}
          
          {connectionStatus === 'disconnected' && (
            <div className="text-yellow-400 mb-4">
              Соединение с провайдером потеряно.
              <button 
                onClick={handleConnect}
                className="ml-2 underline hover:text-yellow-300"
              >
                Подключиться
              </button>
            </div>
          )}
          
          {React.Children.map(children, child => {
            // Передаем провайдер, метод для подключения и статус соединения всем дочерним компонентам
            if (React.isValidElement(child)) {
              return React.cloneElement(child as React.ReactElement<any>, { 
                ethProvider: provider,
                connectWallet: handleConnect,
                connectionStatus
              });
            }
            return child;
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AppFrameModal; 