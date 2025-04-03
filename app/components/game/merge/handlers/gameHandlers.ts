'use client'

/**
 * Файл содержит обработчики игровых событий, вынесенные из MergeGameClient
 */

/**
 * Обработчик переключения паузы
 */
export const createTogglePauseHandler = (isPaused: boolean, setUserPausedGame: (state: boolean) => void, togglePause: () => void) => {
  return () => {
    const newPauseState = !isPaused;
    if (newPauseState) {
      // Устанавливаем флаг пользовательской паузы только при включении паузы
      setUserPausedGame(true);
    }
    // Вызываем оригинальную функцию
    togglePause();
  };
};

/**
 * Обработчик возобновления игры
 */
export const createResumeGameHandler = (setUserPausedGame: (state: boolean) => void, resumeGame: () => void) => {
  return () => {
    setUserPausedGame(false);
    resumeGame();
  };
};

/**
 * Обработчик закрытия игры
 */
export const createGameCloseHandler = (
  cleanupResources: () => void, 
  setIsPaused: (state: boolean) => void, 
  gameInstanceRef: React.MutableRefObject<any>, 
  dispatch: any, 
  onClose: () => void
) => {
  return () => {
    // Логируем закрытие игры для отладки
    console.log("Закрытие игры MergeGameClient");
    
    // Сначала очищаем все ресурсы
    cleanupResources();
    
    // Делаем паузу, чтобы убедиться, что игра остановлена
    setIsPaused(true);
    
    // Явно уничтожаем экземпляр игры Phaser
    if (gameInstanceRef.current) {
      try {
        gameInstanceRef.current.destroy(true);
        gameInstanceRef.current = null;
      } catch (error) {
        console.error('Ошибка при уничтожении Phaser игры:', error);
      }
    }
    
    // Устанавливаем активную вкладку "merge" при выходе из игры
    try {
      dispatch({
        type: 'SET_ACTIVE_TAB',
        payload: 'merge'
      });
      console.log("Успешно установлена активная вкладка 'merge'");
    } catch (error) {
      console.error("Ошибка при установке активной вкладки:", error);
    }
    
    // Небольшая задержка перед закрытием для завершения очистки ресурсов
    setTimeout(() => {
      // Вызываем обработчик onClose из props
      if (typeof onClose === 'function') {
        console.log("Вызываем onClose коллбэк");
        onClose();
      } else {
        console.error("onClose не является функцией:", onClose);
      }
    }, 50);
  };
}; 