'use client'

import React, { useState, useEffect } from 'react'
import { useGameState } from '../contexts/game/hooks/useGameState'
import { useGameDispatch } from '../contexts/game/hooks/useGameDispatch'

// Константы, должны совпадать с теми, что используются в gameDataService.ts
const BACKUP_METADATA_KEY = 'backup_metadata';
const MAX_BACKUP_SIZE = 500 * 1024; // 500 КБ

/**
 * Компонент для отладки сохранения прогресса
 */
export default function DevTools() {
  const gameState = useGameState()
  const dispatch = useGameDispatch()
  const [userId, setUserId] = useState<string>('')
  const [storageInfo, setStorageInfo] = useState<Record<string, string>>({})
  const [backupInfo, setBackupInfo] = useState<{exists: boolean, count: number, latestTimestamp?: string}>({exists: false, count: 0})
  const [localStorageSize, setLocalStorageSize] = useState<string>("0 КБ")
  
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
  
  // Получаем информацию из localStorage при монтировании
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    try {
      // Получаем информацию из localStorage
      const storedUserId = localStorage.getItem('user_id')
      const storedUserIdAlt = localStorage.getItem('userId')
      const storedGameId = localStorage.getItem('game_id')
      const authToken = localStorage.getItem('auth_token')
      
      const userId = storedUserId || storedUserIdAlt || storedGameId || '';
      setUserId(userId || 'Не найден')
      
      // Получаем размер localStorage
      const storageSize = getLocalStorageSize();
      setLocalStorageSize(storageSize);
      
      // Проверяем наличие резервных копий через метаданные
      let backupCount = 0;
      let latestTimestamp: string | undefined;
      
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
      
      // Выводим все ключи из localStorage
      const keys = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key) keys.push(key)
      }
      
      console.log('[DevTools] Ключи в localStorage:', keys)
      console.log('[DevTools] gameState:', gameState)
    } catch (error) {
      console.error('[DevTools] Ошибка при получении информации из localStorage:', error)
    }
  }, [gameState._userId])
  
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
      
      const timestamp = Date.now();
      const backupKey = `backup_gamestate_${userId}_${timestamp}`;
      
      // Подготавливаем данные в правильном формате
      const backupData = {
        gameState: gameState,
        timestamp,
        version: gameState._saveVersion || 1
      };
      
      // Проверяем размер перед сохранением
      const jsonString = JSON.stringify(backupData);
      const size = new Blob([jsonString]).size;
      
      if (size > MAX_BACKUP_SIZE) {
        alert(`Слишком большой размер резервной копии: ${(size / 1024).toFixed(2)} КБ (макс ${MAX_BACKUP_SIZE / 1024} КБ)`);
        return;
      }
      
      // Сохраняем резервную копию
      localStorage.setItem(backupKey, jsonString);
      
      // Обновляем метаданные
      let metadata: Record<string, any> = {};
      const metadataJson = localStorage.getItem(BACKUP_METADATA_KEY);
      
      if (metadataJson) {
        try {
          metadata = JSON.parse(metadataJson);
        } catch (e) {
          metadata = {};
        }
      }
      
      if (!metadata[userId]) {
        metadata[userId] = { backups: [] };
      }
      
      // Добавляем информацию о новой резервной копии
      metadata[userId].backups.push({
        key: backupKey,
        timestamp,
        version: gameState._saveVersion || 1
      });
      
      // Сохраняем обновленные метаданные
      localStorage.setItem(BACKUP_METADATA_KEY, JSON.stringify(metadata));
      
      console.log('[DevTools] Создана резервная копия состояния игры');
      
      // Обновляем информацию о размере localStorage
      const storageSize = getLocalStorageSize();
      setLocalStorageSize(storageSize);
      
      // Обновляем информацию о резервных копиях
      setBackupInfo({
        exists: true,
        count: backupInfo.count + 1,
        latestTimestamp: new Date().toLocaleString()
      });
      
      setStorageInfo({
        ...storageInfo,
        'backups': (backupInfo.count + 1).toString(),
        'localStorage.size': storageSize
      });
      
      alert('Резервная копия успешно создана');
    } catch (error) {
      console.error('[DevTools] Ошибка при создании резервной копии:', error);
      alert(`Ошибка при создании резервной копии: ${error}`);
    }
  }
  
  // Стили для панели отладки
  const styles = {
    container: {
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      zIndex: 9999,
      fontSize: '12px',
      maxWidth: '300px'
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
    } as React.CSSProperties
  }
  
  // Проверяем, не приближается ли размер localStorage к лимиту
  const isStorageSizeWarning = parseFloat(localStorageSize) > 4000; // 4 МБ из 5 МБ лимита
  
  return (
    <div style={styles.container}>
      <div style={styles.title}>Отладка сохранения</div>
      
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
    </div>
  )
} 