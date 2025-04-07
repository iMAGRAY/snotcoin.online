/**
 * ВНИМАНИЕ! Этот модуль устарел и будет удален в ближайшее время.
 * Вместо него используйте контекст SaveManagerProvider и хуки:
 * - useSaveManager() - из app/contexts/SaveManagerProvider
 * - useSaveGame() - из app/hooks/useSaveGame
 * - useLoadGame() - из app/hooks/useLoadGame
 * - useForceSave() - из app/hooks/useForceSave
 */
import GameSaverService from './GameSaverService';
import type { SaveGameFunction } from './GameSaverService';

// Экспортируем сервис для внешнего использования
// УСТАРЕЛО: Будет удалено, используйте useSaveManager() из контекста SaveManagerProvider
export { GameSaverService };

// Экспортируем тип для обратной совместимости
// УСТАРЕЛО: Будет удалено, используйте типы из services/saveSystem/types
export type { SaveGameFunction };

// Также экспортируем по умолчанию для обратной совместимости
// УСТАРЕЛО: Будет удалено, используйте useSaveManager() из контекста SaveManagerProvider
export default GameSaverService; 