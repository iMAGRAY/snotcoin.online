'use client'

/**
 * Файл содержит обработчики игровых событий, вынесенные из MergeGameClient
 */

/**
 * Создает обработчик для включения/выключения паузы в игре
 */
export const createTogglePauseHandler = (
  isPaused: boolean,
  setUserPausedGame: React.Dispatch<React.SetStateAction<boolean>>,
  togglePause: () => void
) => {
  return () => {
    // Если игра была приостановлена, отмечаем, что это сделал пользователь
    if (!isPaused) {
      setUserPausedGame(true);
    }
    togglePause();
  };
};

/**
 * Создает обработчик для возобновления игры
 */
export const createResumeGameHandler = (
  setUserPausedGame: React.Dispatch<React.SetStateAction<boolean>>,
  resumeGame: () => void
) => {
  return () => {
    setUserPausedGame(false);
    resumeGame();
  };
};

/**
 * Создает обработчик для закрытия игры
 */
export const createGameCloseHandler = (
  cleanupResources: () => void,
  setIsPaused: React.Dispatch<React.SetStateAction<boolean>>,
  gameInstanceRef: React.MutableRefObject<any>,
  dispatch: any,
  onClose: () => void
) => {
  return () => {
    // Останавливаем игру перед закрытием
    setIsPaused(true);
    
    // Очищаем ресурсы
    cleanupResources();
    
    // Уничтожаем экземпляр игры Phaser
    if (gameInstanceRef.current) {
      try {
        gameInstanceRef.current.destroy(true);
        gameInstanceRef.current = null;
      } catch (error) {
        console.error('Ошибка при уничтожении Phaser игры в handleGameClose:', error);
      }
    }
    
    // Возвращаемся в главное меню с правильным активным табом
    dispatch({
      type: 'SET_ACTIVE_TAB',
      payload: { activeTab: 'merge' }
    });
    
    // Вызываем колбэк закрытия
    onClose();
  };
}; 