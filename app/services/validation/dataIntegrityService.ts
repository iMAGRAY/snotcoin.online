import type { ExtendedGameState, GameState } from '../../types/gameTypes';
import { createInitialGameState } from "../../constants/gameConstants";

/**
 * Сервис для проверки и валидации целостности данных
 * Проверяет целостность состояния игры и исправляет поврежденные данные
 */

/**
 * Восстанавливает структуру игрового состояния, заполняя отсутствующие или поврежденные поля
 * @param gameState Состояние игры, которое нужно проверить и исправить
 * @returns Исправленное состояние игры
 */
export const repairGameState = (gameState: ExtendedGameState): ExtendedGameState => {
  try {
    const repairedState: ExtendedGameState = { ...gameState };
    const repairedFields: string[] = [];
    
    // Проверяем и восстанавливаем инвентарь
    if (!repairedState.inventory) {
      repairedState.inventory = {
        snot: 0,
        snotCoins: 0,
        containerCapacity: 100,
        containerCapacityLevel: 1,
        fillingSpeed: 1,
        fillingSpeedLevel: 1,
        collectionEfficiency: 1,
        containerSnot: 0,
        Cap: 100,
        lastUpdateTimestamp: Date.now()
      };
      repairedFields.push('inventory');
    } else {
      // Проверяем и восстанавливаем поля инвентаря
      const inventoryFields = [
        { field: 'snot', defaultValue: 0 },
        { field: 'snotCoins', defaultValue: 0 },
        { field: 'containerCapacity', defaultValue: 100 },
        { field: 'containerCapacityLevel', defaultValue: 1 },
        { field: 'fillingSpeed', defaultValue: 1 },
        { field: 'fillingSpeedLevel', defaultValue: 1 },
        { field: 'collectionEfficiency', defaultValue: 1 },
        { field: 'containerSnot', defaultValue: 0 },
        { field: 'lastUpdateTimestamp', defaultValue: Date.now() }
      ];
      
      for (const { field, defaultValue } of inventoryFields) {
        if ((repairedState.inventory as any)[field] === undefined || 
            typeof (repairedState.inventory as any)[field] !== 'number') {
          (repairedState.inventory as any)[field] = defaultValue;
          repairedFields.push(`inventory.${field}`);
        }
      }
      
      // Особая обработка для Cap
      if (repairedState.inventory.Cap === undefined) {
        repairedState.inventory.Cap = repairedState.inventory.containerCapacity || 100;
        repairedFields.push('inventory.Cap');
      }
    }
    
    // Проверяем и восстанавливаем контейнер
    if (!repairedState.container) {
      repairedState.container = {
        level: 1,
        capacity: 100,
        currentAmount: 0,
        fillRate: 1,
        currentFill: 0
      };
      repairedFields.push('container');
    } else {
      // Проверяем и восстанавливаем поля контейнера
      const containerFields = [
        { field: 'level', defaultValue: 1 },
        { field: 'capacity', defaultValue: 100 },
        { field: 'currentAmount', defaultValue: 0 },
        { field: 'fillRate', defaultValue: 1 },
        { field: 'currentFill', defaultValue: 0 }
      ];
      
      for (const { field, defaultValue } of containerFields) {
        if ((repairedState.container as any)[field] === undefined || 
            typeof (repairedState.container as any)[field] !== 'number') {
          (repairedState.container as any)[field] = defaultValue;
          repairedFields.push(`container.${field}`);
        }
      }
    }
    
    // Проверяем и восстанавливаем улучшения
    if (!repairedState.upgrades) {
      repairedState.upgrades = {
        containerLevel: 1,
        fillingSpeedLevel: 1,
        collectionEfficiencyLevel: 1,
        clickPower: { level: 1, value: 1 },
        passiveIncome: { level: 1, value: 0.1 }
      };
      repairedFields.push('upgrades');
    } else {
      // Проверяем и восстанавливаем поля улучшений
      const upgradesFields = [
        { field: 'containerLevel', defaultValue: 1 },
        { field: 'fillingSpeedLevel', defaultValue: 1 },
        { field: 'collectionEfficiencyLevel', defaultValue: 1 }
      ];
      
      for (const { field, defaultValue } of upgradesFields) {
        if ((repairedState.upgrades as any)[field] === undefined || 
            typeof (repairedState.upgrades as any)[field] !== 'number') {
          (repairedState.upgrades as any)[field] = defaultValue;
          repairedFields.push(`upgrades.${field}`);
        }
      }
      
      // Проверяем и восстанавливаем clickPower
      if (!repairedState.upgrades.clickPower || 
          typeof repairedState.upgrades.clickPower !== 'object') {
        repairedState.upgrades.clickPower = { level: 1, value: 1 };
        repairedFields.push('upgrades.clickPower');
      } else {
        if (typeof repairedState.upgrades.clickPower.level !== 'number') {
          repairedState.upgrades.clickPower.level = 1;
          repairedFields.push('upgrades.clickPower.level');
        }
        if (typeof repairedState.upgrades.clickPower.value !== 'number') {
          repairedState.upgrades.clickPower.value = 1;
          repairedFields.push('upgrades.clickPower.value');
        }
      }
      
      // Проверяем и восстанавливаем passiveIncome
      if (!repairedState.upgrades.passiveIncome || 
          typeof repairedState.upgrades.passiveIncome !== 'object') {
        repairedState.upgrades.passiveIncome = { level: 1, value: 0.1 };
        repairedFields.push('upgrades.passiveIncome');
      } else {
        if (typeof repairedState.upgrades.passiveIncome.level !== 'number') {
          repairedState.upgrades.passiveIncome.level = 1;
          repairedFields.push('upgrades.passiveIncome.level');
        }
        if (typeof repairedState.upgrades.passiveIncome.value !== 'number') {
          repairedState.upgrades.passiveIncome.value = 0.1;
          repairedFields.push('upgrades.passiveIncome.value');
        }
      }
    }
    
    // Проверяем и восстанавливаем достижения
    if (!repairedState.achievements) {
      repairedState.achievements = { unlockedAchievements: [] };
      repairedFields.push('achievements');
    } else if (!Array.isArray(repairedState.achievements.unlockedAchievements)) {
      repairedState.achievements.unlockedAchievements = [];
      repairedFields.push('achievements.unlockedAchievements');
    }
    
    // Проверяем и восстанавливаем предметы
    if (!repairedState.items) {
      repairedState.items = [];
      repairedFields.push('items');
    } else if (!Array.isArray(repairedState.items)) {
      repairedState.items = [];
      repairedFields.push('items');
    }
    
    // Проверяем и восстанавливаем настройки
    if (!repairedState.settings) {
      repairedState.settings = {
        language: 'en',
        theme: 'light',
        notifications: true,
        tutorialCompleted: false,
        musicEnabled: true,
        soundEnabled: true,
        notificationsEnabled: true
      };
      repairedFields.push('settings');
    } else {
      // Проверяем и восстанавливаем поля настроек
      const settingsFields = [
        { field: 'language', defaultValue: 'en', type: 'string' },
        { field: 'theme', defaultValue: 'light', type: 'string' },
        { field: 'notifications', defaultValue: true, type: 'boolean' },
        { field: 'tutorialCompleted', defaultValue: false, type: 'boolean' },
        { field: 'musicEnabled', defaultValue: true, type: 'boolean' },
        { field: 'soundEnabled', defaultValue: true, type: 'boolean' },
        { field: 'notificationsEnabled', defaultValue: true, type: 'boolean' }
      ];
      
      for (const { field, defaultValue, type } of settingsFields) {
        if ((repairedState.settings as any)[field] === undefined || 
            typeof (repairedState.settings as any)[field] !== type) {
          (repairedState.settings as any)[field] = defaultValue;
          repairedFields.push(`settings.${field}`);
        }
      }
    }
    
    // Проверяем и восстанавливаем настройки звука
    if (!repairedState.soundSettings) {
      repairedState.soundSettings = {
        musicVolume: 0.5,
        soundVolume: 0.5,
        notificationVolume: 0.5,
        clickVolume: 0.5,
        effectsVolume: 0.5,
        backgroundMusicVolume: 0.3,
        isMuted: false,
        isEffectsMuted: false,
        isBackgroundMusicMuted: false
      };
      repairedFields.push('soundSettings');
    } else {
      // Проверяем и восстанавливаем поля настроек звука
      const soundSettingsFields = [
        { field: 'musicVolume', defaultValue: 0.5 },
        { field: 'soundVolume', defaultValue: 0.5 },
        { field: 'notificationVolume', defaultValue: 0.5 },
        { field: 'clickVolume', defaultValue: 0.5 },
        { field: 'effectsVolume', defaultValue: 0.5 },
        { field: 'backgroundMusicVolume', defaultValue: 0.3 },
        { field: 'isMuted', defaultValue: false },
        { field: 'isEffectsMuted', defaultValue: false },
        { field: 'isBackgroundMusicMuted', defaultValue: false }
      ];
      
      for (const { field, defaultValue } of soundSettingsFields) {
        if ((repairedState.soundSettings as any)[field] === undefined || 
            typeof (repairedState.soundSettings as any)[field] !== typeof defaultValue) {
          (repairedState.soundSettings as any)[field] = defaultValue;
          repairedFields.push(`soundSettings.${field}`);
        }
      }
    }
    
    // Проверяем и восстанавливаем основные игровые поля
    const gameStateFields = [
      { field: 'activeTab', defaultValue: 'main', type: 'string' },
      { field: 'hideInterface', defaultValue: false, type: 'boolean' },
      { field: 'isPlaying', defaultValue: false, type: 'boolean' },
      { field: 'isLoading', defaultValue: false, type: 'boolean' },
      { field: 'containerLevel', defaultValue: 1, type: 'number' },
      { field: 'fillingSpeed', defaultValue: 1, type: 'number' },
      { field: 'containerSnot', defaultValue: 0, type: 'number' },
      { field: 'gameStarted', defaultValue: true, type: 'boolean' },
      { field: 'highestLevel', defaultValue: 1, type: 'number' },
      { field: 'consecutiveLoginDays', defaultValue: 0, type: 'number' }
    ];
    
    for (const { field, defaultValue, type } of gameStateFields) {
      if ((repairedState as any)[field] === undefined || 
          typeof (repairedState as any)[field] !== type) {
        (repairedState as any)[field] = defaultValue;
        repairedFields.push(field);
      }
    }
    
    // Проверяем и восстанавливаем метаданные
    if (!repairedState._saveVersion) {
      repairedState._saveVersion = 1;
      repairedFields.push('_saveVersion');
    }
    
    if (!repairedState._lastModified) {
      repairedState._lastModified = Date.now();
      repairedFields.push('_lastModified');
    }
    
    // Добавляем информацию о восстановлении данных
    if (repairedFields.length > 0) {
      repairedState._wasRepaired = true;
      repairedState._repairedAt = Date.now();
      repairedState._repairedFields = repairedFields;
      
      console.warn(`[DataIntegrity] Восстановлены ${repairedFields.length} полей: ${repairedFields.join(', ')}`);
    }
    
    return repairedState;
  } catch (error) {
    console.error('[DataIntegrity] Ошибка при восстановлении состояния игры:', error);
    
    // В случае ошибки возвращаем исходное состояние
    return gameState;
  }
};

