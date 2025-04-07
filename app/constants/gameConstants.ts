/**
 * Константы и начальные состояния для игры
 */

import { GameState } from '../context/GameContext';
import { Inventory } from '../types/inventory';

/**
 * Создает начальное состояние игры
 * @param userId ID пользователя
 * @returns Начальное состояние игры
 */
export function createInitialGameState(userId: string): GameState {
  const now = new Date();
  const currentTimeMs = now.getTime();
  
  // Попытка восстановить сохраненное значение snot из sessionStorage
  let initialSnot = 0.1; // Значение по умолчанию
  let initialSnotCoins = 0;
  let initialContainerSnot = 0.05;
  
  // Функция выполняется только в браузере
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      // Проверяем наличие резервной копии в sessionStorage
      const backupKey = `snot_backup_${userId}`;
      const backupData = sessionStorage.getItem(backupKey);
      
      if (backupData) {
        const backup = JSON.parse(backupData);
        
        // Проверяем, что значение snot в backup - число
        if (backup && typeof backup.snot === 'number' && !isNaN(backup.snot)) {
          console.log('[createInitialGameState] Найдена резервная копия snot:', {
            snot: backup.snot,
            backupTime: new Date(backup.timestamp).toISOString()
          });
          
          initialSnot = backup.snot;
        }
      }
    } catch (error) {
      // Игнорируем ошибки при проверке сохранений
      console.warn('[createInitialGameState] Ошибка при проверке резервной копии:', error);
    }
  }
  
  // Гарантируем, что все значения являются числами
  initialSnot = Number(initialSnot) || 0.1;
  initialSnotCoins = Number(initialSnotCoins) || 0;
  initialContainerSnot = Number(initialContainerSnot) || 0.05;
  
  return {
    // Мета-информация
    _userId: userId,
    _saveVersion: 1,
    _lastSaved: now.toISOString(),
    _lastModified: currentTimeMs,
    _createdAt: now.toISOString(),
    _wasRepaired: false,
    _repairedAt: currentTimeMs,
    _repairedFields: [],
    _tempData: null,
    _isSavingInProgress: false,
    _skipSave: false,
    _lastSaveError: null,
    _isBeforeUnloadSave: false,
    _isRestoredFromBackup: false,
    _isInitialState: true,
    _lastActionTime: now.toISOString(),
    _lastAction: null,
    
    // Пользовательские данные
    user: {
      username: null,
      displayName: null,
      farcaster_fid: null,
      farcaster_username: null,
      farcaster_displayname: null,
      farcaster_pfp: null,
      pfp: null,
      fid: null,
      verified: null,
      metadata: {}
    },
    
    // Игровой инвентарь
    inventory: {
      snot: initialSnot,
      snotCoins: initialSnotCoins,
      containerCapacity: 1,
      containerSnot: initialContainerSnot,
      fillingSpeed: 0.01, // Изменено с 1 на 0.01, чтобы соответствовало createDefaultGameState
      containerCapacityLevel: 1,
      fillingSpeedLevel: 1,
      collectionEfficiency: 1.0,
      lastUpdateTimestamp: currentTimeMs
    },
    
    // Контейнер
    container: {
      level: 1,
      capacity: 1,
      currentAmount: 0,
      fillRate: 1,
      currentFill: 0
    },
    
    // Улучшения
    upgrades: {
      clickPower: {
        level: 1,
        value: 1
      },
      passiveIncome: {
        level: 0,
        value: 0
      },
      collectionEfficiencyLevel: 0,
      containerLevel: 1,
      fillingSpeedLevel: 1
    },
    
    // Логи
    logs: [],
    
    // Аналитика
    analytics: null,
    
    // Предметы
    items: [],
    
    // Достижения
    achievements: {
      unlockedAchievements: []
    },
    
    // Статистика
    highestLevel: 1,
    stats: {
      clickCount: 0,
      playTime: 0,
      startDate: now.toISOString(),
      highestLevel: 1,
      totalSnot: 0,
      totalSnotCoins: 0,
      consecutiveLoginDays: 0
    },
    
    // Последовательные дни входа
    consecutiveLoginDays: 0,
    
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
      backgroundMusicVolume: 0.5,
      isMuted: false,
      isEffectsMuted: false,
      isBackgroundMusicMuted: false
    },
    
    // Игровой интерфейс
    hideInterface: false,
    activeTab: 'laboratory',
    fillingSpeed: 0.01, // Синхронизировано с inventory.fillingSpeed
    containerLevel: 1,
    isPlaying: false,
    validationStatus: 'pending',
    lastValidation: now.toISOString(),
    gameStarted: false,
    isLoading: false
  };
}

