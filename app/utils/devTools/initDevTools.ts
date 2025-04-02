/**
 * Инициализация инструментов разработчика
 * Файл для автоматического запуска инструментов при загрузке приложения в режиме разработки
 */

import { activateFarcasterDevMock, isFarcasterDevMockActive } from './farcasterDevMock';

// Интерфейс настроек режима разработчика
interface DevSettings {
  autoActivateWarpcastMock?: boolean;
  warpcastUser?: {
    fid?: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
  };
  devPanelPosition?: {
    x: number;
    y: number;
  };
  devPanelSize?: {
    width: number;
    height: number;
  };
}

// Дефолтные настройки
const DEFAULT_SETTINGS: DevSettings = {
  autoActivateWarpcastMock: true, // Включаем автоактивацию по умолчанию
  warpcastUser: {
    fid: 123456789, // Более реалистичный FID
    username: 'dev_user',
    displayName: 'Dev User',
    pfpUrl: 'https://cdn.warpcast.com/profile-pictures/default-profile.png'
  },
  devPanelPosition: {
    x: -1,
    y: -1
  },
  devPanelSize: {
    width: 500,
    height: 400
  }
};

/**
 * Инициализация инструментов разработчика
 */
export const initDevTools = () => {
  // Проверяем, находимся ли мы в режиме разработки
  const isDev = process.env.NODE_ENV === 'development';
  if (!isDev) return;
  
  console.log('[DevTools] Инициализация инструментов разработчика...');
  
  try {
    // Проверяем URL на наличие параметра dev=true или dev=warpcast
    const urlParams = new URLSearchParams(window.location.search);
    const devParam = urlParams.get('dev');
    const isDevelopmentMode = devParam === 'true' || devParam === 'warpcast';
    
    // Если уже активирован, выходим
    if (isFarcasterDevMockActive()) {
      console.log('[DevTools] Режим разработчика уже активен');
      return;
    }
    
    // Загружаем сохраненные настройки
    let settings: DevSettings = {...DEFAULT_SETTINGS};
    const savedSettings = localStorage.getItem('devSettings');
    
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        settings = {...settings, ...parsed};
      } catch (error) {
        console.error('[DevTools] Ошибка при загрузке настроек:', error);
      }
    } else {
      // Если настроек нет, сохраняем дефолтные
      saveDevSettings(DEFAULT_SETTINGS);
    }
    
    // Активируем если dev=true/warpcast или autoActivateWarpcastMock=true
    if (isDevelopmentMode || settings.autoActivateWarpcastMock) {
      console.log('[DevTools] Автоматическая активация режима разработчика Warpcast');
      
      // Принудительно устанавливаем активацию, если параметр dev=true/warpcast
      if (isDevelopmentMode) {
        settings.autoActivateWarpcastMock = true;
        saveDevSettings(settings);
      }
      
      activateFarcasterDevMock(settings.warpcastUser);
      
      // Уведомляем в консоли об успешной активации
      console.log('[DevTools] Режим разработчика активирован');
      console.log('[DevTools] Используем пользователя:', settings.warpcastUser);
    }
  } catch (error) {
    console.error('[DevTools] Ошибка при инициализации инструментов разработчика:', error);
  }
};

/**
 * Сохранение настроек режима разработчика
 */
export const saveDevSettings = (settings: DevSettings) => {
  try {
    localStorage.setItem('devSettings', JSON.stringify(settings));
    console.log('[DevTools] Настройки сохранены:', settings);
  } catch (error) {
    console.error('[DevTools] Ошибка при сохранении настроек:', error);
  }
};

// Экспорт функции для проверки, находимся ли мы в режиме разработки
export function isDevMode(): boolean {
  return process.env.NODE_ENV === 'development';
}
