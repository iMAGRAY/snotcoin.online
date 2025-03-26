'use client'

import { createContext } from 'react'
import type { GameState, Action } from '../../../types/gameTypes'

/**
 * Контекст для хранения состояния игры
 */
export const GameStateContext = createContext<GameState | null>(null)

/**
 * Контекст для изменения состояния игры
 */
export const GameDispatchContext = createContext<((action: Action) => void) | null>(null)

/**
 * Контекст для отслеживания процесса сохранения
 */
export const IsSavingContext = createContext<boolean>(false) 