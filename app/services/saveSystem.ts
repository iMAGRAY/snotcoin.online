/**
 * Простая система сохранения игрового прогресса
 * Использует только localStorage для упрощения и повышения надежности
 */
import { ExtendedGameState } from '../types/gameTypes';
import * as localStorage from './storage/localStorageService';

/**
 * Результат операции сохранения/загрузки
 */
export interface SaveResult {
  success: boolean;         // Успешность операции
  message?: string;         // Сообщение об операции
  error?: string;           // Ошибка (если есть)
  timestamp: number;        // Время операции
  data?: ExtendedGameState | undefined; // Данные (только для загрузки)
  metrics?: {
    duration: number;       // Длительность операции в мс
    dataSize?: number;      // Размер данных в байтах
  };
}

/**
 * Информация о сохранениях
 */
export interface SaveInfo {
  local?: {
    timestamp?: number;     // Время последнего сохранения
    version?: number;       // Версия сохранения
    size?: number;          // Размер сохранения в байтах
  };
}

/**
 * Опции системы сохранения
 */
export interface SaveSystemOptions {
  enableAutoSave: boolean;       // Автоматическое сохранение
  autoSaveInterval: number;      // Интервал автосохранения в мс
}

// Опции по умолчанию
const DEFAULT_OPTIONS: SaveSystemOptions = {
  enableAutoSave: true,
  autoSaveInterval: 60000 // 1 минута
};

/**
 * Система сохранения игрового прогресса
 */
export class SaveSystem {
  private userId: string;
  private options: SaveSystemOptions;
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private lastGameState: ExtendedGameState | null = null;
  
  /**
   * Создает экземпляр системы сохранения
   * @param userId ID пользователя
   * @param options Опции системы сохранения
   */
  constructor(userId: string, options?: Partial<SaveSystemOptions>) {
    this.userId = userId;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    
    // Сохраняем ID пользователя
    localStorage.saveUserId(userId);
  }
  
  /**
   * Инициализирует систему сохранения
   */
  async initialize(): Promise<SaveResult> {
    const startTime = Date.now();
    
    try {
      // Проверяем доступность localStorage
      if (!localStorage.isLocalStorageAvailable()) {
        return {
          success: false,
          message: "localStorage недоступен",
          error: "Хранилище недоступно",
          timestamp: Date.now(),
          metrics: { duration: Date.now() - startTime }
        };
      }
      
      // Пробуем загрузить сохранение
      const loadResult = await this.load();
      
      // Запускаем автосохранение
      if (this.options.enableAutoSave) {
        this.startAutoSave();
      }
      
      return {
        success: true,
        message: "Система сохранений инициализирована",
        timestamp: Date.now(),
        data: loadResult.data,
        metrics: { duration: Date.now() - startTime }
      };
    } catch (error) {
      return {
        success: false,
        message: "Ошибка инициализации системы сохранений",
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
        metrics: { duration: Date.now() - startTime }
      };
    }
  }
  
  /**
   * Сохраняет состояние игры
   * @param state Состояние для сохранения
   */
  async save(state: ExtendedGameState): Promise<SaveResult> {
    const startTime = Date.now();
    
    try {
      if (!this.userId) {
        throw new Error("ID пользователя не указан");
      }
      
      // Сохраняем последнее состояние
      this.lastGameState = state;
      
      // Вычисляем размер данных
      const stateJson = JSON.stringify(state);
      const dataSize = stateJson.length;
      
      // Сохраняем в localStorage
      const success = localStorage.saveGameState(this.userId, state);
      
      if (!success) {
        throw new Error("Не удалось сохранить состояние в localStorage");
      }
      
      return {
        success: true,
        message: "Состояние сохранено",
        timestamp: Date.now(),
        metrics: {
          duration: Date.now() - startTime,
          dataSize
        }
      };
    } catch (error) {
      return {
        success: false,
        message: "Ошибка при сохранении состояния",
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
        metrics: { duration: Date.now() - startTime }
      };
    }
  }

  /**
   * Загружает состояние игры
   */
  async load(): Promise<SaveResult> {
    const startTime = Date.now();
    
    try {
      if (!this.userId) {
        throw new Error("ID пользователя не указан");
      }
      
      // Загружаем из localStorage
      const state = localStorage.loadGameState(this.userId);
      
      if (!state) {
        return {
          success: false,
          message: "Сохранение не найдено",
          error: "Данные не найдены",
          timestamp: Date.now(),
          metrics: { duration: Date.now() - startTime }
        };
      }
      
      // Сохраняем последнее состояние
      this.lastGameState = state;
      
      // Вычисляем размер данных
      const dataSize = JSON.stringify(state).length;
      
      return {
        success: true,
        message: "Состояние загружено",
        timestamp: Date.now(),
        data: state,
        metrics: {
          duration: Date.now() - startTime,
          dataSize
        }
      };
    } catch (error) {
      return {
        success: false,
        message: "Ошибка при загрузке состояния",
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
        metrics: { duration: Date.now() - startTime }
      };
    }
  }
  
