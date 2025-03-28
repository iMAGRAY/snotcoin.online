import { Action, GameState, ExtendedGameState } from "../types/gameTypes"
import { initialState } from "../constants/gameConstants"

// Единое хранилище для данных в памяти
const inMemoryStore: Record<string, any> = {};

export function gameReducer(state: ExtendedGameState = initialState as ExtendedGameState, action: Action): ExtendedGameState {
  // Вспомогательная функция для обновления метаданных
  const withMetadata = (newState: Partial<ExtendedGameState>): ExtendedGameState => {
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
        inventory: {
          ...state.inventory,
          containerCapacity: action.payload,
        },
      });

    case "UPDATE_CONTAINER_SNOT":
      return withMetadata({
        inventory: {
          ...state.inventory,
          containerSnot: action.payload,
        },
      });

    case "UPDATE_FILLING_SPEED":
      return withMetadata({
        inventory: {
          ...state.inventory,
          fillingSpeed: action.payload,
        },
      });

    case "UPDATE_RESOURCES":
      // Обновление ресурсов с автоматическим заполнением контейнера
      const currentTime = Date.now();
      const lastUpdateTime = state.inventory.lastUpdateTimestamp || currentTime;
      
      // Проверяем корректность времени обновления
      if (lastUpdateTime > currentTime) {
        // Защита от некорректной даты - используем текущее время
        return withMetadata({
          inventory: {
            ...state.inventory,
            lastUpdateTimestamp: currentTime
          }
        });
      }
      
      const elapsedTime = currentTime - lastUpdateTime;
      
      // Предотвращаем аномально большие интервалы времени (более 1 часа)
      const maxElapsedTime = 60 * 60 * 1000; // 1 час в миллисекундах
      const safeElapsedTime = Math.min(elapsedTime, maxElapsedTime);
      
      // Получаем скорость заполнения и вместимость с проверками
      const fillingSpeed = Math.max(0.01, state.inventory.fillingSpeed || 0.01);
      const containerCapacity = Math.max(1, state.inventory.Cap || 100);
      const currentContainerSnot = Math.max(0, state.inventory.containerSnot || 0);
      
      // Рассчитываем прирост в зависимости от скорости наполнения и времени
      const containerIncrement = (safeElapsedTime / 1000) * fillingSpeed;
      
      // Новое количество в контейнере не может превышать вместимость
      const newContainerSnot = Math.min(
        currentContainerSnot + containerIncrement,
        containerCapacity
      );
      
      return withMetadata({
        inventory: {
          ...state.inventory,
          containerSnot: newContainerSnot,
          lastUpdateTimestamp: currentTime
        }
      });

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
          fillingSpeed: state.inventory.fillingSpeed * 1.1, // Увеличиваем на 10%
        },
      });

    case "UPGRADE_CONTAINER_CAPACITY":
      return withMetadata({
        inventory: {
          ...state.inventory,
          containerCapacity: state.inventory.containerCapacity * 1.2, // Увеличиваем на 20%
        },
      });

    case "INCREMENT_CONTAINER_CAPACITY":
      return withMetadata({
        inventory: {
          ...state.inventory,
          containerCapacity: state.inventory.containerCapacity * 1.2, // Увеличиваем на 20%
        },
      });

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
      
      const defaultState = {
        ...state,
        inventory: {
          ...state.inventory,
          snot: 0,
          snotCoins: 0,
          containerCapacity: 100,
          containerSnot: 0,
          fillingSpeed: 1,
          containerCapacityLevel: 1,
          fillingSpeedLevel: 1,
          collectionEfficiency: 1,
          Cap: 100,
          lastUpdateTimestamp: Date.now()
        },
        container: {
          level: 1,
          capacity: 100,
          currentAmount: 0,
          fillRate: 1,
          currentFill: 0
        },
        upgrades: {
          containerLevel: 1,
          fillingSpeedLevel: 1,
          clickPower: { level: 1, value: 1 },
          passiveIncome: { level: 1, value: 0.1 },
          collectionEfficiencyLevel: 1
        },
        _saveVersion: 1,
        _lastSaved: new Date().toISOString(),
        _userId: '',
        _lastModified: Date.now(),
        _createdAt: new Date().toISOString(),
        _wasRepaired: false,
        _repairedAt: Date.now(),
        _repairedFields: [],
        _tempData: null,
        _isSavingInProgress: false,
        _skipSave: false,
        _lastSaveError: null,
        _isBeforeUnloadSave: false,
        _isRestoredFromBackup: false,
        _isInitialState: true,
        _lastActionTime: new Date().toISOString(),
        _lastAction: action.type,
        logs: [],
        analytics: null,
        items: [],
        achievements: { unlockedAchievements: [] },
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
          language: 'en',
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
          backgroundMusicVolume: 0.5,
          isMuted: false,
          isEffectsMuted: false,
          isBackgroundMusicMuted: false
        },
        hideInterface: false,
        activeTab: 'game',
        fillingSpeed: 1,
        containerLevel: 1,
        isPlaying: false,
        validationStatus: 'pending',
        lastValidation: new Date().toISOString(),
        gameStarted: false,
        isLoading: false
      };

      return defaultState;
    }

    case "RESET_GAME_STATE":
      return {
        ...initialState as ExtendedGameState,
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

    default:
      return state;
  }
}

