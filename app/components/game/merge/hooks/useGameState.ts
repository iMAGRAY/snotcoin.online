import { useState, useEffect } from 'react';

// Тип для параметров инициализации состояния игры
interface GameStateOptions {
  isPaused?: boolean;
  isLoading?: boolean;
}

// Хук для управления состоянием игры
export const useGameState = () => {
  // Состояние для отображения загрузки
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Состояние для отображения ошибок
  const [hasError, setHasError] = useState<boolean>(false);
  const [debugMessage, setDebugMessage] = useState<string>("");
  
  // Состояние для отображения уровня БУДУЩЕГО шара, который появится после текущего броска
  const [futureNextBallLevel, setFutureNextBallLevel] = useState<number>(1);
  
  // Состояние для паузы игры - изначально не на паузе
  const [isPaused, setIsPaused] = useState<boolean>(false);
  
  // Состояние для отслеживания первого запуска игры
  const [isFirstLoad, setIsFirstLoad] = useState<boolean>(true);
  
  // Состояние для отслеживания активности вкладки
  const [isTabActive, setIsTabActive] = useState<boolean>(true);
  
  // Функция для инициализации состояния игры из внешних опций
  const initializeGameState = (options: GameStateOptions) => {
    if (options.isPaused !== undefined) {
      setIsPaused(options.isPaused);
    }
    
    if (options.isLoading !== undefined) {
      setIsLoading(options.isLoading);
    }
  };
  
  // Сбрасываем флаг первой загрузки после того, как загрузка завершена
  useEffect(() => {
    if (!isLoading && isFirstLoad) {
      setIsFirstLoad(false);
    }
  }, [isLoading, isFirstLoad]);
  
  // Обработчик изменения видимости страницы
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Страница скрыта - ставим игру на паузу и отмечаем, что вкладка не активна
        setIsPaused(true);
        setIsTabActive(false);
      } else {
        // Страница снова видима - отмечаем, что вкладка активна
        setIsTabActive(true);
        // Мы не снимаем паузу автоматически, когда страница снова становится видимой
        // Пользователь должен сам нажать кнопку "Продолжить"
      }
    };
    
    // Добавляем слушатель события изменения видимости страницы
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Убираем слушатель при размонтировании
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
  
  // Функция для паузы/возобновления игры
  const togglePause = () => {
    setIsPaused(!isPaused);
  };
  
  // Функция для продолжения игры
  const resumeGame = () => {
    // Возобновляем игру только если вкладка активна
    if (isTabActive) {
      setIsPaused(false);
    } else {
      // Если вкладка не активна, показываем сообщение
      alert('Пожалуйста, активируйте вкладку для продолжения игры');
    }
  };
  
  return {
    isLoading,
    setIsLoading,
    hasError,
    setHasError,
    debugMessage,
    setDebugMessage,
    futureNextBallLevel,
    setFutureNextBallLevel,
    isPaused,
    setIsPaused,
    isTabActive,
    isFirstLoad,
    setIsFirstLoad,
    togglePause,
    resumeGame,
    initializeGameState
  };
}; 