/**
 * Время автосохранения в миллисекундах
 */
export const AUTO_SAVE_INTERVAL = 15000;

/**
 * Минимальный интервал между ручными сохранениями
 */
export const MIN_SAVE_INTERVAL = 2000;

/**
 * Константы для игры
 */
export const GAME_VERSION = 1;

/**
 * Начальное состояние игры
 */
export const initialState: GameState = {
  user: null,
  inventory: {
    snot: 0.1,
    snotCoins: 0,
    containerSnot: 0.05,
    containerCapacity: 1,
    containerCapacityLevel: 1,
    fillingSpeed: 0.01, // Обновлено для соответствия с createInitialGameState
    fillingSpeedLevel: 1,
    collectionEfficiency: 1,
    lastUpdateTimestamp: Date.now()
  },
  container: {
    level: 1,
    capacity: 1,
    currentAmount: 0,
    fillRate: 1,
    currentFill: 0
  },
  upgrades: {
    containerLevel: 1,
    fillingSpeedLevel: 1,
    clickPower: { level: 1, value: 1 },
    passiveIncome: { level: 1, value: 0.1 },
    collectionEfficiencyLevel: 1
  },
  _saveVersion: 1,
  _lastSaved: new Date().toISOString(),
  _userId: '',
  _lastModified: Date.now(),
  _createdAt: new Date().toISOString(),
  _wasRepaired: false,
  _repairedAt: Date.now(),
  _repairedFields: [],
  _tempData: null,
  _isSavingInProgress: false,
  _skipSave: false,
  _lastSaveError: null,
  _isBeforeUnloadSave: false,
  _isRestoredFromBackup: false,
  _isInitialState: true,
  _lastActionTime: new Date().toISOString(),
  _lastAction: 'RESET_GAME_STATE',
  logs: [],
  analytics: null,
  items: [],
  achievements: { unlockedAchievements: [] },
  highestLevel: 1,
  stats: {
    clickCount: 0,
    playTime: 0,
    startDate: new Date().toISOString(),
    highestLevel: 1,
    totalSnot: 0,
    totalSnotCoins: 0,
    consecutiveLoginDays: 0
  },
  consecutiveLoginDays: 0,
  settings: {
    language: 'en',
    theme: 'light',
    notifications: true,
    tutorialCompleted: false,
    musicEnabled: true,
    soundEnabled: true,
    notificationsEnabled: true
  },
  soundSettings: {
    musicVolume: 0.5,
    soundVolume: 0.5,
    notificationVolume: 0.5,
    clickVolume: 0.5,
    effectsVolume: 0.5,
    backgroundMusicVolume: 0.5,
    isMuted: false,
    isEffectsMuted: false,
    isBackgroundMusicMuted: false
  },
  hideInterface: false,
  activeTab: 'laboratory',
  fillingSpeed: 1,
  containerLevel: 1,
  isPlaying: false,
  validationStatus: 'pending',
  lastValidation: new Date().toISOString(),
  gameStarted: false,
  isLoading: false
};

/**
 * Стоимость улучшений
 */
export const UPGRADE_COSTS = {
  containerCapacity: [
    { level: 1, cost: 0 },
    { level: 2, cost: 100 },
    { level: 3, cost: 250 },
    { level: 4, cost: 500 },
    { level: 5, cost: 1000 }
  ],
  fillingSpeed: [
    { level: 1, cost: 0 },
    { level: 2, cost: 150 },
    { level: 3, cost: 350 },
    { level: 4, cost: 700 },
    { level: 5, cost: 1500 }
  ],
  collectionEfficiency: [
    { level: 1, cost: 0 },
    { level: 2, cost: 200 },
    { level: 3, cost: 450 },
    { level: 4, cost: 900 },
    { level: 5, cost: 2000 }
  ],
  clickPower: [
    { level: 1, cost: 0 },
    { level: 2, cost: 50 },
    { level: 3, cost: 150 },
    { level: 4, cost: 300 },
    { level: 5, cost: 600 }
  ],
  passiveIncome: [
    { level: 0, cost: 0 },
    { level: 1, cost: 300 },
    { level: 2, cost: 600 },
    { level: 3, cost: 1200 },
    { level: 4, cost: 2400 },
    { level: 5, cost: 4800 }
  ]
};

/**
 * Значения улучшений
 */
