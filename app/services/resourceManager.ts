'use client';

import { ExtendedGameState } from '../types/gameTypes';

/**
 * Интерфейс для ресурсов игры
 */
export interface GameResources {
  snot: number;
  snotCoins: number;
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
    snotCoins: 0,
    containerSnot: 0.05,
    containerCapacity: 1,
    containerCapacityLevel: 1, 
    fillingSpeed: 0.01,
    fillingSpeedLevel: 1,
    collectionEfficiency: 1.0,
    lastUpdateTimestamp: Date.now() as number
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
      currentValue: this.resources[resourceType],
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
        currentValue: this.resources[resourceType],
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
    const elapsedTimeSeconds = elapsedTimeMs / 1000;
    const increase = fillingSpeed * elapsedTimeSeconds;
    
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
   * @param state Состояние игры
   * @returns Ресурсы игры
   */
  public static fromGameState(state: ExtendedGameState): GameResources {
    const inventory = state.inventory || {};
    
    console.log('[ResourceManager.fromGameState] Создание ресурсов из состояния игры');
    console.log('[ResourceManager.fromGameState] Система сохранений отключена');
    
    // Создаем текущее время как число для lastUpdateTimestamp
    const currentTime: number = Date.now();
    
    // Гарантируем, что все значения будут числами и имеют значения по умолчанию
    return {
      snot: typeof inventory.snot === 'number' && !isNaN(inventory.snot) ? inventory.snot : 0,
      snotCoins: typeof inventory.snotCoins === 'number' && !isNaN(inventory.snotCoins) ? inventory.snotCoins : 0,
      containerSnot: typeof inventory.containerSnot === 'number' && !isNaN(inventory.containerSnot) ? inventory.containerSnot : 0.05,
      containerCapacity: typeof inventory.containerCapacity === 'number' && !isNaN(inventory.containerCapacity) ? inventory.containerCapacity : 1,
      containerCapacityLevel: typeof inventory.containerCapacityLevel === 'number' && !isNaN(inventory.containerCapacityLevel) ? inventory.containerCapacityLevel : 1,
      fillingSpeed: typeof inventory.fillingSpeed === 'number' && !isNaN(inventory.fillingSpeed) ? inventory.fillingSpeed : 0.01,
      fillingSpeedLevel: typeof inventory.fillingSpeedLevel === 'number' && !isNaN(inventory.fillingSpeedLevel) ? inventory.fillingSpeedLevel : 1,
      collectionEfficiency: typeof inventory.collectionEfficiency === 'number' && !isNaN(inventory.collectionEfficiency) ? inventory.collectionEfficiency : 1.0,
      lastUpdateTimestamp: typeof inventory.lastUpdateTimestamp === 'number' && !isNaN(inventory.lastUpdateTimestamp) ? inventory.lastUpdateTimestamp : currentTime
    };
  }

  /**
   * Обновить состояние игры ресурсами
   * @param state Состояние игры для обновления
   * @returns Обновленное состояние игры
   */
  public updateGameState(state: ExtendedGameState): ExtendedGameState {
    const updatedState = {
      ...state,
      inventory: {
        ...state.inventory,
        ...this.resources
      }
    };

    // Логируем, что система сохранений отключена
    console.log('[ResourceManager] Система сохранений отключена');

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
} 