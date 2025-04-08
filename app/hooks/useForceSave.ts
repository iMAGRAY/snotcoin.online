/**
 * Заглушка для хука принудительного сохранения состояния игры
 * (система сохранения была удалена)
 */

import { useCallback } from "react"

/**
 * Хук-заглушка, который возвращает функцию, не выполняющую никаких действий
 * Сохраняет интерфейс для совместимости с компонентами
 */
export const useForceSave = () => {
  /**
   * Функция-заглушка, имитирующая принудительное сохранение
   */
  const forceSave = useCallback(async (delay?: number) => {
    console.log('[useForceSave] Функция сохранения отключена (система сохранений удалена)')
    return {
      success: true,
      timestamp: Date.now(),
      message: 'Сохранение отключено'
    }
  }, [])
  
  return forceSave
} 