import { Action, GameState, ExtendedGameState } from "../types/gameTypes"
import { initialState } from "../constants/gameConstants"
import { createInitialGameState, FILL_RATES } from "../constants/gameConstants"
import { UPGRADE_VALUES } from '../constants/gameConstants'

// Определяем интерфейс Container для использования внутри файла
interface Container {
  id: string;
  level: number;
  requiredSnot?: number;
  capacity?: number;
  timestamp?: number;
  [key: string]: any; // Дополнительные поля
}

// Расширяем интерфейс ExtendedGameState для поддержки массива контейнеров
interface ExtendedGameStateWithContainers extends ExtendedGameState {
  containers?: Container[];
}

// Единое хранилище для данных в памяти
const inMemoryStore: Record<string, any> = {};

/**
 * Рассчитывает емкость контейнера на основе уровня
 * @param level Уровень контейнера
 * @returns Емкость контейнера
 */
function calculateContainerCapacity(level: number): number {
  // Безопасный уровень для доступа к массиву значений
  const safeLevel = Math.max(1, Math.min(level, UPGRADE_VALUES.containerCapacity.length));
  
  // Индекс в массиве на 1 меньше, чем уровень
  const capacityIndex = safeLevel - 1;
  
  // Получаем значение из константы
  const result = UPGRADE_VALUES.containerCapacity[capacityIndex];
  
  // Возвращаем значение вместимости контейнера
  return typeof result === 'number' ? result : 1;
}

// Тип для пэйлоада действий
export type ActionPayload = {
  [key: string]: any;
};

// Тип для действий
export type ActionType = 
  | 'SET_RESOURCE'
  | 'INCREMENT_RESOURCE'
  | 'COLLECT_CONTAINER_SNOT'
  | 'UPDATE_CONTAINER'
  | 'INIT_CONTAINER'
  | 'UPGRADE_CONTAINER'
  | 'REPLACE_GAME_STATE'
  | 'UPDATE_GAME_STATE'
  | 'MERGE_GAME_STATE'
  | 'RESET_PROGRESS'
  | 'SET_USER_ID'
  | 'SET_SAVE_VERSION'
  | 'SET_SAVED_TIME'
  | 'LOGIN'                   // Добавляем все используемые типы действий
  | 'SET_ACTIVE_TAB'
  | 'SET_USER'
  | 'UPDATE_CONTAINER_LEVEL'
  | 'UPDATE_CONTAINER_SNOT'
  | 'UPDATE_FILLING_SPEED'
  | 'UPDATE_RESOURCES'
  | 'ADD_SNOT'
  | 'LOAD_GAME_STATE'
  | 'UPDATE_CONTAINER'         // Этот тип уже есть выше, но TypeScript его не видит
  | 'ADD_CONTAINER'            // Добавим недостающие типы, использованные в reducer
  | 'REMOVE_CONTAINER'         // Добавим недостающие типы, использованные в reducer
  | 'SET_GAME_STARTED'         // Добавим недостающие типы
  | 'SET_CLICK_SOUND_VOLUME'   // Добавим недостающие типы
  | 'SET_BACKGROUND_MUSIC_VOLUME' // Добавим недостающие типы
  | 'SET_EFFECTS_SOUND_VOLUME' // Добавим недостающие типы
  | 'SET_MUTE'                 // Добавим недостающие типы
  | 'SET_EFFECTS_MUTE'         // Добавим недостающие типы
  | 'SET_BACKGROUND_MUSIC_MUTE' // Добавим недостающие типы
  | 'SET_HIDE_INTERFACE'       // Добавим недостающие типы
  | 'SET_SOUND_SETTINGS'       // Добавим недостающие типы
  | 'UPDATE_INVENTORY'         // Добавим недостающие типы
  | 'UPDATE_UPGRADES'          // Добавим недостающие типы
  | 'UPGRADE_FILLING_SPEED'    // Добавим недостающие типы
  | 'UPGRADE_CONTAINER_CAPACITY' // Добавим недостающие типы
  | 'INCREMENT_CONTAINER_CAPACITY' // Добавим недостающие типы
  | 'INITIALIZE_NEW_USER'      // Добавим недостающие типы
  | 'LOAD_USER_DATA'           // Добавим недостающие типы
  | 'SET_IS_PLAYING'           // Добавим недостающие типы
  | 'SET_GAME_INSTANCE_RUNNING'; // Добавим недостающие типы

