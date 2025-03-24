import { GameState } from "@/app/types/gameTypes";
import { initialState } from "@/app/constants/gameConstants";
import * as uuid from "uuid";
import * as LZString from "lz-string";

// Константы для системы сохранения
const SAVE_VERSION = 1;
const LOCAL_SAVE_INTERVAL = 30 * 1000; // 30 секунд
const SERVER_SAVE_INTERVAL = 2 * 60 * 1000; // 2 минуты
const CONFLICT_THRESHOLD = 5 * 60 * 1000; // 5 минут

// Расширяем тип игрового состояния для нужд системы сохранений
interface ExtendedGameState extends GameState {
  _saveVersion?: number;
  _lastSavedAt?: string;
  _serverSavedAt?: string;
  _isDelta?: boolean;
  _baseVersion?: number;
  _saveId?: string;
  _mergedAt?: string; // Метка времени последнего слияния состояний
}

// Интерфейс для дельта-изменений состояния
interface DeltaChanges {
  _isDelta: true;
  _baseVersion: number;
  changes: Record<string, any>;
}

// Опции для сохранения
interface SaveOptions {
  forceFull?: boolean; // Принудительно полное сохранение, а не дельта
  skipServer?: boolean; // Пропустить сохранение на сервер
  skipLocal?: boolean; // Пропустить локальное сохранение
}

// Абстрактный интерфейс для адаптеров хранилища
interface StorageAdapter {
  save(key: string, data: any): Promise<boolean>;
  load(key: string): Promise<any>;
  delete(key: string): Promise<boolean>;
}

/**
 * Адаптер для работы с localStorage
 */
class LocalStorageAdapter implements StorageAdapter {
  /**
   * Сохраняет данные в localStorage с компрессией
   */
  async save(key: string, data: any): Promise<boolean> {
    try {
      const serialized = JSON.stringify(data);
      const compressed = LZString.compressToUTF16(serialized);
      
      localStorage.setItem(key, compressed);
      return true;
    } catch (error) {
      console.error('Ошибка при сохранении в localStorage:', error);
      return false;
    }
  }

  /**
   * Загружает данные из localStorage с декомпрессией
   */
  async load(key: string): Promise<any> {
    try {
      const compressed = localStorage.getItem(key);
      
      if (!compressed) {
        return null;
      }
      
      const serialized = LZString.decompressFromUTF16(compressed);
      
      if (!serialized) {
        return null;
      }
      
      return JSON.parse(serialized);
    } catch (error) {
      console.error('Ошибка при загрузке из localStorage:', error);
      return null;
    }
  }

  /**
   * Удаляет данные из localStorage
   */
  async delete(key: string): Promise<boolean> {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Ошибка при удалении из localStorage:', error);
      return false;
    }
  }
}

/**
 * Адаптер для работы с API сервера через fetch
 */
class ServerApiAdapter implements StorageAdapter {
  private userId: string;
  private authToken: string;
  private baseUrl: string;

  constructor(userId: string, authToken: string, baseUrl: string = '') {
    this.userId = userId;
    this.authToken = authToken;
    this.baseUrl = baseUrl;
  }

