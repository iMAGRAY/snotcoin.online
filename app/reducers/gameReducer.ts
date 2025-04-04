import { Action, GameState, ExtendedGameState } from "../types/gameTypes"
import { initialState } from "../constants/gameConstants"
import { createInitialGameState, FILL_RATES } from "../constants/gameConstants"

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
  // Базовая емкость для первого уровня
  const baseCapacity = 1;
  // Увеличение емкости с каждым уровнем
  const capacityIncrease = 1;
  // Рассчитываем емкость
  return baseCapacity + (level - 1) * capacityIncrease;
}

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
      // Получаем количество для сбора
      const { amount } = action.payload;
      
      // Проверяем валидность данных
      if (amount <= 0 || isNaN(amount)) {
        return state; // Возвращаем состояние без изменений при некорректных данных
      }
      
      // Вычисляем новое значение snot с защитой от переполнения
      const currentSnot = state.inventory.snot || 0;
      const newSnot = Math.max(0, currentSnot + amount);
      
      // Сбрасываем состояние контейнера в любом случае
      // Добавляем к общему количеству SNOT и обнуляем контейнер
      return withMetadata({
        inventory: {
          ...state.inventory,
          snot: newSnot,
          containerSnot: 0 // Обнуляем контейнер после сбора
        }
      });
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
      
      // Проверяем и восстанавливаем критически важные части состояния
      const normalizedState = {
        ...loadedState,
        // Обновляем метаданные для отслеживания восстановления
        _lastActionTime: new Date().toISOString(),
        _lastAction: action.type,
        _loadedAt: new Date().toISOString(),
        // Убеждаемся, что userId всегда присутствует
        _userId: loadedState._userId || state._userId || ''
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

