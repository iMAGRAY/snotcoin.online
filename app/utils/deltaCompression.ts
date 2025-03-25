/**
 * Модуль для дельта-компрессии состояний игры
 * Позволяет создавать и применять разностные изменения между состояниями
 */

// Импорты
import { ExtendedGameState } from "../types/gameTypes";
import jsonpatch, { Operation } from 'fast-json-patch';
import { GameStateDelta, DeltaOperation } from '../types/saveTypes';

/**
 * Генерирует уникальный идентификатор, комбинируя временную метку и случайную строку
 * @returns Уникальный идентификатор строки
 */
export function generateUniqueId(): string {
  const timestamp = new Date().getTime();
  const randomStr = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${randomStr}`;
}

/**
 * Расширенный интерфейс для состояния игры с опциональными свойствами
 */
interface EnhancedGameState extends ExtendedGameState {
  _deltaVersion?: number;
  _baseStateId?: string;
  _changeRecords?: any[];
  _saveId?: string;
  _appliedDelta?: boolean;
  _deltaAppliedAt?: number;
  _deltaClientId?: string;
}

/**
 * Опции для создания дельты
 */
interface DeltaOptions {
  // Включать метаданные в дельту
  includeMetadata?: boolean;
  
  // Минимальное количество изменений для создания дельты
  minChanges?: number;
  
  // Добавить метку времени создания дельты
  addTimestamp?: boolean;
  
  // Игнорировать эти поля при создании дельты
  ignoreFields?: string[];
  
  // Всегда включать эти поля в дельту, даже если они не изменились
  alwaysIncludeFields?: string[];
  
  // Идентификатор клиента, создавшего дельту
  clientId?: string;
}

// Определение ключей, доступных для изменения
type GameStateSection = 'inventory' | 'container' | 'upgrades' | 
  'items' | 'achievements' | 'settings' | 'soundSettings';

/**
 * Функция для поиска изменений между объектами
 * @param oldObj Старый объект
 * @param newObj Новый объект
 * @param path Текущий путь в объекте
 * @returns Объект с изменениями
 */
function findChanges(oldObj: any, newObj: any, path = ""): Record<string, any> {
  if (!oldObj || !newObj) {
    return newObj === undefined ? {} : newObj;
  }
  
  const changes: Record<string, any> = {};
  const processedKeys = new Set<string>();
  
  // Проверяем изменения в существующих полях
  for (const key in newObj) {
    processedKeys.add(key);
    const newValue = newObj[key];
    const oldValue = oldObj[key];
    const currentPath = path ? `${path}.${key}` : key;
    
    // Если значения равны, пропускаем
    if (newValue === oldValue) continue;
    
    // Обработка массивов
    if (Array.isArray(newValue) && Array.isArray(oldValue)) {
      if (JSON.stringify(newValue) !== JSON.stringify(oldValue)) {
        changes[key] = newValue; // Для массивов сохраняем полную копию при изменениях
      }
      continue;
    }
    
    // Рекурсивно обрабатываем вложенные объекты
    if (
      typeof newValue === 'object' && newValue !== null && 
      typeof oldValue === 'object' && oldValue !== null
    ) {
      const nestedChanges = findChanges(oldValue, newValue, currentPath);
      if (Object.keys(nestedChanges).length > 0) {
        changes[key] = nestedChanges;
      }
      continue;
    }
    
    // Для примитивных значений сохраняем новое значение
    if (newValue !== oldValue) {
      changes[key] = newValue;
    }
  }
  
  // Проверяем удаленные поля
  for (const key in oldObj) {
    if (!processedKeys.has(key)) {
      changes[key] = null; // Помечаем удаленные поля как null
    }
  }
  
  return changes;
}

/**
 * Создает дельту (разницу) между двумя состояниями игры
 * @param baseState Исходное состояние
 * @param newState Новое состояние
 * @param userId ID пользователя 
 * @param baseVersion Версия исходного состояния
 * @param newVersion Версия нового состояния
 * @returns Объект с дельтой и метаданными
 */
export function createDelta(
  baseState: ExtendedGameState,
  newState: ExtendedGameState,
  userId: string,
  baseVersion: number,
  newVersion: number = baseVersion + 1
): GameStateDelta {
  // Генерируем операции патча (дельту)
  const operations = jsonpatch.compare(baseState, newState);
  
  // Фильтруем операции, исключая временные данные
  const filteredOperations = operations.filter((op: Operation) => {
    // Исключаем логи и временные данные
    return !op.path.startsWith('/logs/') && 
           !op.path.startsWith('/_tempData/') &&
           !op.path.includes('_lastSave') &&
           !op.path.includes('_lastSaved') &&
           !op.path.includes('_clientSentAt');
  });
  
  // Создаем объект дельты с метаданными
  const delta: GameStateDelta = {
    userId,
    baseVersion,
    newVersion,
    delta: filteredOperations,
    timestamp: Date.now(),
    size: JSON.stringify(filteredOperations).length
  };
  
  return delta;
}

/**
 * Применяет дельту к базовому состоянию
 * @param baseState Исходное состояние к которому применяется дельта
 * @param delta Дельта для применения
 * @returns Обновленное состояние после применения дельты
 */
export function applyDelta(
  baseState: ExtendedGameState,
  delta: GameStateDelta
): ExtendedGameState {
  try {
    // Создаем глубокую копию базового состояния
    const newState = JSON.parse(JSON.stringify(baseState)) as ExtendedGameState;
    
    // Применяем операции патча к копии
    jsonpatch.applyPatch(newState, delta.delta as Operation[]);
    
    // Обновляем метаданные в состоянии, если они существуют
    if (newState._saveVersion !== undefined) {
      newState._saveVersion = delta.newVersion;
      newState._lastModified = Date.now();
      newState._lastSaved = new Date().toISOString();
    }
    
    return newState;
  } catch (error) {
    console.error('Ошибка применения дельты:', error);
    throw new Error(`Не удалось применить дельту: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
  }
}