/**
 * Валидирует загруженное игровое состояние
 * @param state Игровое состояние
 * @param userId ID пользователя
 * @returns Валидированное состояние игры
 */
export const validateLoadedGameState = (
  state: ExtendedGameState,
  userId: string
): ExtendedGameState => {
  // Проверяем наличие состояния
  if (!state) {
    console.error('[DataIntegrity] Загруженное состояние отсутствует');
    return createDefaultGameState(userId);
  }
  
  try {
    // Проверяем идентификатор пользователя
    if (state._userId && state._userId !== userId) {
      console.warn(`[DataIntegrity] Несоответствие ID пользователя: ${state._userId} != ${userId}`);
      state._userId = userId;
    }
    
    // Проверяем целостность данных
    if (!checkDataIntegrity(state)) {
      console.warn('[DataIntegrity] Загруженное состояние повреждено, выполняем восстановление');
      
      // Восстанавливаем поврежденные данные
      const repairedState = repairGameState(state);
      
      // Обновляем идентификатор пользователя
      repairedState._userId = userId;
      
      return repairedState;
    }
    
    return state;
  } catch (error) {
    console.error('[DataIntegrity] Ошибка при валидации загруженного состояния:', error);
    return createDefaultGameState(userId);
  }
};

/**
 * Создает состояние игры по умолчанию
 * @param userId ID пользователя
 * @returns Состояние игры по умолчанию
 */
