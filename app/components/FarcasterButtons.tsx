"use client"

import { useState, useEffect } from 'react';
import { addAppToFavorites, isRunningInsideFarcaster, requestNotificationPermission } from '../utils/farcaster';

interface FarcasterButtonsProps {
  className?: string;
  favoriteButtonLabel?: string;
  notificationButtonLabel?: string;
}

export default function FarcasterButtons({
  className = '',
  favoriteButtonLabel = 'Добавить в избранное',
  notificationButtonLabel = 'Включить уведомления'
}: FarcasterButtonsProps) {
  const [isFarcaster, setIsFarcaster] = useState(false);
  const [addedToFavorites, setAddedToFavorites] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Проверяем окружение при загрузке компонента
  useEffect(() => {
    const checkEnvironment = async () => {
      const isInsideFarcaster = isRunningInsideFarcaster();
      setIsFarcaster(isInsideFarcaster);
    };
    
    checkEnvironment();
  }, []);

  // Отображаем компонент только если находимся внутри Farcaster
  if (!isFarcaster) {
    return null;
  }

  // Обработчик добавления в избранное
  const handleAddToFavorites = async () => {
    try {
      const result = await addAppToFavorites();
      
      if (result) {
        setAddedToFavorites(true);
        
        // Сбрасываем состояние через 3 секунды
        setTimeout(() => {
          setAddedToFavorites(false);
        }, 3000);
      }
    } catch (error) {
      console.error('Ошибка при добавлении в избранное:', error);
    }
  };

  // Обработчик запроса разрешений на уведомления
  const handleRequestNotifications = async () => {
    try {
      const result = await requestNotificationPermission();
      
      if (result) {
        setNotificationsEnabled(true);
        
        // Сбрасываем состояние через 3 секунды
        setTimeout(() => {
          setNotificationsEnabled(false);
        }, 3000);
      }
    } catch (error) {
      console.error('Ошибка при запросе разрешений на уведомления:', error);
    }
  };

  // Стили для кнопок
  const buttonStyle = `
    px-4 py-2 
    rounded-md 
    font-medium 
    text-sm 
    transition-all 
    duration-200
    mr-2
    last:mr-0
  `;
  
  const favoriteButtonStyle = `
    ${buttonStyle} 
    ${addedToFavorites 
      ? 'bg-green-500 text-white' 
      : 'bg-blue-500 hover:bg-blue-600 text-white'}
  `;
  
  const notificationButtonStyle = `
    ${buttonStyle} 
    ${notificationsEnabled 
      ? 'bg-green-500 text-white' 
      : 'bg-purple-500 hover:bg-purple-600 text-white'}
  `;

  return (
    <div className={`flex items-center ${className}`}>
      <button 
        className={favoriteButtonStyle}
        onClick={handleAddToFavorites}
      >
        {addedToFavorites ? 'Добавлено' : favoriteButtonLabel}
      </button>
      
      <button
        className={notificationButtonStyle}
        onClick={handleRequestNotifications}
      >
        {notificationsEnabled ? 'Уведомления включены' : notificationButtonLabel}
      </button>
    </div>
  );
} 