/**
 * Утилита для умного слияния состояний игры при конфликтах версий
 */
import { 
  ExtendedGameState, 
  Inventory, 
  InventoryItem, 
  GameStateStats, 
  Achievements as GameAchievements,
  Container 
} from '../types/gameTypes';
import { apiLogger as logger } from '../lib/logger';

/**
 * Типы стратегий слияния
 */
export enum MergeStrategy {
  CLIENT_WINS = 'CLIENT_WINS',     // Приоритет имеет клиентское состояние
  SERVER_WINS = 'SERVER_WINS',     // Приоритет имеет серверное состояние
  SMART_MERGE = 'SMART_MERGE',     // Умное слияние по полям
  REJECT = 'REJECT',                // Отклонение слияния (ошибка)
  LATEST_WINS = 'latest_wins',
  MANUAL_RESOLVE = 'manual_resolve'
}

/**
 * Опции для слияния состояний
 */
export interface MergeOptions {
  strategy: MergeStrategy;
  preferHigherValues?: boolean;    // Предпочитать более высокие значения при конфликтах числовых полей
  keepHistory?: boolean;           // Сохранять историю слияний
  generateDelta?: boolean;         // Генерировать дельту изменений
  ignoreFields?: string[];         // Поля, которые не нужно сливать
  forceFields?: string[];          // Поля, которые всегда берутся из newState
}

/**
 * Результат слияния состояний
 */
export interface MergeResult {
  _userId?: string;
  _saveVersion?: number;
  _savedAt?: string;
  _mergedAt?: string;
  _saveReason?: string;
  state: ExtendedGameState;
  conflicts: {
    total: number;
    resolved: number;
    fields: string[];
  };
  changes: {
    total: number;
    fields: string[];
  };
  strategy: MergeStrategy;
}

/**
 * Базовые интерфейсы для объектов игры
 */
interface Quest {
  id: string;
  progress: number;
  completed: boolean;
  completed_at?: string;
  started_at?: string;
  steps?: Record<string, boolean>;
  metadata?: Record<string, any>;
}

interface Achievement {
  id: string;
  progress: number;
  unlocked: boolean;
  unlocked_at?: string;
  metadata?: Record<string, any>;
}

/**
 * Умное слияние состояний игры
 */
