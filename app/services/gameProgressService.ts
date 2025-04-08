'use client';

import { ExtendedGameState } from '@/app/types/game';
import { saveGameState, loadGameState, clearAllData } from './storage';

// Ключи для localStorage
const GAME_STATE_KEY = 'game_state';
const GAME_STATE_BACKUP_KEY = 'game_state_backup';
const LAST_SYNC_KEY = 'snotcoin_last_sync';
const SYNC_QUEUE_KEY = 'snotcoin_sync_queue';
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 минут в миллисекундах
const SYNC_RETRY_INTERVAL = 60 * 1000; // 1 минута в миллисекундах
const MAX_RETRY_ATTEMPTS = 3;

// Интерфейс для элемента очереди синхронизации
interface SyncQueueItem {
  id: string;
  gameState: ExtendedGameState;
  timestamp: number;
  attemptCount: number;
  status: 'pending' | 'processing' | 'failed';
  error?: string;
}

// Интерфейс для элемента истории прогресса
interface ProgressHistoryItem {
  id: number;
  user_id: string;
  client_id: string;
  save_type: string;
  save_reason: string;
  created_at: string | Date;
}

// Проверяет, есть ли у объекта метод getProvider
function hasGetProviderMethod(obj: any): boolean {
  return obj && typeof obj.getProvider === 'function';
}

/**
 * Класс для управления прогрессом игры
 */
export class GameProgressService {
  public userId: string;
  private syncIntervalId: NodeJS.Timeout | null = null;
  private _isInitialized = false;
  private isSyncing = false;
  private baseUrl: string;
  private syncQueue: SyncQueueItem[] = [];
  private _lastSyncTimestamp = 0;
  // Добавляем поле для uploadQueue
  private uploadQueue: Array<{
    status: 'pending' | 'processing' | 'failed' | 'success';
    attemptCount: number;
    data: any;
    timestamp: number;
  }> = [];

  constructor(userId: string) {
    this.userId = userId;
    this.baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    this.initialize();
  }

  /**
   * Инициализация сервиса
   */
  private initialize(): void {
    if (this._isInitialized) return;
    
    this._isInitialized = true;
    
    // Загружаем очередь синхронизации
    this.loadSyncQueue();
    
    // Запускаем периодическую синхронизацию
    this.syncIntervalId = setInterval(() => {
      this.processSyncQueue();
    }, 30000); // Каждые 30 секунд

    // Обработчик перед закрытием страницы
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
      
      // Добавляем обработчики изменения состояния сети
      window.addEventListener('online', () => {
        console.log('[GameProgressService] Сеть доступна, запускаем синхронизацию');
        this.handleNetworkChange();
      });
      
      window.addEventListener('offline', () => {
        console.log('[GameProgressService] Сеть недоступна, синхронизация будет отложена');
        this.handleNetworkChange();
      });
    }

    // Начальная загрузка состояния
    this.loadGameState();
    
