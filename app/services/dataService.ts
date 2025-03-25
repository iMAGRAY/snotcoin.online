import type { GameState, ExtendedGameState } from "../types/gameTypes";
import { saveQueue, CompressedGameState, isCompressedGameState } from "../utils/saveQueue";
import { getToken } from "../services/authenticationService";

// Типы для кэша
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: number;
  integrity: boolean;
}

// Константы для кэширования
const CACHE_TTL = 5 * 60 * 1000; // 5 минут
const SAVE_DEBOUNCE_TIME = 15 * 1000; // 15 секунд (увеличено с 10 секунд)
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000; // 1 секунда
const MAX_CACHE_SIZE = 50; // Увеличено с 10 до 50
const MAX_PENDING_SAVES = 20;
const INTEGRITY_CHECK_FIELDS = ['inventory'] as const;

// Кэш для данных игры
const gameStateCache = new Map<string, CacheEntry<ExtendedGameState>>();

// Отслеживание последних загрузок для предотвращения частых запросов
const lastLoadTimestamps = new Map<string, number>();
const LOAD_DEBOUNCE_TIME = 2000; // 2 секунды между загрузками

// Отслеживание последних сохранений для предотвращения частых запросов
const lastSaveTimestamps = new Map<string, number>();

// Отслеживание версий для предотвращения конфликтов
const stateVersions = new Map<string, number>();

// Очередь сохранений для пакетной обработки
const pendingSaves = new Map<string, ExtendedGameState>();

// Таймер для пакетной обработки
let batchSaveTimer: NodeJS.Timeout | null = null;

// Хранилище резервных копий в памяти
const backupStore = new Map<string, {
  data: ExtendedGameState;
  timestamp: number;
}>();

/**
 * Сохраняет резервную копию состояния в памяти приложения
 */
function saveBackup(userId: string, gameState: ExtendedGameState, error?: unknown): void {
  try {
    if (gameState && userId) {
      backupStore.set(userId, {
        data: gameState,
        timestamp: Date.now()
      });
      
      // Ограничиваем размер хранилища резервных копий
      if (backupStore.size > 50) {
        const oldestKey = Array.from(backupStore.entries())
          .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
        backupStore.delete(oldestKey);
      }
    }
  } catch (backupError) {
    // Ошибка создания резервной копии
  }
}

/**
 * Получает резервную копию из памяти приложения
 */
function getBackup(userId: string): ExtendedGameState | null {
  try {
    const backup = backupStore.get(userId);
    if (backup && backup.data) {
      return backup.data;
    }
    return null;
  } catch (error) {
    // Ошибка получения резервной копии
    return null;
  }
}

/**
 * Проверяет целостность данных
 */
function checkDataIntegrity(data: ExtendedGameState): boolean {
  if (!data) return false;
  
  // Проверяем наличие критически важных полей
  for (const field of INTEGRITY_CHECK_FIELDS) {
    if (!data[field]) {
      return false;
    }
  }
  
  // Проверка инвентаря
  if (data.inventory) {
    if (typeof data.inventory.snot !== 'number' || 
        typeof data.inventory.snotCoins !== 'number' ||
        typeof data.inventory.containerCapacity !== 'number') {
      return false;
    }
  }
  
  return true;
}

/**
 * Ограничивает размер кэша
 */
function limitCacheSize(): void {
  if (gameStateCache.size <= MAX_CACHE_SIZE) return;
  
  // Сортируем записи по времени последнего обновления
  const entries = Array.from(gameStateCache.entries())
    .sort((a, b) => a[1].timestamp - b[1].timestamp);
  
  // Удаляем самые старые записи
  const entriesToRemove = entries.slice(0, gameStateCache.size - MAX_CACHE_SIZE);
  for (const [key] of entriesToRemove) {
    gameStateCache.delete(key);
  }
}

/**
 * Восстанавливает данные из кэша
 */
function restoreFromCache(userId: string, gameState: ExtendedGameState): ExtendedGameState {
  const cachedEntry = gameStateCache.get(userId);
  if (cachedEntry && cachedEntry.integrity) {
    // Создаем новый объект с данными из кэша для критических полей
    return {
      ...gameState,
      inventory: gameState.inventory || cachedEntry.data.inventory
    };
  }
  return gameState;
}

