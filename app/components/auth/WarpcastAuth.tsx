'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { authService } from '@/app/services/auth/authService';
import { useFarcaster } from '@/app/contexts/FarcasterContext';
import { logAuthInfo, AuthStep, AuthLogType, logAuth } from '@/app/utils/auth-logger';
import type { FarcasterContext, FarcasterSDK } from '@/app/types/farcaster';
import { FARCASTER_SDK } from '@/app/types/farcaster';

// Интерфейс для данных пользователя
interface UserData {
  user: {
    id: string;
    fid?: number;
    username?: string;
  };
  token?: string;
}

// Интерфейс пропсов компонента
interface WarpcastAuthProps {
  onSuccess: (userData: UserData) => void;
  onError: (error: string) => void;
}

// Функция для проверки поддержки браузера
const checkBrowserSupport = (): boolean => {
  const ua = navigator.userAgent;
  const browserInfo = {
    chrome: ua.match(/Chrome\/(\d+)/),
    firefox: ua.match(/Firefox\/(\d+)/),
    safari: ua.match(/Version\/(\d+).*Safari/),
    edge: ua.match(/Edg\/(\d+)/)
  };

  for (const [browser, match] of Object.entries(browserInfo)) {
    if (match && match[1]) {
      const version = parseInt(match[1]);
      if (version < FARCASTER_SDK.MIN_BROWSER_VERSIONS[browser as keyof typeof FARCASTER_SDK.MIN_BROWSER_VERSIONS]) {
        return false;
      }
    }
  }

  return true;
};

