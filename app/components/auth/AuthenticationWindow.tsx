"use client"

import React, { useState, useEffect } from 'react';
import { useWarpcastAuth } from '../../hooks/useWarpcastAuth';
import { AuthStatus, AuthStep } from '../../types/warpcastAuth';
import { logAuthInfo, logAuthError } from '../../utils/auth-logger';
import { WarpcastUser } from '../../types/warpcastAuth';

interface AuthenticationWindowProps {
  onAuthenticate: (user: any) => void;
}

export const authStore = {
  isAuthenticated: false,
  user: null as WarpcastUser | null,
  setAuth: (user: WarpcastUser | null) => {
    authStore.isAuthenticated = !!user;
    authStore.user = user;
  },
  setAuthToken: (token: string) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('authToken', token);
  },
  getIsAuthenticated: () => authStore.isAuthenticated,
  getAuthToken: () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('authToken');
  },
  clearAuthData: () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    authStore.isAuthenticated = false;
    authStore.user = null;
  }
};

export const AuthenticationWindow: React.FC<AuthenticationWindowProps> = ({ onAuthenticate }) => {
  const {
    user,
    status,
    isLoading,
    handleAuth,
    handleRetry,
    isAuthenticated,
    errorMessage,
    login,
    logout
  } = useWarpcastAuth();

  const [showError, setShowError] = useState(false);

  useEffect(() => {
    if (status === AuthStatus.ERROR) {
      setShowError(true);
    }
  }, [status]);

  useEffect(() => {
    if (isAuthenticated && user) {
      onAuthenticate(user);
    }
  }, [isAuthenticated, user, onAuthenticate]);

  const handleLogin = async () => {
    try {
      logAuthInfo(AuthStep.LOGIN_INIT as AuthStep, 'Начало процесса входа');
      const result = await login();
      if (result !== null) {
        onAuthenticate(result);
      }
    } catch (error) {
      logAuthError(AuthStep.AUTH_ERROR as AuthStep, 'Ошибка при входе', error as Error);
      setShowError(true);
    }
  };

  const handleLogout = async () => {
    try {
      logAuthInfo(AuthStep.LOGOUT as AuthStep, 'Выход из системы');
      await logout();
      onAuthenticate(null);
    } catch (error) {
      logAuthError(AuthStep.AUTH_ERROR as AuthStep, 'Ошибка при выходе', error as Error);
    }
  };

  if (isLoading) {
    return (
      <div className="auth-window">
        <div className="auth-content">
          <div className="loading-spinner"></div>
          <p>Загрузка...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className="auth-window">
        <div className="auth-content">
          <div className="user-info">
            {user.pfp && (
              <img 
                src={user.pfp} 
                alt={user.displayName || user.username} 
                className="user-avatar"
              />
            )}
            <div className="user-details">
              <h3>{user.displayName || user.username}</h3>
              <p>@{user.username}</p>
              <p className="user-fid">FID: {user.fid}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="logout-button">
            Выйти
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-window">
      <div className="auth-content">
        <h2>Добро пожаловать в Snotcoin</h2>
        <p>Для начала игры необходимо авторизоваться через Warpcast</p>
        
        {showError && errorMessage && (
          <div className="error-message">
            <p>{errorMessage}</p>
            <button onClick={handleRetry} className="retry-button">
              Повторить
            </button>
          </div>
        )}
        
        <button 
          onClick={handleLogin} 
          className="login-button"
          disabled={status === AuthStatus.LOADING}
        >
          Войти через Warpcast
        </button>
      </div>
    </div>
  );
};

