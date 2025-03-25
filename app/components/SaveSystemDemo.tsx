import React, { useState, useEffect } from 'react';
import { useSaveContext } from '../contexts/SaveContext';
import { createDefaultExtendedGameState } from '../types/gameTypes';

/**
 * Демонстрационный компонент для системы сохранения
 */
const SaveSystemDemo: React.FC = () => {
  const {
    isInitialized,
    isInitializing,
    isSaving,
    isLoading,
    lastSaveResult,
    lastLoadResult,
    saveInfo,
    saveState,
    loadState,
    resetAllData,
    exportStateToString,
    importStateFromString,
    setAutoSave,
    setSyncWithServer
  } = useSaveContext();
  
  // Локальное состояние
  const [gameState, setGameState] = useState(createDefaultExtendedGameState('demo-user'));
  const [exportedState, setExportedState] = useState<string>('');
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string>('');
  
  // Загружаем начальное состояние при инициализации
  useEffect(() => {
    if (isInitialized && !isInitializing) {
      handleLoadState();
    }
  }, [isInitialized, isInitializing]);
  
  // Обработчик сохранения состояния
  const handleSaveState = async () => {
    setStatusMessage('Сохранение...');
    
    // Обновляем время последнего изменения и userId
    const updatedState = {
      ...gameState,
      _lastModified: Date.now(),
      _userId: 'demo-user'
    };
    
    const result = await saveState(updatedState);
    
    if (result.success) {
      setGameState(updatedState);
      setStatusMessage(`Сохранено успешно (${result.metrics?.duration}мс)`);
    } else {
      setStatusMessage(`Ошибка сохранения: ${result.error}`);
    }
  };
  
  // Обработчик загрузки состояния
  const handleLoadState = async () => {
    setStatusMessage('Загрузка...');
    
    const result = await loadState();
    
    if (result.success && result.data?.state) {
      setGameState(result.data.state);
      setStatusMessage(`Загружено успешно (${result.metrics?.duration}мс)`);
    } else {
      setStatusMessage(`Ошибка загрузки: ${result.error}`);
    }
  };
  
  // Обработчик сброса данных
  const handleResetData = async () => {
    if (window.confirm('Вы уверены, что хотите сбросить все данные?')) {
      setStatusMessage('Сброс данных...');
      
      const result = await resetAllData();
      
      if (result.success) {
        // Загружаем новое состояние (будет создано по умолчанию)
        const loadResult = await loadState();
        if (loadResult.success && loadResult.data?.state) {
          setGameState(loadResult.data.state);
        }
        
        setStatusMessage('Данные сброшены успешно');
      } else {
        setStatusMessage(`Ошибка сброса данных: ${result.error}`);
      }
    }
  };
  
  // Обработчик экспорта состояния
  const handleExportState = async () => {
    setStatusMessage('Экспорт состояния...');
    
    const exported = await exportStateToString();
    
    if (exported) {
      setExportedState(exported);
      setStatusMessage('Состояние экспортировано успешно');
    } else {
      setStatusMessage('Ошибка экспорта состояния');
    }
  };
  
  // Обработчик импорта состояния
  const handleImportState = async () => {
    if (!exportedState.trim()) {
      setStatusMessage('Введите экспортированное состояние');
      return;
    }
    
    setStatusMessage('Импорт состояния...');
    
    try {
      const result = await importStateFromString(exportedState);
      
      if (result.success && result.data?.state) {
        setGameState(result.data.state);
        setStatusMessage('Состояние импортировано успешно');
      } else {
        setStatusMessage(`Ошибка импорта: ${result.error}`);
      }
    } catch (error) {
      setStatusMessage(`Ошибка импорта: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  
  // Обработчик изменения автосохранения
  const handleAutoSaveChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = e.target.checked;
    setAutoSaveEnabled(enabled);
    setAutoSave(enabled);
  };
  
  // Обработчик изменения синхронизации
  const handleSyncChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = e.target.checked;
    setSyncEnabled(enabled);
    setSyncWithServer(enabled);
  };
  
  // Добавление ресурсов в тестовых целях
  const handleAddResources = () => {
    setGameState(prev => ({
      ...prev,
      inventory: {
        ...prev.inventory,
        snot: prev.inventory.snot + 100,
        snotCoins: prev.inventory.snotCoins + 10
      }
    }));
    
    setStatusMessage('Ресурсы добавлены. Не забудьте сохранить!');
  };
  
  // Повышение уровня в тестовых целях
  const handleLevelUp = () => {
    setGameState(prev => {
      // Создаем безопасную копию текущих улучшений с учетом возможного отсутствия clickPower
      const clickPower = prev.upgrades.clickPower || { level: 0, value: 0 };
      
      return {
        ...prev,
        inventory: {
          ...prev.inventory,
          containerCapacityLevel: prev.inventory.containerCapacityLevel + 1,
          containerCapacity: prev.inventory.containerCapacity + 100,
          fillingSpeedLevel: prev.inventory.fillingSpeedLevel + 1,
          fillingSpeed: prev.inventory.fillingSpeed + 2
        },
        upgrades: {
          ...prev.upgrades,
          clickPower: {
            ...clickPower,
            level: clickPower.level + 1,
            value: clickPower.value + 1
          }
        }
      };
    });
    
    setStatusMessage('Уровень повышен. Не забудьте сохранить!');
  };
  
  // Добавление достижения в тестовых целях
  const handleAddAchievement = () => {
    const achievements = gameState.achievements?.unlockedAchievements || [];
    const newAchievement = `achievement_${Date.now()}`;
    
    setGameState(prev => ({
      ...prev,
      achievements: {
        unlockedAchievements: [...achievements, newAchievement]
      }
    }));
    
    setStatusMessage('Достижение добавлено. Не забудьте сохранить!');
  };
  
  /**
   * Повышаем уровень улучшения clickPower
   */
  const handleUpgrade = () => {
    if (isLoading) return;
    
    setGameState(prev => {
      // Проверяем наличие clickPower и создаем безопасную копию
      const clickPower = prev.upgrades.clickPower || { level: 0, value: 0 };
      
      return {
        ...prev,
        upgrades: {
          ...prev.upgrades,
          clickPower: {
            ...clickPower,
            level: clickPower.level + 1,
            value: clickPower.value + 1
          }
        }
      };
    });
    
    setStatusMessage('Улучшение повышено. Не забудьте сохранить!');
  };
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Демонстрация системы сохранения</h2>
      
      <div className="mb-4 p-2 bg-gray-100 rounded">
        <p className="font-semibold">Статус: {isInitializing ? 'Инициализация...' : (isInitialized ? 'Готово' : 'Не инициализировано')}</p>
        <p className="text-sm">{statusMessage}</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-gray-50 p-4 rounded shadow">
          <h3 className="text-lg font-semibold mb-2">Управление сохранениями</h3>
          
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={handleSaveState}
              disabled={!isInitialized || isSaving}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {isSaving ? 'Сохранение...' : 'Сохранить'}
            </button>
            
            <button
              onClick={handleLoadState}
              disabled={!isInitialized || isLoading}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {isLoading ? 'Загрузка...' : 'Загрузить'}
            </button>
            
            <button
              onClick={handleResetData}
              disabled={!isInitialized}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              Сбросить данные
            </button>
          </div>
          
          <div className="mb-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={autoSaveEnabled}
                onChange={handleAutoSaveChange}
                disabled={!isInitialized}
                className="form-checkbox"
              />
              <span>Автосохранение</span>
            </label>
            
            <label className="flex items-center space-x-2 mt-2">
              <input
                type="checkbox"
                checked={syncEnabled}
                onChange={handleSyncChange}
                disabled={!isInitialized}
                className="form-checkbox"
              />
              <span>Синхронизация с сервером</span>
            </label>
          </div>
          
          <div className="border-t pt-4 mt-4">
            <h4 className="font-medium mb-2">Информация о сохранении:</h4>
            {saveInfo ? (
              <div className="text-sm">
                <p>Последнее сохранение: {saveInfo.lastSaved.toLocaleString()}</p>
                <p>Версия: {saveInfo.version}</p>
                <p>Количество сохранений: {saveInfo.saveCount}</p>
                <p>Локальная резервная копия: {saveInfo.hasLocalBackup ? 'Да' : 'Нет'}</p>
                <p>Синхронизировано: {saveInfo.hasSyncedBackup ? 'Да' : 'Нет'}</p>
                {saveInfo.lastSync && (
                  <p>Последняя синхронизация: {saveInfo.lastSync.toLocaleString()}</p>
                )}
              </div>
            ) : (
              <p className="text-sm italic">Нет данных о сохранении</p>
            )}
          </div>
        </div>
        
        <div className="bg-gray-50 p-4 rounded shadow">
          <h3 className="text-lg font-semibold mb-2">Текущее состояние</h3>
          
          <div className="mb-4">
            <h4 className="font-medium">Инвентарь:</h4>
            <ul className="text-sm ml-4">
              <li>Сопли: {gameState.inventory.snot}</li>
              <li>SnotCoins: {gameState.inventory.snotCoins}</li>
              <li>Емкость контейнера: {gameState.inventory.containerCapacity}</li>
              <li>Уровень емкости: {gameState.inventory.containerCapacityLevel}</li>
              <li>Скорость заполнения: {gameState.inventory.fillingSpeed}</li>
              <li>Уровень скорости: {gameState.inventory.fillingSpeedLevel}</li>
            </ul>
          </div>
          
          <div className="mb-4">
            <h4 className="font-medium">Улучшения:</h4>
            <ul className="text-sm ml-4">
              {Object.entries(gameState.upgrades).map(([key, upgrade]) => (
                <li key={key}>
                  {key}: Уровень {upgrade.level}, Значение {upgrade.value}
                </li>
              ))}
            </ul>
          </div>
          
          <div className="mb-4">
            <h4 className="font-medium">Достижения ({gameState.achievements?.unlockedAchievements.length || 0}):</h4>
            {gameState.achievements?.unlockedAchievements.length ? (
              <ul className="text-sm ml-4 max-h-20 overflow-y-auto">
                {gameState.achievements.unlockedAchievements.map((achievement, index) => (
                  <li key={index}>{achievement}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm italic">Нет достижений</p>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleAddResources}
              className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded text-sm"
            >
              + Ресурсы
            </button>
            
            <button
              onClick={handleLevelUp}
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded text-sm"
            >
              + Уровень
            </button>
            
            <button
              onClick={handleAddAchievement}
              className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1 rounded text-sm"
            >
              + Достижение
            </button>
          </div>
        </div>
      </div>
      
      <div className="border-t pt-4">
        <h3 className="text-lg font-semibold mb-2">Экспорт/Импорт</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <button
              onClick={handleExportState}
              disabled={!isInitialized}
              className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded mb-2 disabled:opacity-50"
            >
              Экспортировать состояние
            </button>
            
            <textarea
              value={exportedState}
              onChange={(e) => setExportedState(e.target.value)}
              className="w-full h-32 border rounded p-2 text-xs font-mono"
              placeholder="Экспортированное состояние появится здесь..."
              readOnly
            />
          </div>
          
          <div>
            <button
              onClick={handleImportState}
              disabled={!isInitialized || !exportedState}
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded mb-2 disabled:opacity-50"
            >
              Импортировать состояние
            </button>
            
            <textarea
              value={exportedState}
              onChange={(e) => setExportedState(e.target.value)}
              className="w-full h-32 border rounded p-2 text-xs font-mono"
              placeholder="Вставьте экспортированное состояние здесь..."
            />
          </div>
        </div>
      </div>
      
      {lastSaveResult || lastLoadResult ? (
        <div className="border-t pt-4 mt-4">
          <h3 className="text-lg font-semibold mb-2">Результаты последних операций</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lastSaveResult && (
              <div className="bg-gray-50 p-3 rounded">
                <h4 className="font-medium">Последнее сохранение:</h4>
                <div className="text-sm mt-1">
                  <p>Статус: {lastSaveResult.success ? 'Успешно' : 'Ошибка'}</p>
                  <p>Сообщение: {lastSaveResult.message}</p>
                  {lastSaveResult.error && <p className="text-red-500">Ошибка: {lastSaveResult.error}</p>}
                  {lastSaveResult.metrics && (
                    <>
                      <p>Длительность: {lastSaveResult.metrics.duration}мс</p>
                      {lastSaveResult.metrics.dataSize && (
                        <p>Размер данных: {Math.round(lastSaveResult.metrics.dataSize / 1024 * 100) / 100} КБ</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
            
            {lastLoadResult && (
              <div className="bg-gray-50 p-3 rounded">
                <h4 className="font-medium">Последняя загрузка:</h4>
                <div className="text-sm mt-1">
                  <p>Статус: {lastLoadResult.success ? 'Успешно' : 'Ошибка'}</p>
                  <p>Сообщение: {lastLoadResult.message}</p>
                  {lastLoadResult.error && <p className="text-red-500">Ошибка: {lastLoadResult.error}</p>}
                  {lastLoadResult.data?.source && <p>Источник: {lastLoadResult.data.source}</p>}
                  {lastLoadResult.metrics && (
                    <>
                      <p>Длительность: {lastLoadResult.metrics.duration}мс</p>
                      {lastLoadResult.metrics.dataSize && (
                        <p>Размер данных: {Math.round(lastLoadResult.metrics.dataSize / 1024 * 100) / 100} КБ</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default SaveSystemDemo; 