export const createDefaultGameState = (userId: string): ExtendedGameState => {
  const now = Date.now();
  
  return {
    // Инвентарь
    inventory: {
      snot: 0,
      snotCoins: 0,
      containerCapacity: 100,
      containerCapacityLevel: 1,
      fillingSpeed: 1,
      fillingSpeedLevel: 1,
      collectionEfficiency: 1,
      containerSnot: 0,
      Cap: 0,
    },
    
    // Контейнер
    container: {
      level: 1,
      capacity: 100,
      currentAmount: 0,
      fillRate: 1,
      currentFill: 0
    },
    
    // Улучшения
    upgrades: {
      containerLevel: 1,
      fillingSpeedLevel: 1,
      collectionEfficiencyLevel: 1,
      clickPower: { level: 1, value: 1 },
      passiveIncome: { level: 1, value: 0.1 }
    },
    
    // Предметы и достижения
    items: [],
    achievements: { unlockedAchievements: [] },
    
    // Настройки
    settings: {
      language: 'en',
      theme: 'light',
      notifications: true,
      tutorialCompleted: false,
      musicEnabled: true,
      soundEnabled: true,
      notificationsEnabled: true
    },
    
    // Настройки звука
    soundSettings: {
      musicVolume: 0.5,
      soundVolume: 0.5,
      notificationVolume: 0.5,
      clickVolume: 0.5,
      effectsVolume: 0.5,
      backgroundMusicVolume: 0.3,
      isMuted: false,
      isEffectsMuted: false,
      isBackgroundMusicMuted: false
    },
    
    // Статистика
    stats: {
      clickCount: 0,
      playTime: 0,
      startDate: new Date().toISOString(),
      highestLevel: 1,
      totalSnot: 0,
      totalSnotCoins: 0,
      consecutiveLoginDays: 0
    },
    
    // Базовые игровые параметры
    activeTab: 'main',
    user: null,
    validationStatus: "pending",
    hideInterface: false,
    isPlaying: false,
    isLoading: false,
    containerLevel: 1,
    fillingSpeed: 1,
    containerSnot: 0,
    gameStarted: true,
    highestLevel: 1,
    consecutiveLoginDays: 0,
    
    // Метаданные
    _saveVersion: 1,
    _lastModified: now,
    _userId: userId,
    _lastSaved: new Date().toISOString()
  };
};

