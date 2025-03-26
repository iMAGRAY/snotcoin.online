/**
 * Модуль дельта-компрессии игровых данных
 * Оптимизирует синхронизацию, передавая только изменения между состояниями
 */

import { ExtendedGameState } from "../types/gameTypes";
import { DeltaGameState, DeltaOperation } from "../types/saveTypes";
import { generateSimpleChecksum } from "./dataIntegrity";

// Константы
const IGNORED_FIELDS = ['_lastSaved', '_decompressedAt', '_tempData', 'logs'];
const CRITICAL_FIELDS = ['inventory', 'container', 'upgrades'];

/**
 * Генерирует уникальный ID для дельты
 * @param userId ID пользователя
 * @returns Строка с уникальным ID
 */
export function generateUniqueId(userId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `delta_${userId}_${timestamp}_${random}`;
}

/**
 * Проверяет наличие значимых изменений в состоянии игры
 * @param oldState Старое состояние
 * @param newState Новое состояние
 * @returns true, если есть значимые изменения
 */
export function hasSignificantChanges(oldState: ExtendedGameState, newState: ExtendedGameState): boolean {
  // Проверяем критические поля
  for (const field of CRITICAL_FIELDS) {
    const oldJson = JSON.stringify(oldState[field as keyof ExtendedGameState]);
    const newJson = JSON.stringify(newState[field as keyof ExtendedGameState]);
    
    if (oldJson !== newJson) {
      return true;
    }
  }
  
  // Проверяем поле settings, если оно существует
  if (oldState.settings && newState.settings) {
    if (JSON.stringify(oldState.settings) !== JSON.stringify(newState.settings)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Создает дельту между двумя состояниями игры
 * @param oldState Предыдущее состояние
 * @param newState Новое состояние
 * @param userId ID пользователя 
 * @param baseVersion Версия базового состояния
 * @returns Объект дельты или null, если изменений нет
 */
export function createDelta(
  oldState: ExtendedGameState,
  newState: ExtendedGameState,
  userId: string,
  baseVersion: number
): DeltaGameState | null {
  if (!oldState || !newState || !userId) {
    console.error('[deltaCompression] Invalid arguments for createDelta');
    return null;
  }
  
  try {
    // Клонируем состояния для безопасности
    const baseState = JSON.parse(JSON.stringify(oldState));
    const targetState = JSON.parse(JSON.stringify(newState));
    
    // Убедимся, что baseVersion существует и является числом
    const safeBaseVersion = typeof baseVersion === 'number' ? baseVersion : 1;
    
    // Очищаем игнорируемые поля
    IGNORED_FIELDS.forEach(field => {
      if (baseState) delete (baseState as any)[field];
      if (targetState) delete (targetState as any)[field];
    });
    
    // Создаем операции дельты
    const operations: DeltaOperation[] = [];
    
    // Сравниваем состояния и создаем патч
    compareObjects(baseState, targetState, '', operations);
    
    // Если изменений нет, возвращаем null
    if (operations.length === 0) {
      return null;
    }
    
    // Определяем важность изменений
    const isCritical = operations.some(op => 
      CRITICAL_FIELDS.some(field => op.path && op.path.startsWith(`/${field}`))
    );
    
    // Текущее время для согласованности меток времени
    const currentTime = Date.now();
    
    // Создаем объект дельты с безопасными значениями
    const delta: DeltaGameState = {
      _id: generateUniqueId(userId),
      _baseVersion: safeBaseVersion,
      _newVersion: safeBaseVersion + 1,
      _createdAt: currentTime,
      _clientId: userId,
      _isFullState: false,
      changes: {},
      _timestamp: currentTime,
      _changeCount: operations.length,
      delta: operations
    };
    
    // Создаем упрощенное представление изменений
    operations.forEach(op => {
      if (op.path && (op.op === 'replace' || op.op === 'add')) {
        setValueByPath(delta.changes, op.path.substring(1), op.value);
      } else if (op.path && op.op === 'remove') {
        setValueByPath(delta.changes, op.path.substring(1), null);
      }
    });
  
  return delta;
  } catch (error) {
    console.error('[deltaCompression] Error creating delta:', error);
    return null;
  }
}

/**
 * Применяет дельту к состоянию игры
 * @param baseState Базовое состояние
 * @param delta Дельта изменений
 * @returns Новое состояние или null при ошибке
 */
export function applyDelta(
  baseState: ExtendedGameState,
  delta: DeltaGameState
): ExtendedGameState | null {
  if (!baseState || !delta) {
    console.error('[deltaCompression] Invalid arguments for applyDelta');
    return null;
  }
  
  try {
    // Проверяем совместимость версий
    if (baseState._saveVersion !== delta._baseVersion) {
      console.error(`[deltaCompression] Несовместимая версия состояния: ${baseState._saveVersion} vs ${delta._baseVersion}`);
      return null;
    }
    
    // Клонируем состояние для безопасности
    const newState = JSON.parse(JSON.stringify(baseState));
    
    // Применяем операции патча
    for (const op of delta.delta) {
      try {
        if (op) {
          applyOperation(newState, op);
        }
      } catch (opError) {
        console.error(`[deltaCompression] Ошибка при применении операции ${op?.op} по пути ${op?.path}:`, opError);
      }
    }
    
    // Обновляем метаданные
    newState._saveVersion = delta._newVersion;
    newState._lastModified = Date.now();
    
    return newState;
  } catch (error) {
    console.error('[deltaCompression] Ошибка при применении дельты:', error);
    return null;
  }
}

/**
 * Применяет операцию к объекту
 * @param obj Объект для изменения
 * @param operation Операция патча
 */
function applyOperation(obj: any, operation: DeltaOperation): void {
  // Получаем путь в виде массива сегментов, игнорируя начальный /
  const segments = operation.path.substring(1).split('/').map(decodeURIComponent);
  
  switch (operation.op) {
    case 'add':
    case 'replace':
      setValueAtPath(obj, segments, operation.value);
      break;
      
    case 'remove':
      removeValueAtPath(obj, segments);
      break;
      
    case 'move':
      if (!operation.from) throw new Error('Отсутствует путь from для операции move');
      
      const fromSegments = operation.from.substring(1).split('/').map(decodeURIComponent);
      const value = getValueAtPath(obj, fromSegments);
      
      removeValueAtPath(obj, fromSegments);
      setValueAtPath(obj, segments, value);
      break;
      
    case 'copy':
      if (!operation.from) throw new Error('Отсутствует путь from для операции copy');
      
      const sourceSegments = operation.from.substring(1).split('/').map(decodeURIComponent);
      const sourceValue = getValueAtPath(obj, sourceSegments);
      
      setValueAtPath(obj, segments, JSON.parse(JSON.stringify(sourceValue)));
      break;
      
    case 'test':
      const currentValue = getValueAtPath(obj, segments);
      const expectedValue = operation.value;
      
      if (JSON.stringify(currentValue) !== JSON.stringify(expectedValue)) {
        throw new Error(`Тест не пройден: ${operation.path} ожидался ${JSON.stringify(expectedValue)}, получен ${JSON.stringify(currentValue)}`);
      }
      break;
  }
}

/**
 * Устанавливает значение по пути в объекте
 * @param obj Объект для изменения
 * @param path Путь сегментов
 * @param value Значение для установки
 */
function setValueAtPath(obj: any, path: string[], value: any): void {
  // Проверяем, что путь не пустой
  if (!path || path.length === 0) {
    console.warn('[deltaCompression] Пустой путь в setValueAtPath, пропускаем операцию');
    return;
  }

  // Если путь состоит из одного сегмента, устанавливаем значение напрямую
  if (path.length === 1) {
    obj[path[0]] = value;
    return;
  }

  const lastSegment = path.pop();
  
  if (!lastSegment) {
    console.warn('[deltaCompression] Неверный путь: пустой массив после pop');
    return;
  }
  
  // Находим родительский объект
  let current = obj;
  
  for (const segment of path) {
    if (segment === '') continue;
    
    if (current[segment] === undefined || current[segment] === null) {
      // Если индекс числовой, создаем массив, иначе объект
      current[segment] = /^\d+$/.test(segment) ? [] : {};
    }
    
    current = current[segment];
    
    // Проверяем, что мы не потеряли ссылку на объект
    if (current === undefined || current === null) {
      console.warn(`[deltaCompression] Потеряна ссылка на объект по пути ${path.join('/')}`);
      return;
    }
  }
  
  // Устанавливаем значение
  current[lastSegment] = value;
}

/**
 * Удаляет значение по пути в объекте
 * @param obj Объект для изменения
 * @param path Путь сегментов
 */
function removeValueAtPath(obj: any, path: string[]): void {
  const lastSegment = path.pop();
  
  if (!lastSegment) {
    throw new Error('Неверный путь: пустой массив');
  }
  
  // Находим родительский объект
  let current = obj;
  
  for (const segment of path) {
    if (segment === '') continue;
    
    if (current[segment] === undefined) {
      // Если сегмент не существует, просто выходим
      return;
    }
    
    current = current[segment];
  }
  
  // Удаляем значение
  if (Array.isArray(current)) {
    // Если массив, используем splice для удаления элемента
    const index = parseInt(lastSegment, 10);
    current.splice(index, 1);
  } else {
    // Иначе удаляем свойство
    delete current[lastSegment];
  }
}

/**
 * Получает значение по пути в объекте
 * @param obj Объект
 * @param path Путь сегментов
 * @returns Значение или undefined
 */
function getValueAtPath(obj: any, path: string[]): any {
  let current = obj;
  
  for (const segment of path) {
    if (segment === '') continue;
    
    if (current[segment] === undefined) {
      return undefined;
    }
    
    current = current[segment];
  }
  
  return current;
}

/**
 * Устанавливает значение по строковому пути в объекте
 * @param obj Объект для изменения
 * @param path Строковый путь с точечной нотацией
 * @param value Значение для установки
 */
function setValueByPath(obj: any, path: string, value: any): void {
  const segments = path.split('.');
  setValueAtPath(obj, segments, value);
}

/**
 * Сравнивает объекты и создает операции дельты
 * @param oldObj Старый объект
 * @param newObj Новый объект
 * @param path Текущий путь
 * @param operations Массив операций
 */
function compareObjects(oldObj: any, newObj: any, path: string, operations: DeltaOperation[]): void {
  // Проверяем, что объекты не null/undefined
  if (oldObj === null || oldObj === undefined) {
    if (newObj !== null && newObj !== undefined) {
      operations.push({
        op: 'add',
        path: path || '/',
        value: newObj
      });
    }
    return;
  }
  
  if (newObj === null || newObj === undefined) {
    operations.push({
      op: 'remove',
      path: path || '/'
    });
    return;
  }
  
  // Если объекты разных типов, заменяем полностью
  if (typeof oldObj !== typeof newObj) {
    operations.push({
      op: 'replace',
      path: path || '/',
      value: newObj
    });
    return;
  }
  
  // Для примитивов просто сравниваем значения
  if (typeof oldObj !== 'object') {
    if (oldObj !== newObj) {
      operations.push({
        op: 'replace',
        path: path || '/',
        value: newObj
      });
    }
    return;
  }
  
  // Для массивов используем специальную функцию сравнения
  if (Array.isArray(oldObj) || Array.isArray(newObj)) {
    compareArrays(
      Array.isArray(oldObj) ? oldObj : [],
      Array.isArray(newObj) ? newObj : [],
      path,
      operations
    );
    return;
  }
  
  // Для объектов сравниваем все ключи
  const allKeys = new Set([
    ...Object.keys(oldObj),
    ...Object.keys(newObj)
  ]);
  
  // Преобразуем Set в массив для итерации
  const allKeysArray = Array.from(allKeys);
  
  for (const key of allKeysArray) {
    const oldValue = oldObj[key];
    const newValue = newObj[key];
    const newPath = path ? `${path}/${key}` : `/${key}`;
    
    // Пропускаем игнорируемые поля
    if (IGNORED_FIELDS.includes(key)) {
      continue;
    }
    
    // Если значения разные, создаем операцию
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      if (newValue === undefined) {
        operations.push({
          op: 'remove',
          path: newPath
        });
      } else {
        operations.push({
          op: 'replace',
          path: newPath,
          value: newValue
        });
      }
    }
  }
}

/**
 * Сравнивает два массива и создает операции патча
 * @param oldArr Старый массив
 * @param newArr Новый массив
 * @param path Текущий путь
 * @param operations Массив операций для заполнения
 */
function compareArrays(oldArr: any[], newArr: any[], path: string, operations: DeltaOperation[]): void {
  // Если массивы очень разные по размеру, заменяем полностью
  if (Math.abs(oldArr.length - newArr.length) > oldArr.length * 0.5) {
    operations.push({
      op: 'replace',
      path: fixPath(path),
      value: newArr
    });
    return;
  }
  
  // Для небольших массивов используем наивный подход
  if (oldArr.length < 10 && newArr.length < 10) {
    // Проверяем каждый элемент
    for (let i = 0; i < Math.max(oldArr.length, newArr.length); i++) {
      const itemPath = `${path}[${i}]`;
      
      // Элемент добавлен
      if (i >= oldArr.length) {
        operations.push({
          op: 'add',
          path: fixPath(itemPath),
          value: newArr[i]
        });
        continue;
      }
      
      // Элемент удален
      if (i >= newArr.length) {
        operations.push({
          op: 'remove',
          path: fixPath(`${path}[${oldArr.length - (oldArr.length - i)}]`)
        });
        continue;
      }
      
      // Рекурсивно сравниваем элементы
      compareObjects(oldArr[i], newArr[i], itemPath, operations);
    }
    return;
  }
  
  // Для больших массивов заменяем полностью
  if (JSON.stringify(oldArr) !== JSON.stringify(newArr)) {
    operations.push({
      op: 'replace',
      path: fixPath(path),
      value: newArr
    });
  }
}

/**
 * Конвертирует точечную нотацию пути в JSON Pointer
 * @param path Путь в точечной нотации
 * @returns Путь в формате JSON Pointer
 */
function fixPath(path: string): string {
  if (!path) return '/';
  
  // Заменяем точки и экранируем специальные символы
  return '/' + path
    .replace(/\./g, '/')
    .replace(/\[(\d+)\]/g, '/$1')
    .replace(/~/g, '~0')
    .replace(/\//g, '~1');
}

/**
 * Оптимизирует дельту, удаляя избыточные операции
 * @param delta Дельта для оптимизации
 * @returns Оптимизированная дельта
 */
export function optimizeDelta(delta: DeltaGameState): DeltaGameState {
  const optimized = { ...delta };
  
  // Находим избыточные операции
  const pathMap = new Map<string, number>();
  
  // Отмечаем все пути
  for (let i = 0; i < optimized.delta.length; i++) {
    const op = optimized.delta[i];
    pathMap.set(op.path, i);
  }
  
  // Фильтруем операции, оставляя только последние для каждого пути
  const filteredOperations: DeltaOperation[] = [];
  const processedPaths = new Set<string>();
  
  // Обрабатываем с конца для сохранения последних операций
  for (let i = optimized.delta.length - 1; i >= 0; i--) {
    const op = optimized.delta[i];
    
    // Игнорируем проверки (test)
    if (op.op === 'test') continue;
    
    // Если путь не обработан, добавляем операцию
    if (!processedPaths.has(op.path)) {
      filteredOperations.unshift(op);
      processedPaths.add(op.path);
      
      // Если operaton - move или copy, также помечаем исходный путь
      if ((op.op === 'move' || op.op === 'copy') && op.from) {
        processedPaths.add(op.from);
      }
    }
  }
  
  // Обновляем дельту
  optimized.delta = filteredOperations;
  optimized._changeCount = filteredOperations.length;
  
  return optimized;
}

/**
 * Проверяет, содержит ли дельта критические изменения
 * @param delta Дельта для проверки
 * @returns true, если содержит критические изменения
 */
export function hasCriticalChanges(delta: DeltaGameState): boolean {
  return delta.delta.some(op => 
    CRITICAL_FIELDS.some(field => op.path.startsWith(`/${field}`))
  );
}

/**
 * Вычисляет размер дельты в байтах
 * @param delta Дельта для измерения
 * @returns Размер в байтах
 */
export function calculateDeltaSize(delta: DeltaGameState): number {
  if (!delta) return 0;
  return JSON.stringify(delta).length;
}

/**
 * Определяет, стоит ли использовать дельту или полное состояние
 * @param fullState Полное состояние
 * @param delta Дельта
 * @returns true, если дельта эффективнее
 */
export function isDeltaEfficient(fullState: ExtendedGameState, delta: DeltaGameState): boolean {
  if (!fullState || !delta) return false;
  
  const fullSize = JSON.stringify(fullState).length;
  const deltaSize = calculateDeltaSize(delta);
  
  // Если дельта больше 70% полного состояния, лучше отправить полное состояние
  return deltaSize < fullSize * 0.7;
} 