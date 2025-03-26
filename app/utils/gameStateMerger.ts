/**
 * Утилита для умного слияния состояний игры при конфликтах версий
 */
import { ExtendedGameState, Inventory } from '../types/gameTypes';
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
interface InventoryItem {
  id: string;
  quantity: number;
  stackable?: boolean;
  acquired_at?: string;
  metadata?: Record<string, any>;
}

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

// Тип для GameStats, соответствующий типам в GameState
interface GameStats {
  playtime: number;
  score: number;
  last_played_at?: string;
  clickCount: number;
  playTime: number;
  startDate: string;
  highestLevel?: number;
  totalSnot?: number;
  totalSnotCoins?: number;
  consecutiveLoginDays?: number;
  [key: string]: any;
}

// Тип в стиле GameState
interface GameStateStats {
  clickCount: number;
  playTime: number;
  startDate: string;
  highestLevel?: number;
  totalSnot?: number;
  totalSnotCoins?: number;
  consecutiveLoginDays?: number;
}

// Тип в стиле GameState
interface GameAchievements {
  unlockedAchievements: string[];
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
  
  result.state._lastMerged = new Date().toISOString();
  result.state._mergeInfo = {
    duration: performance.now() - startTime,
    conflicts: result.conflicts.total,
    resolved: result.conflicts.resolved,
    strategy: options.strategy
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
  // Создаем новый объект для результата
  const result: Inventory = { ...oldInventory };
  
  // Слияние базовых числовых полей с приоритетом больших значений если указано
  if (options.preferHigherValues) {
    result.snot = Math.max(oldInventory.snot, newInventory.snot);
    result.snotCoins = Math.max(oldInventory.snotCoins, newInventory.snotCoins);
    result.containerCapacity = Math.max(oldInventory.containerCapacity, newInventory.containerCapacity);
    result.containerSnot = Math.max(oldInventory.containerSnot, newInventory.containerSnot);
    result.fillingSpeed = Math.max(oldInventory.fillingSpeed, newInventory.fillingSpeed);
    result.collectionEfficiency = Math.max(oldInventory.collectionEfficiency, newInventory.collectionEfficiency);
    result.Cap = Math.max(oldInventory.Cap, newInventory.Cap);
    result.containerCapacityLevel = Math.max(oldInventory.containerCapacityLevel, newInventory.containerCapacityLevel);
    result.fillingSpeedLevel = Math.max(oldInventory.fillingSpeedLevel, newInventory.fillingSpeedLevel);
  } else {
    // Берем новые значения
    Object.assign(result, newInventory);
  }
  
  // Обновляем timestamp
  result.lastUpdateTimestamp = Math.max(
    oldInventory.lastUpdateTimestamp || 0,
    newInventory.lastUpdateTimestamp || 0
  );
  
  return result;
}

/**
 * Слияние инвентаря в виде массивов
 */
function mergeInventory(oldInventory: InventoryItem[], newInventory: InventoryItem[], options: MergeOptions): InventoryItem[] {
  const mergedInventory = [...oldInventory];
  
  // Для каждого предмета в новом инвентаре
  for (const newItem of newInventory) {
    const existingItemIndex = mergedInventory.findIndex(item => item.id === newItem.id);
    
    if (existingItemIndex >= 0) {
      // Предмет существует, объединяем количество
      const existingItem = mergedInventory[existingItemIndex];
      
      if (newItem.stackable) {
        // Для стекуемых предметов берем максимальное количество
        mergedInventory[existingItemIndex] = {
          ...existingItem,
          quantity: Math.max(existingItem.quantity, newItem.quantity)
        };
      } else {
        // Для нестекуемых предметов объединяем свойства, приоритет у новых
        mergedInventory[existingItemIndex] = {
          ...existingItem,
          ...newItem
        };
      }
    } else {
      // Добавляем новый предмет
      mergedInventory.push({ ...newItem });
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