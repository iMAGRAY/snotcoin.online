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
  // Проверяем, что уровень находится в допустимом диапазоне
  const safeLevel = Math.max(1, Math.min(level, UPGRADE_VALUES.containerCapacity.length));
  
  // Получаем емкость на основе уровня из массива значений
  const capacity = UPGRADE_VALUES.containerCapacity[safeLevel - 1];
  
  // Проверяем, что значение определено
  return typeof capacity === 'number' ? capacity : 1;
}

// Тип для пэйлоада действий
export type ActionPayload = {
  [key: string]: any;
};

// Определяем интерфейс для корректной обработки энергии
export interface RestoreEnergyPayload {
  energy: number;
  timestamp: number;
  forceUpdateTimestamp?: boolean;
}

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
  | 'RESTORE_ENERGY'           // Действие для восстановления энергии
  | 'UPDATE_ENERGY_TIMESTAMP'  // Действие для обновления временной метки энергии
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
  | 'LOAD_GAME_STATE';

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
      
      // Если обновляем energy, проверяем наличие lastEnergyUpdateTime
      if (resource === "energy" && !action.payload.skipUpdateTime) {
        return withMetadata({
          inventory: {
            ...state.inventory,
            [resource]: value,
            lastEnergyUpdateTime: Date.now() // Обновляем время при изменении энергии
          }
        });
      }
      
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
      const currentSnot = state.inventory.snot;
      const amountToCollect = action.payload.containerSnot;
      
      // Округляем до 12 знаков после запятой для уменьшения погрешности
      const roundToPrecision = (num: number, precision: number = 12): number => {
        return Math.round(num * Math.pow(10, precision)) / Math.pow(10, precision);
      };
      
      // Проверяем, есть ли расхождение между текущим значением и ожидаемым
      const expectedSnot = action.payload.expectedSnot;
      if (expectedSnot !== undefined && Math.abs(currentSnot - expectedSnot) > 0.000001) {
        console.log(`[gameReducer] Обнаружено расхождение в snot: текущее=${currentSnot}, ожидаемое=${expectedSnot}, разница=${currentSnot - expectedSnot}`);
        // Корректируем текущее значение к ожидаемому
        state.inventory.snot = expectedSnot;
      }
      
      // Выполняем сбор ресурса с округлением
      const newSnot = roundToPrecision(state.inventory.snot + amountToCollect);
      
      console.log(`[gameReducer] COLLECT_CONTAINER_SNOT: ${state.inventory.snot} + ${amountToCollect} = ${newSnot} 
      {время: '${new Date().toISOString()}', containerSnot: ${amountToCollect}}`);
      
      return {
        ...state,
        inventory: {
          ...state.inventory,
          snot: newSnot,
          containerSnot: 0
        }
      };
    }

    case "UPGRADE_FILLING_SPEED":
      return withMetadata({
        inventory: {
          ...state.inventory,
          fillingSpeed: state.inventory.fillingSpeed * FILL_RATES.FILL_SPEED_MULTIPLIER, // Увеличиваем согласно константе
          fillingSpeedLevel: state.inventory.fillingSpeedLevel + 1, // Увеличиваем уровень
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
          containerCapacity: 1, // Обновляем значение containerCapacity
          containerCapacityLevel: 1,
          fillingSpeed: 1,
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
      console.log("[GameReducer] Загружаем сохраненное состояние игры", 
        loadedState._isRestoredFromBackup ? "из резервной копии" : "");
      
      // Сохраняем userId из localStorage, если он отсутствует в загружаемом состоянии
      if (typeof window !== 'undefined' && !loadedState._userId) {
        const storedUserId = localStorage.getItem('user_id') || localStorage.getItem('game_id');
        if (storedUserId) {
          console.log(`[GameReducer] Устанавливаем _userId из localStorage: ${storedUserId}`);
          loadedState._userId = storedUserId;
        }
      }
      
      // Проверяем и нормализуем значения энергии в загружаемом состоянии
      if (loadedState.inventory) {
        // Убеждаемся, что значение энергии существует и валидно
        if (typeof loadedState.inventory.energy === 'undefined' || 
            loadedState.inventory.energy === null || 
            isNaN(loadedState.inventory.energy)) {
          console.log(`[GameReducer] Инициализируем отсутствующую энергию до максимального значения`);
          loadedState.inventory.energy = 500; // Устанавливаем максимальное значение только если энергия отсутствует
        } else {
          console.log(`[GameReducer] Используем существующее значение энергии:`, loadedState.inventory.energy);
        }
        
        // Убеждаемся, что время последнего обновления энергии существует и валидно
        if (!loadedState.inventory.lastEnergyUpdateTime || 
            isNaN(Number(loadedState.inventory.lastEnergyUpdateTime))) {
          console.log(`[GameReducer] Устанавливаем текущее время для lastEnergyUpdateTime`);
          loadedState.inventory.lastEnergyUpdateTime = Date.now();
        }
        
        console.log(`[GameReducer] Загружено состояние энергии:`, {
          energy: loadedState.inventory.energy,
          lastUpdate: new Date(loadedState.inventory.lastEnergyUpdateTime).toISOString()
        });
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

    case "RESTORE_ENERGY": {
      // Деструктурируем параметры из пэйлоада
      const { energy, timestamp, forceUpdateTimestamp = true } = action.payload as RestoreEnergyPayload;
      
      // Проверка валидности входных данных
      if (typeof energy !== 'number' || isNaN(energy) || energy < 0) {
        console.error('[gameReducer] Некорректное значение energy:', energy);
        return state;
      }
      
      // Логируем изменение энергии
      console.log('[gameReducer] RESTORE_ENERGY:', {
        было: state.inventory.energy,
        стало: energy,
        разница: energy - (state.inventory.energy || 0),
        timestamp: new Date(timestamp).toISOString(),
        forceUpdateTimestamp
      });
      
      // Если forceUpdateTimestamp=false, обновляем только энергию, сохраняя timestamp
      if (forceUpdateTimestamp === false) {
        return {
          ...state,
          inventory: {
            ...state.inventory,
            energy: energy
          }
        };
      }
      
      // Иначе обновляем и энергию, и timestamp (стандартное поведение)
      return {
        ...state,
        inventory: {
          ...state.inventory,
          energy: energy,
          lastEnergyUpdateTime: timestamp
        }
      };
    }

    case "UPDATE_ENERGY_TIMESTAMP": {
      const { timestamp } = action.payload;
      
      console.log(`[gameReducer] UPDATE_ENERGY_TIMESTAMP: ${new Date(timestamp).toISOString()}`);
      
      return {
        ...state,
        inventory: {
          ...state.inventory,
          lastEnergyUpdateTime: timestamp
        }
      };
    }

    default:
      return state;
  }
}

