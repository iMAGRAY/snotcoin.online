/**
 * Хук для принудительного сохранения состояния игры
 * Полезен для защиты от потери данных при закрытии страницы
 */

import { useCallback, useEffect, useState } from "react"
import { useSaveManager } from "../contexts/SaveManagerProvider"
import type { SaveResult } from "../services/saveSystem"
import { useGameState } from "../contexts/game/hooks/useGameState"

/**
 * Хук для принудительного сохранения состояния игры
 * Возвращает функцию, которая сохраняет состояние с опциональной задержкой
 * @returns {(delay?: number) => Promise<SaveResult>} Функция сохранения с опциональной задержкой в миллисекундах
 */
export const useForceSave = () => {
  const saveManager = useSaveManager()
  const gameState = useGameState()
  const [isSaving, setIsSaving] = useState(false)

  // Создаем функцию сохранения
  const forceSave = useCallback(
    async (delay?: number): Promise<SaveResult> => {
      // Если сохранение уже идет, возвращаем ошибку
      if (isSaving) {
        return {
          success: false,
          error: "Already saving",
          timestamp: Date.now()
        }
      }

      // Получаем ID пользователя
      const userId = gameState?.user?.id
      
      // Если нет ID пользователя, возвращаем ошибку
      if (!userId) {
        console.error("[useForceSave] User ID not found")
        return {
          success: false,
          error: "User ID not found",
          timestamp: Date.now()
        }
      }

      // Если задержка указана, ждем указанное время
      if (delay && delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay))
      }

      try {
        setIsSaving(true)
        // Сохраняем состояние
        const result = await saveManager.save(userId, gameState)
        return result
      } catch (error) {
        console.error("[useForceSave] Error saving state:", error)
        return {
          success: false,
          error: String(error),
          timestamp: Date.now()
        }
      } finally {
        setIsSaving(false)
      }
    },
    [saveManager, isSaving, gameState]
  )

  // Добавляем обработчик события перед закрытием страницы
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Вызываем функцию сохранения без задержки
      forceSave()
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [forceSave])

  return forceSave
} 