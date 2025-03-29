import GameSaverService from './GameSaverService';
import type { SaveGameFunction } from './GameSaverService';

// Экспортируем сервис для внешнего использования
export { GameSaverService };

// Экспортируем тип для обратной совместимости
export type { SaveGameFunction };

// Также экспортируем по умолчанию для обратной совместимости
export default GameSaverService; 