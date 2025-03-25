import type { GameState, Action, ExtendedGameState } from "../types/gameTypes";

// Экшен для загрузки состояния игры
export const loadGameState = (state: GameState): Action => ({
  type: "LOAD_GAME_STATE",
  payload: state
});

// Экшен для обновления ресурсов
export const updateResources = (): Action => ({
  type: "UPDATE_RESOURCES"
});

// Экшен для сбора ресурсов из контейнера
export const collectContainerSnot = (amount: number): Action => ({
  type: "COLLECT_CONTAINER_SNOT",
  payload: { amount }
});

// Экшен для установки активной вкладки
export const setActiveTab = (tab: string): Action => ({
  type: "SET_ACTIVE_TAB",
  payload: tab
});

// Экшен для установки пользователя
export const setUser = (user: any): Action => ({
  type: "SET_USER",
  payload: user
});

// Экшен для инициализации нового пользователя
export const initializeNewUser = (initialData?: Partial<ExtendedGameState>) => {
  return {
    type: "INITIALIZE_NEW_USER",
    payload: initialData as ExtendedGameState
  };
};

// Экшен для сброса состояния игры
export const resetGameState = (): Action => ({
  type: "RESET_GAME_STATE"
});

// Экшен для обновления контейнера
export const updateContainerLevel = (level: number): Action => ({
  type: "UPDATE_CONTAINER_LEVEL",
  payload: level
});

// Экшен для обновления скорости заполнения
export const updateFillingSpeed = (speed: number): Action => ({
  type: "UPDATE_FILLING_SPEED",
  payload: speed
});

// Экшен для установки значения ресурса
export const setResource = (resource: string, value: number): Action => ({
  type: "SET_RESOURCE",
  payload: { resource, value }
});

// Объединяем экшены в один объект для удобства импорта
export const gameActions = {
  loadGameState,
  updateResources,
  collectContainerSnot,
  setActiveTab,
  setUser,
  initializeNewUser,
  resetGameState,
  updateContainerLevel,
  updateFillingSpeed,
  setResource
}; 