export function mergeGameStates(
  oldState: ExtendedGameState,
  newState: ExtendedGameState,
  options: MergeOptions = { strategy: MergeStrategy.SMART_MERGE }
): MergeResult {
  const startTime = performance.now();
  
  // Инициализируем результат
  const result: MergeResult = {
    state: { ...oldState },
    conflicts: {
      total: 0,
      resolved: 0,
      fields: []
    },
    changes: {
      total: 0,
      fields: []
    },
    strategy: options.strategy
  };
  
  // Проверяем стратегию слияния
  if (options.strategy === MergeStrategy.CLIENT_WINS) {
    result.state = { ...newState };
    result.changes.total = 1;
    result.changes.fields = ['*all'];
    
    logger.info('Применена стратегия CLIENT_WINS', { 
      oldVersion: oldState._saveVersion,
      newVersion: newState._saveVersion
    });
    
    return result;
  }
  
  if (options.strategy === MergeStrategy.SERVER_WINS) {
    // Ничего не меняем, возвращаем старое состояние
    logger.info('Применена стратегия SERVER_WINS', { 
      oldVersion: oldState._saveVersion,
      newVersion: newState._saveVersion
    });
    
    return result;
  }
  
  if (options.strategy === MergeStrategy.REJECT) {
    throw new Error('Слияние отклонено согласно стратегии REJECT');
  }
  
  // Идем по основным полям игры и применяем специфические стратегии слияния
  
  // Слияние инвентаря
  if (oldState.inventory && newState.inventory) {
    result.state.inventory = mergeInventoryObjects(oldState.inventory, newState.inventory, options);
    result.changes.fields.push('inventory');
    result.changes.total++;
  }
  
  // Слияние контейнера
  if (oldState.container && newState.container) {
    result.state.container = mergeContainerObjects(oldState.container, newState.container, options);
    result.changes.fields.push('container');
    result.changes.total++;
  }
  
  // Слияние квестов
  if (oldState.quests && newState.quests) {
    const [mergedQuests, questConflicts] = mergeQuests(oldState.quests, newState.quests, options);
    result.state.quests = mergedQuests;
    result.conflicts.total += questConflicts;
    result.conflicts.resolved += questConflicts;
    result.conflicts.fields.push('quests');
    result.changes.fields.push('quests');
    result.changes.total++;
  }
  
  // Слияние достижений
  if (oldState.achievements && newState.achievements) {
    result.state.achievements = mergeAchievements(oldState.achievements, newState.achievements, options);
    result.changes.fields.push('achievements');
    result.changes.total++;
  }
  
  // Слияние статистики
  if (oldState.stats && newState.stats) {
    const [mergedStats, statsConflicts] = mergeStats(oldState.stats, newState.stats, options);
    result.state.stats = mergedStats;
    result.conflicts.total += statsConflicts;
    result.conflicts.resolved += statsConflicts;
    result.conflicts.fields.push('stats');
    result.changes.fields.push('stats');
    result.changes.total++;
  }
  
  // Слияние настроек
  if (oldState.settings && newState.settings) {
    result.state.settings = { ...oldState.settings, ...newState.settings };
    result.changes.fields.push('settings');
    result.changes.total++;
  }
  
  // Для полей, которые должны всегда браться из нового состояния
  if (options.forceFields) {
    for (const field of options.forceFields) {
      if (field in newState) {
        (result.state as any)[field] = (newState as any)[field];
        if (!result.changes.fields.includes(field)) {
          result.changes.fields.push(field);
          result.changes.total++;
        }
      }
    }
  }
  
  // Обновляем метаданные
  result.state._saveVersion = Math.max(
    oldState._saveVersion || 1,
    newState._saveVersion || 1
  ) + 1;
  
  // Добавляем информацию о слиянии
  result.state._lastMerged = new Date().toISOString();
  result.state._mergeInfo = {
    timestamp: Date.now(),
    strategy: options.strategy,
    conflicts: result.conflicts.total,
    resolved: result.conflicts.resolved,
    duration: performance.now() - startTime
  };
  
  logger.info('Выполнено слияние игровых состояний', { 
    oldVersion: oldState._saveVersion,
    newVersion: newState._saveVersion,
    conflicts: result.conflicts.total,
    changes: result.changes.total,
    duration: performance.now() - startTime
  });
  
  return result;
}

/**
 * Слияние объектов инвентаря
 */
function mergeInventoryObjects(oldInventory: Inventory, newInventory: Inventory, options: MergeOptions): Inventory {
  // Убедимся, что оба инвентаря определены
  if (!oldInventory || !newInventory) {
    return oldInventory || newInventory || {
      snot: 0,
      snotCoins: 0,
      containerSnot: 0,
      containerCapacity: 1,
      containerCapacityLevel: 1,
      fillingSpeed: 1,
      fillingSpeedLevel: 1,
      collectionEfficiency: 1,
      lastUpdateTimestamp: Date.now()
    };
  }

  // Создаем новый объект с объединенными значениями
  return {
    // Берем максимальные значения для основных полей
    snot: Math.max(oldInventory.snot || 0, newInventory.snot || 0),
    snotCoins: Math.max(oldInventory.snotCoins || 0, newInventory.snotCoins || 0),
    containerSnot: Math.max(oldInventory.containerSnot || 0, newInventory.containerSnot || 0),
    containerCapacity: Math.max(oldInventory.containerCapacity || 1, newInventory.containerCapacity || 1),
    fillingSpeed: Math.max(oldInventory.fillingSpeed || 1, newInventory.fillingSpeed || 1),
    containerCapacityLevel: Math.max(oldInventory.containerCapacityLevel || 1, newInventory.containerCapacityLevel || 1),
    fillingSpeedLevel: Math.max(oldInventory.fillingSpeedLevel || 1, newInventory.fillingSpeedLevel || 1),
    collectionEfficiency: Math.max(oldInventory.collectionEfficiency || 1, newInventory.collectionEfficiency || 1),
    lastUpdateTimestamp: Math.max(oldInventory.lastUpdateTimestamp || 0, newInventory.lastUpdateTimestamp || 0)
  };
}

/**
 * Слияние инвентаря в виде массивов
 */