  /**
   * Сохраняет данные через API
   */
  async save(key: string, data: any): Promise<boolean> {
    try {
      // Проверяем авторизацию
      if (!this.userId || !this.authToken) {
        console.error('Отсутствуют данные для авторизации');
        return false;
      }

      const response = await fetch(`${this.baseUrl}/api/game/savestate/${this.userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ошибка сохранения (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      
      // Сохраняем локальную версию для оптимизации будущих запросов
      if (result.version) {
        this.saveLocalVersion(result.version);
      }
      
      return result.success === true;
    } catch (error) {
      console.error('Ошибка при сохранении на сервер:', error);
      return false;
    }
  }

  /**
   * Загружает данные через API
   */
  async load(key: string): Promise<any> {
    try {
      // Проверяем авторизацию
      if (!this.userId || !this.authToken) {
        console.error('Отсутствуют данные для авторизации');
        return null;
      }

      // Получаем последнюю версию локально (для оптимизации загрузки)
      const lastVersion = await this.getLocalVersion();
      
      const response = await fetch(
        `${this.baseUrl}/api/game/savestate/${this.userId}?lastKnownVersion=${lastVersion}`, 
        {
          headers: {
            'Authorization': `Bearer ${this.authToken}`
          }
        }
      );

      // Если версия локально последняя, сервер вернет 304
      if (response.status === 304) {
        console.log('Локальная версия актуальна, загрузка с сервера не требуется');
        return null;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ошибка загрузки (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      
      // Сохраняем версию, если она пришла от сервера
      if (data && data._saveVersion) {
        this.saveLocalVersion(data._saveVersion);
      }
      
      return data;
    } catch (error) {
      console.error('Ошибка при загрузке с сервера:', error);
      return null;
    }
  }

  /**
   * Удаляет данные через API
   */
  async delete(key: string): Promise<boolean> {
    // Удаление через API не поддерживается для защиты данных
    console.warn('Прямое удаление данных с сервера не реализовано');
    return false;
  }
  
  /**
   * Получает локальную версию сохранения для оптимизации запросов
   */
  private async getLocalVersion(): Promise<number> {
    try {
      const localKey = `${this.userId}_version`;
      const version = localStorage.getItem(localKey);
      return version ? parseInt(version, 10) : 0;
    } catch (error) {
      return 0;
    }
  }
  
  /**
   * Сохраняет локальную версию
   */
  saveLocalVersion(version: number): void {
    try {
      const localKey = `${this.userId}_version`;
      localStorage.setItem(localKey, version.toString());
    } catch (error) {
      console.error('Ошибка при сохранении версии:', error);
    }
  }
}

/**
 * Основной класс системы сохранения
 */
export class SaveSystem {
  private userId: string | null = null;
  private authToken: string | null = null;
  private localAdapter: LocalStorageAdapter;
  private serverAdapter: ServerApiAdapter | null = null;

  private lastLocalSave: number = 0;
  private lastServerSave: number = 0;
  private lastLoadedState: ExtendedGameState | null = null;
  private autoSaveTimeout: NodeJS.Timeout | null = null;
  private saveInProgress: boolean = false;

  private saveKey: string = 'snotcoin_save';
  
  constructor() {
    this.localAdapter = new LocalStorageAdapter();
  }

  /**
   * Устанавливает данные пользователя для сохранений
   */
  setUserData(userId: string, authToken: string): void {
    this.userId = userId;
    this.authToken = authToken;
    this.serverAdapter = new ServerApiAdapter(userId, authToken);
    this.saveKey = `snotcoin_save_${userId}`;
  }

  /**
   * Получает ID пользователя
   */
  getUserId(): string | null {
    return this.userId;
  }

  /**
   * Проверяет, инициализирована ли система сохранений с данными пользователя
   */
  isInitialized(): boolean {
    return !!this.userId && !!this.authToken && !!this.serverAdapter;
  }

  /**
   * Запускает автосохранение
   */
  startAutoSave(): void {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }

    this.autoSaveTimeout = setTimeout(() => {
      this.autoSave();
    }, LOCAL_SAVE_INTERVAL);
  }

  /**
   * Останавливает автосохранение
   */
  stopAutoSave(): void {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
      this.autoSaveTimeout = null;
    }
  }

  /**
   * Логика автосохранения
   */
  private async autoSave(): Promise<void> {
    if (this.saveInProgress) {
      // Если сохранение уже идет, откладываем следующее
      this.startAutoSave();
      return;
    }

    // Проверяем, есть ли загруженное состояние
    if (!this.lastLoadedState) {
      console.warn('Автосохранение пропущено: нет загруженного состояния');
      this.startAutoSave();
      return;
    }

    const now = Date.now();
    const options: SaveOptions = {};

    // Определяем нужно ли сохранять на сервер
    if (now - this.lastServerSave >= SERVER_SAVE_INTERVAL) {
      // Пришло время сохранять на сервер
      options.skipLocal = false;
      options.skipServer = false;
    } else {
      // Сохраняем только локально
      options.skipServer = true;
    }

    try {
      // Запускаем сохранение
      const saveResult = await this.save(this.lastLoadedState, options);
      
      if (!saveResult) {
        console.warn('Автосохранение не удалось, попробуем снова через сокращенный интервал');
        // При неудаче пробуем сохранить чаще, но только локально
        setTimeout(() => {
          this.autoSave();
        }, Math.floor(LOCAL_SAVE_INTERVAL / 2));
        return;
      }
    } catch (error) {
      console.error('Ошибка при автосохранении:', error);
      // При ошибке также пробуем сохранить чаще, но только локально
      setTimeout(() => {
        this.autoSave();
      }, Math.floor(LOCAL_SAVE_INTERVAL / 2));
      return;
    }

    // Планируем следующее автосохранение
    this.startAutoSave();
  }

  /**
   * Сохраняет игровое состояние
   * @param state Текущее игровое состояние
   * @param options Опции сохранения
   */
  async save(state: ExtendedGameState, options: SaveOptions = {}): Promise<boolean> {
    if (!state) {
      console.error('Попытка сохранить пустое состояние');
      return false;
    }

    this.saveInProgress = true;
    let success = true;
    
    try {
      // Создаем копию состояния для сохранения
      const stateToSave: ExtendedGameState = this.deepClone(state);
      
      // Добавляем метаданные сохранения
      stateToSave._saveVersion = stateToSave._saveVersion || 0;
      stateToSave._lastSavedAt = new Date().toISOString();
      
      // Генерируем уникальный ID сохранения, если его нет
      if (!stateToSave._saveId) {
        stateToSave._saveId = uuid.v4();
      }
      
      // Локальное сохранение
      if (!options.skipLocal) {
        const localSuccess = await this.localAdapter.save(this.saveKey, stateToSave);
        if (localSuccess) {
          this.lastLocalSave = Date.now();
        } else {
          success = false;
        }
      }
      
      // Сохранение на сервер
      if (!options.skipServer && this.serverAdapter && this.isInitialized()) {
        // Проверяем, есть ли существенные изменения, требующие сохранения на сервер
        if (options.forceFull || this.hasSignificantChanges(this.lastLoadedState, stateToSave)) {
          // Создаем дельту для оптимизации передачи данных
          let dataToSave: ExtendedGameState | DeltaChanges = stateToSave;
          
          if (!options.forceFull && this.lastLoadedState && this.lastLoadedState._saveVersion) {
            const delta = this.createStateDelta(this.lastLoadedState, stateToSave);
            if (delta) {
              dataToSave = delta;
            }
          }
          
          const serverSuccess = await this.serverAdapter.save(this.saveKey, dataToSave);
          if (serverSuccess) {
            this.lastServerSave = Date.now();
            stateToSave._serverSavedAt = new Date().toISOString();
            
            // Обновляем локальную копию с отметкой о серверном сохранении
            if (!options.skipLocal) {
              await this.localAdapter.save(this.saveKey, stateToSave);
            }
          } else {
            // При ошибке сохранения, только отметим что было неудачно
            success = false;
          }
        } else {
          console.log('Пропуск сохранения на сервер: нет существенных изменений');
        }
      }
      
      // Сохраняем последнее состояние для дальнейшего определения изменений
      this.lastLoadedState = this.deepClone(stateToSave);
      
      return success;
    } catch (error) {
      console.error('Ошибка при сохранении:', error);
      return false;
    } finally {
      this.saveInProgress = false;
    }
  }

  /**
   * Проверяет, есть ли в состоянии существенные изменения, требующие сохранения
   */
  private hasSignificantChanges(oldState: ExtendedGameState | null, newState: ExtendedGameState): boolean {
    if (!oldState) return true;
    
    try {
      // Проверяем изменения в ключевых параметрах игры
      // (можно настроить для конкретной игры, какие изменения считать существенными)
      
      // Проверяем изменение основных показателей
      if (oldState.inventory?.snot !== newState.inventory?.snot ||
          oldState.inventory?.snotCoins !== newState.inventory?.snotCoins ||
          oldState.container?.level !== newState.container?.level) {
        return true;
      }
      
      // Проверяем изменения в апгрейдах
      if (JSON.stringify(oldState.upgrades) !== JSON.stringify(newState.upgrades)) {
        return true;
      }
      
      // Проверяем время - если прошло более 5 минут, сохраняем в любом случае
      const oldTime = oldState._lastSavedAt ? new Date(oldState._lastSavedAt).getTime() : 0;
      const currentTime = Date.now();
      if (currentTime - oldTime > 5 * 60 * 1000) {
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Ошибка при проверке изменений:', error);
      return true; // В случае ошибки лучше сохранить
    }
  }

  /**
   * Загружает игровое состояние
   * @param forceServer Принудительно загрузить с сервера
   * @returns Загруженное состояние или null
   */
  async load(forceServer: boolean = false): Promise<ExtendedGameState | null> {
    try {
      let serverState: ExtendedGameState | null = null;
      let localState: ExtendedGameState | null = null;
      
      // Загружаем локальные данные
      if (!forceServer) {
        localState = await this.localAdapter.load(this.saveKey) as ExtendedGameState | null;
      }
      
      // Загружаем серверные данные, если доступны и пользователь аутентифицирован
      if (this.serverAdapter && this.isInitialized()) {
        serverState = await this.serverAdapter.load(this.saveKey) as ExtendedGameState | null;
      }
      
      // Если есть и локальные, и серверные данные - разрешаем конфликты
      if (localState && serverState) {
        const resolvedState = this.resolveStateConflict(localState, serverState);
        this.lastLoadedState = resolvedState;
        return resolvedState;
      }
      
      // Если есть только один источник данных
      const state = serverState || localState;
      
      if (!state) {
        // Если нет данных, возвращаем начальное состояние
        const initialGameState: ExtendedGameState = {
          ...initialState,
          _saveVersion: SAVE_VERSION,
          _lastSavedAt: new Date().toISOString(),
          _saveId: uuid.v4()
        };
        
        this.lastLoadedState = initialGameState;
        return initialGameState;
      }
      
      // Проверяем, является ли состояние дельта-состоянием
      if (this.isDeltaState(state)) {
        console.error('Получено дельта-состояние, но нет базового состояния для применения');
        return null;
      }
      
      this.lastLoadedState = state;
      return state;
    } catch (error) {
      console.error('Ошибка при загрузке игрового состояния:', error);
      
      // В случае ошибки при загрузке с сервера, пытаемся вернуть локальное сохранение
      if (!forceServer) {
        try {
          const fallbackState = await this.localAdapter.load(this.saveKey) as ExtendedGameState | null;
          if (fallbackState) {
            console.warn('Используем локальное сохранение после ошибки сервера');
            this.lastLoadedState = fallbackState;
            return fallbackState;
          }
        } catch (localError) {
          console.error('Ошибка при резервной загрузке из локального хранилища:', localError);
        }
      }
      
      return null;
    }
  }

  /**
   * Разрешает конфликт между локальным и серверным состоянием
   * @param localState Локальное состояние
   * @param serverState Серверное состояние
   * @returns Разрешенное состояние
   */
  private resolveStateConflict(
    localState: ExtendedGameState, 
    serverState: ExtendedGameState
  ): ExtendedGameState {
    // Проверяем, является ли серверное состояние дельтой
    if (this.isDeltaState(serverState)) {
      // Если это дельта, применяем ее к локальному состоянию
      return this.applyDelta(localState, serverState as any);
    }
    
    try {
      // Получаем временные метки
      const localTimestamp = localState._lastSavedAt 
        ? new Date(localState._lastSavedAt).getTime() 
        : 0;
        
      const serverTimestamp = serverState._serverSavedAt 
        ? new Date(serverState._serverSavedAt).getTime() 
        : 0;
        
      // Проверяем на различия в версиях
      const localVersion = localState._saveVersion || 0;
      const serverVersion = serverState._saveVersion || 0;
      
      // Если разница во времени между сохранениями меньше порогового значения,
      // выполняем умное слияние данных
      const timeDiff = Math.abs(localTimestamp - serverTimestamp);
      
      if (timeDiff < CONFLICT_THRESHOLD) {
        console.log('Обнаружен незначительный конфликт данных, выполняем умное слияние');
        return this.mergeStates(localState, serverState);
      }
      
      // Если версии совпадают, выбираем более новое состояние
      if (localVersion === serverVersion) {
        return localTimestamp > serverTimestamp ? localState : serverState;
      }
      
      // Если версии разные, но близкие, пытаемся объединить данные
      if (Math.abs(localVersion - serverVersion) <= 3) {
        return this.mergeStates(localState, serverState, true);
      }
      
      // Если версии сильно различаются, предпочитаем более новую версию
      return serverVersion > localVersion ? serverState : localState;
    } catch (error) {
      console.error('Ошибка при разрешении конфликта состояний:', error);
      
      // В случае ошибки возвращаем самое новое состояние по временной метке
      const localTimestamp = localState._lastSavedAt 
        ? new Date(localState._lastSavedAt).getTime() 
        : 0;
        
      const serverTimestamp = serverState._serverSavedAt 
        ? new Date(serverState._serverSavedAt).getTime() 
        : 0;
        
      return localTimestamp > serverTimestamp ? localState : serverState;
    }
  }
  
  /**
   * Выполняет умное слияние двух состояний
   * @param localState Локальное состояние
   * @param serverState Серверное состояние
   * @param preferNewer Предпочитать более новые данные при конфликтах
   * @returns Объединенное состояние
   */
  private mergeStates(
    localState: ExtendedGameState,
    serverState: ExtendedGameState,
    preferNewer: boolean = false
  ): ExtendedGameState {
    // Создаем базовое состояние из более нового
    const localTime = localState._lastSavedAt 
      ? new Date(localState._lastSavedAt).getTime() 
      : 0;
      
    const serverTime = serverState._serverSavedAt 
      ? new Date(serverState._serverSavedAt).getTime() 
      : 0;
      
    // Определяем, какое состояние более новое
    const isLocalNewer = localTime > serverTime;
    
    // Выбираем базовое состояние
    const baseState = isLocalNewer ? this.deepClone(localState) : this.deepClone(serverState);
    const otherState = isLocalNewer ? serverState : localState;
    
    // Критические данные, которые нельзя потерять
    const criticalPaths = [
      'inventory.snotCoins',
      'inventory.snot',
      'container.level',
      'upgrades'
    ];
    
    try {
      // Обходим критические пути и проверяем на потерю данных
      for (const path of criticalPaths) {
        const parts = path.split('.');
        let baseValue: any = baseState;
        let otherValue: any = otherState;
        
        for (const part of parts) {
          if (baseValue === undefined || baseValue === null) break;
          if (otherValue === undefined || otherValue === null) break;
          
          baseValue = baseValue[part];
          otherValue = otherValue[part];
        }
        
        // Если значение существует в другом состоянии, но отсутствует в базовом,
        // либо значение в другом состоянии больше (для числовых значений),
        // копируем его из другого состояния
        if (baseValue === undefined && otherValue !== undefined) {
          this.setValueByPath(baseState, path, otherValue);
        } else if (
          typeof baseValue === 'number' &&
          typeof otherValue === 'number' &&
          otherValue > baseValue
        ) {
          if (preferNewer || path.includes('inventory') || path.includes('container')) {
            this.setValueByPath(baseState, path, otherValue);
          }
        }
      }
      
      // Проверяем на новые элементы, которых может не быть в базовом состоянии
      this.mergeArrays(baseState, otherState, 'upgrades');
      this.mergeArrays(baseState, otherState, 'inventory.items');
      this.mergeArrays(baseState, otherState, 'achievements');
      
      // Обновляем метаданные слияния
      baseState._mergedAt = new Date().toISOString();
      baseState._saveVersion = Math.max(
        baseState._saveVersion || 0,
        otherState._saveVersion || 0
      ) + 1;
      
      return baseState;
    } catch (error) {
      console.error('Ошибка при слиянии состояний:', error);
      // В случае ошибки возвращаем состояние, выбранное в начале
      return baseState;
    }
  }
  
  /**
   * Устанавливает значение в объекте по указанному пути
   * @param obj Объект для изменения
   * @param path Путь в формате 'a.b.c'
   * @param value Значение для установки
   */
  private setValueByPath(obj: any, path: string, value: any): void {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (current[part] === undefined) {
        current[part] = {};
      }
      current = current[part];
    }
    
    current[parts[parts.length - 1]] = value;
  }
  
  /**
   * Объединяет массивы из двух состояний
   * @param baseState Базовое состояние
   * @param otherState Другое состояние
   * @param path Путь к массиву
   */
  private mergeArrays(baseState: any, otherState: any, path: string): void {
    try {
      const parts = path.split('.');
      let baseArray: any[] | undefined;
      let otherArray: any[] | undefined;
      
      // Получаем ссылки на массивы
      let baseCurrent = baseState;
      let otherCurrent = otherState;
      
      for (const part of parts) {
        if (!baseCurrent || !otherCurrent) return;
        
        baseCurrent = baseCurrent[part];
        otherCurrent = otherCurrent[part];
      }
      
      baseArray = baseCurrent;
      otherArray = otherCurrent;
      
      // Если обе ссылки - массивы, объединяем их
      if (Array.isArray(baseArray) && Array.isArray(otherArray)) {
        // Предполагаем, что массивы содержат объекты с id
        const baseIds = new Set(baseArray.map(item => item.id || JSON.stringify(item)));
        
        // Добавляем элементы, которых нет в базовом массиве
        for (const item of otherArray) {
          const itemId = item.id || JSON.stringify(item);
          if (!baseIds.has(itemId)) {
            baseArray.push(item);
          }
        }
      }
    } catch (error) {
      console.error(`Ошибка при объединении массивов по пути ${path}:`, error);
    }
  }

  /**
   * Создает дельту изменений между двумя состояниями
   */
  private createStateDelta(
    baseState: ExtendedGameState, 
    newState: ExtendedGameState
  ): DeltaChanges | null {
    try {
      // Проверяем, что у нас есть базовая версия
      if (!baseState._saveVersion) {
        return null;
      }

      const changes: Record<string, any> = {};
      let hasChanges = false;

      // Рекурсивная функция для сравнения объектов и нахождения различий
      const findChanges = (
        base: Record<string, any>, 
        current: Record<string, any>, 
        path: string = ''
      ): void => {
        // Получаем все ключи из обоих объектов
        const allKeys = new Set([
          ...Object.keys(base), 
          ...Object.keys(current)
        ]);

        // Используем Array.from для итерации по Set
        Array.from(allKeys).forEach(key => {
          // Пропускаем служебные поля
          if (key.startsWith('_')) return;

          const currentPath = path ? `${path}.${key}` : key;
          const baseValue = base[key];
          const currentValue = current[key];

          // Если значение отсутствует в одном из объектов
          if (baseValue === undefined || currentValue === undefined) {
            if (baseValue !== currentValue) {
              hasChanges = true;
              changes[currentPath] = currentValue;
            }
            return;
          }

          // Если типы различаются
          if (typeof baseValue !== typeof currentValue) {
            hasChanges = true;
            changes[currentPath] = currentValue;
            return;
          }

          // Если это примитивы и они различаются
          if (
            typeof currentValue !== 'object' || 
            currentValue === null
          ) {
            if (baseValue !== currentValue) {
              hasChanges = true;
              changes[currentPath] = currentValue;
            }
            return;
          }

          // Если это массив
          if (Array.isArray(currentValue)) {
            if (
              JSON.stringify(baseValue) !== JSON.stringify(currentValue)
            ) {
              hasChanges = true;
              changes[currentPath] = currentValue;
            }
            return;
          }

          // Если это объект, рекурсивно ищем изменения
          findChanges(baseValue, currentValue, currentPath);
        });
      };

      // Начинаем поиск изменений
      findChanges(baseState, newState);

      if (!hasChanges) {
        return null;
      }

      // Создаем объект дельты
      return {
        _isDelta: true,
        _baseVersion: baseState._saveVersion,
        changes
      };
    } catch (error) {
      console.error('Ошибка при создании дельты состояния:', error);
      return null;
    }
  }

  /**
   * Создает глубокую копию объекта состояния
   * @param state Объект состояния для клонирования
   * @returns Глубокая копия объекта
   */
  private deepClone<T>(state: T): T {
    try {
      return JSON.parse(JSON.stringify(state));
    } catch (error) {
      console.error('Ошибка при создании глубокой копии объекта:', error);
      // В случае ошибки возвращаем оригинал
      return state;
    }
  }

  /**
   * Применяет дельту изменений к базовому состоянию
   */
  private applyDelta(
    baseState: ExtendedGameState, 
    deltaChanges: DeltaChanges
  ): ExtendedGameState {
    // Проверяем, что это действительно дельта
    if (!deltaChanges._isDelta || !deltaChanges.changes) {
      console.warn('Попытка применить не-дельту как дельту');
      return baseState;
    }

    try {
      // Создаем копию базового состояния
      const newState = this.deepClone(baseState);
      
      // Применяем изменения
      Object.keys(deltaChanges.changes).forEach(path => {
        const value = deltaChanges.changes[path];
        const parts = path.split('.');
        
        // Находим нужный объект для изменения
        let current: any = newState;
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          if (current[part] === undefined) {
            current[part] = {};
          }
          current = current[part];
        }
        
        // Устанавливаем новое значение
        const lastPart = parts[parts.length - 1];
        current[lastPart] = value;
      });
      
      // Обновляем версию
      newState._saveVersion = Math.max(
        baseState._saveVersion || 0,
        deltaChanges._baseVersion + 1
      );
      
      return newState;
    } catch (error) {
      console.error('Ошибка при применении дельты:', error);
      return baseState;
    }
  }

  /**
   * Проверяет, является ли состояние дельта-состоянием
   */
  private isDeltaState(state: any): boolean {
    return !!state && state._isDelta === true && typeof state.changes === 'object';
  }

  /**
   * Восстанавливает начальное состояние игры
   */
  async resetToInitial(): Promise<ExtendedGameState> {
    const initialGameState: ExtendedGameState = {
      ...initialState,
      _saveVersion: SAVE_VERSION,
      _lastSavedAt: new Date().toISOString(),
      _saveId: uuid.v4()
    };
    
    // Сохраняем начальное состояние
    await this.save(initialGameState, { forceFull: true });
    this.lastLoadedState = initialGameState;
    
    return initialGameState;
  }

  /**
   * Удаляет все локальные сохранения
   */
  async clearLocalSaves(): Promise<boolean> {
    try {
      await this.localAdapter.delete(this.saveKey);
      return true;
    } catch (error) {
      console.error('Ошибка при удалении локальных сохранений:', error);
      return false;
    }
  }
}

/**
 * Создаем и экспортируем единственный экземпляр системы сохранения для использования во всем приложении
 */
export const saveSystem = new SaveSystem(); 