    // Запускаем первую синхронизацию с небольшой задержкой
    setTimeout(() => {
      if (this.isOnline()) {
        this.processSyncQueue();
      } else {
        console.log('[GameProgressService] Первая синхронизация отложена из-за отсутствия сети');
      }
    }, 2000);
  }

  /**
   * Очистка ресурсов при уничтожении сервиса
   */
  public dispose(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.handleBeforeUnload.bind(this));
      window.removeEventListener('online', () => this.handleNetworkChange());
      window.removeEventListener('offline', () => this.handleNetworkChange());
    }
    
    // Сохраняем текущую очередь
    this.saveSyncQueue();

    this._isInitialized = false;
  }

  /**
   * Обработчик события перед закрытием страницы
   */
  private handleBeforeUnload(): void {
    // Сохраняем текущую очередь
    this.saveSyncQueue();
    
    const currentState = this.loadGameState();
    if (currentState) {
      this.saveGameState(currentState);
    }
  }

  /**
   * Сохраняет состояние игры
   */
  public saveGameState(gameState: ExtendedGameState): ExtendedGameState {
    try {
      // Сохраняем локально
      saveGameState(gameState);
      
      // Добавляем в очередь синхронизации
      this.addToSyncQueue(gameState);
      
      return gameState;
    } catch (error) {
      console.error('[GameProgressService] Ошибка при сохранении состояния:', error);
      return gameState;
    }
  }

  /**
   * Загружает состояние игры
   */
  public loadGameState(): ExtendedGameState {
    try {
      // Пытаемся загрузить из локального хранилища
      const savedState = loadGameState();
      if (savedState) {
        return savedState;
      }

      // Если ничего не помогло, создаем новое состояние
      return this.createInitialState();
    } catch (error) {
      console.error('[GameProgressService] Ошибка при загрузке состояния:', error);
      return this.createInitialState();
    }
  }

  private createInitialState(): ExtendedGameState {
    return {
      user: null,
      inventory: {
        snot: 0,
        snotCoins: 0,
        containerSnot: 0.05,
        containerCapacity: 1,
        containerCapacityLevel: 1,
        fillingSpeed: 1,
        fillingSpeedLevel: 1,
        collectionEfficiency: 1.0,
        lastUpdateTimestamp: Date.now()
      },
      container: {
        level: 1,
        capacity: 1,
        currentAmount: 0.05,
        fillRate: 0.01,
        currentFill: 0.05,
        fillingSpeed: 1,
        lastUpdateTimestamp: Date.now()
      },
      upgrades: {
        containerCapacity: {
          level: 1,
          cost: 0
        },
        fillingSpeed: {
          level: 1,
          cost: 0
        }
      },
      _userId: this.userId || 'unknown',
      _provider: '',
      _lastModified: Date.now(),
      _createdAt: new Date().toISOString(),
      _tempData: null,
      _lastActionTime: new Date().toISOString(),
      _lastAction: 'init',
      _dataSource: 'new',
      _loadedAt: new Date().toISOString(),
      logs: [],
      analytics: null,
      items: [],
      achievements: {
        unlockedAchievements: []
      },
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
        language: 'ru',
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
        backgroundMusicVolume: 0.25,
        isMuted: false,
        isEffectsMuted: false,
        isBackgroundMusicMuted: false
      },
      hideInterface: false,
      activeTab: 'main',
      fillingSpeed: 1,
      containerLevel: 1,
      isPlaying: false,
      isGameInstanceRunning: false,
      validationStatus: 'valid',
      lastValidation: new Date().toISOString(),
      gameStarted: false,
      isLoading: false
    };
  }

  /**
   * Загружает очередь синхронизации из localStorage
   */
  private loadSyncQueue(): void {
    try {
      const queueStr = localStorage.getItem(SYNC_QUEUE_KEY);
      if (queueStr) {
        this.syncQueue = JSON.parse(queueStr);
      }
    } catch (error) {
      console.error('[GameProgressService] Ошибка при загрузке очереди синхронизации:', error);
      this.syncQueue = [];
    }
  }

  /**
   * Сохраняет очередь синхронизации в localStorage
   */
  private saveSyncQueue(): void {
    try {
      // Ограничиваем размер очереди, оставляя только последние 50 элементов
      if (this.syncQueue.length > 50) {
        console.warn(`[GameProgressService] Очередь синхронизации слишком большая (${this.syncQueue.length}). Обрезаем до 50 элементов.`);
        this.syncQueue = this.syncQueue.slice(-50);
      }
      
      // Аггрегируем элементы очереди по времени - удаляем лишние сохранения, сделанные в течение короткого периода времени
      this.compactSyncQueue();
      
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('[GameProgressService] Ошибка при сохранении очереди синхронизации:', error);
    }
  }

  /**
   * Компактифицирует очередь синхронизации, удаляя избыточные записи
   */
  private compactSyncQueue(): void {
    // Время в миллисекундах, в течение которого считаем записи избыточными (5 минут)
    const COMPACT_THRESHOLD = 5 * 60 * 1000;
    
    if (this.syncQueue.length <= 1) return;
    
    // Сортируем по времени
    this.syncQueue.sort((a, b) => a.timestamp - b.timestamp);
    
    // Проходим по очереди и объединяем близкие записи
    const compactedQueue: SyncQueueItem[] = [];
    const firstItem = this.syncQueue[0];
    
    // Проверяем, что первый элемент существует
    if (!firstItem) return;
    
    let lastItem: SyncQueueItem = firstItem;
    compactedQueue.push(lastItem);
    
    for (let i = 1; i < this.syncQueue.length; i++) {
      const currentItem = this.syncQueue[i];
      
      // Проверяем, что текущий элемент существует
      if (!currentItem) continue;
      
      // Если текущий элемент был создан в течение порогового времени от последнего сохраненного,
      // и оба в статусе 'pending', то игнорируем текущий
      if (
        currentItem.timestamp - lastItem.timestamp < COMPACT_THRESHOLD && 
        currentItem.status === 'pending' && 
        lastItem.status === 'pending'
      ) {
        console.log('[GameProgressService] Объединяем близкие по времени элементы очереди синхронизации');
        continue;
      }
      
      compactedQueue.push(currentItem);
      lastItem = currentItem;
    }
    
    // Если произошло объединение, обновляем очередь
    if (compactedQueue.length < this.syncQueue.length) {
      console.log(`[GameProgressService] Очередь синхронизации сжата: ${this.syncQueue.length} -> ${compactedQueue.length} элементов`);
      this.syncQueue = compactedQueue;
    }
  }

  /**
   * Добавляет состояние игры в очередь синхронизации
   */
  private addToSyncQueue(gameState: ExtendedGameState): void {
    // Проверяем размер очереди, если она слишком большая, то удаляем старые элементы перед добавлением нового
    if (this.syncQueue.length >= 100) {
      console.warn(`[GameProgressService] Очередь синхронизации достигла максимального размера (${this.syncQueue.length}). Удаление старых записей.`);
      // Оставляем только последние 50 элементов
      this.syncQueue = this.syncQueue.slice(-50);
    }
    
    // Частота сохранений - не чаще чем раз в 30 секунд, если очередь не пуста
    const MIN_SAVE_INTERVAL = 30 * 1000; // 30 seconds
    const lastItemIndex = this.syncQueue.length - 1;
    const lastItem = lastItemIndex >= 0 ? this.syncQueue[lastItemIndex] : null;
    
    if (
      lastItem && 
      Date.now() - lastItem.timestamp < MIN_SAVE_INTERVAL && 
      this.syncQueue.length > 0
    ) {
      console.log('[GameProgressService] Слишком частые сохранения, обновляем последний элемент в очереди');
      // Вместо добавления нового элемента, обновляем последний
      lastItem.gameState = gameState;
      lastItem.timestamp = Date.now();
    } else {
      // Добавляем новый элемент в очередь
      const item: SyncQueueItem = {
        id: Date.now().toString(),
        gameState,
        timestamp: Date.now(),
        attemptCount: 0,
        status: 'pending'
      };
      
      this.syncQueue.push(item);
    }
    
    this.saveSyncQueue();
  }

  /**
   * Получает очередь синхронизации из localStorage
   */
  private getSyncQueue(): SyncQueueItem[] {
    return this.syncQueue;
  }

  /**
   * Получает размер очереди синхронизации
   */
  public getSyncQueueSize(): number {
    return this.syncQueue.length;
  }

  /**
   * Очищает очередь синхронизации
   */
  public clearSyncQueue(): void {
    try {
      console.log(`[GameProgressService] Очистка очереди синхронизации (${this.syncQueue.length} элементов)`);
      this.syncQueue = [];
      localStorage.removeItem(SYNC_QUEUE_KEY);
    } catch (error) {
      console.error('[GameProgressService] Ошибка при очистке очереди синхронизации:', error);
    }
  }

  /**
   * Сохраняет текущее состояние игры и очищает очередь (аварийный сброс)
   */
  public emergencyReset(): boolean {
    try {
      // Получаем текущее состояние
      const currentState = this.loadGameState();
      
      // Очищаем очередь
      this.clearSyncQueue();
      
      // Сохраняем текущее состояние заново
      if (currentState) {
        localStorage.setItem(GAME_STATE_KEY, JSON.stringify(currentState));
        this.createLocalBackup(currentState);
        
        // Добавляем в очередь только текущее состояние
        const queueItem: SyncQueueItem = {
          id: `${Date.now()}-reset`,
          gameState: currentState,
          timestamp: Date.now(),
          attemptCount: 0,
          status: 'pending'
        };
        
        this.syncQueue.push(queueItem);
        this.saveSyncQueue();
        
        console.log('[GameProgressService] Аварийный сброс выполнен успешно');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[GameProgressService] Ошибка при аварийном сбросе:', error);
      return false;
    }
  }

  /**
   * Обрабатывает очередь синхронизации
   */
  private async processSyncQueue(): Promise<void> {
    if (this.isSyncing || this.syncQueue.length === 0) return;

    this.isSyncing = true;
    
    try {
      const item = this.syncQueue[0];
      if (!item) {
        console.warn('[GameProgressService] Элемент в очереди синхронизации не найден');
        return;
      }

      if (item.status === 'failed' && item.attemptCount >= MAX_RETRY_ATTEMPTS) {
        // Удаляем элемент после максимального количества попыток
        this.syncQueue.shift();
        this.saveSyncQueue();
        return;
      }

      // Обновляем статус элемента
      item.status = 'processing';
      item.attemptCount++;
      this.saveSyncQueue();

      // Здесь должна быть логика синхронизации с сервером
      // Пока что просто удаляем элемент из очереди
      this.syncQueue.shift();
      this.saveSyncQueue();
    } catch (error) {
      console.error('[GameProgressService] Ошибка при обработке очереди синхронизации:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Синхронизирует состояние с базой данных
   */
  public async syncWithDatabase(immediate = false): Promise<void> {
    try {
      // Проверяем состояние сети
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        console.warn('[GameProgressService] Сеть недоступна, синхронизация отложена');
        return;
      }
      
      if (immediate) {
        console.log('[GameProgressService] Запущена немедленная синхронизация');
        await this.processSyncQueue();
      } else {
        // Планируем обработку очереди
        if (!this.isSyncing && this.syncQueue.length > 0) {
          console.log('[GameProgressService] Запланирована обработка очереди');
          setTimeout(() => this.processSyncQueue(), 100);
        }
      }
    } catch (error) {
      console.error('[GameProgressService] Ошибка при синхронизации:', error);
    }
  }

  /**
   * Сохраняет состояние игры в базе данных
   */
  private async saveToDatabase(gameState: any): Promise<boolean> {
    try {
      if (!gameState) {
        console.error('Attempted to save empty game state');
        return false;
      }

      // Всегда используем относительный URL для избежания CORS-ошибок
      const apiUrl = '/api/progress/save';

      // Проверяем размер данных для сохранения
      const originalStateString = JSON.stringify(gameState);
      
      // Флаг сжатия данных, если они большие
      let isCompressed = false;
      let processedGameState = gameState;
      
      // Если размер данных больше 100KB, пытаемся их сжать
      if (originalStateString.length > 100 * 1024) {
        console.log(`[GameProgressService] Большой размер данных (${Math.round(originalStateString.length/1024)}KB), пытаемся сжать`);
        try {
          // Создаем более компактное представление состояния (только существенные данные)
          const compactState = {
            resources: gameState.resources,
            buildings: gameState.buildings,
            upgrades: gameState.upgrades,
            lastUpdated: gameState.lastUpdated
          };
          
          // Используем compact-state вместо полного состояния
          processedGameState = compactState;
          isCompressed = true;
          
          const compressedSize = JSON.stringify(processedGameState).length;
          console.log(`[GameProgressService] Сжатие состояния: ${Math.round(originalStateString.length/1024)}KB -> ${Math.round(compressedSize/1024)}KB`);
        } catch (compressionError) {
          console.error('[GameProgressService] Ошибка при сжатии состояния:', compressionError);
        }
      }

      console.log('[GameProgressService] Saving to:', apiUrl);

      try {
        // Попытка сохранить прогресс
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // Добавляем для работы с сессионными куками
          body: JSON.stringify({
            user_id: this.userId,
            game_state: processedGameState,
            version: 1,
            is_compressed: isCompressed
          })
        });

        if (!response.ok) {
          let errorMessage = `Failed to save progress: ${response.status} ${response.statusText}`;
          try {
            const errorData = await response.json();
            errorMessage += ` - ${JSON.stringify(errorData)}`;
          } catch (parseError) {
            // Ошибка парсинга JSON не критична
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();
        if (!data.success) {
          throw new Error(`Failed to save progress: ${data.error || 'Unknown error'}`);
        }

        console.log('[GameProgressService] Progress saved successfully:', data);
        
        // Обновляем время последней успешной синхронизации
        localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
        
        return true;
      } catch (fetchError) {
        // Перехватываем ошибки сетевого запроса отдельно
        console.error('[GameProgressService] Network error:', fetchError);
        throw fetchError;
      }
    } catch (error) {
      console.error('Error saving progress to database:', error);
      
      // Проверяем, является ли ошибка сетевой
      const isNetworkError = error instanceof TypeError && 
        (error.message.includes('Failed to fetch') || 
         error.message.includes('NetworkError') ||
         error.message.includes('Network request failed'));
         
      if (isNetworkError) {
        console.warn('[GameProgressService] Network error detected. Will retry later.');
      }

      // Обновляем свойство isNetworkAvailable
      if (isNetworkError) {
        console.log('[GameProgressService] Network appears to be unavailable. Switching to offline mode.');
      }
      
      // Добавляем в очередь только если не уже там
      const queueItem: SyncQueueItem = {
        id: Date.now().toString(),
        gameState,
        timestamp: Date.now(),
        attemptCount: 0,
        status: 'pending',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      
      this.syncQueue.push(queueItem);
      this.saveSyncQueue();
      
      return false;
    }
  }

  /**
   * Загружает состояние игры из базы данных
   */
  private async loadFromDatabase(): Promise<ExtendedGameState | null> {
    try {
      // Всегда используем относительный URL для избежания CORS-ошибок
      const apiUrl = `/api/progress/load?user_id=${encodeURIComponent(this.userId)}`;

      console.log('[GameProgressService] Loading from:', apiUrl);

      try {
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.success === false) {
          throw new Error(data.error || 'Unknown error in response');
        }
        
        return data.game_state || null;
      } catch (fetchError) {
        console.error('[GameProgressService] Network error during load:', fetchError);
        throw fetchError;
      }
    } catch (error) {
      console.error('[GameProgressService] Error loading from database:', error);
      return null;
    }
  }

  /**
   * Получает историю прогресса
   */
  public async getProgressHistory(limit = 10): Promise<ProgressHistoryItem[]> {
    try {
      // Всегда используем относительный URL для избежания CORS-ошибок
      const apiUrl = `/api/progress/history?user_id=${encodeURIComponent(this.userId)}&limit=${limit}`;

      console.log('[GameProgressService] Loading history from:', apiUrl);

      try {
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.success === false) {
          throw new Error(data.error || 'Unknown error in response');
        }
        
        return data.history || [];
      } catch (fetchError) {
        console.error('[GameProgressService] Network error during history load:', fetchError);
        throw fetchError;
      }
    } catch (error) {
      console.error('[GameProgressService] Ошибка при получении истории:', error);
      return [];
    }
  }

  /**
   * Восстанавливает прогресс из истории
   */
  public async restoreFromHistory(historyId: number): Promise<boolean> {
    try {
      // Всегда используем относительный URL для избежания CORS-ошибок
      const apiUrl = `/api/progress/restore`;

      console.log('[GameProgressService] Restoring from:', apiUrl);

      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            user_id: this.userId,
            history_id: historyId
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.success === false) {
          throw new Error(data.error || 'Unknown error in response');
        }
        
        if (data.success) {
          // Загрузка актуального состояния после восстановления
          const newState = await this.loadFromDatabase();
          if (newState) {
            this.saveGameState(newState);
            return true;
          }
        }
        return false;
      } catch (fetchError) {
        console.error('[GameProgressService] Network error during restore:', fetchError);
        throw fetchError;
      }
    } catch (error) {
      console.error('[GameProgressService] Ошибка при восстановлении из истории:', error);
      return false;
    }
  }

  public async createDatabaseBackup(reason = 'manual'): Promise<boolean> {
    try {
      const currentState = this.loadGameState();
      if (!currentState) {
        console.error('[GameProgressService] Нет текущего состояния для создания резервной копии');
        return false;
      }

      return await this.saveToDatabase(currentState);
    } catch (error) {
      console.error('[GameProgressService] Ошибка при создании резервной копии в базе данных:', error);
      return false;
    }
  }

  public clearAllData(): void {
    try {
      clearAllData();
      this.syncQueue = [];
      console.log('[GameProgressService] Все данные очищены');
    } catch (error) {
      console.error('[GameProgressService] Ошибка при очистке данных:', error);
    }
  }

  private dispatchGameEvent(type: string, data?: Record<string, any>): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(`game:${type}`, { detail: data }));
    }
  }

  /**
   * Получает состояние сети
   */
  private isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  /**
   * Обрабатывает изменение состояния сети
   */
  private handleNetworkChange(): void {
    const isOnline = this.isOnline();
    console.log(`[GameProgressService] Состояние сети: ${isOnline ? 'онлайн' : 'офлайн'}`);
    
    if (isOnline && this.syncQueue.length > 0) {
      console.log('[GameProgressService] Сеть доступна, запускаем отложенную синхронизацию');
      this.syncWithDatabase();
    }
  }

  /**
   * Создает локальную резервную копию
   */
  createLocalBackup(gameState: ExtendedGameState): void {
    try {
      const backup = {
        state: gameState,
        timestamp: Date.now(),
        version: 1
      };
      localStorage.setItem('snotcoin_game_state_backup', JSON.stringify(backup));
      console.log('[GameProgressService] Локальная резервная копия создана');
    } catch (error) {
      console.error('[GameProgressService] Ошибка при создании локальной резервной копии:', error);
    }
  }

  // Для исправления ошибки в методе sanitizeGameStateForBackup
  sanitizeGameStateForBackup(gameState: ExtendedGameState): Partial<ExtendedGameState> {
    return {
      _userId: gameState._userId,
      // Остальные поля оставляем как есть
      // Указываем что user это null, чтобы соответствовать типам
      user: gameState.user || null,
      // ... остальные поля ...
    };
  }

  // Для исправления ошибок с проверкой item undefined
  processUploadQueue(): void {
    // ... существующий код ...
    
    // Обработка следующего элемента, если он есть
    const item = this.uploadQueue[0];
    if (!item) return;
    
    // Теперь можно безопасно использовать item
    if (item.status === 'failed' && item.attemptCount >= MAX_RETRY_ATTEMPTS) {
      // ... существующий код ...
    }
    
    // Так как мы проверили, что item существует, можно безопасно использовать эти поля
    item.status = 'processing';
    item.attemptCount++;
    
    // ... остальной код ...
  }

  public saveDefaultState(): ExtendedGameState {
    const now = new Date().toISOString();
    const state: ExtendedGameState = {
      user: null,
      inventory: {
        snot: 0,
        snotCoins: 0,
        containerSnot: 0.05,
        containerCapacity: 1,
        containerCapacityLevel: 1,
        fillingSpeed: 1,
        fillingSpeedLevel: 1,
        collectionEfficiency: 1.0,
        lastUpdateTimestamp: Date.now()
      },
      container: {
        level: 1,
        capacity: 1,
        currentAmount: 0.05,
        fillRate: 0.01,
        currentFill: 0.05,
        fillingSpeed: 1,
        lastUpdateTimestamp: Date.now()
      },
      upgrades: {
        containerCapacity: {
          level: 1,
          cost: 0
        },
        fillingSpeed: {
          level: 1,
          cost: 0
        },
        collectionEfficiencyLevel: 1,
        containerLevel: 1,
        fillingSpeedLevel: 1,
        clickPower: { level: 1, value: 1 },
        passiveIncome: { level: 1, value: 0.1 }
      },
      _userId: 'unknown',
      _provider: 'local',
      _lastModified: Date.now(),
      _createdAt: now,
      _tempData: null,
      _lastActionTime: now,
      _lastAction: 'init',
      _dataSource: 'new',
      _loadedAt: now,
      logs: [],
      analytics: null,
      items: [],
      achievements: {
        unlockedAchievements: []
      },
      highestLevel: 1,
      stats: {
        clickCount: 0,
        playTime: 0,
        startDate: now,
        highestLevel: 1,
        totalSnot: 0,
        totalSnotCoins: 0,
        consecutiveLoginDays: 0
      },
      consecutiveLoginDays: 0,
      settings: {
        language: 'ru',
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
        backgroundMusicVolume: 0.25,
        isMuted: false,
        isEffectsMuted: false,
        isBackgroundMusicMuted: false
      },
      hideInterface: false,
      activeTab: 'main',
      fillingSpeed: 1,
      containerLevel: 1,
      isPlaying: false,
      isGameInstanceRunning: false,
      validationStatus: 'valid',
      lastValidation: now,
      gameStarted: false,
      isLoading: false
    };

    return state;
  }

  private processNextQueueItem() {
    if (!this.uploadQueue || this.uploadQueue.length === 0) {
      return;
    }
    
    const item = this.uploadQueue[0];
    if (!item) {
      // Если элемент undefined, просто удаляем его и пробуем следующий
      this.uploadQueue.shift();
      this.processNextQueueItem();
      return;
    }
    
    if (item.status === 'failed' && item.attemptCount >= MAX_RETRY_ATTEMPTS) {
      // Удаляем элемент из очереди, если превышено количество попыток
      this.uploadQueue.shift();
      
      // Обрабатываем следующий элемент
      this.processNextQueueItem();
      return;
    }
    
    // Теперь мы уверены, что item не undefined
    item.status = 'processing';
    item.attemptCount++;
    
    // ... остальной код ...
  }
}

let gameProgressServiceInstance: GameProgressService | null = null;

export function getGameProgressService(userId: string): GameProgressService {
  if (!gameProgressServiceInstance || gameProgressServiceInstance.userId !== userId) {
    gameProgressServiceInstance = new GameProgressService(userId);
  }
  return gameProgressServiceInstance;
}