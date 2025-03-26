'use client';

import { useEffect } from 'react';
import { authStore } from '../components/auth/AuthenticationWindow';
import { getToken, isAuthenticated, refreshToken } from '../services/auth/authenticationService';
import { jwtDecode } from 'jwt-decode';

/**
 * Компонент для инициализации глобального хранилища авторизации
 */
export default function AuthStoreInitializer() {
  // Получаем данные пользователя из токена
  const getUserDataFromToken = (token: string) => {
    try {
      return jwtDecode(token);
    } catch (error) {
      console.error('[AuthStore] Ошибка при декодировании токена:', error);
      return null;
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Предотвращаем повторную инициализацию
      if (window.authStore) {
        console.log('[AuthStore] Хранилище уже инициализировано');
        return;
      }
      
      // Инициализируем глобальное хранилище
      window.authStore = {
        getAuthToken: () => {
          // Получаем напрямую из authStore, без обращения к getToken
          const authStoreToken = authStore.getAuthToken();
          if (authStoreToken) {
            return authStoreToken.token;
          }
          
          // Иначе получаем напрямую из localStorage без обращения к getToken
          if (window.localStorage) {
            const token = window.localStorage.getItem('auth_token');
            // Возвращаем токен без проверки валидности (проверка должна быть при установке)
            return token;
          }
          
          return null;
        },
        getIsAuthenticated: () => {
          return authStore.getIsAuthenticated();
        },
        setAuthToken: (token: string) => {
          // Поддерживаем обратную совместимость с существующим форматом
          authStore.setAuthData({ token }, true);
        },
        clearAuthData: () => {
          // Очищаем локальное хранилище
          if (window.localStorage) {
            window.localStorage.removeItem('auth_token');
            window.localStorage.removeItem('user_id');
          }
          
          // Очищаем authStore
          authStore.clearAuthData();
        }
      };
      
      // Проверяем, есть ли сохраненный токен при инициализации
      const token = getToken();
      
      if (token) {
        const userData = getUserDataFromToken(token);
        
        if (userData && isAuthenticated()) {
          // Если токен действителен и в authStore токена нет, инициализируем authStore
          if (authStore.getAuthToken() === null) {
            authStore.setAuthData({ token, user: userData }, true);
            console.log('[AuthStore] Инициализировано из сохраненного токена');
          }
        } else {
          // Если токен есть, но сессия недействительна, пробуем обновить
          refreshToken()
            .then(success => {
              if (success) {
                const newToken = getToken();
                if (newToken) {
                  const newUserData = getUserDataFromToken(newToken);
                  authStore.setAuthData({ token: newToken, user: newUserData }, true);
                  console.log('[AuthStore] Токен обновлен при инициализации');
                }
              } else {
                // Если не удалось обновить токен, очищаем хранилище
                window.authStore?.clearAuthData();
              }
            })
            .catch(error => {
              console.error('[AuthStore] Ошибка при обновлении токена:', error);
              // Очищаем хранилище при ошибке
              window.authStore?.clearAuthData();
            });
        }
      }
      
      console.log('[AuthStore] Глобальное хранилище authStore инициализировано');
    }
    
    return () => {
      // Очищаем только ссылку при размонтировании компонента,
      // но сохраняем данные для использования в других местах
      if (typeof window !== 'undefined') {
        delete window.authStore;
      }
    };
  }, []);
  
  // Этот компонент не рендерит никакого UI
  return null;
} 