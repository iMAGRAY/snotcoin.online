'use client';

import { ExtendedGameState } from '../types/gameTypes';

/**
 * Интерфейс для ресурсов игры
 */
export interface GameResources {
  snot: number;
  kingCoins: number;
  containerSnot: number;
  containerCapacity: number;
  containerCapacityLevel: number;
  fillingSpeed: number;
  fillingSpeedLevel: number;
  collectionEfficiency: number;
  lastUpdateTimestamp: number;
}

/**
 * Тип операции ресурса
 */
export type ResourceOperation = 'add' | 'subtract' | 'set' | 'multiply' | 'divide';

/**
 * Результат операции с ресурсами
 */
export interface ResourceOperationResult {
  success: boolean;
  resourceType: keyof GameResources;
  operation: ResourceOperation;
  timestamp: number;
  error?: string;
  newValue?: number;
  oldValue?: number;
}

/**
 * Класс для управления ресурсами игры
 */
export class ResourceManager {
  private resources: GameResources;
  
  private readonly defaultResources: GameResources = {
    snot: 0,
    kingCoins: 0,
    containerSnot: 0.05,
    containerCapacity: 1,
    containerCapacityLevel: 1, 
    fillingSpeed: 0.01,
    fillingSpeedLevel: 1,
    collectionEfficiency: 1.0,
    lastUpdateTimestamp: Date.now() as number
  };
  
  private initialResources: GameResources = { ...this.defaultResources };
  
  // Добавляем переменные для отслеживания изменений ресурсов
  private resourcesHistory: Map<keyof GameResources, {value: number, timestamp: number}[]> = new Map();
  private maxHistorySize: number = 10;
  private maxResourceIncreaseThreshold: {[key in keyof GameResources]?: number} = {
    snot: 1000,
    kingCoins: 500,
    containerSnot: 200
  };
  private maxResourceIncreaseRatePerSecond: {[key in keyof GameResources]?: number} = {
    snot: 2000,
    kingCoins: 1000,
    containerSnot: 500
  };

  constructor(initialResources?: Partial<GameResources>) {
    // Сначала инициализируем значениями по умолчанию
    this.resources = { ...this.defaultResources };
    
    // Применяем начальные ресурсы с проверками
    if (initialResources) {
      // Обрабатываем каждый ключ отдельно
      for (const key in initialResources) {
        if (Object.prototype.hasOwnProperty.call(initialResources, key)) {
          const typedKey = key as keyof GameResources;
          const value = initialResources[typedKey];
          
          // Проверяем, что значение есть и является корректным числом
          if (value !== undefined && typeof value === 'number' && !isNaN(value)) {
            this.resources[typedKey] = value;
          }
        }
      }
    }
    
    // Дополнительная проверка для критичных значений
    if (isNaN(this.resources.snot)) {
      console.warn('[ResourceManager] Обнаружено некорректное значение snot, устанавливаем по умолчанию 0');
      this.resources.snot = 0;
    }
    
    if (this.resources.containerSnot < 0 || isNaN(this.resources.containerSnot)) {
      console.warn('[ResourceManager] Обнаружено отрицательное или NaN значение containerSnot, сбрасываем в 0');
      this.resources.containerSnot = 0;
    }
    
    // Гарантируем, что все числовые значения корректны
    for (const key in this.resources) {
      const typedKey = key as keyof GameResources;
      if (typeof this.resources[typedKey] === 'number' && isNaN(this.resources[typedKey] as number)) {
        console.warn(`[ResourceManager] Обнаружено NaN значение для ${key}, устанавливаем по умолчанию`);
        this.resources[typedKey] = this.defaultResources[typedKey];
      }
    }
    
    console.log('[ResourceManager] Инициализирован с ресурсами:', { ...this.resources });
    
    // Инициализируем историю для каждого ресурса
    Object.keys(this.resources).forEach((key) => {
      this.resourcesHistory.set(key as keyof GameResources, []);
    });
  }

  /**
   * Получить текущее значение ресурса
   * @param resourceType Тип ресурса
   * @returns Текущее значение ресурса
   */
  public getResource(resourceType: keyof GameResources): number {
    return this.resources[resourceType] ?? 0;
  }