export const UPGRADE_VALUES = {
  containerCapacity: [1, 2, 3, 5, 8, 12],
  fillingSpeed: [1, 1.5, 2, 3, 4, 6],
  collectionEfficiency: [1, 1.2, 1.5, 1.8, 2.2, 3],
  clickPower: [1, 2, 3, 5, 8, 12],
  passiveIncome: [0, 0.1, 0.3, 0.5, 1, 2]
};

/**
 * Достижения
 */
export const ACHIEVEMENTS = [
  { id: 'first_snot', name: 'Первая сопля', description: 'Получите первую соплю', requirement: 1 },
  { id: 'snot_10', name: 'Соплезбиратель', description: 'Соберите 10 соплей', requirement: 10 },
  { id: 'snot_100', name: 'Соплезбиратель+', description: 'Соберите 100 соплей', requirement: 100 },
  { id: 'snot_1000', name: 'Соплезбиратель++', description: 'Соберите 1000 соплей', requirement: 1000 },
  { id: 'coin_10', name: 'Первые монеты', description: 'Соберите 10 монет', requirement: 10 },
  { id: 'coin_100', name: 'Копилка', description: 'Соберите 100 монет', requirement: 100 },
  { id: 'coin_1000', name: 'Богатство', description: 'Соберите 1000 монет', requirement: 1000 },
  { id: 'max_container', name: 'Максимальный контейнер', description: 'Улучшите контейнер до максимума', requirement: 5 },
  { id: 'max_speed', name: 'Максимальная скорость', description: 'Улучшите скорость до максимума', requirement: 5 },
  { id: 'max_efficiency', name: 'Максимальная эффективность', description: 'Улучшите эффективность до максимума', requirement: 5 }
];

export const SAVE_INTERVALS = {
  MIN_SAVE_INTERVAL: 10000,
  MIN_FORCE_SAVE_INTERVAL: 5000,
  MIN_LOAD_INTERVAL: 2000,
  SAVE_RETRY_DELAY: 3000,
  SAVE_DEBOUNCE_DELAY: 10000
};

export const THRESHOLDS = {
  snot: 10,
  snotCoins: 1,
  containerAmount: 5
};

export const MAX_RETRIES = 3;

export const RESOURCES = {
  DEFAULTS: {
    MIN_LEVEL: 1,
    MIN_CAPACITY: 1,
    MIN_FILLING_SPEED: 1,
    COLLECTION_EFFICIENCY: 1
  }
};

export const DEFAULT_INVENTORY: Inventory = {
  snot: 0.1,
  snotCoins: 0,
  containerSnot: 0.05,
  containerCapacity: 1,
  containerCapacityLevel: 1,
  fillingSpeed: 0.01, // Обновлено для соответствия начальным значениям
  fillingSpeedLevel: 1,
  collectionEfficiency: 1,
  lastUpdateTimestamp: Date.now()
};

// Константы для обновления ресурсов
export const FILL_RATES = {
  // На уровне 1 заполняем 1 единицу snotа за 12 часов
  BASE_FILL_RATE: 1, // Базовый уровень, при котором 1 единица snot заполняется за 12 часов
  
  // Базовая скорость заполнения в единицах в секунду для уровня 1
  // 1 snot за 12 часов = 1 / (12 * 3600) snot в секунду
  BASE_CONTAINER_FILL_RATE: 1 / (7.2 * 360), // Увеличено в 100 раз для более быстрого заполнения
  
  // Коэффициент улучшения на каждом уровне (значение fillingSpeed)
  LEVEL_1_FILL_SPEED: 1,    // 1 snot за 12 часов
  LEVEL_2_FILL_SPEED: 1.5,  // 1 snot за 8 часов
  LEVEL_3_FILL_SPEED: 2,    // 1 snot за 6 часов
  LEVEL_4_FILL_SPEED: 3,    // 1 snot за 4 часа
  LEVEL_5_FILL_SPEED: 4,    // 1 snot за 3 часа
  
  // Время полного заполнения на 1 уровне в часах
  FULL_CONTAINER_FILL_TIME_HOURS: 12
};

/**
 * Рассчитывает емкость контейнера на основе уровня
 * @param level Уровень контейнера
 * @returns Емкость контейнера
 */
function calculateContainerCapacity(level: number): number {
  // Проверяем, что уровень находится в допустимом диапазоне
  const safeLevel = Math.max(1, Math.min(level, UPGRADE_VALUES.containerCapacity.length));
  
  // Получаем емкость на основе уровня из массива значений
  const capacity = UPGRADE_VALUES.containerCapacity[safeLevel - 1];
  
  // Проверяем, что значение определено
  return typeof capacity === 'number' ? capacity : 1;
} 