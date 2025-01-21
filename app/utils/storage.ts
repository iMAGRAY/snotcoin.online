import type { GameState } from "../types/gameTypes"
import { encrypt, decrypt } from "./encryption"
import { openDB, type DBSchema, type IDBPDatabase } from "idb"

const STORAGE_VERSION = "1.2"

interface GameDB extends DBSchema {
  gameState: {
    key: string
    value: {
      state: GameState
      version: string
      lastUpdated: string
    }
  }
  changes: {
    key: string
    value: {
      change: any // Updated to any since GameStateChange is removed
      timestamp: string
    }
  }
}

let db: IDBPDatabase<GameDB>

async function getDB() {
  if (!db) {
    db = await openDB<GameDB>("gameDB", 1, {
      upgrade(db) {
        db.createObjectStore("gameState")
        db.createObjectStore("changes", { keyPath: "timestamp" })
      },
    })
  }
  return db
}

export async function saveGameState(gameState: GameState): Promise<void> {
  const db = await getDB()
  const stateToSave = {
    version: STORAGE_VERSION,
    state: gameState,
    lastUpdated: new Date().toISOString(),
  }
  const serializedState = JSON.stringify(stateToSave)
  const encryptedState = encrypt(serializedState)

  await db.put("gameState", stateToSave, "current") //Updated put method

  if (typeof window !== "undefined" && window.Telegram?.WebApp?.CloudStorage) {
    try {
      await window.Telegram.WebApp.CloudStorage.setItem("gameState", encryptedState)
      console.log("Game state saved successfully to Telegram CloudStorage")
    } catch (error) {
      console.error("Error saving game state to Telegram CloudStorage:", error)
    }
  }
}

export async function loadGameState(): Promise<GameState | null> {
  const db = await getDB()
  let state = await db.get("gameState", "current")

  if (!state && typeof window !== "undefined" && window.Telegram?.WebApp?.CloudStorage) {
    try {
      const encryptedState = await window.Telegram.WebApp.CloudStorage.getItem("gameState")
      if (encryptedState) {
        const serializedState = decrypt(encryptedState)
        state = JSON.parse(serializedState)
        if (state) {
          await db.put("gameState", state, "current")
        }
      }
    } catch (error) {
      console.error("Error loading game state from Telegram CloudStorage:", error)
    }
  }

  if (state) {
    if (state.version === STORAGE_VERSION) {
      return state.state as GameState
    } else {
      console.warn("Outdated game state version, migrating...")
      return migrateGameState(state.state, state.version)
    }
  }

  return null
}

export async function saveGameStateChange(change: any): Promise<void> {
  // Updated to any
  const db = await getDB()
  await db.add("changes", {
    change,
    timestamp: new Date().toISOString(),
  })
}

export async function getUnsyncedChanges(): Promise<any[]> {
  // Updated to any
  const db = await getDB()
  return (await db.getAll("changes")).map((item) => item.change)
}

export async function clearUnsyncedChanges(): Promise<void> {
  const db = await getDB()
  await db.clear("changes")
}

function migrateGameState(oldState: any, oldVersion: string): GameState {
  // Implement migration logic here
  return oldState as GameState
}