function mergeInventory(oldInventory: InventoryItem[], newInventory: InventoryItem[], options: MergeOptions): InventoryItem[] {
  const mergedInventory = [...oldInventory];
  
  for (const newItem of newInventory) {
    const existingItemIndex = mergedInventory.findIndex(item => item.id === newItem.id);
    
    if (existingItemIndex !== -1) {
      const existingItem = mergedInventory[existingItemIndex];
      if (existingItem) {
        mergedInventory[existingItemIndex] = {
          id: existingItem.id,
          quantity: Math.max(existingItem.quantity, newItem.quantity),
          stackable: newItem.stackable ?? existingItem.stackable ?? false,
          acquired_at: existingItem.acquired_at || newItem.acquired_at || new Date().toISOString(),
          metadata: { ...(existingItem.metadata || {}), ...(newItem.metadata || {}) }
        };
      }
    } else {
      mergedInventory.push({
        id: newItem.id,
        quantity: newItem.quantity,
        stackable: newItem.stackable ?? false,
        acquired_at: newItem.acquired_at || new Date().toISOString(),
        metadata: newItem.metadata || {}
      });
    }
  }
  
  return mergedInventory;
}

/**
 * Слияние квестов
 * Возвращает [слитые квесты, количество конфликтов]
 */
function mergeQuests(
  oldQuests: Record<string, Quest>,
  newQuests: Record<string, Quest>,
  options: MergeOptions
): [Record<string, Quest>, number] {
  const mergedQuests: Record<string, Quest> = { ...oldQuests };
  let conflicts = 0;
  
  // Для каждого квеста в новом состоянии
  for (const [questId, newQuest] of Object.entries(newQuests)) {
    const oldQuest = oldQuests[questId];
    
    if (!oldQuest) {
      // Новый квест, просто добавляем
      mergedQuests[questId] = newQuest;
      continue;
    }
    
    // Завершенные квесты имеют приоритет
    if (oldQuest.completed && !newQuest.completed) {
      // Оставляем старый квест (уже завершен)
      conflicts++;
      continue;
    }
    
    if (!oldQuest.completed && newQuest.completed) {
      // Используем новый квест (так как он завершен)
      mergedQuests[questId] = newQuest;
      continue;
    }
    
    // Оба не завершены или оба завершены
    if (oldQuest.progress !== newQuest.progress) {
      conflicts++;
      
      // В случае конфликта берем более высокий прогресс
      mergedQuests[questId] = {
        ...oldQuest,
        ...newQuest,
        progress: Math.max(oldQuest.progress, newQuest.progress)
      };
    } else {
      // Прогресс одинаковый, объединяем остальные поля
      mergedQuests[questId] = {
        ...oldQuest,
        ...newQuest
      };
    }
  }
  
  return [mergedQuests, conflicts];
}

/**
 * Слияние достижений
 */
function mergeAchievements(
  oldAchievements: GameAchievements,
  newAchievements: GameAchievements,
  options: MergeOptions
): GameAchievements {
  // Получаем объединенный список разблокированных достижений
  const oldAchievementsArray = oldAchievements.unlockedAchievements || [];
  const newAchievementsArray = newAchievements.unlockedAchievements || [];
  const allAchievements = [...oldAchievementsArray, ...newAchievementsArray];
  
  // Создаем уникальный набор
  const uniqueAchievements = Array.from(new Set(allAchievements));
  
  return {
    unlockedAchievements: uniqueAchievements
  };
}

/**
 * Слияние статистики
 */