  /**
   * Получить все ресурсы
   * @returns Объект со всеми ресурсами
   */
  public getAllResources(): GameResources {
    return { ...this.resources };
  }

  /**
   * Установить значение ресурса
   * @param resourceType Тип ресурса
   * @param value Новое значение
   * @returns Результат операции
   */
  public setResource(resourceType: keyof GameResources, value: number): ResourceOperationResult {
    console.log(`[ResourceManager] setResource вызван для ${resourceType}:`, { 
      oldValue: this.resources[resourceType],
      newValue: value,
      allResources: { ...this.resources }
    });
    
    if (typeof value !== 'number' || isNaN(value)) {
      return {
        success: false,
        error: 'Недопустимое значение ресурса',
        resourceType,
        operation: 'set',
        timestamp: Date.now()
      };
    }

    if (value < 0) {
      return {
        success: false,
        resourceType,
        oldValue: this.resources[resourceType],
        error: 'Cannot set negative resource value',
        operation: 'set',
        timestamp: Date.now()
      };
    }

    // Проверка на подозрительно большое значение
    const threshold = this.maxResourceIncreaseThreshold[resourceType];
    const currentValue = this.resources[resourceType];
    
    if (threshold && value > currentValue + threshold) {
      console.warn(`[ResourceManager] Подозрительное изменение ресурса ${resourceType}: +${value - currentValue}. Применяем ограничение.`);
      value = currentValue + threshold;
    }
    
    // Добавляем текущее значение в историю перед изменением
    this.addToResourceHistory(resourceType, currentValue, Date.now());
    
    const oldValue = this.resources[resourceType] || 0;
    // Устанавливаем значение ресурса в объекте resources используя свойство resourceType
    this.resources[resourceType] = value;
    
    console.log(`[ResourceManager] setResource результат для ${resourceType}:`, { 
      oldValue,
      newValue: value,
      updatedValue: this.resources[resourceType]
    });

    return {
      success: true,
      oldValue,
      newValue: value,
      resourceType,
      operation: 'set',
      timestamp: Date.now()
    };
  }

  /**
   * Добавить значение к ресурсу
   * @param resourceType Тип ресурса
   * @param amount Количество для добавления
   * @returns Результат операции
   */
  public addResource(resourceType: keyof GameResources, amount: number): ResourceOperationResult {
    try {
      console.log(`[ResourceManager] addResource вызван для ${resourceType}:`, { 
        oldValue: this.resources[resourceType],
        amount,
        allResources: { ...this.resources }
      });
      
      if (typeof amount !== 'number' || isNaN(amount)) {
        return {
          success: false,
          error: 'Недопустимое количество для добавления',
          resourceType,
          operation: 'add',
          timestamp: Date.now()
        };
      }

      // Проверка на подозрительно большое добавление
      const threshold = this.maxResourceIncreaseThreshold[resourceType];
      if (threshold && amount > threshold) {
        console.warn(`[ResourceManager] Подозрительное добавление ресурса ${resourceType}: +${amount}. Применяем ограничение.`);
        amount = threshold;
      }
      
      // Проверка скорости изменения ресурса
      const isChangeValid = this.validateResourceChange(resourceType, amount);
      if (!isChangeValid) {
        console.warn(`[ResourceManager] Обнаружено подозрительно быстрое изменение ресурса ${resourceType}. Игнорируем.`);
        return {
          success: false,
          error: 'Подозрительное изменение ресурса',
          resourceType,
          operation: 'add',
          timestamp: Date.now()
        };
      }

      // Получаем текущее значение ресурса (0 если его нет)
      const oldValue = this.resources[resourceType] !== undefined ? 
        this.resources[resourceType] : 
        (resourceType === 'snot' ? 0 : 0);
      
      // Дополнительная проверка корректности oldValue
      if (typeof oldValue !== 'number' || isNaN(oldValue)) {
        console.error(`[ResourceManager] Некорректное текущее значение ${resourceType}:`, { 
          oldValue, 
          resourceType, 
          resources: this.resources 
        });
        
        // Устанавливаем безопасное значение по умолчанию
        const safeOldValue = resourceType === 'snot' ? 0 : 0;
        const safeNewValue = safeOldValue + amount;
        
        // Безопасное обновление значения
        this.resources[resourceType] = safeNewValue;
        
        return {
          success: true,
          oldValue: safeOldValue,
          newValue: safeNewValue,
          resourceType,
          operation: 'add',
          timestamp: Date.now()
        };
      }
      
      const newValue = oldValue + amount;
      
      // Проверка корректности нового значения
      if (isNaN(newValue)) {
        return {
          success: false,
          error: `Некорректное новое значение: ${oldValue} + ${amount} = ${newValue}`,
          oldValue,
          resourceType,
          operation: 'add',
          timestamp: Date.now()
        };
      }
      
      // Добавляем текущее значение в историю перед изменением
      this.addToResourceHistory(resourceType, oldValue, Date.now());
      
      // Устанавливаем значение ресурса в объекте resources используя ключ resourceType
      this.resources[resourceType] = newValue;

      console.log(`[ResourceManager] addResource результат для ${resourceType}:`, { 
        oldValue,
        amount,
        newValue,
        updatedValue: this.resources[resourceType]
      });
      
      return {
        success: true,
        oldValue,
        newValue,
        resourceType,
        operation: 'add',
        timestamp: Date.now()
      };
    } catch (error) {
      // Обрабатываем любые неожиданные ошибки
      console.error(`[ResourceManager] Критическая ошибка в addResource:`, error);
      
      try {
        // Используем прямое присваивание как последнюю надежду
        const currentValue = this.resources[resourceType] || 0;
        this.resources[resourceType] = currentValue + amount;
        
        return {
          success: true,
          oldValue: currentValue,
          newValue: currentValue + amount,
          resourceType,
          operation: 'add',
          timestamp: Date.now()
        };
      } catch (fallbackError) {
        console.error(`[ResourceManager] Критическая ошибка при резервной обработке:`, fallbackError);
        
        return {
          success: false,
          error: `Критическая ошибка: ${error instanceof Error ? error.message : String(error)}`,
          resourceType,
          operation: 'add',
          timestamp: Date.now()
        };
      }
    }
  }

