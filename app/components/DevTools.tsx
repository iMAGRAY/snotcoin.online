'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useGameState } from '../contexts/game/hooks/useGameState'
import { useGameDispatch } from '../contexts/game/hooks/useGameDispatch'
import { cleanupLocalStorage } from '../services/localStorageManager'

// Константы, должны совпадать с теми, что используются в gameDataService.ts
const BACKUP_METADATA_KEY = 'backup_metadata';
const MAX_BACKUP_SIZE = 500 * 1024; // 500 КБ

interface BackupInfo {
  exists: boolean;
  count: number;
  latestTimestamp: string | null;
}

/**
 * Компонент для отладки сохранения прогресса
 */
export default function DevTools() {
  const gameState = useGameState()
  const dispatch = useGameDispatch()
  const [userId, setUserId] = useState<string>('')
  const [storageInfo, setStorageInfo] = useState<Record<string, string>>({})
  const [backupInfo, setBackupInfo] = useState<BackupInfo>({exists: false, count: 0, latestTimestamp: null})
  const [localStorageSize, setLocalStorageSize] = useState<string>("0 КБ")
  
  // Состояния для управления позицией и размером окна
  const [position, setPosition] = useState({ x: 10, y: 10 })
  const [size, setSize] = useState({ width: 300, height: 400 })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const [isMinimized, setIsMinimized] = useState(false)
  const [isDevMode, setIsDevMode] = useState(false)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const prevSizeRef = useRef({ width: 300, height: 400 })
  
  // Функция для проверки режима разработки
  useEffect(() => {
    // Проверяем, находимся ли мы в режиме разработки
    const isDevelopment = process.env.NODE_ENV === 'development' || 
                         window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1';
    setIsDevMode(isDevelopment);
  }, []);
  
  // Функция для проверки размера localStorage
  const getLocalStorageSize = () => {
    try {
      let totalSize = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key) || '';
          totalSize += key.length + value.length;
        }
      }
      
      // Размер в КБ с округлением до 2 знаков
      return (totalSize / 1024).toFixed(2) + ' КБ';
    } catch (e) {
      console.error('[DevTools] Ошибка при расчете размера localStorage:', e);
      return "Ошибка расчета";
    }
  };
  
  // Обновляем информацию о хранилище и резервных копиях
  const updateStorageInfo = () => {
    if (typeof window === 'undefined') return;
    
    try {
      // Получаем размер localStorage
      const storageSize = getLocalStorageSize();
      setLocalStorageSize(storageSize);
      
      // Проверяем наличие резервных копий через метаданные
      let backupCount = 0;
      let latestTimestamp: string | null = null;
      
      if (userId) {
        const metadataJson = localStorage.getItem(BACKUP_METADATA_KEY);
        if (metadataJson) {
          try {
            const metadata = JSON.parse(metadataJson);
            if (metadata[userId] && metadata[userId].backups) {
              backupCount = metadata[userId].backups.length;
              
              if (backupCount > 0) {
                // Сортируем по времени (от новых к старым)
                const backups = [...metadata[userId].backups];
                backups.sort((a, b) => b.timestamp - a.timestamp);
                
                // Получаем время последней резервной копии
                if (backups[0] && backups[0].timestamp) {
                  latestTimestamp = new Date(backups[0].timestamp).toLocaleString();
                }
              }
            }
          } catch (error) {
            console.error('[DevTools] Ошибка при разборе метаданных резервных копий:', error);
          }
        }
      }
      
      // Обновляем информацию о резервных копиях
      setBackupInfo({
        exists: backupCount > 0,
        count: backupCount,
        latestTimestamp
      });
      
      // Собираем всю информацию о сохранении
      setStorageInfo({
        ...storageInfo,
        'backups': backupCount.toString(),
        'localStorage.size': storageSize
      });
    } catch (error) {
      console.error('[DevTools] Ошибка при обновлении информации о хранилище:', error);
    }
  };
  
  // Получаем информацию из localStorage при монтировании
  useEffect(() => {
    if (typeof window === 'undefined') return () => {};
    
    try {
      // Получаем информацию из localStorage
      const storedUserId = localStorage.getItem('user_id');
      const storedUserIdAlt = localStorage.getItem('userId');
      const storedGameId = localStorage.getItem('game_id');
      const authToken = localStorage.getItem('auth_token');
      
      const userId = storedUserId || storedUserIdAlt || storedGameId || '';
      setUserId(userId || 'Не найден');
      
      // Получаем размер localStorage
      const storageSize = getLocalStorageSize();
      setLocalStorageSize(storageSize);
      
      // Проверяем наличие резервных копий через метаданные
      let backupCount = 0;
      let latestTimestamp: string | null = null;
      
      const metadataJson = localStorage.getItem(BACKUP_METADATA_KEY);
      if (metadataJson && userId) {
        try {
          const metadata = JSON.parse(metadataJson);
          if (metadata[userId] && metadata[userId].backups) {
            backupCount = metadata[userId].backups.length;
            
            if (backupCount > 0) {
              // Сортируем по времени (от новых к старым)
              const backups = [...metadata[userId].backups];
              backups.sort((a, b) => b.timestamp - a.timestamp);
              
              // Получаем время последней резервной копии
              if (backups[0] && backups[0].timestamp) {
                latestTimestamp = new Date(backups[0].timestamp).toLocaleString();
              }
            }
          }
        } catch (error) {
          console.error('[DevTools] Ошибка при разборе метаданных резервных копий:', error);
        }
      }
      
      // Обновляем информацию о резервных копиях
      setBackupInfo({
        exists: backupCount > 0,
        count: backupCount,
        latestTimestamp
      });
      
      // Собираем всю информацию о сохранении
      setStorageInfo({
        'user_id': storedUserId || 'Не найден',
        'userId': storedUserIdAlt || 'Не найден',
        'game_id': storedGameId || 'Не найден',
        'auth_token': authToken ? 'Найден' : 'Не найден',
        'backups': backupCount.toString(),
        'gameState._userId': gameState._userId || 'Не найден',
        'localStorage.size': storageSize,
        'localStorage.length': localStorage.length.toString()
      })
      
      // Добавляем обработчики событий сохранения
      const handleSaveSuccess = () => {
        console.log('[DevTools] Получено событие успешного сохранения');
        updateStorageInfo();
      };
      
      const handleSaveError = (event: any) => {
        console.error('[DevTools] Получено событие ошибки сохранения:', event.detail?.error);
      };
      
      window.addEventListener('game-save-success', handleSaveSuccess);
      window.addEventListener('game-save-error', handleSaveError);
      
      return () => {
        window.removeEventListener('game-save-success', handleSaveSuccess);
        window.removeEventListener('game-save-error', handleSaveError);
      };
    } catch (error) {
      console.error('[DevTools] Ошибка при получении информации из localStorage:', error);
      return () => {};
    }
  }, [gameState._userId]);
  
  // Эффект для обработки движения мыши и отпускания при перетаскивании
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragOffset.x
        const newY = e.clientY - dragOffset.y
        
        // Проверяем границы экрана, чтобы не выходить за них
        const maxX = window.innerWidth - (containerRef.current?.offsetWidth || 0)
        const maxY = window.innerHeight - (containerRef.current?.offsetHeight || 0)
        
        setPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY))
        })
      } else if (isResizing) {
        const deltaX = e.clientX - resizeStart.x
        const deltaY = e.clientY - resizeStart.y
        
        const newWidth = Math.max(200, resizeStart.width + deltaX)
        const newHeight = Math.max(200, resizeStart.height + deltaY)
        
        setSize({
          width: newWidth,
          height: newHeight
        })
      }
    }
    
    const handleMouseUp = () => {
      setIsDragging(false)
      setIsResizing(false)
    }
    
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, isResizing, dragOffset, resizeStart]);
  
  // Если не режим разработки, не рендерим компонент
  if (!isDevMode) return null;
  
  // Обработчик для сворачивания/разворачивания панели
  const handleToggleMinimize = () => {
    if (isMinimized) {
      // Если окно было свёрнуто, восстанавливаем предыдущий размер
      setSize(prevSizeRef.current);
      setIsMinimized(false);
    } else {
      // Если окно было развёрнуто, сохраняем текущий размер и сворачиваем
      prevSizeRef.current = { ...size };
      setSize({ width: 50, height: 50 });
      setIsMinimized(true);
    }
  };
  
  // Обработчики для перемещения окна
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    })
  }
  
  const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    })
  }
  
  // Обработчик для тестового сохранения
  const handleTestSave = () => {
    // Небольшое изменение в игровом состоянии, чтобы вызвать сохранение
    dispatch({
      type: 'ADD_SNOT',
      payload: 1
    })
    
    console.log('[DevTools] Отправлен тестовый запрос на сохранение')
  }
  
  // Обработчик для очистки localStorage
  const handleClearStorage = () => {
    if (window.confirm('Вы уверены, что хотите очистить localStorage? Это приведет к потере всех локальных данных.')) {
      localStorage.clear()
      console.log('[DevTools] localStorage очищен')
      window.location.reload()
    }
  }
  
  // Обработчик для создания резервной копии
  const handleCreateBackup = () => {
    try {
      if (!userId) {
        alert('Невозможно создать резервную копию: отсутствует userId');
        return;
      }
      
      // Очищаем localStorage перед созданием копии
      const cleaned = cleanupLocalStorage(70, userId);
      
      // Создаем локальную резервную копию вручную
      try {
        const backupKey = `backup_${userId}_${Date.now()}`;
        localStorage.setItem(backupKey, JSON.stringify({
          gameState,
          timestamp: Date.now(),
          version: gameState._saveVersion || 1
        }));
        
        // Обновляем ключ последней резервной копии
        localStorage.setItem(`backup_${userId}_latest`, backupKey);
        
        console.log('[DevTools] Создана резервная копия состояния игры');
        
        // Обновляем информацию о размере localStorage и резервных копиях
        updateStorageInfo();
        
        alert('Резервная копия успешно создана');
      } catch (backupError) {
        console.error('[DevTools] Ошибка при создании резервной копии:', backupError);
        alert(`Ошибка при создании резервной копии: ${backupError}`);
      }
    } catch (error) {
      console.error('[DevTools] Ошибка при создании резервной копии:', error);
      alert(`Ошибка при создании резервной копии: ${error}`);
    }
  }
  
  // Стили для панели отладки
  const styles = {
    container: {
      position: 'fixed',
      top: `${position.y}px`,
      left: `${position.x}px`,
      width: `${size.width}px`,
      height: `${size.height}px`,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: isMinimized ? '0' : '10px',
      borderRadius: '5px',
      zIndex: 9999,
      fontSize: '12px',
      overflow: 'hidden',
      resize: 'none',
      boxShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
      transition: 'width 0.3s, height 0.3s, padding 0.3s'
    } as React.CSSProperties,
    titleBar: {
      fontSize: '14px',
      fontWeight: 'bold',
      marginBottom: isMinimized ? '0' : '8px',
      padding: '5px',
      backgroundColor: 'rgba(60, 60, 60, 0.8)',
      borderRadius: '3px',
      cursor: 'move',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      userSelect: 'none'
    } as React.CSSProperties,
    title: {
      fontSize: '14px',
      fontWeight: 'bold',
      marginBottom: '5px'
    } as React.CSSProperties,
    infoRow: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: '3px'
    } as React.CSSProperties,
    button: {
      backgroundColor: '#4CAF50',
      border: 'none',
      color: 'white',
      padding: '5px 10px',
      textAlign: 'center',
      textDecoration: 'none',
      display: 'inline-block',
      fontSize: '12px',
      margin: '5px 5px 5px 0',
      cursor: 'pointer',
      borderRadius: '3px'
    } as React.CSSProperties,
    dangerButton: {
      backgroundColor: '#f44336'
    } as React.CSSProperties,
    section: {
      marginBottom: '10px',
      borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
      paddingBottom: '5px'
    } as React.CSSProperties,
    warningText: {
      color: '#ffcc00',
      fontWeight: 'bold'
    } as React.CSSProperties,
    resizeHandle: {
      position: 'absolute',
      bottom: '0',
      right: '0',
      width: '15px',
      height: '15px',
      cursor: 'nwse-resize',
      background: 'linear-gradient(135deg, transparent 50%, rgba(255, 255, 255, 0.5) 50%)',
      borderRadius: '0 0 5px 0',
      display: isMinimized ? 'none' : 'block'
    } as React.CSSProperties,
    minimizeButton: {
      backgroundColor: 'transparent',
      border: 'none',
      color: 'white',
      cursor: 'pointer',
      fontSize: '16px',
      padding: '0',
      marginLeft: '5px',
      width: '20px',
      height: '20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    } as React.CSSProperties,
    minimizedContent: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      width: '100%',
      fontWeight: 'bold',
      fontSize: '20px'
    } as React.CSSProperties
  }
  
  // Проверяем, не приближается ли размер localStorage к лимиту
  const isStorageSizeWarning = parseFloat(localStorageSize) > 4000; // 4 МБ из 5 МБ лимита
  
  return (
    <div style={styles.container} ref={containerRef}>
      <div style={styles.titleBar} onMouseDown={handleMouseDown}>
        <div>
          {isMinimized ? 'DEV' : 'Отладка сохранения'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {!isMinimized && (
            <div style={{ fontSize: '10px', marginRight: '5px' }}>
              {size.width}x{size.height}
            </div>
          )}
          <button 
            style={styles.minimizeButton} 
            onClick={handleToggleMinimize}
            title={isMinimized ? "Развернуть" : "Свернуть"}
          >
            {isMinimized ? '□' : '—'}
          </button>
        </div>
      </div>
      
      {isMinimized ? (
        <div style={styles.minimizedContent}>
          {parseFloat(localStorageSize) > 4000 ? '⚠️' : '✓'}
        </div>
      ) : (
        <>
          <div style={styles.section}>
            <div style={{...styles.title, fontSize: '12px'}}>Идентификаторы:</div>
            {Object.entries(storageInfo).map(([key, value]) => (
              <div key={key} style={styles.infoRow}>
                <div>{key}:</div>
                <div style={key === 'localStorage.size' && isStorageSizeWarning ? styles.warningText : undefined}>
                  {value}
                </div>
              </div>
            ))}
          </div>
          
          <div style={styles.section}>
            <div style={{...styles.title, fontSize: '12px'}}>Резервные копии:</div>
            <div style={styles.infoRow}>
              <div>Статус:</div>
              <div>{backupInfo.exists ? 'Доступны' : 'Отсутствуют'}</div>
            </div>
            <div style={styles.infoRow}>
              <div>Количество:</div>
              <div>{backupInfo.count}</div>
            </div>
            {backupInfo.exists && backupInfo.latestTimestamp && (
              <div style={styles.infoRow}>
                <div>Последняя копия:</div>
                <div>{backupInfo.latestTimestamp}</div>
              </div>
            )}
          </div>
          
          <div style={styles.section}>
            <div style={{...styles.title, fontSize: '12px'}}>Версия:</div>
            <div style={styles.infoRow}>
              <div>_saveVersion:</div>
              <div>{gameState._saveVersion || 'Не задана'}</div>
            </div>
            <div style={styles.infoRow}>
              <div>_lastSaved:</div>
              <div>{gameState._lastSaved ? new Date(gameState._lastSaved).toLocaleTimeString() : 'Нет'}</div>
            </div>
          </div>
          
          <button 
            style={styles.button} 
            onClick={handleTestSave}
          >
            Тестовое сохранение
          </button>
          
          <button 
            style={styles.button} 
            onClick={handleCreateBackup}
          >
            Создать резервную копию
          </button>
          
          <button 
            style={{...styles.button, ...styles.dangerButton}} 
            onClick={handleClearStorage}
          >
            Очистить localStorage
          </button>
          
          <div style={styles.resizeHandle} onMouseDown={handleResizeStart}></div>
        </>
      )}
    </div>
  )
} 