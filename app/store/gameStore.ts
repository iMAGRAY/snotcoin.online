import { create } from "zustand"
import { persist, type StateStorage, type StorageValue } from "zustand/middleware"
import type { GameState, Action } from "../types/gameTypes"
import { initialState } from "../reducers/gameReducer"
import { gameReducer } from "../game/gameLogic"

const storage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      const webApp = window.Telegram.WebApp
      if ("CloudStorage" in webApp && typeof webApp.CloudStorage.getItem === "function") {
        const value = await webApp.CloudStorage.getItem(name)
        return value
      }
    }
    const value = localStorage.getItem(name)
    return value
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      const webApp = window.Telegram.WebApp
      if ("CloudStorage" in webApp && typeof webApp.CloudStorage.setItem === "function") {
        await webApp.CloudStorage.setItem(name, value)
        return
      }
    }
    localStorage.setItem(name, value)
  },
  removeItem: async (name: string): Promise<void> => {
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      const webApp = window.Telegram.WebApp
      if ("CloudStorage" in webApp && typeof webApp.CloudStorage.setItem === "function") {
        await webApp.CloudStorage.setItem(name, "")
        return
      }
    }
    localStorage.removeItem(name)
  },
}

export const useGameStore = create(
  persist<GameState & { dispatch: (action: Action) => void }>(
    (set, get) => ({
      ...initialState,
      dispatch: (action: Action) => set((state) => gameReducer(state, action)),
    }),
    {
      name: "game-storage",
      storage: {
        getItem: async (name): Promise<StorageValue<GameState & { dispatch: (action: Action) => void }> | null> => {
          const value = await storage.getItem(name)
          if (value === null) {
            return null
          }
          return JSON.parse(value) as StorageValue<GameState & { dispatch: (action: Action) => void }>
        },
        setItem: async (name, value) => {
          await storage.setItem(name, JSON.stringify(value))
        },
        removeItem: async (name) => {
          await storage.removeItem(name)
        },
      },
    },
  ),
)

export const useResources = () =>
  useGameStore((state) => ({
    snotCoins: state.inventory.snotCoins,
    snot: state.inventory.snot,
    energy: state.energy,
    maxEnergy: state.maxEnergy,
  }))

export const useContainer = () =>
  useGameStore((state) => ({
    containerCapacity: state.containerCapacity,
    containerFillingSpeed: state.fillingSpeed,
    containerSnot: state.containerSnot,
    collectionEfficiency: state.inventory.collectionEfficiency,
    containerLevel: state.containerLevel,
  }))

export const useGameState = () =>
  useGameStore((state) => ({
    activeTab: state.activeTab,
    gameStarted: state.gameStarted,
  }))

export const useSoundSettings = () =>
  useGameStore((state) => ({
    clickSoundVolume: state.clickSoundVolume,
    backgroundMusicVolume: state.backgroundMusicVolume,
    effectsSoundVolume: state.effectsSoundVolume,
    isMuted: state.isMuted,
    isBackgroundMusicMuted: state.isBackgroundMusicMuted,
    isEffectsMuted: state.isEffectsMuted,
  }))