function mergeStats(
  oldStats: GameStateStats,
  newStats: GameStateStats,
  options: MergeOptions
): [GameStateStats, number] {
  let conflicts = 0;
  const result: GameStateStats = { ...oldStats };
  
  // Для числовых полей используем максимальное значение или сумму
  if (options.preferHigherValues) {
    result.clickCount = Math.max(oldStats.clickCount || 0, newStats.clickCount || 0);
    result.playTime = Math.max(oldStats.playTime || 0, newStats.playTime || 0);
    
    if (oldStats.highestLevel !== undefined || newStats.highestLevel !== undefined) {
      result.highestLevel = Math.max(oldStats.highestLevel || 0, newStats.highestLevel || 0);
    }
    
    if (oldStats.totalSnot !== undefined || newStats.totalSnot !== undefined) {
      result.totalSnot = Math.max(oldStats.totalSnot || 0, newStats.totalSnot || 0);
    }
    
    if (oldStats.totalSnotCoins !== undefined || newStats.totalSnotCoins !== undefined) {
      result.totalSnotCoins = Math.max(oldStats.totalSnotCoins || 0, newStats.totalSnotCoins || 0);
    }
    
    if (oldStats.consecutiveLoginDays !== undefined || newStats.consecutiveLoginDays !== undefined) {
      result.consecutiveLoginDays = Math.max(oldStats.consecutiveLoginDays || 0, newStats.consecutiveLoginDays || 0);
    }
  } else {
    // Берем новые значения, но сохраняем максимальные показатели
    Object.assign(result, newStats);
    
    // Для определенных полей всегда берем максимальное значение
    if (oldStats.highestLevel !== undefined && newStats.highestLevel !== undefined) {
      result.highestLevel = Math.max(oldStats.highestLevel, newStats.highestLevel);
    }
    
    if (oldStats.totalSnot !== undefined && newStats.totalSnot !== undefined) {
      result.totalSnot = Math.max(oldStats.totalSnot, newStats.totalSnot);
    }
    
    if (oldStats.totalSnotCoins !== undefined && newStats.totalSnotCoins !== undefined) {
      result.totalSnotCoins = Math.max(oldStats.totalSnotCoins, newStats.totalSnotCoins);
    }
  }
  
  // То же для startDate, если оно есть
  if (oldStats.startDate && newStats.startDate) {
    const oldStartDate = new Date(oldStats.startDate).getTime();
    const newStartDate = new Date(newStats.startDate).getTime();
    result.startDate = oldStartDate < newStartDate ? oldStats.startDate : newStats.startDate;
  }
  
  return [result, conflicts];
}

/**
 * Экспортируем стратегии слияния отдельно, чтобы их можно было использовать выборочно
 */
export const mergeStrategies = {
  inventory: mergeInventory,
  quests: mergeQuests,
  achievements: mergeAchievements,
  stats: mergeStats
};

/**
 * Функция для работы с достижениями в стиле Record
 */
function mergeAchievementRecords(
  oldAchievements: Record<string, Achievement>,
  newAchievements: Record<string, Achievement>,
  options: MergeOptions
): Record<string, Achievement> {
  // Создаем копию старых достижений
  const result: Record<string, Achievement> = { ...oldAchievements };
  
  // Перебираем новые достижения
  for (const [key, newAchievement] of Object.entries(newAchievements)) {
    // Если у нас нет такого достижения, добавляем
    if (!result[key]) {
      result[key] = { ...newAchievement };
      continue;
    }
    
    // Получаем старое достижение
    const oldAchievement = result[key];
    
    // Всегда берем максимальный прогресс
    result[key].progress = Math.max(oldAchievement.progress, newAchievement.progress);
    
    // Если достижение разблокировано в любой из версий, считаем его разблокированным
    result[key].unlocked = oldAchievement.unlocked || newAchievement.unlocked;
    
    // Берем более позднее время разблокировки
    if (oldAchievement.unlocked_at && newAchievement.unlocked_at && 
        new Date(newAchievement.unlocked_at || 0) > new Date(oldAchievement.unlocked_at || 0)) {
      result[key].unlocked_at = newAchievement.unlocked_at;
    }
    
    // Объединяем метаданные, предпочитая более новые значения
    if (oldAchievement.metadata || newAchievement.metadata) {
      result[key].metadata = { ...(oldAchievement.metadata || {}), ...(newAchievement.metadata || {}) };
    }
  }
  
  return result;
}

/**
 * Объединяет два объекта контейнера
 */
function mergeContainerObjects(oldContainer: Container, newContainer: Container, options: MergeOptions): Container {
  if (!oldContainer) {
    return newContainer;
  }

  if (!newContainer) {
    return oldContainer;
  }

  // Создаем новый объект с объединенными значениями
  return {
    // Берем максимальные значения для всех полей
    level: Math.max(oldContainer.level || 1, newContainer.level || 1),
    currentAmount: Math.max(oldContainer.currentAmount || 0, newContainer.currentAmount || 0),
    fillRate: Math.max(oldContainer.fillRate || 1, newContainer.fillRate || 1),
    currentFill: Math.max(oldContainer.currentFill || 0, newContainer.currentFill || 0)
  };
} 