  /**
   * Вычесть значение из ресурса
   * @param resourceType Тип ресурса
   * @param amount Количество для вычитания
   * @param allowNegative Разрешить отрицательные значения
   * @returns Результат операции
   */
  public subtractResource(
    resourceType: keyof GameResources, 
    amount: number, 
    allowNegative = false
  ): ResourceOperationResult {
    if (typeof amount !== 'number' || isNaN(amount)) {
      return {
        success: false,
        error: 'Недопустимое количество для вычитания',
        resourceType,
        operation: 'subtract',
        timestamp: Date.now()
      };
    }

    const oldValue = this.resources[resourceType] || 0;
    
    // Проверка достаточности ресурса
    if (!allowNegative && oldValue < amount) {
      return {
        success: false,
        error: 'Недостаточно ресурса для вычитания',
        oldValue,
        resourceType,
        operation: 'subtract',
        timestamp: Date.now()
      };
    }

    // Добавляем текущее значение в историю перед изменением
    this.addToResourceHistory(resourceType, oldValue, Date.now());
    
    const newValue = allowNegative ? oldValue - amount : Math.max(0, oldValue - amount);
    this.resources[resourceType] = newValue;

    return {
      success: true,
      oldValue,
      newValue,
      resourceType,
      operation: 'subtract',
      timestamp: Date.now()
    };
  }

