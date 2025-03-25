"use client"

import { useEffect, useState, useRef } from 'react';

/**
 * Компонент для работы с Farcaster Frames SDK
 * Инициализирует SDK и вызывает метод ready() сразу после загрузки
 */
const FarcasterFrameHandler = () => {
  // Проверка браузерного окружения
  if (typeof window === 'undefined') {
    return null; // Ничего не рендерим на сервере
  }

  const [isLoaded, setIsLoaded] = useState(false);
  const [sdkInitialized, setSdkInitialized] = useState(false);
  
  // Ref для отслеживания монтирования компонента
  const isMountedRef = useRef(true);
  // Ref для отслеживания инициализации SDK
  const sdkInitializedRef = useRef(false);
  // Ref для отслеживания таймера
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Безопасная функция обновления состояния
  const safeSetState = (setter: Function, value: any) => {
    if (isMountedRef.current) {
      setter(value);
    }
  };

  // Используем try-catch внутри useEffect для предотвращения падения приложения
  useEffect(() => {
    // Сбрасываем флаги при монтировании компонента
    isMountedRef.current = true;
    sdkInitializedRef.current = false;

    const initFarcaster = async () => {
      // Если SDK уже был инициализирован, не инициализируем повторно
      if (sdkInitializedRef.current) return;
      
      try {
        // Динамический импорт SDK только на клиенте
        const sdkModule = await import('@farcaster/frame-sdk');
        const sdk = sdkModule.default;
        
        // Проверяем, что SDK загружен корректно
        if (!sdk || !sdk.actions || typeof sdk.actions.ready !== 'function') {
          console.warn('Farcaster Frame SDK не загружен корректно');
          return;
        }
        
        // Проверяем, что компонент все еще смонтирован
        if (!isMountedRef.current) return;
        
        // Отмечаем, что SDK был инициализирован
        sdkInitializedRef.current = true;
        
        // Получаем контекст SDK
        try {
          const context = await sdk.context;
          console.log('Farcaster Frame SDK initialized', context);
          
          // Проверяем, что компонент все еще смонтирован
          if (!isMountedRef.current) return;
          
          // Вызываем метод ready() для уведомления Farcaster, что фрейм готов
          sdk.actions.ready();
          console.log('Farcaster ready() called');
          
          // Обновляем состояние только если компонент смонтирован
          safeSetState(setIsLoaded, true);
          safeSetState(setSdkInitialized, true);
        } catch (contextError) {
          console.warn('Failed to get Farcaster context, but will still call ready()', contextError);
          
          // Даже при ошибке контекста пытаемся вызвать ready()
          if (isMountedRef.current) {
            try {
              sdk.actions.ready();
              console.log('Farcaster ready() called despite context error');
              
              safeSetState(setIsLoaded, true);
              safeSetState(setSdkInitialized, true);
            } catch (readyError) {
              console.error('Failed to call ready()', readyError);
            }
          }
        }
      } catch (error) {
        console.error('Error initializing Farcaster Frame SDK:', error);
      }
    };

    // Отложенная инициализация для улучшения стабильности
    // Сохраняем ссылку на таймер, чтобы можно было очистить
    timeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && !sdkInitializedRef.current) {
        initFarcaster();
      }
    }, 300);
    
    // Функция очистки при размонтировании компонента
    return () => {
      // Обновляем флаг монтирования
      isMountedRef.current = false;
      
      // Очищаем таймер, если он был установлен
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  // Компонент не рендерит UI
  return null;
};

export default FarcasterFrameHandler; 