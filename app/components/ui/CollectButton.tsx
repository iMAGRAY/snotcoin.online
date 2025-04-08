'use client';

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from './button';

interface CollectButtonProps {
  collect: () => Promise<boolean>;
  lastCollectError: string | null;
  forceSaveAfterCollect?: () => void;
  className?: string;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link';
}

type CollectStatus = 'idle' | 'collecting' | 'collected';

const CollectButton: React.FC<CollectButtonProps> = ({
  collect,
  lastCollectError,
  forceSaveAfterCollect,
  className = '',
  variant = 'default'
}) => {
  const [isClicked, setIsClicked] = useState(false);
  const [collectStatus, setCollectStatus] = useState<CollectStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const isCollecting = collectStatus === 'collecting';

  const handleClick = useCallback(async () => {
    if (isCollecting || isClicked) {
      console.log('[CollectButton] Кнопка уже нажата или сбор идет, игнорируем клик');
      return;
    }
    
    setIsClicked(true); // Блокируем кнопку от множественных кликов
    
    try {
      setCollectStatus('collecting');
      setErrorMessage(null);
      
      console.log('[CollectButton] Начинаем сбор ресурсов');
      const success = await collect();
      
      // Если сбор не удался, но не было ошибки, выводим общее сообщение
      if (!success && !lastCollectError) {
        setErrorMessage('Не удалось собрать ресурсы. Попробуйте еще раз.');
        console.warn('[CollectButton] Сбор не удался, но ошибки не было');
      } else if (lastCollectError) {
        // Если была ошибка, показываем пользователю с понятным сообщением
        const userFriendlyError = lastCollectError === 'Контейнер пуст' 
          ? 'Контейнер пуст. Подождите, пока он наполнится.'
          : 'Не удалось собрать ресурсы. Попробуйте позже.';
          
        setErrorMessage(userFriendlyError);
        console.warn('[CollectButton] Ошибка при сборе:', lastCollectError);
      } else {
        console.log('[CollectButton] Сбор успешно завершен');
        setCollectStatus('collected');
        
        // Сохраняем после сбора, если функция предоставлена
        if (typeof forceSaveAfterCollect === 'function') {
          forceSaveAfterCollect();
        }
        
        // Показываем анимацию успешного сбора
        setTimeout(() => {
          setCollectStatus('idle');
        }, 1000);
      }
    } catch (error) {
      console.error('[CollectButton] Исключение при сборе:', error);
      setErrorMessage('Произошла ошибка при сборе. Попробуйте еще раз.');
      setCollectStatus('idle');
    } finally {
      // Разблокируем кнопку через небольшую задержку для предотвращения слишком быстрых повторных кликов
      setTimeout(() => {
        setIsClicked(false);
      }, 500);
    }
  }, [collect, isCollecting, isClicked, lastCollectError, forceSaveAfterCollect]);

  return (
    <div className="collect-button-container">
      <Button
        className={`collect-button ${className} ${collectStatus}`}
        variant={variant}
        onClick={handleClick}
        disabled={isCollecting || isClicked}
      >
        {collectStatus === 'collecting' ? 'Собираем...' : 'Собрать'}
      </Button>
      
      {errorMessage && (
        <div className="text-sm text-red-500 mt-1">
          {errorMessage}
        </div>
      )}
    </div>
  );
};

export default CollectButton; 