  /**
   * Сбор ресурсов из контейнера
   * @returns Результат операции
   */
  public collectContainer(): ResourceOperationResult {
    try {
      // Получаем текущее значение снота в контейнере с защитой от NaN
      let containerSnot = typeof this.resources.containerSnot === 'number' ? this.resources.containerSnot : 0;
      
      // Проводим проверку на минимальное значение для сбора
      const MIN_COLLECTIBLE_AMOUNT = 0.000001; // Очень маленькое значение для контроля погрешности
      
      // Если значение контейнера слишком маленькое или ноль, используем запасное значение
      if (containerSnot < MIN_COLLECTIBLE_AMOUNT) {
        const DEFAULT_MIN_AMOUNT = 0.05; // Значение по умолчанию для сбора
        console.warn(`[ResourceManager] collectContainer: контейнер почти пуст (${containerSnot}), используем минимальное значение ${DEFAULT_MIN_AMOUNT}`);
        containerSnot = DEFAULT_MIN_AMOUNT;
      }
      
      // Проверяем текущее значение снота с защитой от NaN/null
      let oldSnotValue = typeof this.resources.snot === 'number' ? this.resources.snot : 0;
      
      // Проверяем и исправляем текущее значение снота, если оно некорректное
      if (isNaN(oldSnotValue)) {
        console.warn(`[ResourceManager] collectContainer: обнаружено некорректное значение snot (${oldSnotValue}), устанавливаем 0`);
        oldSnotValue = 0;
      }
      
      // Применяем защиту от резких изменений
      const threshold = this.maxResourceIncreaseThreshold['snot'];
      if (threshold && containerSnot > threshold) {
        console.warn(`[ResourceManager] Подозрительно большое значение в контейнере: ${containerSnot}. Применяем ограничение.`);
        containerSnot = threshold;
      }
      
      // Проверяем скорость изменения ресурса
      const isChangeValid = this.validateResourceChange('snot', containerSnot);
      if (!isChangeValid) {
        console.warn(`[ResourceManager] Обнаружено подозрительно быстрое изменение ресурса snot при сборе. Применяем ограничение.`);
        containerSnot = this.maxResourceIncreaseRatePerSecond['snot'] || containerSnot;
      }
      
      // Суммируем значения
      const newSnotValue = oldSnotValue + containerSnot;
      
      // Дополнительная проверка на корректность нового значения
      if (isNaN(newSnotValue)) {
        console.error(`[ResourceManager] collectContainer: некорректный результат сложения ${oldSnotValue} + ${containerSnot} = ${newSnotValue}`);
        return {
          success: false,
          error: `Ошибка при расчете нового значения: ${oldSnotValue} + ${containerSnot} = ${newSnotValue}`,
          oldValue: containerSnot,
          resourceType: 'containerSnot',
          operation: 'subtract',
          timestamp: Date.now()
        };
      }
      
      // Добавляем текущее значение в историю перед изменением
      this.addToResourceHistory('snot', oldSnotValue, Date.now());
      
      // Обновляем оба ресурса
      this.resources.snot = newSnotValue;
      this.resources.containerSnot = 0;
      
      // Логируем для диагностики
      console.log('[ResourceManager] collectContainer результат:', {
        oldSnot: oldSnotValue,
        newSnot: newSnotValue,
        collectedAmount: containerSnot
      });

      return {
        success: true,
        oldValue: containerSnot,
        newValue: 0,
        resourceType: 'containerSnot',
        operation: 'subtract',
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('[ResourceManager] Ошибка в collectContainer:', error);
      
      // Пытаемся выполнить прямую модификацию как запасной вариант
      try {
        const currentSnot = typeof this.resources.snot === 'number' ? this.resources.snot : 0;
        const containerValue = typeof this.resources.containerSnot === 'number' ? this.resources.containerSnot : 0.05;
        
        this.resources.snot = currentSnot + containerValue;
        this.resources.containerSnot = 0;
        
        console.log('[ResourceManager] collectContainer: выполнено прямое обновление после ошибки:', {
          oldSnot: currentSnot,
          newSnot: this.resources.snot,
          containerValue
        });
        
        return {
          success: true,
          oldValue: containerValue,
          newValue: 0,
          resourceType: 'containerSnot',
          operation: 'subtract',
          timestamp: Date.now()
        };
      } catch (fallbackError) {
        console.error('[ResourceManager] Ошибка при прямом обновлении в collectContainer:', fallbackError);
        
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Неизвестная ошибка при сборе',
          oldValue: 0,
          resourceType: 'containerSnot',
          operation: 'subtract',
          timestamp: Date.now()
        };
      }
    }
  }

