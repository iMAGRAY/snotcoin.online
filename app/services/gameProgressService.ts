'use client';

import { GameState } from '@/types/game';

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
  gameState: GameState;
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

/**
 * Класс для управления прогрессом игры
 */
export class GameProgressService {
  public userId: string;
  private syncIntervalId: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private isSyncing = false;
  private baseUrl: string;
  private syncQueue: SyncQueueItem[] = [];

  constructor(userId: string) {
    this.userId = userId;
    this.baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    this.initialize();
  }

  /**
   * Инициализация сервиса
   */
  private initialize(): void {
    if (this.isInitialized) return;
    
    this.isInitialized = true;
    
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
      // Проверяем состояние сети перед синхронизацией
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

    this.isInitialized = false;
  }

  /**
   * Обработчик события перед закрытием страницы
   * Выполняет синхронизацию с базой данных
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
   * Генерирует хеш состояния игры
   */
  private generateStateHash(state: GameState): string {
    // Простая хеш-функция для проверки целостности
    return JSON.stringify(state)
      .split('')
      .reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0)
      .toString(16);
  }

  /**
   * Проверяет целостность состояния
   */
  private verifyStateIntegrity(state: GameState): boolean {
    try {
      const savedHash = localStorage.getItem(`${GAME_STATE_KEY}_hash`);
      const currentHash = this.generateStateHash(state);
      return savedHash === currentHash;
    } catch (error) {
      console.error('[GameProgressService] Ошибка при проверке целостности:', error);
      return false;
    }
  }

  /**
   * Создает резервную копию состояния
   */
  private createLocalBackup(state: GameState): void {
    if (typeof window === 'undefined') return;
    
    try {
      const backup = {
        state,
        hash: this.generateStateHash(state),
        timestamp: Date.now()
      };
      
      localStorage.setItem(GAME_STATE_BACKUP_KEY, JSON.stringify(backup));
      console.log('[GameProgressService] Создана локальная резервная копия');
    } catch (error) {
      console.error('[GameProgressService] Ошибка при создании локальной резервной копии:', error);
    }
  }

  /**
   * Восстанавливает состояние из резервной копии
   */
  private restoreFromLocalBackup(): GameState | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const backupStr = localStorage.getItem(GAME_STATE_BACKUP_KEY);
      if (!backupStr) return null;
      
      const backup = JSON.parse(backupStr);
      if (!backup.state || !backup.timestamp) return null;

      // Проверяем возраст резервной копии
      const backupAge = Date.now() - backup.timestamp;
      if (backupAge > 24 * 60 * 60 * 1000) {
        console.log('[GameProgressService] Локальная резервная копия слишком старая');
        return null;
      }

      console.log('[GameProgressService] Восстановление из локальной резервной копии');
      return backup.state;
    } catch (error) {
      console.error('[GameProgressService] Ошибка при восстановлении из локальной резервной копии:', error);
      return null;
    }
  }

  /**
   * Сохраняет состояние игры в localStorage
   */
  public saveGameState(gameState: GameState): GameState {
    try {
      // Сохраняем локально
      localStorage.setItem(GAME_STATE_KEY, JSON.stringify(gameState));
      localStorage.setItem(`${GAME_STATE_KEY}_hash`, this.generateStateHash(gameState));
      
      // Создаем локальную резервную копию
      this.createLocalBackup(gameState);
      
      // Добавляем в очередь синхронизации
      this.addToSyncQueue(gameState);
      
      return gameState;
    } catch (error) {
      console.error('[GameProgressService] Ошибка при сохранении состояния:', error);
      return gameState;
    }
  }

  /**
   * Проверяет, являются ли изменения состояния критическими
   */
  private isCriticalStateChange(prevState: GameState, newState: GameState): boolean {
    // Определяем критические изменения, которые требуют немедленной синхронизации
    return (
      prevState.resources.gold !== newState.resources.gold ||
      prevState.resources.wood !== newState.resources.wood ||
      prevState.resources.stone !== newState.resources.stone
    );
  }

  /**
   * Загружает состояние игры из localStorage или создает новое
   */
  public loadGameState(): GameState {
    try {
      // Пытаемся загрузить из локального хранилища
      const savedState = localStorage.getItem(GAME_STATE_KEY);
      if (savedState) {
        const state = JSON.parse(savedState) as GameState;
        if (this.verifyStateIntegrity(state)) {
          return state;
        }
      }

      // Если локальное состояние повреждено, пробуем восстановить из резервной копии
      const backupState = this.restoreFromLocalBackup();
      if (backupState) {
        return backupState;
      }

      // Если ничего не помогло, создаем новое состояние
      return this.createInitialState();
    } catch (error) {
      console.error('[GameProgressService] Ошибка при загрузке состояния:', error);
      return this.createInitialState();
    }
  }

  private createInitialState(): GameState {
    return {
      resources: {
        gold: 0,
        wood: 0,
        stone: 0
      },
      buildings: [],
      upgrades: [],
      lastUpdated: Date.now()
    };
  }

  /**
   * Загружает очередь синхронизации из localStorage
   */
  private loadSyncQueue(): void {
    try {
      const queueData = localStorage.getItem(SYNC_QUEUE_KEY);
      if (queueData) {
        const queue = JSON.parse(queueData) as SyncQueueItem[];
        // Фильтруем и обновляем статусы
        this.syncQueue = queue.filter(item => {
          // Удаляем старые записи (старше 24 часов)
          const isOld = Date.now() - item.timestamp > 24 * 60 * 60 * 1000;
          // Сбрасываем статус processing
          if (item.status === 'processing') {
            item.status = 'pending';
          }
          return !isOld;
        });
        console.log(`[GameProgressService] Загружено ${this.syncQueue.length} элементов в очереди`);
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
      // Не сохраняем, если очередь пуста
      if (this.syncQueue.length === 0) {
        localStorage.removeItem(SYNC_QUEUE_KEY);
        return;
      }
      
      // Проверяем размер очереди
      if (this.syncQueue.length > 500) {
        console.warn(`[GameProgressService] Очередь синхронизации слишком большая (${this.syncQueue.length} элементов), усекаем до последних 100`);
        // Оставляем только последние 100 элементов
        this.syncQueue = this.syncQueue.slice(-100);
      }
      
      try {
        const queueString = JSON.stringify(this.syncQueue);
        
        // Проверяем размер строки (localStorage обычно ограничен ~5МБ)
        if (queueString.length > 3 * 1024 * 1024) { // 3МБ предел
          console.error(`[GameProgressService] Очередь синхронизации слишком большая (${queueString.length} байт), очищаем`);
          this.syncQueue = []; // Очищаем очередь если она слишком большая
          localStorage.removeItem(SYNC_QUEUE_KEY);
          return;
        }
        
        localStorage.setItem(SYNC_QUEUE_KEY, queueString);
        console.log(`[GameProgressService] Сохранено ${this.syncQueue.length} элементов в очереди`);
      } catch (storageError) {
        // Ошибка localStorage (обычно при превышении квоты)
        console.error('[GameProgressService] Ошибка сохранения в localStorage:', storageError);
        // Усекаем очередь до последних 10 элементов при ошибке
        this.syncQueue = this.syncQueue.slice(-10);
        try {
          localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(this.syncQueue));
          console.warn(`[GameProgressService] Очередь синхронизации усечена до ${this.syncQueue.length} элементов`);
        } catch (retryError) {
          console.error('[GameProgressService] Не удалось сохранить даже усеченную очередь:', retryError);
          this.syncQueue = []; // Очищаем очередь в случае критической ошибки
        }
      }
    } catch (error) {
      console.error('[GameProgressService] Ошибка при сохранении очереди синхронизации:', error);
    }
  }

  /**
   * Добавляет состояние игры в очередь синхронизации
   */
  private addToSyncQueue(gameState: GameState): void {
    // Проверяем, если очередь уже большая, удаляем старые элементы
    if (this.syncQueue.length > 500) {
      // Удаляем элементы со статусом 'failed' и большим числом попыток
      this.syncQueue = this.syncQueue.filter(item => 
        !(item.status === 'failed' && item.attemptCount >= MAX_RETRY_ATTEMPTS)
      );
      
      // Если очередь всё ещё большая, удаляем самые старые элементы
      if (this.syncQueue.length > 400) {
        console.warn(`[GameProgressService] Очередь синхронизации слишком большая, удаляем старые элементы`);
        this.syncQueue = this.syncQueue.slice(-300);
      }
    }
    
    // Добавляем новый элемент с уникальным ID
    const queueItem: SyncQueueItem = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      gameState,
      timestamp: Date.now(),
      attemptCount: 0,
      status: 'pending'
    };

    this.syncQueue.push(queueItem);
    console.log('[GameProgressService] Добавлено в очередь синхронизации:', queueItem.id);
    
    // Сохраняем обновленную очередь
    this.saveSyncQueue();
    
    // Запускаем синхронизацию если сеть доступна и нет активной синхронизации
    if (this.isOnline() && !this.isSyncing) {
      this.syncWithDatabase();
    }
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
        localStorage.setItem(`${GAME_STATE_KEY}_hash`, this.generateStateHash(currentState));
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

    // Проверяем, если очередь слишком большая, сокращаем её
    if (this.syncQueue.length > 1000) {
      console.warn(`[GameProgressService] Очередь синхронизации слишком большая (${this.syncQueue.length} элементов), урезаем`);
      // Оставляем только последние элементы
      this.syncQueue = this.syncQueue.slice(-100);
      this.saveSyncQueue();
    }

    this.isSyncing = true;
    console.log(`[GameProgressService] Обработка очереди синхронизации: ${this.syncQueue.length} элементов`);
    
    // Копируем очередь для обработки
    const queueToProcess = [...this.syncQueue];
    
    // Обрабатываем каждый элемент в очереди
    for (const item of queueToProcess) {
      // Пропускаем элементы, которые еще не готовы для повторной попытки
      if (item.status === 'failed' && item.attemptCount >= MAX_RETRY_ATTEMPTS) {
        console.log(`[GameProgressService] Элемент ${item.id} превысил лимит попыток: ${item.attemptCount}`);
        continue;
      }
      
      // Пропускаем элементы в обработке
      if (item.status === 'processing') {
        continue;
      }
      
      // Ожидаем перед повторной попыткой, если это не первая попытка
      if (item.status === 'failed' && item.attemptCount > 0) {
        const backoffTime = Math.min(
          SYNC_RETRY_INTERVAL * Math.pow(2, item.attemptCount - 1), 
          5 * 60 * 1000 // Максимум 5 минут
        );
        
        const shouldRetryNow = Date.now() - item.timestamp > backoffTime;
        if (!shouldRetryNow) {
          console.log(`[GameProgressService] Отложена повторная попытка для ${item.id}, следующая через ${Math.round((backoffTime - (Date.now() - item.timestamp))/1000)} сек`);
          continue;
        }
      }

      try {
        // Обновляем статус и метку времени
        item.status = 'processing';
        item.timestamp = Date.now();
        
        console.log(`[GameProgressService] Попытка синхронизации: ${item.id} (попытка ${item.attemptCount + 1})`);
        
        // Отправляем запрос на сервер
        const success = await this.saveToDatabase(item.gameState);
        
        if (success) {
          // Удаляем элемент из очереди
          this.syncQueue = this.syncQueue.filter(i => i.id !== item.id);
          console.log(`[GameProgressService] Успешно синхронизировано: ${item.id}`);
        } else {
          // Обновляем информацию о попытке
          item.status = 'failed';
          item.attemptCount++;
          item.error = 'Не удалось сохранить (неизвестная ошибка)';
          console.warn(`[GameProgressService] Синхронизация не удалась: ${item.id} (попытка ${item.attemptCount})`);
        }
      } catch (error) {
        // Обрабатываем ошибку
        item.status = 'failed';
        item.attemptCount++;
        item.timestamp = Date.now(); // Обновляем время для отсчета до следующей попытки
        item.error = error instanceof Error ? error.message : 'Unknown error';
        
        console.error(`[GameProgressService] Ошибка при обработке элемента ${item.id} (попытка ${item.attemptCount}):`, error);
        
        // Если у нас уже много попыток, выводим подробную диагностику
        if (item.attemptCount >= MAX_RETRY_ATTEMPTS - 1) {
          console.warn(`[GameProgressService] Элемент ${item.id} скоро достигнет максимального числа попыток`);
        }
      }
    }

    this.isSyncing = false;
    
    // Сохраняем изменения очереди
    if (this.syncQueue.length > 0) {
      console.log(`[GameProgressService] Ожидает синхронизации: ${this.syncQueue.length} элементов`);
      this.saveSyncQueue();
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
  private async loadFromDatabase(): Promise<GameState | null> {
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
      localStorage.removeItem(GAME_STATE_KEY);
      localStorage.removeItem(GAME_STATE_BACKUP_KEY);
      localStorage.removeItem(`${GAME_STATE_KEY}_hash`);
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
}

let gameProgressServiceInstance: GameProgressService | null = null;

export function getGameProgressService(userId: string): GameProgressService {
  if (!gameProgressServiceInstance || gameProgressServiceInstance.userId !== userId) {
    gameProgressServiceInstance = new GameProgressService(userId);
  }
  return gameProgressServiceInstance;
}