  /**
   * Удаляет все данные пользователя
   */
  async resetData(): Promise<SaveResult> {
    const startTime = Date.now();
    
    try {
      if (!this.userId) {
        throw new Error("ID пользователя не указан");
      }
      
      // Удаляем из localStorage
      const success = localStorage.deleteGameState(this.userId);
      
      this.lastGameState = null;
      
      return {
        success: success,
        message: success ? "Данные удалены" : "Ошибка при удалении данных",
        timestamp: Date.now(),
        metrics: { duration: Date.now() - startTime }
      };
    } catch (error) {
      return {
        success: false,
        message: "Ошибка при удалении данных",
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
        metrics: { duration: Date.now() - startTime }
      };
    }
  }
  
  /**
   * Экспортирует состояние игры в строку
   */
  async exportToString(): Promise<string | null> {
    try {
      const state = this.lastGameState || await localStorage.loadGameState(this.userId);
      
      if (!state) {
        return null;
      }
      
      return JSON.stringify(state);
    } catch (error) {
      console.error("[SaveSystem] Ошибка при экспорте состояния:", error);
      return null;
    }
  }
  
  /**
   * Импортирует состояние из строки
   * @param exportedState Строка с экспортированным состоянием
   */
  async importFromString(exportedState: string): Promise<SaveResult> {
    const startTime = Date.now();
    
    try {
      if (!exportedState) {
        throw new Error("Пустая строка экспорта");
      }
      
      // Парсим состояние
      const state = JSON.parse(exportedState) as ExtendedGameState;
      
      // Проверяем корректность структуры
      if (!state || typeof state !== 'object') {
        throw new Error("Некорректный формат данных");
      }
      
      // Добавляем метаданные
      state._userId = this.userId;
      state._lastModified = Date.now();
      state._savedAt = new Date().toISOString();
      
      // Сохраняем в localStorage
      const success = localStorage.saveGameState(this.userId, state);
      
      if (!success) {
        throw new Error("Не удалось сохранить импортированное состояние");
      }
      
      // Сохраняем последнее состояние
      this.lastGameState = state;
      
      return {
        success: true,
        message: "Состояние импортировано",
        timestamp: Date.now(),
        data: state,
        metrics: { duration: Date.now() - startTime }
      };
    } catch (error) {
      return {
        success: false,
        message: "Ошибка при импорте состояния",
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
        metrics: { duration: Date.now() - startTime }
      };
    }
  }
  
  /**
   * Получает информацию о сохранениях
   */
  async getSaveInfo(): Promise<SaveInfo> {
    try {
      if (!this.userId) {
        return {};
      }
      
      // Проверяем наличие сохранения
      const hasState = localStorage.hasGameState(this.userId);
      
      if (!hasState) {
        return {};
      }
      
      // Загружаем состояние для получения метаданных
      const state = localStorage.loadGameState(this.userId);
      
      return {
        local: {
          timestamp: state?._lastModified || Date.now(),
          version: state?._saveVersion || 1,
          size: state ? JSON.stringify(state).length : 0
        }
      };
    } catch (error) {
      console.error("[SaveSystem] Ошибка при получении информации о сохранениях:", error);
      return {};
    }
  }
  
  /**
   * Запускает автосохранение
   */
  startAutoSave(): void {
    this.stopAutoSave();
    
    this.autoSaveTimer = setInterval(() => {
      if (this.lastGameState) {
        this.save(this.lastGameState).catch(error => {
          console.error("[SaveSystem] Ошибка при автосохранении:", error);
        });
      }
    }, this.options.autoSaveInterval);
  }
  
  /**
   * Останавливает автосохранение
   */
  stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }
  
  /**
   * Включает или выключает автосохранение
   */
  setAutoSave(enabled: boolean): void {
    this.options.enableAutoSave = enabled;
    
    if (enabled) {
      this.startAutoSave();
    } else {
      this.stopAutoSave();
    }
  }
  
  /**
   * Устанавливает интервал автосохранения
   */
  setAutoSaveInterval(interval: number): void {
    this.options.autoSaveInterval = interval;
    
    if (this.options.enableAutoSave && this.autoSaveTimer) {
      this.stopAutoSave();
      this.startAutoSave();
    }
  }
  
  /**
   * Уничтожает систему сохранения
   */
  destroy(): void {
    this.stopAutoSave();
    this.lastGameState = null;
  }

  /**
   * Создаёт экстренную резервную копию состояния игры
   * @param state Текущее состояние игры для экстренного сохранения
   */
  createEmergencyBackup(state: ExtendedGameState): void {
    try {
      if (!this.userId || !state) {
        console.error("[SaveSystem] Не удалось создать экстренную копию: отсутствует ID пользователя или состояние");
        return;
      }
      
      if (typeof localStorage !== 'undefined' && localStorage.isLocalStorageAvailable()) {
        // Используем специальную функцию для сохранения резервной копии
        const success = localStorage.saveGameStateBackup(this.userId, state);
        
        if (success) {
          console.log("[SaveSystem] Экстренная резервная копия создана успешно");
        } else {
          console.error("[SaveSystem] Не удалось создать экстренную резервную копию");
        }
      }
    } catch (error) {
      console.error("[SaveSystem] Ошибка при создании экстренной копии:", error);
    }
  }
} 