  /**
   * Обновить заполнение контейнера на основе прошедшего времени
   * @param elapsedTimeMs Прошедшее время в миллисекундах
   * @returns Результат операции
   */
  public updateContainerFilling(elapsedTimeMs: number): ResourceOperationResult {
    if (elapsedTimeMs <= 0) {
      return {
        success: false,
        error: 'Недопустимое значение времени',
        resourceType: 'containerSnot',
        operation: 'add',
        timestamp: Date.now()
      };
    }

    const oldValue = this.resources.containerSnot || 0;
    const fillingSpeed = this.resources.fillingSpeed || 0.01;
    const containerCapacity = this.resources.containerCapacity || 1;
    
    // Расчет прироста на основе времени (в секундах)
    let elapsedTimeSeconds = elapsedTimeMs / 1000;
    
    // Проверка на подозрительно большое значение времени
    const MAX_VALID_TIME_SECONDS = 30; // Максимально допустимое время
    if (elapsedTimeSeconds > MAX_VALID_TIME_SECONDS) {
      console.warn(`[ResourceManager] Подозрительно большое значение времени: ${elapsedTimeSeconds}с. Применяем ограничение.`);
      elapsedTimeSeconds = MAX_VALID_TIME_SECONDS;
    }
    
    const increase = fillingSpeed * elapsedTimeSeconds;
    
    // Добавляем текущее значение в историю перед изменением
    this.addToResourceHistory('containerSnot', oldValue, Date.now());
    
    // Ограничиваем новое значение вместимостью контейнера
    const newValue = Math.min(containerCapacity, oldValue + increase);
    this.resources.containerSnot = newValue;
    
    // Обновляем временную метку
    this.resources.lastUpdateTimestamp = Date.now();

    return {
      success: true,
      oldValue,
      newValue,
      resourceType: 'containerSnot',
      operation: 'add',
      timestamp: Date.now()
    };
  }

  /**
   * Обновить емкость контейнера
   * @param newLevel Новый уровень емкости
   * @param newCapacity Новая емкость
   * @returns Результат операции
   */
  public upgradeContainerCapacity(newLevel: number, newCapacity: number): ResourceOperationResult {
    if (typeof newLevel !== 'number' || isNaN(newLevel) || newLevel <= 0) {
      return {
        success: false,
        error: 'Недопустимое значение уровня',
        resourceType: 'containerCapacityLevel',
        operation: 'set',
        timestamp: Date.now()
      };
    }

    if (typeof newCapacity !== 'number' || isNaN(newCapacity) || newCapacity <= 0) {
      return {
        success: false,
        error: 'Недопустимое значение емкости',
        resourceType: 'containerCapacity',
        operation: 'set',
        timestamp: Date.now()
      };
    }

    // Сохраняем старые значения
    const oldLevel = this.resources.containerCapacityLevel;
    const oldCapacity = this.resources.containerCapacity;
    
    // Обновляем значения
    this.resources.containerCapacityLevel = newLevel;
    this.resources.containerCapacity = newCapacity;
    
    // Если текущее заполнение превышает новую емкость, ограничиваем его
    if (this.resources.containerSnot > newCapacity) {
      this.resources.containerSnot = newCapacity;
    }

    return {
      success: true,
      oldValue: oldCapacity,
      newValue: newCapacity,
      resourceType: 'containerCapacity',
      operation: 'set',
      timestamp: Date.now()
    };
  }

  /**
   * Обновить скорость заполнения контейнера
   * @param newLevel Новый уровень скорости
   * @param newSpeed Новая скорость
   * @returns Результат операции
   */
  public upgradeFillingSpeed(newLevel: number, newSpeed: number): ResourceOperationResult {
    if (typeof newLevel !== 'number' || isNaN(newLevel) || newLevel <= 0) {
      return {
        success: false,
        error: 'Недопустимое значение уровня',
        resourceType: 'fillingSpeedLevel',
        operation: 'set',
        timestamp: Date.now()
      };
    }

    if (typeof newSpeed !== 'number' || isNaN(newSpeed) || newSpeed <= 0) {
      return {
        success: false,
        error: 'Недопустимое значение скорости',
        resourceType: 'fillingSpeed',
        operation: 'set',
        timestamp: Date.now()
      };
    }

    // Сохраняем старые значения
    const oldLevel = this.resources.fillingSpeedLevel;
    const oldSpeed = this.resources.fillingSpeed;
    
    // Обновляем значения
    this.resources.fillingSpeedLevel = newLevel;
    this.resources.fillingSpeed = newSpeed;

    return {
      success: true,
      oldValue: oldSpeed,
      newValue: newSpeed,
      resourceType: 'fillingSpeed',
      operation: 'set',
      timestamp: Date.now()
    };
  }