/**
 * Проверяет, можно ли применить дельту к указанному состоянию
 * @param state Состояние игры
 * @param delta Дельта для проверки
 * @returns true если дельту можно применить, иначе false
 */
export function canApplyDelta(
  state: ExtendedGameState,
  delta: GameStateDelta
): boolean {
  // Проверяем соответствие версий
  if (state._saveVersion === undefined) {
    return false;
  }
  
  const stateVersion = state._saveVersion;
  return stateVersion === delta.baseVersion;
}

/**
 * Оценивает эффективность использования дельты вместо полного состояния
 * @param baseState Исходное состояние
 * @param newState Новое состояние
 * @returns Объект с информацией об эффективности
 */
export function estimateDeltaEfficiency(
  baseState: ExtendedGameState,
  newState: ExtendedGameState
): { 
  fullStateSize: number; 
  deltaSize: number; 
  compressionRatio: number;
  isEfficient: boolean;
} {
  // Создаем дельту между состояниями
  const delta = createDelta(
    baseState, 
    newState, 
    newState._userId || 'unknown',
    newState._saveVersion || 0
  );
  
  // Размер полного состояния
  const fullStateSize = JSON.stringify(newState).length;
  
  // Размер дельты
  const deltaSize = delta.size || JSON.stringify(delta).length;
  
  // Коэффициент сжатия (отношение размера дельты к полному размеру)
  const compressionRatio = deltaSize / fullStateSize;
  
  // Считаем дельту эффективной, если она занимает менее 60% от полного размера
  const isEfficient = compressionRatio < 0.6;
  
  return {
    fullStateSize,
    deltaSize,
    compressionRatio,
    isEfficient
  };
}

/**
 * Проверяет, есть ли существенные изменения между старым и новым состояниями
 * @param oldState Старое состояние игры
 * @param newState Новое состояние игры
 * @returns true, если есть существенные изменения
 */
export function hasSignificantChanges(oldState: EnhancedGameState | null, newState: EnhancedGameState | null): boolean {
  if (!oldState || !newState) return true;
  
  // Проверка изменений в критических параметрах
  const criticalParams = [
    'snot', 'snotCoins', 'containerCapacity', 'containerCapacityLevel',
    'fillingSpeed', 'fillingSpeedLevel', 'collectionEfficiency'
  ];
  
  for (const param of criticalParams) {
    if (oldState.inventory[param as keyof typeof oldState.inventory] !== 
        newState.inventory[param as keyof typeof newState.inventory]) {
      return true;
    }
  }
  
  // Проверка уровней апгрейдов
  if (oldState.upgrades.containerLevel !== newState.upgrades.containerLevel ||
      oldState.upgrades.fillingSpeedLevel !== newState.upgrades.fillingSpeedLevel ||
      oldState.upgrades.collectionEfficiencyLevel !== newState.upgrades.collectionEfficiencyLevel) {
    return true;
  }
  
  // Проверка clickPower и passiveIncome
  if ((oldState.upgrades.clickPower?.level !== newState.upgrades.clickPower?.level) ||
      (oldState.upgrades.passiveIncome?.level !== newState.upgrades.passiveIncome?.level)) {
    return true;
  }
  
  // Проверка достижений, если они есть
  if (oldState.achievements && newState.achievements) {
    const oldAchievements = oldState.achievements.unlockedAchievements || [];
    const newAchievements = newState.achievements.unlockedAchievements || [];
    
    if (oldAchievements.length !== newAchievements.length) {
      return true;
    }
  }
  
  // Проверка количества предметов, если они есть
  if (oldState.items && newState.items && oldState.items.length !== newState.items.length) {
    return true;
  }
  
  return false;
} 