/**
 * Сохраняет состояние игры с оптимизацией
 */
export async function saveGameState(userId: string, gameState: ExtendedGameState): Promise<void> {
  try {
    if (!userId || !gameState) {
      console.error('[DataService] Неверные аргументы для saveGameState:', { userId: Boolean(userId), gameState: Boolean(gameState) });
      throw new Error('Invalid arguments for saveGameState');
    }
    
    console.log(`[DataService] Сохранение состояния для пользователя ${userId}`);
    
    // Проверяем целостность данных перед сохранением
    const isDataValid = checkDataIntegrity(gameState);
    if (!isDataValid) {
      console.warn(`[DataService] Целостность данных нарушена для пользователя ${userId}, пытаемся восстановить из кэша`);
      // Пытаемся восстановить данные из кэша
      gameState = restoreFromCache(userId, gameState);
    }
    
    // Обновляем версию состояния
    const currentVersion = stateVersions.get(userId) || 0;
    const newVersion = currentVersion + 1;
    stateVersions.set(userId, newVersion);
    
    // Подготавливаем состояние для сохранения
    const stateToSave = { 
      ...gameState,
      _saveVersion: newVersion,
      _lastSaved: new Date().toISOString()
    };
    
    // Обновляем кэш немедленно
    gameStateCache.set(userId, {
      data: stateToSave,
      timestamp: Date.now(),
      version: newVersion,
      integrity: checkDataIntegrity(stateToSave)
    });
    
    // Ограничиваем размер кэша
    limitCacheSize();
    
    // Проверяем, не слишком ли часто сохраняем
    const now = Date.now();
    const lastSave = lastSaveTimestamps.get(userId) || 0;
    
    // Если прошло меньше времени, чем SAVE_DEBOUNCE_TIME, добавляем в очередь
    if (now - lastSave < SAVE_DEBOUNCE_TIME) {
      console.log(`[DataService] Добавление в очередь сохранения для пользователя ${userId}, времени прошло: ${now - lastSave}мс`);
      // Если очередь слишком большая, удаляем старые записи
      if (pendingSaves.size >= MAX_PENDING_SAVES) {
        await processBatchSaves();
      }
      
      pendingSaves.set(userId, stateToSave);
      
      // Запускаем таймер для пакетного сохранения, если еще не запущен
      if (!batchSaveTimer) {
        batchSaveTimer = setTimeout(() => processBatchSaves(), SAVE_DEBOUNCE_TIME);
      }
      return;
    }
    
    // Обновляем временную метку последнего сохранения
    lastSaveTimestamps.set(userId, now);
    
    // Добавляем в очередь сохранений
    console.log(`[DataService] Добавляем задачу сохранения в очередь для пользователя ${userId}`);
    saveQueue.enqueue(async () => {
      await saveToPostgres(userId, stateToSave);
    });
    
  } catch (error) {
    // Ошибка сохранения состояния
    console.error(`[DataService] Ошибка сохранения состояния игры для пользователя ${userId}:`, error);
    saveBackup(userId, gameState, error);
    throw error;
  }
}

/**
 * Сохраняет состояние в PostgreSQL с повторными попытками
 */