  /**
   * Создать ресурсы из состояния игры
   * @param gameState Состояние игры
   * @returns Ресурсы игры
   */
  public static fromGameState(gameState: ExtendedGameState): GameResources {
    return {
      snot: gameState.inventory.snot || 0,
      kingCoins: gameState.inventory.kingCoins || 0,
      containerSnot: gameState.inventory.containerSnot || 0.05,
      containerCapacity: gameState.inventory.containerCapacity || 1,
      containerCapacityLevel: gameState.inventory.containerCapacityLevel || 1,
      fillingSpeed: gameState.inventory.fillingSpeed || 0.01,
      fillingSpeedLevel: gameState.inventory.fillingSpeedLevel || 1,
      collectionEfficiency: gameState.inventory.collectionEfficiency || 1.0,
      lastUpdateTimestamp: gameState.inventory.lastUpdateTimestamp || Date.now()
    };
  }

  /**
   * Обновить состояние игры ресурсами
   * @param gameState Состояние игры для обновления
   * @returns Обновленное состояние игры
   */
  public updateGameState(gameState: ExtendedGameState): ExtendedGameState {
    const updatedState = { ...gameState };
    
    // Обновляем инвентарь
    updatedState.inventory = {
      ...updatedState.inventory,
      snot: this.resources.snot,
      kingCoins: this.resources.kingCoins,
      containerSnot: this.resources.containerSnot,
      containerCapacity: this.resources.containerCapacity,
      containerCapacityLevel: this.resources.containerCapacityLevel,
      fillingSpeed: this.resources.fillingSpeed,
      fillingSpeedLevel: this.resources.fillingSpeedLevel,
      collectionEfficiency: this.resources.collectionEfficiency,
      lastUpdateTimestamp: this.resources.lastUpdateTimestamp
    };
    
    // Обновляем контейнер
    updatedState.container = {
      ...updatedState.container,
      currentAmount: this.resources.containerSnot,
      capacity: this.resources.containerCapacity,
      fillingSpeed: this.resources.fillingSpeed,
      lastUpdateTimestamp: this.resources.lastUpdateTimestamp
    };
    
    // Обновляем улучшения
    updatedState.upgrades = {
      ...updatedState.upgrades,
      containerCapacity: {
        level: this.resources.containerCapacityLevel,
        cost: updatedState.upgrades.containerCapacity?.cost || 0
      },
      fillingSpeed: {
        level: this.resources.fillingSpeedLevel,
        cost: updatedState.upgrades.fillingSpeed?.cost || 0
      }
    };
    
    // Обновляем метаданные
    updatedState._lastModified = Date.now();
    updatedState._lastAction = 'resource_update';
    updatedState._lastActionTime = new Date().toISOString();
    
    return updatedState;
  }

  /**
   * Создать строку бэкапа ресурсов для хранения
   * @returns Строка JSON с ресурсами
   */
  public createBackup(): string {
    // Система сохранений отключена, просто возвращаем текущие ресурсы как JSON
    console.log('[ResourceManager] Создание бэкапа (система сохранений отключена)');
    return JSON.stringify(this.resources);
  }

  /**
   * Восстановить ресурсы из бэкапа
   * @param backupStr Строка JSON с ресурсами
   * @returns true если восстановление успешно, иначе false
   */
  public restoreFromBackup(backupStr: string): boolean {
    try {
      console.log('[ResourceManager] Восстановление из бэкапа (система сохранений отключена)');
      const backup = JSON.parse(backupStr);
      
      // Проверяем, что бэкап содержит основные ресурсы
      if (typeof backup.snot !== 'number' || typeof backup.containerSnot !== 'number') {
        return false;
      }
      
      // Восстанавливаем каждый ресурс с проверкой
      Object.keys(this.resources).forEach(key => {
        const resourceKey = key as keyof GameResources;
        if (typeof backup[resourceKey] === 'number' && !isNaN(backup[resourceKey])) {
          this.resources[resourceKey] = backup[resourceKey];
        }
      });
      
      // Обновляем временную метку
      this.resources.lastUpdateTimestamp = Date.now();
      
      return true;
    } catch (error) {
      console.error('Ошибка при восстановлении из бэкапа:', error);
      return false;
    }
  }

