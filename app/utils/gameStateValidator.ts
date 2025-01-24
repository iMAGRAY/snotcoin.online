import type { GameState } from "../types/gameTypes"

export function validateGameState(gameState: GameState): boolean {
  // Проверка наличия всех необходимых полей
  if (!gameState.user || !gameState.inventory || !gameState.containerLevel) {
    return false
  }

  // Проверка диапазонов значений
  if (gameState.energy < 0 || gameState.energy > gameState.maxEnergy) {
    return false
  }

  if (gameState.containerLevel < 1 || gameState.containerLevel > 100) {
    return false
  }

  // Проверка согласованности данных
  if (gameState.containerSnot > gameState.inventory.Cap) {
    return false
  }

  // Дополнительные проверки...

  return true
}