export default function WarpcastAuth({ onSuccess, onError }: WarpcastAuthProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sdkCheckAttempts, setSdkCheckAttempts] = useState(0);
  const authAttemptedRef = useRef(false);
  const { refreshUserData, isAuthenticated } = useFarcaster();
  
  // Функция для проверки наличия SDK
  const checkFarcasterSDK = (): boolean => {
    // Если пользователь уже аутентифицирован, сразу возвращаем true
    if (isAuthenticated) {
      return true;
    }
    
    if (typeof window === 'undefined') {
      return false;
    }
    
    // Проверяем, доступен ли объект farcaster в браузере
    if (typeof window.farcaster === 'undefined') {
      return false;
    }
    
    const farcaster = window.farcaster as FarcasterSDK;
    
    // Проверяем наличие всех необходимых методов
    return typeof farcaster.ready === 'function' &&
           typeof farcaster.getContext === 'function' &&
           typeof farcaster.fetchUserByFid === 'function';
  };

  // Функция для загрузки SDK скрипта
  const loadFarcasterSDK = useCallback(async (): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      // Проверяем поддержку браузера
      if (!checkBrowserSupport()) {
        reject(new Error(FARCASTER_SDK.ERROR_CODES.BROWSER_NOT_SUPPORTED));
        return;
      }

      // Проверяем, не загружен ли скрипт уже
      const oldScript = document.getElementById('farcaster-sdk-script');
      if (oldScript) {
        console.log('[WarpcastAuth] Найден существующий SDK скрипт');
        
        // Проверяем также, что SDK доступен
        if (window.farcaster && typeof window.farcaster.ready === 'function') {
          console.log('[WarpcastAuth] SDK скрипт уже загружен и инициализирован');
          resolve();
          return;
        } else {
          console.warn('[WarpcastAuth] SDK скрипт загружен, но SDK не инициализирован');
          
          // Удаляем старый скрипт, чтобы загрузить заново
          try {
            // Создаем копию скрипта, чтобы отследить его удаление
            const scriptParent = oldScript.parentNode;
            if (scriptParent) {
              scriptParent.removeChild(oldScript);
              console.log('[WarpcastAuth] Старый SDK скрипт успешно удален');
            }
          } catch (e) {
            console.error('[WarpcastAuth] Ошибка при удалении старого SDK скрипта:', e);
          }
        }
      }
      
      logAuthInfo(AuthStep.FARCASTER_INIT, 'Загрузка Farcaster SDK скрипта');
      
      // Собираем все URL в один массив для попыток загрузки
      const allUrls: string[] = [
        // Приоритизируем локальный скрипт
        '/farcaster-sdk.js', // Локальная копия SDK
        FARCASTER_SDK.SCRIPT_URL, 
        FARCASTER_SDK.BACKUP_SCRIPT_URL,
        ...(FARCASTER_SDK.ALTERNATIVE_URLS || []).filter(url => typeof url === 'string')
      ].filter(Boolean) as string[];
      
      let currentUrlIndex = 0;
      
      // Функция для загрузки скрипта с заданным URL
      const loadScript = (scriptUrl: string) => {
        // Загружаем SDK
        const script = document.createElement('script');
        script.src = scriptUrl;
        script.id = 'farcaster-sdk-script';
        script.async = true;
        script.crossOrigin = 'anonymous'; // Добавляем crossorigin для лучшей совместимости
        
        // Таймаут загрузки
        let timeoutId: NodeJS.Timeout | null = setTimeout(() => {
          timeoutId = null;
          
          // Пробуем следующий URL в списке
          currentUrlIndex++;
          if (currentUrlIndex < allUrls.length) {
            console.warn(`[WarpcastAuth] Таймаут загрузки с URL ${scriptUrl}, пробуем следующий: ${allUrls[currentUrlIndex]}`);
            
            // Удаляем скрипт, который не загрузился
            const failedScript = document.getElementById('farcaster-sdk-script');
            if (failedScript && failedScript.parentNode) {
              failedScript.parentNode.removeChild(failedScript);
            }
            
            const nextUrl = allUrls[currentUrlIndex];
            if (nextUrl) {
              loadScript(nextUrl);
            }
          } else {
            // Если все URL перепробованы - возвращаем ошибку
            logAuth(AuthStep.FARCASTER_INIT, AuthLogType.ERROR, 'Ошибка загрузки SDK скрипта', {});
            reject(new Error(FARCASTER_SDK.ERROR_CODES.SDK_NOT_LOADED));
          }
        }, FARCASTER_SDK.TIMEOUT.SDK_LOAD);

        let retryCount = 0;
        const maxRetries = 2;
        
        const initializeSDK = () => {
          // Даем немного времени браузеру для инициализации SDK
          setTimeout(async () => {
            try {
              const farcaster = window.farcaster as FarcasterSDK;
              if (farcaster && typeof farcaster.ready === 'function') {
                try {
                  await farcaster.ready();
                  logAuthInfo(AuthStep.FARCASTER_INIT, 'SDK успешно загружен и инициализирован');
                  if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                  }
                  resolve();
                } catch (error) {
                  console.error('[WarpcastAuth] Ошибка при вызове farcaster.ready()', error);
                  
                  // Пробуем повторно инициализировать, если не превышен лимит попыток
                  if (retryCount < maxRetries) {
                    retryCount++;
                    console.log(`[WarpcastAuth] Повторная попытка инициализации SDK (${retryCount}/${maxRetries})...`);
                    setTimeout(initializeSDK, 1000); // Пробуем через секунду
                  } else {
                    logAuth(AuthStep.FARCASTER_INIT, AuthLogType.ERROR, 'Ошибка при инициализации SDK', {}, error);
                    if (timeoutId) {
                      clearTimeout(timeoutId);
                      timeoutId = null;
                    }
                    
                    // Пробуем следующий URL в списке
                    currentUrlIndex++;
                    if (currentUrlIndex < allUrls.length) {
                      console.warn(`[WarpcastAuth] API недоступно при загрузке с ${scriptUrl}, пробуем следующий URL: ${allUrls[currentUrlIndex]}`);
                      
                      // Удаляем текущий скрипт
                      const currentScript = document.getElementById('farcaster-sdk-script');
                      if (currentScript && currentScript.parentNode) {
                        currentScript.parentNode.removeChild(currentScript);
                      }
                      
                      // Загружаем с нового URL
                      const nextUrl = allUrls[currentUrlIndex];
                      if (nextUrl) {
                        loadScript(nextUrl);
                      }
                    } else {
                      reject(new Error(FARCASTER_SDK.ERROR_CODES.SDK_NOT_LOADED));
                    }
                  }
                }
              } else {
                console.error('[WarpcastAuth] SDK загружен, но API недоступен:', window.farcaster);
                
                // Пробуем повторно проверить наличие SDK, если не превышен лимит попыток
                if (retryCount < maxRetries) {
                  retryCount++;
                  console.log(`[WarpcastAuth] Повторная проверка доступности SDK (${retryCount}/${maxRetries})...`);
                  setTimeout(initializeSDK, 1000);
                } else {
                  if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                  }
                  
                  // Пробуем следующий URL в списке
                  currentUrlIndex++;
                  if (currentUrlIndex < allUrls.length) {
                    console.warn(`[WarpcastAuth] API недоступно при загрузке с ${scriptUrl}, пробуем следующий URL: ${allUrls[currentUrlIndex]}`);
                    
                    // Удаляем текущий скрипт
                    const currentScript = document.getElementById('farcaster-sdk-script');
                    if (currentScript && currentScript.parentNode) {
                      currentScript.parentNode.removeChild(currentScript);
                    }
                    
                    // Загружаем с нового URL
                    const nextUrl = allUrls[currentUrlIndex];
                    if (nextUrl) {
                      loadScript(nextUrl);
                    }
                  } else {
                    reject(new Error(FARCASTER_SDK.ERROR_CODES.SDK_NOT_LOADED));
                  }
                }
              }
            } catch (initError) {
              console.error('[WarpcastAuth] Ошибка инициализации после загрузки:', initError);
              if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
              }
              reject(initError);
            }
          }, 500); // Небольшая задержка для инициализации
        };

        script.onload = () => {
          console.log(`[WarpcastAuth] SDK скрипт загружен с ${scriptUrl}, инициализация...`);
          
          // Сначала проверяем, что SDK не инициализирован уже
          if (window.farcaster && window.farcaster.isReady) {
            console.log('[WarpcastAuth] SDK уже инициализирован, пропускаем дополнительную инициализацию');
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
            resolve();
            return;
          }
          
          // Попытка создать объект farcaster, если он отсутствует после загрузки скрипта
          if (!window.farcaster) {
            console.warn('[WarpcastAuth] Скрипт загружен, но объект window.farcaster отсутствует, создаем заглушку');
            
            // Создаем локальную заглушку для Farcaster SDK
            window.farcaster = {
              _isReady: false,
              isReady: false,
              ready: async function() {
                console.log('[WarpcastAuth] Вызов ready() на локальной заглушке SDK');
                this._isReady = true;
                this.isReady = true;
                return true;
              },
              getContext: async function() {
                console.log('[WarpcastAuth] Получение контекста из локальной заглушки SDK');
                // Генерируем случайный локальный ID
                const localId = `local_${Math.random().toString(36).substring(2, 10)}`;
                localStorage.setItem('farcaster_local_id', localId);
                
                return {
                  fid: Math.floor(Math.random() * 9000) + 1000,
                  username: `local_user_${localId}`,
                  displayName: 'Локальный пользователь',
                  pfp: { url: '/images/default_avatar.png', verified: false },
                  verified: false
                };
              },
              fetchUserByFid: async function(fid: number) {
                return { 
                  fid, 
                  username: `user_${fid}`, 
                  displayName: `Пользователь ${fid}`,
                  pfp: { url: '/images/default_avatar.png', verified: false },
                  verified: false
                };
              }
            };
          }
          
          initializeSDK();
        };

        script.onerror = (errorEvent) => {
          console.error(`[WarpcastAuth] Ошибка загрузки Farcaster SDK скрипта с ${scriptUrl}`, errorEvent);
          
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          
          // Пробуем следующий URL в списке
          currentUrlIndex++;
          if (currentUrlIndex < allUrls.length) {
            console.warn(`[WarpcastAuth] Ошибка загрузки с URL ${scriptUrl}, пробуем следующий: ${allUrls[currentUrlIndex]}`);
            const nextUrl = allUrls[currentUrlIndex];
            if (nextUrl) {
              loadScript(nextUrl);
            }
          } else {
            // Если все URL перепробованы - возвращаем ошибку
            logAuth(AuthStep.FARCASTER_INIT, AuthLogType.ERROR, 'Ошибка загрузки SDK скрипта', {}, errorEvent);
            reject(new Error(FARCASTER_SDK.ERROR_CODES.NETWORK_ERROR));
          }
        };

        document.body.appendChild(script);
      };
      
      // Начинаем загрузку с первого URL
      const initialUrl = allUrls[currentUrlIndex];
      if (initialUrl) {
        loadScript(initialUrl);
      } else {
        logAuth(AuthStep.FARCASTER_INIT, AuthLogType.ERROR, 'Нет доступных URL для загрузки SDK', {});
        reject(new Error(FARCASTER_SDK.ERROR_CODES.SDK_NOT_LOADED));
      }
    });
  }, []);

  // Функция для авторизации через Farcaster
  const handleFarcasterAuth = useCallback(async () => {
    const authTimeoutId = setTimeout(() => {
      setErrorMessage('Превышено время ожидания авторизации');
      setIsLoading(false);
    }, FARCASTER_SDK.TIMEOUT.AUTH_PROCESS);

    try {
      logAuth(AuthStep.AUTH_START, AuthLogType.INFO, 'Начало авторизации через Farcaster');
      
      // Если SDK не доступен, показываем ошибку
      if (!checkFarcasterSDK()) {
        throw new Error(FARCASTER_SDK.ERROR_CODES.SDK_NOT_LOADED);
      }
      
      const farcaster = window.farcaster as FarcasterSDK;
      
      // Ждем готовности SDK
      if (!farcaster.isReady) {
        await farcaster.ready();
      }
      
      // Получаем данные пользователя из SDK
      const userData = await farcaster.getContext() as FarcasterContext;
      
      if (!userData || !userData.fid) {
        throw new Error(FARCASTER_SDK.ERROR_CODES.INVALID_RESPONSE);
      }
      
      logAuth(
        AuthStep.VALIDATE_DATA, 
        AuthLogType.INFO, 
        'Получены данные пользователя из Farcaster', 
        { fid: userData.fid, username: userData.username }
      );
      
      // Отправляем данные на сервер для валидации через Neynar и сохранения
      const response = await fetch('/api/auth/warpcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });
      
      console.log(`[WarpcastAuth] Получен ответ с кодом: ${response.status}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Ошибка HTTP: ${response.status}` }));
        console.error('[WarpcastAuth] Ошибка от API:', errorData);
        throw new Error(errorData.message || 'Ошибка авторизации на сервере');
      }
      
      const authResult = await response.json();
      
      if (!authResult.success) {
        console.error('[WarpcastAuth] Неуспешный результат авторизации:', authResult);
        throw new Error(authResult.message || FARCASTER_SDK.ERROR_CODES.AUTH_FAILED);
      }
      
      // Проверяем наличие токена и сохраняем его
      if (!authResult.token) {
        console.error('[WarpcastAuth] В ответе отсутствует токен авторизации:', authResult);
        throw new Error('Токен авторизации отсутствует в ответе сервера');
      }
      
      // Сохраняем токен в localStorage напрямую и через authService
      try {
        localStorage.setItem('auth_token', authResult.token);
        console.log('[WarpcastAuth] Токен авторизации успешно сохранен в localStorage');
        
        // Также сохраняем через authService для дублирования
        authService.saveToken(authResult.token);
      } catch (storageError) {
        console.error('[WarpcastAuth] Ошибка при сохранении токена:', storageError);
        // Продолжаем, так как основное сохранение в localStorage уже произошло
      }
      
      // Сохраняем данные пользователя
      try {
        // Формируем user_id из provider и id
        const userId = `farcaster_${authResult.user.id}`;
        
        // Синхронизируем user_id и game_id
        authService.syncUserAndGameIds(userId);
        console.log(`[WarpcastAuth] Синхронизирован user_id и game_id: ${userId}`);
        
        // Сохраняем данные пользователя через authService
        authService.saveUserData(authResult.user);
        
        // Устанавливаем флаг авторизации
        authService.setAuthenticated(true);
      } catch (userError) {
        console.error('[WarpcastAuth] Ошибка при сохранении данных пользователя:', userError);
      }
      
      // Обновляем данные пользователя в контексте
      await refreshUserData();
      
      logAuth(
        AuthStep.AUTH_COMPLETE, 
        AuthLogType.INFO, 
        'Авторизация через Farcaster успешно завершена', 
        { userId: authResult.user?.id }
      );
      
      clearTimeout(authTimeoutId);
      onSuccess({
        user: {
          id: authResult.user.id,
          fid: authResult.user.fid,
          username: authResult.user.username
        },
        token: authResult.token
      });
    } catch (error) {
      clearTimeout(authTimeoutId);
      console.error('Ошибка авторизации через Farcaster:', error);
      
      let errorMessage = 'Неизвестная ошибка авторизации';
      if (error instanceof Error) {
        switch (error.message) {
          case FARCASTER_SDK.ERROR_CODES.BROWSER_NOT_SUPPORTED:
            errorMessage = 'Ваш браузер не поддерживается. Пожалуйста, обновите браузер или используйте другой.';
            break;
          case FARCASTER_SDK.ERROR_CODES.SDK_NOT_LOADED:
            errorMessage = 'Не удалось загрузить Farcaster SDK. Пожалуйста, используйте Warpcast браузер или установите расширение.';
            break;
          case FARCASTER_SDK.ERROR_CODES.AUTH_FAILED:
            errorMessage = 'Не удалось авторизоваться. Пожалуйста, попробуйте снова.';
            break;
          case FARCASTER_SDK.ERROR_CODES.USER_REJECTED:
            errorMessage = 'Вы отменили авторизацию.';
            break;
          case FARCASTER_SDK.ERROR_CODES.NETWORK_ERROR:
            errorMessage = 'Ошибка сети. Пожалуйста, проверьте подключение к интернету.';
            break;
          case FARCASTER_SDK.ERROR_CODES.INVALID_RESPONSE:
            errorMessage = 'Получены некорректные данные от Farcaster.';
            break;
          default:
            errorMessage = error.message;
        }
      }
      
      setErrorMessage(errorMessage);
      
      logAuth(
        AuthStep.AUTH_ERROR, 
        AuthLogType.ERROR, 
        'Ошибка при авторизации через Farcaster', 
        { errorCode: error instanceof Error ? error.message : 'UNKNOWN' }, 
        error
      );
      
      onError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [refreshUserData, onSuccess, onError]);

  // Эффект для инициализации SDK и авторизации
  useEffect(() => {
    // Предотвращаем повторные попытки авторизации
    if (authAttemptedRef.current) return;
    
    let isMounted = true;
    
    // Проверяем наличие SDK или загружаем его
    const initAuth = async () => {
      // Если пользователь уже аутентифицирован, выходим
      if (isAuthenticated) {
        setIsLoading(false);
        return;
      }
      
      const hasSdk = checkFarcasterSDK();
      
      if (!hasSdk) {
        // Если SDK нет, загружаем его
        loadFarcasterSDK()
          .then(() => {
            if (!isMounted) return;
            authAttemptedRef.current = true;
            handleFarcasterAuth();
          })
          .catch((error) => {
            if (!isMounted) return;
            console.error('Ошибка при загрузке SDK:', error);
            setErrorMessage(error instanceof Error ? error.message : 'Неизвестная ошибка');
            setIsLoading(false);
            
            // Увеличиваем счетчик попыток только при ошибке
            if (sdkCheckAttempts < 3) {
              setSdkCheckAttempts(prev => prev + 1);
            }
          });
        
        // Если уже было много попыток, показываем сообщение пользователю
        if (sdkCheckAttempts >= 3) {
          setErrorMessage('Не удалось загрузить Farcaster SDK. Пожалуйста, используйте Warpcast браузер или установите расширение.');
          setIsLoading(false);
        }
        
        return;
      }
      
      authAttemptedRef.current = true;
      handleFarcasterAuth();
    };
    
    initAuth();
    
    // Повторно проверяем SDK каждые 2 секунды, если он еще не загружен,
    // но не более 3 попыток
    let intervalId: NodeJS.Timeout | null = null;
    
    if (!authAttemptedRef.current && sdkCheckAttempts < 3) {
      intervalId = setInterval(() => {
        if (checkFarcasterSDK() && !authAttemptedRef.current) {
          if (intervalId) clearInterval(intervalId);
          authAttemptedRef.current = true;
          handleFarcasterAuth();
        }
      }, 2000);
    }
    
    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [sdkCheckAttempts, isAuthenticated, refreshUserData, handleFarcasterAuth]);

  // Рендер компонента
  return (
    <div className="flex flex-col items-center space-y-4">
      {isLoading ? (
        <div className="py-4 w-full flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          <span className="ml-3 text-gray-300">Подключение к Farcaster...</span>
        </div>
      ) : errorMessage ? (
        <div className="bg-red-900/30 p-4 rounded-lg w-full">
          <p className="text-red-400 text-sm">{errorMessage}</p>
          <button 
            onClick={() => {
              setErrorMessage(null);
              setIsLoading(true);
              authAttemptedRef.current = false;
              setSdkCheckAttempts(0);
              
              // Прямая инициализация вместо смены состояния, чтобы предотвратить каскадные обновления
              setTimeout(() => {
                // Удаляем старый скрипт Farcaster SDK
                const oldScript = document.getElementById('farcaster-sdk-script');
                if (oldScript && oldScript.parentNode) {
                  oldScript.parentNode.removeChild(oldScript);
                  console.log('[WarpcastAuth] Старый SDK скрипт удален при повторной попытке');
                }
                
                // Загружаем SDK и пробуем авторизацию заново
                loadFarcasterSDK()
                  .then(() => {
                    authAttemptedRef.current = true;
                    handleFarcasterAuth();
                  })
                  .catch((error) => {
                    console.error('[WarpcastAuth] Ошибка при повторной загрузке SDK:', error);
                    setErrorMessage(error instanceof Error ? error.message : 'Неизвестная ошибка');
                    setIsLoading(false);
                  });
              }, 100);
            }}
            className="mt-2 bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg text-sm"
          >
            Попробовать снова
          </button>
        </div>
      ) : (
        <button
          onClick={() => {
            setIsLoading(true);
            authAttemptedRef.current = false;
            handleFarcasterAuth();
          }}
          className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-medium transition-colors bg-purple-600 hover:bg-purple-700 text-white"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 24 24" 
            fill="currentColor" 
            className="w-5 h-5 mr-2"
          >
            <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1.24 14.779h2.48v-5.439l3.76 5.439h2.84l-4.35-6 4.35-5.96h-2.72l-3.88 5.37V4.82h-2.48v11.959z"/>
          </svg>
          <span>Войти через Farcaster</span>
        </button>
      )}
      
      <p className="text-xs text-gray-500 text-center">
        Требуется аккаунт Farcaster. <a href="https://warpcast.com/download" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">Скачать Warpcast</a>
      </p>
    </div>
  );
} 