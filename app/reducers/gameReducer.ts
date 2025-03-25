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
      return withMetadata({ 
        user: action.payload ? {
          id: action.payload.id,
          fid: action.payload.fid,
          username: action.payload.username,
          displayName: action.payload.displayName,
          pfp: action.payload.pfp,
          address: action.payload.address
        } : null,
        validationStatus: action.payload ? "valid" : "invalid",
        lastValidation: action.payload ? Date.now() : undefined
      });

    case "SET_TELEGRAM_USER":
      // Устаревший тип действия, преобразуем в формат Warpcast
      return withMetadata({ 
        user: action.payload ? { 
          id: action.payload.id.toString(),
          fid: parseInt(action.payload.id.toString()),
          username: action.payload.username || "",
          displayName: action.payload.first_name || "",
          pfp: action.payload.photo_url || null,
          address: undefined
        } : null,
        validationStatus: action.payload ? "valid" : "invalid",
        lastValidation: action.payload ? Date.now() : undefined
      });

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
          _lastAction: action.type
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
          containerSnot: 0,
          containerCapacity: 1,
          fillingSpeed: 1 / (24 * 60 * 60), // 1 SNOT per day
        },
        _saveVersion: 1,
        _lastSaved: new Date().toISOString(),
        _isInitialState: true,
        _lastActionTime: new Date().toISOString(),
        _lastAction: action.type,
        user: currentUser
      };
      
      return defaultState;
    }

    case "RESET_GAME_STATE":
      return {
        ...initialState as ExtendedGameState,
        activeTab: "laboratory",
        user: null,
        validationStatus: "pending",
        lastValidation: undefined,
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
      // Проверяем, что загружаемое состояние имеет необходимые поля
      const loadedState = action.payload as ExtendedGameState;
      
      if (!loadedState) {
        return state;
      }
      
      // Проверяем наличие инвентаря
      if (!loadedState.inventory) {
        loadedState.inventory = initialState.inventory;
      }
      
      // Проверяем основные свойства инвентаря и устанавливаем значения по умолчанию при необходимости
      if (typeof loadedState.inventory.snot !== 'number' || isNaN(loadedState.inventory.snot)) {
        loadedState.inventory.snot = initialState.inventory.snot;
      }
      
      if (typeof loadedState.inventory.snotCoins !== 'number' || isNaN(loadedState.inventory.snotCoins)) {
        loadedState.inventory.snotCoins = initialState.inventory.snotCoins;
      }
      
      if (typeof loadedState.inventory.containerCapacity !== 'number' || 
          isNaN(loadedState.inventory.containerCapacity) || 
          loadedState.inventory.containerCapacity <= 0) {
        loadedState.inventory.containerCapacity = initialState.inventory.containerCapacity;
      }
      
      if (typeof loadedState.inventory.Cap !== 'number' || 
          isNaN(loadedState.inventory.Cap) || 
          loadedState.inventory.Cap <= 0) {
        loadedState.inventory.Cap = initialState.inventory.Cap;
      }
      
      // Синхронизируем Cap и containerCapacity
      if (loadedState.inventory.Cap !== loadedState.inventory.containerCapacity) {
        loadedState.inventory.Cap = loadedState.inventory.containerCapacity;
      }
      
      if (typeof loadedState.inventory.containerSnot !== 'number' || 
          isNaN(loadedState.inventory.containerSnot) || 
          loadedState.inventory.containerSnot < 0) {
        loadedState.inventory.containerSnot = initialState.inventory.containerSnot;
      }
      
      // Проверяем, что количество снота в контейнере не превышает емкость
      if (loadedState.inventory.containerSnot > loadedState.inventory.containerCapacity) {
        loadedState.inventory.containerSnot = loadedState.inventory.containerCapacity;
      }
      
      if (typeof loadedState.inventory.fillingSpeed !== 'number' || 
          isNaN(loadedState.inventory.fillingSpeed) || 
          loadedState.inventory.fillingSpeed <= 0) {
        loadedState.inventory.fillingSpeed = initialState.inventory.fillingSpeed;
      }
      
      if (typeof loadedState.inventory.fillingSpeedLevel !== 'number' || 
          isNaN(loadedState.inventory.fillingSpeedLevel) || 
          loadedState.inventory.fillingSpeedLevel <= 0) {
        loadedState.inventory.fillingSpeedLevel = initialState.inventory.fillingSpeedLevel;
      }
      
      if (typeof loadedState.inventory.containerCapacityLevel !== 'number' || 
          isNaN(loadedState.inventory.containerCapacityLevel) || 
          loadedState.inventory.containerCapacityLevel <= 0) {
        loadedState.inventory.containerCapacityLevel = initialState.inventory.containerCapacityLevel;
      }
      
      return loadedState;
    }

    case "SET_GAME_STARTED":
      return withMetadata({
        gameStarted: action.payload,
      });

    case "SET_CLICK_SOUND_VOLUME":
      return withMetadata({
        soundSettings: {
          ...state.soundSettings,
          clickVolume: action.payload,
        },
      });

    case "SET_BACKGROUND_MUSIC_VOLUME":
      return withMetadata({
        soundSettings: {
          ...state.soundSettings,
          backgroundMusicVolume: action.payload,
        },
      });

    case "SET_EFFECTS_SOUND_VOLUME":
      return withMetadata({
        soundSettings: {
          ...state.soundSettings,
          effectsVolume: action.payload,
        },
      });

    case "SET_MUTE":
      return withMetadata({
        soundSettings: {
          ...state.soundSettings,
          isMuted: action.payload,
        },
      });

    case "SET_EFFECTS_MUTE":
      return withMetadata({
        soundSettings: {
          ...state.soundSettings,
          isEffectsMuted: action.payload,
        },
      });

    case "SET_BACKGROUND_MUSIC_MUTE":
      return withMetadata({
        soundSettings: {
          ...state.soundSettings,
          isBackgroundMusicMuted: action.payload,
        },
      });

    case "SET_HIDE_INTERFACE":
      return withMetadata({
        hideInterface: action.payload,
      });

    default:
      return state;
  }
}

