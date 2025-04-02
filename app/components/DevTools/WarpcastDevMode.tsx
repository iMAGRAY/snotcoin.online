'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  activateFarcasterDevMock, 
  deactivateFarcasterDevMock,
  isFarcasterDevMockActive
} from '../../utils/devTools/farcasterDevMock';
import { initDevTools, saveDevSettings } from '../../utils/devTools/initDevTools';

interface WarpcastDevModeProps {
  children?: React.ReactNode;
}

// Данные пользователя для режима разработчика
interface DevUserData {
  fid: number;
  username: string; 
  displayName: string;
  pfpUrl?: string;
}

/**
 * Компонент для включения режима разработчика с эмуляцией Warpcast
 */
const WarpcastDevMode: React.FC<WarpcastDevModeProps> = ({ children }) => {
  const [isActive, setIsActive] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [fid, setFid] = useState('123456789');
  const [username, setUsername] = useState('dev_user');
  const [displayName, setDisplayName] = useState('Dev User');
  const [autoActivate, setAutoActivate] = useState(true);
  const [needsReload, setNeedsReload] = useState(false);
  const [consoleLog, setConsoleLog] = useState<string[]>([]);
  
  // Состояния для перетаскивания и изменения размера
  const [position, setPosition] = useState({ x: -1, y: -1 });
  const [size, setSize] = useState({ width: 500, height: 400 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [startPosition, setStartPosition] = useState({ x: 0, y: 0 });
  const [startSize, setStartSize] = useState({ width: 0, height: 0 });
  
  const panelRef = useRef<HTMLDivElement>(null);
  
  // Загружаем сохраненные настройки и проверяем активен ли мок при монтировании
  useEffect(() => {
    // Проверяем, находимся ли мы в режиме разработки
    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev) return;
    
    // Перехватываем вывод в консоль для показа в панели разработчика
    const originalConsoleLog = console.log;
    const originalConsoleWarn = console.warn; 
    const originalConsoleError = console.error;
    
    console.log = (...args) => {
      originalConsoleLog(...args);
      if (args[0] && typeof args[0] === 'string' && 
          (args[0].includes('[FarcasterContext]') || 
           args[0].includes('[DevTools]') || 
           args[0].includes('[DevModeActivator]')) &&
          !args[0].includes('[HomeContent]')) {
        setConsoleLog(prev => [...prev.slice(-50), args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ')]);
      }
    };
    
    console.warn = (...args) => {
      originalConsoleWarn(...args);
      if (args[0] && typeof args[0] === 'string' && 
          (args[0].includes('[FarcasterContext]') || 
           args[0].includes('[DevTools]'))) {
        setConsoleLog(prev => [...prev.slice(-50), '⚠️ ' + args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ')]);
      }
    };
    
    console.error = (...args) => {
      originalConsoleError(...args);
      if (args[0] && typeof args[0] === 'string' && 
          (args[0].includes('[FarcasterContext]') || 
           args[0].includes('[DevTools]'))) {
        setConsoleLog(prev => [...prev.slice(-50), '❌ ' + args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ')]);
      }
    };
    
    // Добавляем обработчик клавиш для Ctrl+A
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'a') {
        e.preventDefault(); // Предотвращаем стандартное действие (выделение всего текста)
        setShowPanel(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    // Загружаем сохраненные настройки из localStorage
    try {
      const savedSettings = localStorage.getItem('devSettings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        
        if (settings.warpcastUser) {
          setFid(settings.warpcastUser.fid?.toString() || '123456789');
          setUsername(settings.warpcastUser.username || 'dev_user');
          setDisplayName(settings.warpcastUser.displayName || 'Dev User');
        }
        
        setAutoActivate(settings.autoActivateWarpcastMock === true);
        
        // Загружаем сохраненную позицию и размер панели
        if (settings.devPanelPosition) {
          setPosition(settings.devPanelPosition);
        }
        if (settings.devPanelSize) {
          setSize(settings.devPanelSize);
        }
      }
      
      // Если установлена автоактивация и мок не активен, запускаем его
      if (autoActivate && !isFarcasterDevMockActive()) {
        console.log('[WarpcastDevMode] Auto-activating dev mode');
        handleActivate();
      }
    } catch (error) {
      console.error('[WarpcastDevMode] Ошибка при загрузке настроек:', error);
    }
    
    // Проверяем активен ли мок
    const isDevModeActive = isFarcasterDevMockActive();
    setIsActive(isDevModeActive);
    
    // Инициализируем инструменты разработчика
    initDevTools();
    
    // Показываем панель в режиме разработки
    setShowPanel(false); // По умолчанию скрыта, открывается по Ctrl+A
    
    return () => {
      // Восстанавливаем оригинальные функции консоли
      console.log = originalConsoleLog;
      console.warn = originalConsoleWarn;
      console.error = originalConsoleError;
      
      // Удаляем обработчик клавиш
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
  
  // Обработчики для перетаскивания
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).classList.contains('drag-handle')) {
      setIsDragging(true);
      setStartPosition({ x: e.clientX, y: e.clientY });
    }
  };
  
  // Обработчики для изменения размера
  const handleResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsResizing(true);
    setStartPosition({ x: e.clientX, y: e.clientY });
    setStartSize({ width: size.width, height: size.height });
  };
  
  // Обработчик движения мыши
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const deltaX = e.clientX - startPosition.x;
        const deltaY = e.clientY - startPosition.y;
        
        const newX = position.x === -1 
          ? Math.max(0, e.clientX - (panelRef.current?.offsetWidth || 0) / 2)
          : position.x + deltaX;
          
        const newY = position.y === -1 
          ? Math.max(0, e.clientY - 20)
          : position.y + deltaY;
          
        setPosition({ x: newX, y: newY });
        setStartPosition({ x: e.clientX, y: e.clientY });
      } else if (isResizing) {
        const deltaX = e.clientX - startPosition.x;
        const deltaY = e.clientY - startPosition.y;
        
        setSize({
          width: Math.max(300, startSize.width + deltaX),
          height: Math.max(200, startSize.height + deltaY)
        });
      }
    };
    
    const handleMouseUp = () => {
      if (isDragging || isResizing) {
        // Сохраняем новую позицию и размер в настройках
        if (isDragging) {
          saveSettings(autoActivate, {
            devPanelPosition: position,
            devPanelSize: size
          });
        } else if (isResizing) {
          saveSettings(autoActivate, {
            devPanelPosition: position,
            devPanelSize: size
          });
        }
        
        setIsDragging(false);
        setIsResizing(false);
      }
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, startPosition, position, startSize, size, autoActivate]);
  
  // Сохранение настроек
  const saveSettings = (autoActivate: boolean, additional = {}) => {
    const warpcastUser: DevUserData = {
      fid: parseInt(fid),
      username,
      displayName
    };
    
    saveDevSettings({
      autoActivateWarpcastMock: autoActivate,
      warpcastUser,
      ...additional
    });
    
    // Добавляем запись в лог
    setConsoleLog(prev => [...prev, `[DevTools] Настройки сохранены: ${JSON.stringify({
      autoActivateWarpcastMock: autoActivate,
      warpcastUser,
      ...additional
    }, null, 2)}`]);
  };
  
  // Активация режима разработки с мок-данными пользователя
  const handleActivate = () => {
    const userData: DevUserData = {
      fid: parseInt(fid),
      username,
      displayName,
      pfpUrl: 'https://cdn.warpcast.com/profile-pictures/default-profile.png'
    };
    
    const success = activateFarcasterDevMock(userData);
    if (success) {
      setIsActive(true);
      saveSettings(autoActivate);
      setNeedsReload(true);
      
      // Добавляем запись в лог
      setConsoleLog(prev => [...prev, `[DevTools] Режим разработки активирован с пользователем: ${JSON.stringify(userData, null, 2)}`]);
    } else {
      alert('Не удалось активировать режим эмуляции Warpcast.');
      
      // Добавляем запись в лог
      setConsoleLog(prev => [...prev, `[DevTools] ❌ Ошибка при активации режима разработки`]);
    }
  };
  
  // Деактивация режима разработки
  const handleDeactivate = () => {
    const success = deactivateFarcasterDevMock();
    if (success) {
      setIsActive(false);
      // Сохраняем настройку автоактивации
      saveSettings(autoActivate);
      setNeedsReload(true);
      
      // Добавляем запись в лог
      setConsoleLog(prev => [...prev, `[DevTools] Режим разработки деактивирован`]);
    } else {
      alert('Не удалось деактивировать режим эмуляции Warpcast.');
      
      // Добавляем запись в лог
      setConsoleLog(prev => [...prev, `[DevTools] ❌ Ошибка при деактивации режима разработки`]);
    }
  };
  
  // Обработчик для переключения автоактивации
  const handleAutoActivateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.checked;
    setAutoActivate(newValue);
    saveSettings(newValue);
  };

  // Обработчик для перезагрузки страницы
  const handleReload = () => {
    window.location.reload();
  };
  
  // Очистка лога
  const clearLog = () => {
    setConsoleLog([]);
  };
  
  // Если не режим разработки или панель скрыта, не показываем панель
  if (!showPanel) {
    return (
      <>
        {process.env.NODE_ENV === 'development' && (
          <div className="fixed top-16 right-4 z-[9999]">
            <button 
              onClick={() => setShowPanel(true)} 
              className="bg-green-500 text-white p-2 rounded-md shadow-lg hover:bg-green-600 transition-colors text-xs"
            >
              Activate Dev Mode (Ctrl+A)
            </button>
          </div>
        )}
        {isActive && (
          <div className="fixed top-4 left-4 z-[9999] flex items-center bg-black bg-opacity-70 rounded-full p-1.5 shadow-lg">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse mr-1.5"></div>
            <span className="text-white text-xs font-medium">Warpcast Dev Mode: {username} ({fid})</span>
          </div>
        )}
        {children}
      </>
    );
  }
  
  // Стили для позиционирования панели
  const panelStyle = {
    position: 'fixed' as 'fixed',
    left: position.x !== -1 ? `${position.x}px` : 'auto',
    top: position.y !== -1 ? `${position.y}px` : 'auto',
    right: position.x === -1 ? '4px' : 'auto',
    bottom: position.y === -1 ? '4px' : 'auto',
    width: `${size.width}px`,
    maxHeight: `${size.height}px`,
    zIndex: 9999
  };
  
  return (
    <>
      {/* Индикатор активного режима эмуляции Warpcast */}
      {isActive && (
        <div className="fixed top-4 left-4 z-[9999] flex items-center bg-black bg-opacity-70 rounded-full p-1.5 shadow-lg">
          <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse mr-1.5"></div>
          <span className="text-white text-xs font-medium">Warpcast Dev Mode</span>
        </div>
      )}
      
      <div className="fixed top-4 right-4 z-[9999]">
        <button 
          onClick={() => setShowPanel(prev => !prev)} 
          className="bg-purple-600 text-white p-2 rounded-full shadow-lg hover:bg-purple-700 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
      
      <div 
        ref={panelRef}
        style={panelStyle}
        className="p-4 bg-gray-900 rounded-lg shadow-xl border border-gray-700 text-white overflow-hidden flex flex-col resize-both"
      >
        <div 
          className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2 cursor-move drag-handle"
          onMouseDown={handleMouseDown}
        >
          <h3 className="text-lg font-medium">Farcaster Dev Mode</h3>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-400">Press Ctrl+A to toggle</span>
            <button
              onClick={() => setShowPanel(false)}
              className="text-gray-400 hover:text-white"
            >
              ×
            </button>
          </div>
        </div>
        
        <div className="flex flex-col h-full overflow-auto">
          {/* Табы */}
          <div className="flex border-b border-gray-700 mb-4">
            <button className="p-2 border-b-2 border-purple-500 text-purple-400">
              Настройки
            </button>
            <button className="p-2 text-gray-400 hover:text-white">
              Логи
            </button>
          </div>
        
          <div className="grid grid-cols-1 gap-4 mb-4 overflow-y-auto">
            {needsReload && (
              <div className="mb-4 p-3 bg-yellow-800 rounded-lg text-sm">
                <p className="font-medium text-yellow-200">Необходима перезагрузка страницы!</p>
                <p className="text-yellow-300 mt-1">Для применения изменений требуется перезагрузить страницу.</p>
                <button 
                  onClick={handleReload}
                  className="mt-2 w-full bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-1.5 px-4 rounded text-sm"
                >
                  Перезагрузить сейчас
                </button>
              </div>
            )}
            
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <label htmlFor="dev-mode-toggle" className="cursor-pointer">
                  Эмуляция Warpcast
                </label>
                <div className="relative">
                  <input
                    type="checkbox"
                    id="dev-mode-toggle"
                    className="sr-only"
                    checked={isActive}
                    onChange={() => isActive ? handleDeactivate() : handleActivate()}
                  />
                  <div className={`block w-14 h-8 rounded-full transition-colors ${isActive ? 'bg-green-600' : 'bg-gray-600'}`}></div>
                  <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${isActive ? 'transform translate-x-6' : ''}`}></div>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {isActive ? 'Эмуляция Warpcast активна' : 'Эмуляция Warpcast не активна'}
              </p>
            </div>
            
            <div className="space-y-3">
              <div>
                <label htmlFor="fid" className="block text-sm font-medium text-gray-300">
                  FID (Farcaster ID)
                </label>
                <input
                  type="text"
                  id="fid"
                  value={fid}
                  onChange={(e) => setFid(e.target.value)}
                  className="mt-1 block w-full rounded-md bg-gray-800 border-gray-700 text-white shadow-sm p-2 text-sm"
                  disabled={isActive}
                />
              </div>
              
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-300">
                  Username
                </label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="mt-1 block w-full rounded-md bg-gray-800 border-gray-700 text-white shadow-sm p-2 text-sm"
                  disabled={isActive}
                />
              </div>
              
              <div>
                <label htmlFor="displayName" className="block text-sm font-medium text-gray-300">
                  Display Name
                </label>
                <input
                  type="text"
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mt-1 block w-full rounded-md bg-gray-800 border-gray-700 text-white shadow-sm p-2 text-sm"
                  disabled={isActive}
                />
              </div>
              
              <div className="flex items-center mt-4">
                <input
                  id="auto-activate"
                  type="checkbox"
                  checked={autoActivate}
                  onChange={handleAutoActivateChange}
                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-700 rounded"
                />
                <label htmlFor="auto-activate" className="ml-2 block text-sm text-gray-300">
                  Автоматически активировать при загрузке
                </label>
              </div>
            </div>
            
            <div className="mt-6 border-t border-gray-700 pt-4">
              <h4 className="text-sm font-medium text-gray-300 mb-2">Отладочные логи</h4>
              <div className="bg-gray-800 rounded-md p-2 max-h-[200px] overflow-y-auto text-xs font-mono">
                {consoleLog.length === 0 ? (
                  <p className="text-gray-500 italic">Нет доступных логов</p>
                ) : (
                  consoleLog.map((log, index) => (
                    <div key={index} className="mb-1 whitespace-pre-wrap">
                      {log.startsWith('❌') ? (
                        <span className="text-red-400">{log}</span>
                      ) : log.startsWith('⚠️') ? (
                        <span className="text-yellow-400">{log}</span>
                      ) : (
                        <span className="text-green-400">{log}</span>
                      )}
                    </div>
                  ))
                )}
              </div>
              <button 
                onClick={clearLog}
                className="mt-2 text-xs text-gray-400 hover:text-white"
              >
                Очистить логи
              </button>
            </div>
            
            <div className="flex space-x-2 mt-4">
              <button
                onClick={() => {
                  saveSettings(autoActivate, {
                    devPanelPosition: position,
                    devPanelSize: size
                  });
                  setConsoleLog(prev => [...prev, `[DevTools] Настройки сохранены вручную`]);
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded text-sm"
                disabled={isActive}
              >
                Сохранить настройки
              </button>
              
              <button
                onClick={handleReload}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded text-sm"
              >
                Перезагрузить страницу
              </button>
            </div>
          </div>
          
          {/* Ручка для изменения размера */}
          <div 
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
            onMouseDown={handleResizeMouseDown}
          >
            <svg viewBox="0 0 24 24" className="text-gray-500">
              <path fill="currentColor" d="M22,22H20V20H22V22M22,18H20V16H22V18M18,22H16V20H18V22M18,18H16V16H18V18M14,22H12V20H14V22M22,14H20V12H22V14Z" />
            </svg>
          </div>
        </div>
      </div>
      
      {children}
    </>
  );
};

export default WarpcastDevMode; 