// Используем any для обхода строгой типизации
export function gameReducer(state: any = initialState, action: any): any {
  // Вспомогательная функция для обновления метаданных
  const withMetadata = (newState: any): any => {
    return {
      ...state,
      ...newState,
      _lastActionTime: new Date().toISOString(),
      _lastAction: action.type
    };
  };

  switch (action.type) {
    case "LOGIN":
      return withMetadata({
        activeTab: "laboratory",
        isLoading: true,
        // Принудительно сбрасываем эти значения для безопасности
        hideInterface: false
      });

    case "SET_ACTIVE_TAB":
      return withMetadata({
        activeTab: action.payload
      });

    case "SET_USER":
      if (action.payload) {
        // Обновляем state с данными пользователя из Farcaster и обязательно устанавливаем _userId
        return withMetadata({ 
          user: { 
            id: action.payload.id?.toString() || action.payload.id,
            username: action.payload.username || null,
            displayName: action.payload.displayName || null,
            farcaster_fid: action.payload.fid?.toString() || action.payload.farcaster_fid || null,
            farcaster_username: action.payload.username || null,
            farcaster_displayname: action.payload.displayName || null,
            farcaster_pfp: action.payload.pfp || null,
            pfp: action.payload.pfp || null,
            fid: action.payload.fid || null,
            verified: action.payload.verified || null,
            metadata: action.payload.metadata || {}
          },
          _userId: action.payload.userId || action.payload.id?.toString() || action.payload.id
        });
      }
      // Если payload null, сбрасываем пользователя
      return withMetadata({ user: null });

    case "UPDATE_CONTAINER_LEVEL":
      return withMetadata({
        container: {
          ...state.container,
          level: action.payload
        }
      });

    case "UPDATE_CONTAINER_SNOT":
      // Защита от NaN или неопределенных значений
      const newContainerSnot = typeof action.payload === 'number' ? action.payload : 0;
      
      return withMetadata({
        inventory: {
          ...state.inventory,
          containerSnot: newContainerSnot,
        },
      });

    case "UPDATE_FILLING_SPEED":
      // Используем payload для прямого обновления значения скорости
      return withMetadata({
        inventory: {
          ...state.inventory,
          fillingSpeed: action.payload,
        },
      });

    case "UPDATE_RESOURCES": {
      const containerCapacity = Math.max(1, state.inventory.containerCapacity || 1);
      
      return withMetadata({
        inventory: {
          ...state.inventory,
          containerCapacity: containerCapacity
        }
      });
    }

    case "SET_RESOURCE": {
      const { resource, value } = action.payload;
      
      return withMetadata({
        inventory: {
          ...state.inventory,
          [resource]: value
        }
      });
    }

    case "ADD_SNOT":
      return withMetadata({
        inventory: {
          ...state.inventory,
          snot: state.inventory.snot + action.payload,
        },
      });

    case "COLLECT_CONTAINER_SNOT": {
      // Текущее значение snot - гарантируем число
      const currentSnot = typeof state.inventory.snot === 'number' ? state.inventory.snot : 0;
      
      // Проверяем, что передан containerSnot
      const amountToCollect = typeof action.payload.containerSnot === 'number' 
        ? action.payload.containerSnot 
        : (action.payload.amount || 0);
      
      // Валидируем значение
      const validAmount = Math.max(0, amountToCollect);
      
      // Вычисляем новое значение снота
      const newSnot = currentSnot + validAmount;
      
      // Проверяем, есть ли указание на ожидаемое значение
      const expectedSnot = action.payload.expectedSnot;
      
      // Выбираем окончательное значение, гарантируя, что оно число
      let finalSnot = expectedSnot !== undefined ? Number(expectedSnot) : Number(newSnot);
      
      if (isNaN(finalSnot)) {
        finalSnot = currentSnot + validAmount; // Fallback если новое значение NaN
        console.warn('[COLLECT_CONTAINER_SNOT] Обнаружено недопустимое значение snot, исправлено:', {
          currentSnot,
          amountToCollect,
          expectedSnot,
          finalSnot
        });
      }
      
      // Немедленно сохраняем значение в сессионное хранилище для максимальной защиты
      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          const userId = state._userId || 'unknown';
          const backupKey = `snot_backup_${userId}`;
          const backup = {
            snot: finalSnot,
            snotCoins: state.inventory.snotCoins || 0,
            timestamp: Date.now(),
            action: 'COLLECT_CONTAINER_SNOT'
          };
          sessionStorage.setItem(backupKey, JSON.stringify(backup));
          
          // Создаем дополнительную копию с уникальным ключом для максимальной надежности
          const uniqueBackupKey = `snot_backup_${userId}_${Date.now()}`;
          sessionStorage.setItem(uniqueBackupKey, JSON.stringify(backup));
          
          console.log('[COLLECT_CONTAINER_SNOT] Сохранены резервные копии snot:', {
            snot: finalSnot,
            standardKey: backupKey,
            uniqueKey: uniqueBackupKey
          });
          
          // Также сохраняем в localStorage для дополнительной защиты
          try {
            const localBackupKey = `snotcoin_snot_backup_${userId}`;
            localStorage.setItem(localBackupKey, JSON.stringify(backup));
          } catch (localError) {
            // Игнорируем ошибки localStorage, основной приоритет у sessionStorage
          }
        }
      } catch (error) {
        // Игнорируем ошибки сессионного хранилища, но логируем для отладки
        console.warn('[COLLECT_CONTAINER_SNOT] Ошибка при создании резервной копии:', error);
      }
      
      // Атомарно обновляем состояние с минимальным логированием
      const updatedState = {
        ...state,
        inventory: {
          ...state.inventory,
          snot: finalSnot,
          containerSnot: 0 // Обнуляем контейнер при сборе
        },
        _lastActionTime: new Date().toISOString(),
        _lastAction: action.type,
        _lastModified: Date.now() // Важно обновить время модификации для корректного сохранения
      };
      
      return updatedState;
    }

    case "UPGRADE_FILLING_SPEED":
      // Получаем новый уровень скорости
      const newSpeedLevel = state.inventory.fillingSpeedLevel + 1;
      
      // Получаем новую скорость заполнения из массива значений для уровней
      // Используем индексацию с 0, поэтому для уровня 1 берем элемент с индексом 0
      const safeLevel = Math.min(newSpeedLevel, UPGRADE_VALUES.fillingSpeed.length) - 1;
      const newFillingSpeed = UPGRADE_VALUES.fillingSpeed[Math.max(0, safeLevel)];
      
      return withMetadata({
        inventory: {
          ...state.inventory,
          fillingSpeed: newFillingSpeed, // Устанавливаем значение из массива
          fillingSpeedLevel: newSpeedLevel,
        },
      });

    case "UPGRADE_CONTAINER_CAPACITY": {
      const { cost } = action.payload;
      // Проверка наличия достаточного количества snotCoins
      if (state.inventory.snotCoins < cost) {
        return state;
      }

      // Новый уровень емкости контейнера
      const newLevel = state.inventory.containerCapacityLevel + 1;
      // Новая емкость контейнера
      const newCapacity = calculateContainerCapacity(newLevel);

      // @ts-ignore - игнорируем проблему с типом, так как объединяем существующие поля
      return withMetadata({
        ...state,
        inventory: {
          ...state.inventory,
          containerCapacityLevel: newLevel,
          containerCapacity: newCapacity,
          snotCoins: state.inventory.snotCoins - cost
        },
        container: {
          ...state.container,
          level: newLevel
        }
      });
    }

    case "INCREMENT_CONTAINER_CAPACITY": {
      // Новый уровень емкости контейнера
      const newLevel = (state.inventory.containerCapacityLevel || 1) + 1;
      // Новая емкость контейнера
      const newCapacity = calculateContainerCapacity(newLevel);

      // @ts-ignore - игнорируем проблему с типом, так как объединяем существующие поля
      return withMetadata({
        ...state,
        inventory: {
          ...state.inventory,
          containerCapacityLevel: newLevel,
          containerCapacity: newCapacity
        },
        container: {
          ...state.container,
          level: newLevel
        }
      });
    }

    case "INITIALIZE_NEW_USER": {
      // Если передан payload, используем его
      if (action.payload) {
        // Проверяем необходимые поля и устанавливаем значения по умолчанию если они отсутствуют
        const customState = { ...action.payload };
        
        return {
          ...customState,
          activeTab: "laboratory",
          hideInterface: false, // Принудительно показываем интерфейс
          _lastActionTime: new Date().toISOString(),
          _lastAction: action.type,
          lastValidation: new Date().toISOString()
        };
      }
      
      // Стандартная инициализация для нового пользователя
      const currentUser = state.user;
      
      return {
        ...createInitialGameState(state._userId || "unknown"),
        user: currentUser,
        activeTab: "laboratory",
        hideInterface: false, // Принудительно показываем интерфейс
        inventory: {
          snot: 0,
          snotCoins: 0,
          containerSnot: 0,
          containerCapacity: 1, // Вместимость для 1 уровня
          containerCapacityLevel: 1,
          fillingSpeed: 1, // 1 snot за 12 часов при уровне 1
          fillingSpeedLevel: 1,
          collectionEfficiency: 1,
          lastUpdateTimestamp: Date.now(),
        },
        container: {
          level: 1,
          currentAmount: 0,
          fillRate: 1,
          currentFill: 0
        }
      };
    }

    case "RESET_GAME_STATE":
      return {
        ...initialState as ExtendedGameStateWithContainers,
        activeTab: "laboratory",
        hideInterface: false, // Принудительно показываем интерфейс
        user: null,
        validationStatus: "pending",
        lastValidation: new Date().toISOString(),
        _saveVersion: (state._saveVersion || 0) + 1,
        _lastSaved: new Date().toISOString(),
        _lastActionTime: new Date().toISOString(),
        _lastAction: action.type
      };

    case "LOAD_USER_DATA":
      return withMetadata({
        ...state,
        ...action.payload,
      });

    case "SET_IS_PLAYING":
      return withMetadata({
        isPlaying: action.payload,
      });
      
    case "LOAD_GAME_STATE": {
      // Нормализуем восстановленное состояние
      const loadedState = action.payload;
      
      // Сохраняем userId из localStorage, если он отсутствует в загружаемом состоянии
      if (typeof window !== 'undefined' && !loadedState._userId) {
        const storedUserId = localStorage.getItem('user_id') || localStorage.getItem('game_id');
        if (storedUserId) {
          loadedState._userId = storedUserId;
        }
      }
      
      // Проверяем и восстанавливаем критически важные части состояния
      const normalizedState = {
        ...loadedState,
        // Обновляем метаданные для отслеживания восстановления
        _lastActionTime: new Date().toISOString(),
        _lastAction: action.type,
        _loadedAt: new Date().toISOString(),
        // Убеждаемся, что userId всегда присутствует
        _userId: loadedState._userId || state._userId || '',
        // Принудительно показываем интерфейс при загрузке
        hideInterface: false,
        // Устанавливаем лабораторию как активную вкладку, если не указано иное
        activeTab: loadedState.activeTab || "laboratory"
      };
      
      // Возвращаем объединенное состояние с isLoading: false
      return {
        ...state, // Включаем все поля из предыдущего состояния
        ...normalizedState, // Перезаписываем загруженными/нормализованными данными
        isLoading: false // Явно устанавливаем isLoading в false
      };
    }

    case "SET_GAME_STARTED":
      return withMetadata({
        gameStarted: action.payload,
      });

    case "SET_CLICK_SOUND_VOLUME":
      return {
        ...state,
        soundSettings: {
          ...(state.soundSettings || {}),
          clickVolume: action.payload,
          musicVolume: state.soundSettings?.musicVolume || 0.5,
          soundVolume: state.soundSettings?.soundVolume || 0.5,
          notificationVolume: state.soundSettings?.notificationVolume || 0.5,
          effectsVolume: state.soundSettings?.effectsVolume || 0.5,
          backgroundMusicVolume: state.soundSettings?.backgroundMusicVolume || 0.3,
          isMuted: state.soundSettings?.isMuted || false,
          isEffectsMuted: state.soundSettings?.isEffectsMuted || false,
          isBackgroundMusicMuted: state.soundSettings?.isBackgroundMusicMuted || false
        },
      };

    case "SET_BACKGROUND_MUSIC_VOLUME":
      return {
        ...state,
        soundSettings: {
          ...(state.soundSettings || {}),
          backgroundMusicVolume: action.payload,
          musicVolume: state.soundSettings?.musicVolume || 0.5,
          soundVolume: state.soundSettings?.soundVolume || 0.5,
          notificationVolume: state.soundSettings?.notificationVolume || 0.5,
          clickVolume: state.soundSettings?.clickVolume || 0.5,
          effectsVolume: state.soundSettings?.effectsVolume || 0.5,
          isMuted: state.soundSettings?.isMuted || false,
          isEffectsMuted: state.soundSettings?.isEffectsMuted || false,
          isBackgroundMusicMuted: state.soundSettings?.isBackgroundMusicMuted || false
        },
      };

    case "SET_EFFECTS_SOUND_VOLUME":
      return {
        ...state,
        soundSettings: {
          ...(state.soundSettings || {}),
          effectsVolume: action.payload,
          musicVolume: state.soundSettings?.musicVolume || 0.5,
          soundVolume: state.soundSettings?.soundVolume || 0.5,
          notificationVolume: state.soundSettings?.notificationVolume || 0.5,
          clickVolume: state.soundSettings?.clickVolume || 0.5,
          backgroundMusicVolume: state.soundSettings?.backgroundMusicVolume || 0.3,
          isMuted: state.soundSettings?.isMuted || false,
          isEffectsMuted: state.soundSettings?.isEffectsMuted || false,
          isBackgroundMusicMuted: state.soundSettings?.isBackgroundMusicMuted || false
        },
      };

    case "SET_MUTE":
      return {
        ...state,
        soundSettings: {
          ...(state.soundSettings || {}),
          isMuted: action.payload,
          musicVolume: state.soundSettings?.musicVolume || 0.5,
          soundVolume: state.soundSettings?.soundVolume || 0.5,
          notificationVolume: state.soundSettings?.notificationVolume || 0.5,
          clickVolume: state.soundSettings?.clickVolume || 0.5,
          effectsVolume: state.soundSettings?.effectsVolume || 0.5,
          backgroundMusicVolume: state.soundSettings?.backgroundMusicVolume || 0.3,
          isEffectsMuted: state.soundSettings?.isEffectsMuted || false,
          isBackgroundMusicMuted: state.soundSettings?.isBackgroundMusicMuted || false
        },
      };

    case "SET_EFFECTS_MUTE":
      return {
        ...state,
        soundSettings: {
          ...(state.soundSettings || {}),
          isEffectsMuted: action.payload,
          musicVolume: state.soundSettings?.musicVolume || 0.5,
          soundVolume: state.soundSettings?.soundVolume || 0.5,
          notificationVolume: state.soundSettings?.notificationVolume || 0.5,
          clickVolume: state.soundSettings?.clickVolume || 0.5,
          effectsVolume: state.soundSettings?.effectsVolume || 0.5,
          backgroundMusicVolume: state.soundSettings?.backgroundMusicVolume || 0.3,
          isMuted: state.soundSettings?.isMuted || false,
          isBackgroundMusicMuted: state.soundSettings?.isBackgroundMusicMuted || false
        },
      };

    case "SET_BACKGROUND_MUSIC_MUTE":
      return {
        ...state,
        soundSettings: {
          ...(state.soundSettings || {}),
          isBackgroundMusicMuted: action.payload,
          musicVolume: state.soundSettings?.musicVolume || 0.5,
          soundVolume: state.soundSettings?.soundVolume || 0.5,
          notificationVolume: state.soundSettings?.notificationVolume || 0.5,
          clickVolume: state.soundSettings?.clickVolume || 0.5,
          effectsVolume: state.soundSettings?.effectsVolume || 0.5,
          backgroundMusicVolume: state.soundSettings?.backgroundMusicVolume || 0.3,
          isMuted: state.soundSettings?.isMuted || false,
          isEffectsMuted: state.soundSettings?.isEffectsMuted || false
        },
      };

    case "SET_HIDE_INTERFACE":
      return withMetadata({
        hideInterface: action.payload
      });

    case "SET_SOUND_SETTINGS":
      return withMetadata({
        soundSettings: {
          ...state.soundSettings,
          ...action.payload
        }
      });

    case "UPDATE_INVENTORY":
      return {
        ...state,
        inventory: {
          ...state.inventory,
          ...action.payload
        }
      };
      
    case "UPDATE_CONTAINER":
      return {
        ...state,
        container: {
          ...state.container,
          ...action.payload
        }
      };
      
    case "UPDATE_UPGRADES":
      return {
        ...state,
        upgrades: {
          ...state.upgrades,
          ...action.payload
        }
      };

    case "ADD_CONTAINER": {
      const newContainer = action.payload;
      return {
        ...state,
        containers: [...(state.containers || []), newContainer]
      };
    }

    case "REMOVE_CONTAINER": {
      const containerId = action.payload;
      return {
        ...state,
        containers: (state.containers || []).filter(
          (container: any) => container.id !== containerId
        )
      };
    }

    case "UPDATE_CONTAINER": {
      const updatedContainer = action.payload;
      return {
        ...state,
        containers: (state.containers || []).map((container: any) =>
          container.id === updatedContainer.id ? updatedContainer : container
        )
      };
    }

    default:
      return state;
  }
}