async function saveToPostgres(userId: string, gameState: ExtendedGameState, attempt = 1): Promise<void> {
  try {
    // Проверяем минимальный интервал между API-запросами для одного и того же пользователя
    const now = Date.now();
    const lastApiCallTime = lastSaveTimestamps.get(userId) || 0;
    const MIN_API_CALL_INTERVAL = 5000; // 5 секунд между API-запросами
    
    if (now - lastApiCallTime < MIN_API_CALL_INTERVAL) {
      const waitTime = MIN_API_CALL_INTERVAL - (now - lastApiCallTime);
      console.log(`[DataService] Слишком частые сохранения для пользователя ${userId}, ожидаем ${waitTime}мс`);
      
      // Ожидаем определенное время перед следующим API-запросом
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    console.log(`[DataService] Сохраняем в PostgreSQL для пользователя ${userId}, попытка ${attempt}`);
    
    // Проверка целостности данных перед отправкой
    if (!checkDataIntegrity(gameState)) {
      console.warn(`[DataService] Целостность данных нарушена перед отправкой в PostgreSQL для пользователя ${userId}, пытаемся восстановить`);
      // Пытаемся восстановить данные из кэша перед отправкой
      gameState = restoreFromCache(userId, gameState);
      
      // Если после восстановления данные все еще некорректны, создаем резервную копию и выходим
      if (!checkDataIntegrity(gameState)) {
        console.error(`[DataService] Не удалось восстановить целостность данных для пользователя ${userId}`);
        saveBackup(userId, gameState, new Error('Data integrity check failed'));
        throw new Error('Data integrity check failed, unable to save to server');
      }
    }
    
    // Обновляем время последнего API-запроса
    lastSaveTimestamps.set(userId, Date.now());
    
    // Удаляем ненужные данные перед отправкой
    const cleanedState = { ...gameState };
    
    // Удаляем предыдущие состояния, если они есть
    if ((cleanedState as any)._previousState) {
      delete (cleanedState as any)._previousState;
    }
    
    // Удаляем другие большие или временные данные
    const fieldsToClean = [
      '_thrownBalls', 
      '_worldRef', 
      '_bodiesMap', 
      '_tempData',
      '_physicsObjects',
      '_sceneObjects',
      '_renderData',
      '_debugInfo',
      '_frameData'
    ];
    
    fieldsToClean.forEach(field => {
      if ((cleanedState as any)[field]) {
        delete (cleanedState as any)[field];
      }
    });
    
    try {
      console.log(`[DataService] Получаем JWT-токен для пользователя ${userId}`);
      // Получаем JWT-токен
      const token = getToken();
      
      // Проверяем наличие токена
      if (!token) {
        console.error(`[DataService] JWT-токен отсутствует для пользователя ${userId}. Убедитесь, что пользователь авторизован.`);
        
        // Сохраняем резервную копию
        saveBackup(userId, gameState, new Error('JWT token missing'));
        
        // В режиме строгой аутентификации выбрасываем ошибку
        throw new Error('Отсутствует JWT токен для аутентификации. Необходима авторизация через Farcaster.');
      }
      
      console.log(`[DataService] Отправляем запрос на сохранение для пользователя ${userId}`);
      // Отправляем запрос на API
      // Определяем базовый URL в зависимости от среды
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const apiUrl = `${baseUrl}/api/game/save-progress`;
      
      // Подготавливаем данные запроса
      const requestData = {
        userId: userId,
        gameState: cleanedState,
        version: cleanedState._saveVersion || 1,
        isCompressed: false
      };
      
      // Преобразуем в JSON с проверкой
      const jsonData = JSON.stringify(requestData);
      if (!jsonData) {
        throw new Error('JSON.stringify вернул пустое значение');
      }
      
      console.log(`[DataService] Размер данных для отправки: ${jsonData.length} байт`);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: jsonData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error(`[DataService] Ошибка от сервера при сохранении для пользователя ${userId}:`, 
          {status: response.status, error: errorData});
        
        // Если ошибка связана с отсутствием пользователя или его аутентификацией
        if (response.status === 401) {
          console.error(`[DataService] Ошибка аутентификации или пользователь не найден для ${userId}.`);
          
          // Проверяем, есть ли специфичный код ошибки
          if (errorData.code === 'USER_NOT_FOUND') {
            console.log('[DataService] Пользователь не найден на сервере, перенаправляем на авторизацию');
            
            // Перенаправляем на страницу авторизации, если это возможно
            if (typeof window !== 'undefined') {
              // Сохраняем текущее состояние игры в localStorage перед перенаправлением
              try {
                const backupState = JSON.stringify(cleanedState);
                localStorage.setItem('backup_game_state', backupState);
                localStorage.setItem('backup_timestamp', Date.now().toString());
                
                console.log('[DataService] Создана резервная копия состояния игры перед перенаправлением');
                
                // Перенаправляем на страницу авторизации
                window.location.href = '/auth';
                return; // Прерываем выполнение функции
              } catch (backupError) {
                console.error('[DataService] Ошибка при создании резервной копии перед перенаправлением:', backupError);
              }
            }
          }
          
          throw new Error(`Ошибка аутентификации: ${errorData.error || response.statusText}. Требуется авторизация через Farcaster.`);
        }
        
        throw new Error(`Failed to save game state: ${errorData.error || response.statusText}`);
      }
      
      const responseData = await response.json();
      console.log(`[DataService] Успешное сохранение для пользователя ${userId}:`, responseData);
    } catch (error) {
      console.error(`[DataService] Ошибка сохранения данных в PostgreSQL для пользователя ${userId}:`, error);
      
      // Если не последняя попытка, пробуем еще раз
      if (attempt < MAX_RETRY_ATTEMPTS) {
        // Экспоненциальная задержка между попытками
        const delay = RETRY_DELAY * Math.pow(2, attempt - 1);
        console.log(`[DataService] Повторная попытка через ${delay}мс для пользователя ${userId}, попытка ${attempt + 1}`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return saveToPostgres(userId, gameState, attempt + 1);
      }
      
      // Если все попытки исчерпаны, сохраняем резервную копию
      saveBackup(userId, gameState, error);
      throw error;
    }
  } catch (error) {
    console.error(`[DataService] Критическая ошибка сохранения в PostgreSQL для пользователя ${userId}:`, error);
    // Сохраняем резервную копию и пробрасываем ошибку
    saveBackup(userId, gameState, error);
    throw error;
  }
}

/**
 * Обрабатывает пакетные сохранения
 */
async function processBatchSaves(): Promise<void> {
  try {
    // Копируем текущие ожидающие сохранения и очищаем очередь
    const savesToProcess = new Map(pendingSaves);
    pendingSaves.clear();
    
    // Сбрасываем таймер
    if (batchSaveTimer) {
      clearTimeout(batchSaveTimer);
      batchSaveTimer = null;
    }

    // Создаем локальную резервную копию всех сохранений для восстановления
    const backupSaves = new Map(savesToProcess);
    
    // Массив для отслеживания сбойных сохранений
    const failedSaves: [string, ExtendedGameState][] = [];
    
    // Обрабатываем каждое сохранение
    const savePromises: Promise<void>[] = [];
    
    savesToProcess.forEach((state, userId) => {
      // Создаем резервную копию перед сохранением
      saveBackup(userId, state);
      
      // Обновляем временную метку последнего сохранения
      lastSaveTimestamps.set(userId, Date.now());
      
      // Добавляем операцию в массив промисов с обработкой ошибок
      const savePromise = saveQueue.enqueue(async () => {
        try {
          await saveToPostgres(userId, state);
        } catch (saveError) {
          console.error(`Ошибка сохранения для пользователя ${userId}:`, saveError);
          // Сохраняем информацию о неудачном сохранении
          failedSaves.push([userId, state]);
        }
      }) as Promise<void>;
      
      savePromises.push(savePromise);
    });
    
    // Ждем завершения всех операций сохранения
    await Promise.allSettled(savePromises);
    
    // Если есть неудачные сохранения, добавляем их обратно в очередь pendingSaves
    // с короткой задержкой перед следующей попыткой
    if (failedSaves.length > 0) {
      console.warn(`${failedSaves.length} сохранений не удалось выполнить, планируем повторную попытку`);
      
      // Добавляем неудачные сохранения обратно в очередь
      for (const [userId, state] of failedSaves) {
        pendingSaves.set(userId, state);
      }
      
      // Запускаем таймер для повторной попытки с меньшим интервалом
      batchSaveTimer = setTimeout(
        () => processBatchSaves(), 
        Math.min(SAVE_DEBOUNCE_TIME / 2, 5000)
      );
    }
  } catch (error) {
    console.error('Ошибка в процессе пакетной обработки сохранений:', error);
    
    // Пробуем индивидуально сохранить каждое состояние при ошибке пакетной обработки
    for (const [userId, state] of Array.from(pendingSaves.entries())) {
      try {
        await saveToPostgres(userId, state);
      } catch (individualError) {
        console.error(`Индивидуальная ошибка сохранения для пользователя ${userId}:`, individualError);
        // Создаем резервную копию при ошибке
        saveBackup(userId, state, individualError);
      }
    }
    
    // Очищаем очередь после индивидуальных попыток
    pendingSaves.clear();
  }
}

/**
 * Загружает состояние игры с оптимизацией
 */
export async function loadGameState(userId: string): Promise<ExtendedGameState | null> {
  try {
    if (!userId) {
      throw new Error('Invalid userId for loadGameState');
    }
    
    // Проверяем, не слишком ли часто загружаем данные
    const now = Date.now();
    const lastLoad = lastLoadTimestamps.get(userId) || 0;
    
    if (now - lastLoad < LOAD_DEBOUNCE_TIME) {
      console.log(`[DataService] Слишком частые загрузки для пользователя ${userId}, ожидаем ${LOAD_DEBOUNCE_TIME}мс`);
      // Возвращаем данные из кэша, если они есть
      const cachedEntry = gameStateCache.get(userId);
      if (cachedEntry && cachedEntry.integrity) {
        return cachedEntry.data;
      }
      
      // Возвращаем резервную копию, если нет кэша
      const backupData = getBackup(userId);
      if (backupData) {
        return backupData;
      }
      
      // Позволяем загрузку только если нет ни кэша, ни резервной копии
    }
    
    // Обновляем время последней загрузки
    lastLoadTimestamps.set(userId, now);
    
    // Проверяем кэш сначала
    const cachedEntry = gameStateCache.get(userId);
    if (cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_TTL) && cachedEntry.integrity) {
      return cachedEntry.data;
    }
    
    // Переменная для хранения резервной копии
    let backupData: ExtendedGameState | null = null;
    
    // Проверяем, есть ли резервная копия
    backupData = getBackup(userId);
    
    // Настраиваем таймаут для запроса - увеличиваем до 15 секунд для предотвращения AbortError
    let controller: AbortController | null = new AbortController();
    let timeoutId: NodeJS.Timeout | null = null;
    
    // Переменная для отслеживания, отменен ли запрос вручную
    let isManuallyAborted = false;
    
    try {
      // Устанавливаем таймаут с сохранением ссылки для очистки
      timeoutId = setTimeout(() => {
        if (controller) {
          console.log(`[DataService] Таймаут запроса истек для пользователя ${userId}`);
          isManuallyAborted = true;
          controller.abort();
        }
      }, 15000); // Увеличиваем до 15 секунд
      
      console.log(`[DataService] Получаем JWT-токен для пользователя ${userId} (загрузка)`);
      // Получаем токен авторизации через единый метод
      const token = getToken();
      
      if (!token) {
        console.error(`[DataService] JWT-токен отсутствует для пользователя ${userId} при загрузке`);
        
        // Если есть резервная копия в памяти, возвращаем её
        if (backupData) {
          console.log(`[DataService] Возвращаем резервную копию из-за отсутствия токена для ${userId}`);
          return backupData;
        }
        
        throw new Error('Отсутствует JWT токен для аутентификации при загрузке');
      }
      
      // Определяем базовый URL в зависимости от среды
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const apiUrl = `${baseUrl}/api/game/load-progress`;
      
      console.log(`[DataService] Отправляем запрос на загрузку для пользователя ${userId}`);
      
      // Делаем запрос к API с повторными попытками
      let retryCount = 0;
      const MAX_RETRIES = 2;
      let lastError: Error | null = null;
      
      while (retryCount <= MAX_RETRIES) {
        if (isManuallyAborted) {
          break;
        }
        
        try {
          if (retryCount > 0) {
            console.log(`[DataService] Повторная попытка ${retryCount} для пользователя ${userId}`);
            
            // Создаем новый контроллер для каждой повторной попытки
            if (controller) {
              controller = new AbortController();
            }
          }
          
          // Делаем запрос с текущим контроллером
          const response = await fetch(`${apiUrl}?userId=${userId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            },
            signal: controller ? controller.signal : undefined
          });
          
          // Если запрос успешен, прерываем цикл повторных попыток
          if (response.ok) {
            // Получаем данные из ответа
            const data = await response.json();
            
            // Очищаем таймаут
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
            
            if (!data.data || !data.data.gameState) {
              console.error(`[DataService] Ответ не содержит данных gameState для пользователя ${userId}`);
              // Если данных нет, используем резервную копию
              if (backupData) {
                return backupData;
              }
              
              return null;
            }
            
            // Создаем правильно типизированную переменную
            let typedData: ExtendedGameState;
            
            // Проверяем, сжаты ли данные
            if (data.data.isCompressed) {
              // Распаковываем сжатые данные
              try {
                const LZString = await import('lz-string');
                const decompressed = LZString.decompressFromUTF16(data.data.gameState._compressedData);
                
                if (!decompressed) {
                  throw new Error('Decompression failed, got empty result');
                }
                
                typedData = JSON.parse(decompressed) as ExtendedGameState;
              } catch (decompressError) {
                console.error('[DataService] Ошибка при распаковке сжатых данных:', decompressError);
                // В случае ошибки распаковки, возвращаем резервную копию
                if (backupData) {
                  return backupData;
                }
                throw new Error('Failed to decompress game data');
              }
            } else {
              // Проверяем формат gameState - поддержка как структурированного, так и обычного формата
              const gameState = data.data.gameState;
              
              // Для структурированного формата (с critical/regular/extended)
              if (gameState.critical && gameState.critical.inventory) {
                // Преобразуем из структурированного формата в ExtendedGameState
                typedData = {
                  inventory: gameState.critical.inventory,
                  container: gameState.critical.container,
                  upgrades: gameState.critical.upgrades,
                  achievements: gameState.regular?.achievements || { unlockedAchievements: [] },
                  stats: gameState.regular?.stats || {},
                  items: gameState.regular?.items || [],
                  settings: gameState.extended?.settings || {
                    language: 'ru',
                    theme: 'light',
                    notifications: true,
                    tutorialCompleted: false
                  },
                  soundSettings: gameState.extended?.soundSettings || {
                    clickVolume: 0.5,
                    effectsVolume: 0.5,
                    backgroundMusicVolume: 0.3,
                    isMuted: false,
                    isEffectsMuted: false,
                    isBackgroundMusicMuted: false
                  },
                  activeTab: "laboratory",
                  hideInterface: false,
                  isPlaying: false,
                  isLoading: false,
                  containerLevel: gameState.critical.container.level || 1,
                  fillingSpeed: gameState.critical.container.fillRate || 1,
                  containerSnot: gameState.critical.container.currentAmount || 0,
                  gameStarted: true,
                  highestLevel: gameState.critical.container.level || 1,
                  consecutiveLoginDays: 0,
                  user: gameState.critical.metadata?.user || null,
                  validationStatus: "valid",
                  _saveVersion: gameState.critical.metadata?.version || 1,
                  _lastModified: Date.now(),
                  _lastSaved: new Date().toISOString(),
                } as ExtendedGameState;
              } else {
                // Это обычный формат GameState
                typedData = gameState as unknown as ExtendedGameState;
              }
            }
            
            // Проверяем целостность загруженных данных
            const isDataValid = checkDataIntegrity(typedData);
            
            if (!isDataValid && backupData) {
              // Если данные с сервера некорректны, но есть резервная копия - используем ее
              console.warn(`[DataService] Данные с сервера не прошли проверку целостности для ${userId}, используем резервную копию`);
              return backupData;
            }
            
            // Обновляем кэш
            gameStateCache.set(userId, {
              data: typedData,
              timestamp: Date.now(),
              version: typedData._saveVersion || 0,
              integrity: isDataValid
            });
            
            // Ограничиваем размер кэша
            limitCacheSize();
            
            // Обновляем версию
            stateVersions.set(userId, typedData._saveVersion || 0);
            
            // Обновляем время последней загрузки с фактическим временем завершения запроса
            lastLoadTimestamps.set(userId, Date.now());
            
            console.log(`[DataService] Успешно загружены данные для пользователя ${userId}`);
            return typedData;
          } else {
            // Если ответ не OK, получаем текст ошибки
            let errorText = `Статус ответа: ${response.status}`;
            try {
              const errorData = await response.json();
              errorText = errorData.error || errorText;
            } catch (parseError) {
              // Игнорируем ошибки парсинга JSON ответа
            }
            
            throw new Error(`Ошибка загрузки: ${errorText}`);
          }
        } catch (error) {
          console.error(`[DataService] Ошибка при загрузке данных для пользователя ${userId} (попытка ${retryCount}):`, error);
          lastError = error instanceof Error ? error : new Error('Unknown error');
          retryCount++;
          
          // Если это не последняя попытка, делаем паузу перед следующей
          if (retryCount <= MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          }
        }
      }
      
      // Если все попытки исчерпаны, очищаем таймаут и возвращаем резервную копию
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Если все попытки исчерпаны, возвращаем резервную копию
      if (backupData) {
        console.log(`[DataService] Все попытки загрузки завершились с ошибкой, возвращаем резервную копию для ${userId}`);
        return backupData;
      }
      
      // Если нет резервной копии, возвращаем кэшированные данные или null
      const cachedEntry = gameStateCache.get(userId);
      if (cachedEntry) {
        console.log(`[DataService] Возвращаем просроченные данные из кэша после неудачных попыток для ${userId}`);
        return cachedEntry.data;
      }
      
      console.error(`[DataService] Не удалось загрузить данные для ${userId} и нет резервных копий`);
      return null;
    } catch (error) {
      // Очищаем таймаут в случае критической ошибки
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      console.error(`[DataService] Критическая ошибка загрузки для пользователя ${userId}:`, error);
      
      // В случае критической ошибки, пробуем вернуть данные из кэша, даже если они просрочены
      const cachedEntry = gameStateCache.get(userId);
      if (cachedEntry) {
        console.log(`[DataService] Возвращаем просроченные данные из кэша для ${userId}`);
        return cachedEntry.data;
      }
      
      return null;
    }
  } catch (error) {
    console.error(`[DataService] Критическая ошибка загрузки для пользователя ${userId}:`, error);
    
    // В случае критической ошибки, пробуем вернуть данные из кэша, даже если они просрочены
    const cachedEntry = gameStateCache.get(userId);
    if (cachedEntry) {
      console.log(`[DataService] Возвращаем просроченные данные из кэша для ${userId}`);
      return cachedEntry.data;
    }
    
    return null;
  }
}

/**
 * Принудительно сохраняет состояние игры
 */
export async function forceSaveGameState(userId: string, gameState: ExtendedGameState): Promise<void> {
  try {
    if (!userId || !gameState) {
      throw new Error('Invalid arguments for forceSaveGameState');
    }
    
    // Проверяем целостность данных перед сохранением
    const isDataValid = checkDataIntegrity(gameState);
    if (!isDataValid) {
      gameState = restoreFromCache(userId, gameState);
    }
    
    // Обновляем версию состояния
    const currentVersion = stateVersions.get(userId) || 0;
    const newVersion = currentVersion + 1;
    stateVersions.set(userId, newVersion);
    
    // Подготавливаем состояние для сохранения
    const stateToSave = { 
      ...gameState,
      _saveVersion: newVersion,
      _lastSaved: new Date().toISOString(),
      _isForceSave: true,
      _isBeforeUnloadSave: true
    };
    
    // Создаем резервную копию в памяти при принудительном сохранении
    saveBackup(userId, stateToSave);
    
    // Обновляем кэш
    gameStateCache.set(userId, {
      data: stateToSave,
      timestamp: Date.now(),
      version: newVersion,
      integrity: checkDataIntegrity(stateToSave)
    });
    
    // Обновляем временную метку последнего сохранения
    lastSaveTimestamps.set(userId, Date.now());
    
    // Очищаем очередь ожидающих сохранений
    if (pendingSaves.has(userId)) {
      pendingSaves.delete(userId);
    }
    
    // Сохраняем напрямую, без очереди и с таймаутом
    const savePromise = saveToPostgres(userId, stateToSave);
    
    // Устанавливаем максимальное время ожидания для принудительного сохранения
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Force save timeout'));
      }, 3000); // Уменьшаем таймаут до 3 секунд для быстрого выхода
    });
    
    // Используем Promise.race для ограничения времени ожидания
    try {
      await Promise.race([savePromise, timeoutPromise]);
    } catch (raceError) {
      // Полагаемся на резервную копию в памяти
    }
  } catch (error) {
    // Ошибка принудительного сохранения
    
    // Создаем резервную копию в памяти
    saveBackup(userId, gameState, error);
    throw error;
  }
}

/**
 * Очищает кэш для пользователя
 */
export function invalidateCache(userId: string): void {
  gameStateCache.delete(userId);
}

/**
 * Проверяет, есть ли ожидающие изменения для данного пользователя
 */
export function hasPendingChanges(userId: string): boolean {
  return pendingSaves.has(userId);
}

/**
 * Сохраняет все ожидающие изменения немедленно
 */
export async function saveAllPendingChanges(): Promise<void> {
  if (pendingSaves.size > 0) {
    await processBatchSaves();
  }
}

/**
 * Настраивает обработчик для события beforeunload
 */
export function setupBeforeUnloadHandler(userId: string, getLatestState: () => ExtendedGameState): () => void {
  if (typeof window === 'undefined') return () => {};
  
  const handleBeforeUnload = (event: BeforeUnloadEvent) => {
    try {
      const state = getLatestState();
      
      // Устанавливаем флаг для сохранения перед закрытием
      state._isBeforeUnloadSave = true;
      
      // Сохраняем в память как резервную копию
      saveBackup(userId, state);
      
      // Используем Beacon API для надежной отправки перед закрытием
      if (navigator.sendBeacon) {
        // Получаем JWT-токен через единый метод
        const token = getToken();
        
        // Если токена нет, не отправляем запрос
        if (!token) {
          console.warn('[DataService] JWT-токен отсутствует при сохранении перед закрытием страницы');
          return;
        }
        
        // Подготавливаем данные для отправки
        const payload = {
          userId,
          gameState: state,
          clientTimestamp: new Date().toISOString(),
          version: state._saveVersion || 1,
          isCompressed: false
        };
        
        // Создаем заголовки для Beacon API (хотя они не могут быть напрямую использованы)
        // Добавляем токен в URL в качестве обходного решения
        const data = JSON.stringify(payload);
        const blob = new Blob([data], { type: 'application/json' });
        navigator.sendBeacon(`/api/game/save-progress?token=${encodeURIComponent(token)}`, blob);
      }
      
      // Отменяем стандартное сообщение подтверждения выхода
      event.preventDefault();
      // Chrome требует возврата значения
      event.returnValue = '';
    } catch (error) {
      console.error('[DataService] Ошибка в обработчике beforeUnload:', error);
    }
  };
  
  // Добавляем обработчик
  window.addEventListener('beforeunload', handleBeforeUnload);
  
  // Возвращаем функцию для удаления обработчика
  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}

/**
 * Очищает все кэши и состояния
 */
export function clearAllCaches(): void {
  gameStateCache.clear();
  lastSaveTimestamps.clear();
  stateVersions.clear();
  pendingSaves.clear();
  backupStore.clear();
  
  if (batchSaveTimer) {
    clearTimeout(batchSaveTimer);
    batchSaveTimer = null;
  }
}

/**
 * Валидирует данные игры
 */
export function validateGameData(data: any): boolean {
  // Базовая проверка
  if (!data || typeof data !== 'object') {
    return false;
  }
  
  // Проверка обязательных полей
  if (!data.inventory || !data.user || !data.container) {
    return false;
  }
  
  // Проверка типов данных
  if (typeof data.inventory.snot !== 'number' || 
      typeof data.inventory.snotCoins !== 'number') {
    return false;
  }
  
  // Проверка пользовательских данных
  if (!data.user.id) {
    return false;
  }
  
  return true;
}

/**
 * Отменяет все активные запросы
 */
export function cancelAllRequests(): void {
  // Можно реализовать с помощью AbortController, если необходимо
  console.warn('cancelAllRequests: Not implemented');
} 