"use client"

import React, { useRef, useEffect, useState, useCallback, memo } from "react";
import * as Phaser from 'phaser';
import { toast } from 'react-hot-toast';
import { AnimatePresence } from "framer-motion";
import { MergeGameSceneType } from "../../utils/types";
import MergeGameScene from "../../MergeGameScene";
import { setGameInstance, restartGame as restartGameAction } from './gameActions';

export interface GameContainerProps {
  onScoreUpdate: (score: number) => void;
  onGameOver: (finalScore: number) => void;
  shouldRestart?: boolean;
  onRestartComplete?: () => void;
}

// Используем memo для предотвращения ненужных перерисовок компонента
const GameContainer: React.FC<GameContainerProps> = memo(({ 
  onScoreUpdate, 
  onGameOver,
  shouldRestart = false,
  onRestartComplete
}) => {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Обработчик для перезапуска игры
  useEffect(() => {
    if (shouldRestart && gameRef.current) {
      // Перезапускаем игру
      restartGameAction();
      
      // Уведомляем родительский компонент, что перезапуск завершен
      if (onRestartComplete) {
        onRestartComplete();
      }
    }
  }, [shouldRestart, onRestartComplete]);
  
  // Стабильный обработчик обновления счета
  const handleGameUpdate = useCallback(() => {
    if (!gameRef.current) return;
    
    const game = gameRef.current;
    
    // Получаем счет
    const gameScore = game.registry.get('gameScore');
    if (typeof gameScore === 'number') {
      onScoreUpdate(gameScore);
    }
    
    // Проверяем, завершилась ли игра
    const gameOver = game.registry.get('gameOver');
    if (gameOver) {
      const finalGameScore = game.registry.get('finalScore');
      if (typeof finalGameScore === 'number') {
        onGameOver(finalGameScore);
      }
    }
  }, [onScoreUpdate, onGameOver]);
  
  useEffect(() => {
    if (!gameContainerRef.current) return;
    
    // Предотвращаем повторную инициализацию игры
    if (gameRef.current) return;

    // Создаём игру Phaser
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: window.innerWidth,
      height: window.innerHeight - 140, // Уменьшаем высоту для учета верхнего и нижнего бара
      backgroundColor: 'transparent', // Прозрачный фон вместо синего
      parent: gameContainerRef.current,
      physics: {
        default: 'arcade',
        arcade: {
          debug: false,
        },
      },
      scene: [MergeGameScene],
      transparent: true, // Делаем канвас прозрачным
      // Предотвращаем повторное создание канваса
      canvasStyle: 'display: block; touch-action: none;',
      disableContextMenu: true
    };

    // Используем try/catch для более безопасной инициализации Phaser
    try {
      const game = new Phaser.Game(config);
      gameRef.current = game;
      
      // Регистрируем экземпляр игры в gameActions
      setGameInstance(game);
      
      // Сохраняем время начала игры
      game.registry.set('gameStartTime', Date.now());
      
      // Добавляем ведущее начало обновления счета
      const gameUpdateInterval = setInterval(handleGameUpdate, 500);
      
      // Обработчик изменения размера окна
      const handleResize = () => {
        try {
          if (game && game.scale) {
            game.scale.resize(window.innerWidth, window.innerHeight - 140);
          }
        } catch (error) {
          console.error('Ошибка при изменении размера:', error);
        }
      };
      
      window.addEventListener('resize', handleResize);
      setIsLoaded(true);
      
      // Очистка при размонтировании
      return () => {
        window.removeEventListener('resize', handleResize);
        clearInterval(gameUpdateInterval);
        
        if (game) {
          try {
            // Вызываем явную очистку, если метод доступен
            const scene = game.scene.getScene('MergeGameScene');
            if (scene && typeof (scene as any).cleanup === 'function') {
              try {
                (scene as any).cleanup();
              } catch (error) {
                console.error('Ошибка при вызове cleanup:', error);
              }
            }
          } catch (error) {
            console.error('Ошибка при получении сцены:', error);
          }
          
          // В любом случае уничтожаем игру
          try {
            game.destroy(true);
          } catch (error) {
            console.error('Ошибка при уничтожении игры:', error);
          }
          gameRef.current = null;
        }
      };
    } catch (error) {
      console.error('Ошибка при инициализации Phaser:', error);
      setIsLoaded(true); // Помечаем как загруженный, чтобы скрыть экран загрузки
    }
  }, [onScoreUpdate, onGameOver, handleGameUpdate]);

  // Метод для активации способности
  const activateAbility = (ability: string) => {
    if (gameRef.current) {
      const scene = gameRef.current.scene.getScene('MergeGameScene') as MergeGameSceneType;
      if (scene) {
        scene.activateAbility(ability);
      }
    }
  };

  // Метод для паузы игры
  const pauseGame = () => {
    if (gameRef.current) {
      gameRef.current.scene.pause('MergeGameScene');
    }
  };

  // Метод для возобновления игры
  const resumeGame = () => {
    if (gameRef.current) {
      gameRef.current.scene.resume('MergeGameScene');
    }
  };

  // Метод для перезапуска игры
  const restartGame = () => {
    if (!gameRef.current) return;
    
    try {
      // Вызываем функцию перезапуска из gameActions
      restartGameAction();
      
      // Регистрируем новое время начала игры
      gameRef.current.registry.set('gameStartTime', Date.now());
      
      // Сбрасываем статус окончания игры и финальный счет
      gameRef.current.registry.set('gameOver', false);
      gameRef.current.registry.set('finalScore', 0);
      gameRef.current.registry.set('gameScore', 0);
    } catch (error) {
      console.error('Ошибка при перезапуске игры:', error);
      
      // Резервный сценарий: останавливаем текущую игру
      gameRef.current.scene.stop('MergeGameScene');
      
      // Удаляем сцену перед добавлением новой
      gameRef.current.scene.remove('MergeGameScene');
      
      // Создаем новую сцену
      gameRef.current.scene.add('MergeGameScene', MergeGameScene, true);
      
      // Сохраняем время начала игры
      gameRef.current.registry.set('gameStartTime', Date.now());
    }
  };

  return (
    <>
      {/* Игровой контейнер без обводки */}
      <div 
        ref={gameContainerRef} 
        className="flex-grow outline-none" 
        style={{
          willChange: 'transform', // Подсказка для оптимизации
          position: 'relative',
          touchAction: 'none' // Предотвращает масштабирование и скролл на мобильных устройствах
        }}
      />
      
      {/* Индикатор загрузки */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1a2b3d] z-10">
          <div className="text-white text-2xl">Загрузка игры...</div>
        </div>
      )}
    </>
  );
});

// Добавляем displayName для отладки
GameContainer.displayName = 'GameContainer';

export default GameContainer;

// Экспортируем действия для использования в других компонентах
export { 
  activateAbility, 
  pauseGame, 
  resumeGame, 
  restartGame 
} from './gameActions'; 