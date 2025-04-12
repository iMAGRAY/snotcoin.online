"use client"

import { useState, useCallback, useEffect } from 'react';
import { sdk } from '@farcaster/frame-sdk';

interface FarcasterButtonsProps {
  notificationButtonLabel?: string;
}

/**
 * Компонент с кнопками для взаимодействия с функциями Farcaster
 */
const FarcasterButtons: React.FC<FarcasterButtonsProps> = ({
  notificationButtonLabel = 'Enable Notifications'
}) => {
  const [isFarcasterClient, setIsFarcasterClient] = useState(false);
  const [isRequestingNotifications, setIsRequestingNotifications] = useState(false);
  const [isAppAdded, setIsAppAdded] = useState(false);
  
  // Проверяем, находимся ли в Farcaster клиенте и добавлено ли приложение в избранное
  useEffect(() => {
    const checkClientAndAppStatus = async () => {
      // Проверяем доступность SDK или нативного window.farcaster
      const hasFarcasterSDK = typeof sdk !== 'undefined' && 
                             !!sdk.actions && 
                             typeof sdk.actions.ready === 'function';
      
      const hasNativeFarcaster = typeof window !== 'undefined' && 
                               (window as any).farcaster && 
                               typeof (window as any).farcaster.ready === 'function';
      
      const isFarcaster = hasFarcasterSDK || hasNativeFarcaster;
      setIsFarcasterClient(isFarcaster);
      
      if (isFarcaster && sdk) {
        try {
          // Проверяем статус приложения в избранном
          const context = await sdk.context;
          const added = context?.client?.added || false;
          setIsAppAdded(added);
          console.log('[FarcasterButtons] App added status:', added);
        } catch (error) {
          console.error('[FarcasterButtons] Error checking app status:', error);
        }
      }
    };
    
    checkClientAndAppStatus();
    
    // Добавляем слушатель события добавления приложения
    if (typeof sdk?.on === 'function') {
      // Когда приложение добавлено
      sdk.on('frameAdded', () => {
        console.log('[FarcasterButtons] App added event received');
        setIsAppAdded(true);
      });
      
      // Когда приложение удалено
      sdk.on('frameRemoved', () => {
        console.log('[FarcasterButtons] App removed event received');
        setIsAppAdded(false);
      });
    }
    
    // Очищаем слушатели при размонтировании
    return () => {
      if (typeof sdk?.removeAllListeners === 'function') {
        sdk.removeAllListeners();
      }
    };
  }, []);
  
  // Обработчик запроса разрешения на уведомления - вызывает системный диалог
  const handleRequestNotifications = useCallback(async () => {
    if (!sdk?.actions?.addFrame) {
      console.warn('[FarcasterButtons] addFrame method not available');
      return;
    }
    
    try {
      setIsRequestingNotifications(true);
      
      console.log('[FarcasterButtons] Showing system add app dialog');
      const result = await sdk.actions.addFrame();
      console.log('[FarcasterButtons] System add app result:', result);
    } catch (error) {
      console.error('[FarcasterButtons] Error showing system add app dialog:', error);
    } finally {
      setIsRequestingNotifications(false);
    }
  }, []);
  
  // Если мы не в Farcaster клиенте, не отображаем кнопки
  if (!isFarcasterClient) {
    return null;
  }
  
  // Если приложение уже добавлено, не показываем кнопку добавления
  if (isAppAdded) {
    return null;
  }
  
  return (
    <div className="flex flex-col space-y-2">
      <button
        onClick={handleRequestNotifications}
        disabled={isRequestingNotifications}
        className={`px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-sm
                  ${isRequestingNotifications ? 'opacity-70 cursor-not-allowed' : 'opacity-100'}`}
      >
        {isRequestingNotifications ? 'Подключение...' : notificationButtonLabel}
      </button>
    </div>
  );
};

export default FarcasterButtons; 