  /**
   * Добавляет запись в историю изменений ресурса
   * @param resourceType Имя ресурса
   * @param value Текущее значение
   * @param timestamp Временная метка
   */
  private addToResourceHistory(
    resourceType: keyof GameResources, 
    value: number, 
    timestamp: number
  ): void {
    const history = this.resourcesHistory.get(resourceType) || [];
    history.push({value, timestamp});
    
    // Удаляем старые записи, если превышен размер истории
    if (history.length > this.maxHistorySize) {
      history.shift();
    }
    
    this.resourcesHistory.set(resourceType, history);
  }
  
  /**
   * Проверяет валидность изменения ресурса на основе истории
   * @param resourceType Имя ресурса
   * @param amount Количество добавляемого ресурса
   * @returns true если изменение валидно, false если подозрительно
   */
  private validateResourceChange(
    resourceType: keyof GameResources, 
    amount: number
  ): boolean {
    const history = this.resourcesHistory.get(resourceType) || [];
    const currentTime = Date.now();
    
    // Если история пуста - считаем валидным
    if (history.length === 0) return true;
    
    // Проверяем скорость изменения ресурса за последнюю секунду
    const recentEntries = history.filter(
      entry => currentTime - entry.timestamp <= 1000
    );
    
    if (recentEntries.length > 0) {
      // Считаем сумму всех изменений за последнюю секунду
      const totalRecentIncrease = recentEntries.reduce(
        (sum, entry, index, array) => {
          if (index === 0) return 0;
          return sum + Math.max(0, entry.value - (array[index - 1]?.value || 0));
        }, 
        0
      );
      
      // Если сумма изменений + текущее изменение превышает порог - считаем подозрительным
      const maxRate = this.maxResourceIncreaseRatePerSecond[resourceType];
      if (maxRate && totalRecentIncrease + amount > maxRate) {
        console.warn(`[ResourceManager] Превышен лимит скорости изменения ${resourceType}: ${totalRecentIncrease} + ${amount} > ${maxRate} за последнюю секунду`);
        
        // Дополнительный мониторинг подозрительной активности
        const suspiciousActivity = {
          resourceType,
          currentAmount: amount,
          totalRecentIncrease,
          maxAllowedRate: maxRate,
          historyEntries: recentEntries,
          timestamp: new Date().toISOString()
        };
        
        console.error('[ResourceManager] Подозрительная активность:', JSON.stringify(suspiciousActivity));
        this.logSuspiciousActivity(suspiciousActivity);
        
        return false;
      }
    }
    
    // Проверяем величину одиночного изменения
    const maxThreshold = this.maxResourceIncreaseThreshold[resourceType];
    if (maxThreshold && amount > maxThreshold) {
      console.warn(`[ResourceManager] Превышен порог величины изменения ${resourceType}: ${amount} > ${maxThreshold}`);
      
      const suspiciousActivity = {
        resourceType,
        currentAmount: amount,
        maxAllowedThreshold: maxThreshold,
        timestamp: new Date().toISOString()
      };
      
      this.logSuspiciousActivity(suspiciousActivity);
      return false;
    }
    
    return true;
  }
  
  private logSuspiciousActivity(activity: any): void {
    try {
      // Получаем существующие записи из localStorage
      const storedLogs = localStorage.getItem('resource-suspicious-activities');
      const logs = storedLogs ? JSON.parse(storedLogs) : [];
      
      // Добавляем новую запись
      logs.push({
        ...activity,
        currentResources: { ...this.resources },
        userAgent: navigator.userAgent,
      });
      
      // Ограничиваем количество записей для предотвращения переполнения localStorage
      const maxLogs = 50;
      const trimmedLogs = logs.slice(-maxLogs);
      
      // Сохраняем обратно в localStorage
      localStorage.setItem('resource-suspicious-activities', JSON.stringify(trimmedLogs));
      
    } catch (error) {
      console.error('[ResourceManager] Ошибка при сохранении записи о подозрительной активности:', error);
    }
  }
} 