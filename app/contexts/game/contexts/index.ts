'use client'

import { createContext } from 'react'
import type { GameState } from '../../../types/gameTypes'

/**
 * Контекст для доступа к состоянию игры
 */
export const GameStateContext = createContext<GameState | null>(null)

/**
 * Контекст для установки нового состояния игры (заменяет диспетчер)
 */
export const SetGameStateContext = createContext<((newStateOrFunction: GameState | ((prevState: GameState) => GameState)) => void) | null>(null) 