/**
 * Проверяет, является ли объект игровым состоянием
 * @param data Проверяемый объект
 * @returns true если объект является игровым состоянием, иначе false
 */
export const validateGameData = (data: any): boolean => {
  if (!data) return false;
  
  try {
    // Проверяем наличие критических полей
    if (!data.inventory || !data.container || !data.upgrades) {
      return false;
    }
    
    // Проверяем типы полей
    if (typeof data.inventory !== 'object' || 
        typeof data.container !== 'object' || 
        typeof data.upgrades !== 'object') {
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('[DataIntegrity] Ошибка при валидации игровых данных:', error);
    return false;
  }
};

/**
 * Восстанавливает данные из кэша
 * @param userId ID пользователя
 * @param gameState Текущее состояние
 * @param cachedState Кэшированное состояние
 * @returns Восстановленное состояние
 */
export function restoreFromCache(
  gameState: ExtendedGameState, 
  cachedState: ExtendedGameState
): ExtendedGameState {
  try {
    // Если кэшированные данные также повреждены, не используем их
    if (!checkDataIntegrity(cachedState)) {
      console.warn(`[DataIntegrityService] Кэшированные данные также повреждены, используем базовое состояние`);
      return gameState; // Возвращаем исходное состояние
    }
    
    // Создаем новый объект, сохраняя все имеющиеся метаданные
    const restoredState = {
      ...gameState, // Сохраняем все существующие поля
      // Заменяем критические поля из кэша
      inventory: { ...cachedState.inventory },
      container: { ...cachedState.container },
      upgrades: { ...cachedState.upgrades }
    } as ExtendedGameState; // Используем приведение типов для дополнительных полей
    
    // Добавляем метаданные через приведение типов
    (restoredState as any)._isRestored = true;
    (restoredState as any)._restoredAt = Date.now();
    
    return restoredState;
  } catch (error) {
    console.error(`[DataIntegrityService] Ошибка при восстановлении из кэша:`, error);
    return gameState;
  }
}

/**
 * Проверяет целостность данных игрового состояния
 * @param state Состояние игры
 * @returns true если данные целостны, иначе false
 */
export function checkDataIntegrity(state: ExtendedGameState): boolean {
  try {
    // Проверяем наличие основных полей
    if (!state || typeof state !== 'object') {
      console.error('[DataIntegrity] Некорректное состояние игры');
      return false;
    }
    
    // Проверяем наличие userId
    if (!state._userId) {
      console.error('[DataIntegrity] Отсутствует userId в состоянии игры');
      return false;
    }
    
    // Проверяем наличие обязательных полей
    if (!state.inventory || !state.upgrades) {
      console.error('[DataIntegrity] Отсутствуют обязательные поля в состоянии игры');
      return false;
    }
    
    // Проверяем значения в инвентаре
    if (typeof state.inventory.snot !== 'number' || 
        typeof state.inventory.snotCoins !== 'number') {
      console.error('[DataIntegrity] Некорректные данные инвентаря');
      return false;
    }
    
    // Проверка версии сохранения
    if (typeof state._saveVersion !== 'number') {
      console.error('[DataIntegrity] Отсутствует или некорректная версия сохранения');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('[DataIntegrity] Ошибка при проверке целостности данных:', error);
    return false;
  }
} 