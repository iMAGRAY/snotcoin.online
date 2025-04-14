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
      try {
        // Перезапускаем игру
        restartGameAction();
        
        // Обновляем время начала игры
        gameRef.current.registry.set('gameStartTime', Date.now());
        
        // Сбрасываем статус окончания игры и финальный счет
        gameRef.current.registry.set('gameOver', false);
        gameRef.current.registry.set('finalScore', 0);
        gameRef.current.registry.set('gameScore', 0);
        
        // Уведомляем родительский компонент, что перезапуск завершен
        if (onRestartComplete) {
          onRestartComplete();
        }
      } catch (error) {
        console.error('Ошибка при автоматическом перезапуске игры:', error);
        
        // Уведомляем родительский компонент о завершении, даже если произошла ошибка
        if (onRestartComplete) {
          onRestartComplete();
        }
      }
    }
    
    return undefined;
  }, [shouldRestart, onRestartComplete]);
  
  // Стабильный обработчик обновления счета
  const handleGameUpdate = useCallback(() => {
    if (!gameRef.current) return undefined;
    
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
    
    return undefined;
  }, [onScoreUpdate, onGameOver]);
  
  useEffect(() => {
    if (!gameContainerRef.current) return undefined;
    
    // Предотвращаем повторную инициализацию игры
    if (gameRef.current) return undefined;

    // Определяем базовые размеры с соотношением 85:112
    const BASE_WIDTH = 85 * 5;  // 425px
    const BASE_HEIGHT = 112 * 5; // 560px
    
    // Рассчитываем новые размеры с учетом соотношения сторон 85:112
    const containerWidth = window.innerWidth;
    const containerHeight = window.innerHeight - 140;
    
    // Определяем, какая сторона ограничивает
    const scaleWidth = containerWidth / BASE_WIDTH;
    const scaleHeight = containerHeight / BASE_HEIGHT;
    
    // Используем меньший масштаб для сохранения соотношения сторон
    const scale = Math.min(scaleWidth, scaleHeight);
    
    // Вычисляем итоговые размеры с сохранением соотношения сторон
    const newWidth = Math.floor(BASE_WIDTH * scale);
    const newHeight = Math.floor(BASE_HEIGHT * scale);

    // Создаём игру Phaser
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: newWidth,
      height: newHeight,
      backgroundColor: 'transparent',
      parent: gameContainerRef.current,
      physics: {
        default: 'arcade',
        arcade: {
          debug: false,
        },
      },
      scene: [MergeGameScene],
      transparent: true,
      canvasStyle: 'display: block; touch-action: none; margin: 0 auto;',
      disableContextMenu: true,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: BASE_WIDTH,
        height: BASE_HEIGHT,
      }
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
            // Рассчитываем новые размеры с учетом соотношения сторон 85:112
            const containerWidth = window.innerWidth;
            const containerHeight = window.innerHeight - 140;
            
            // Устанавливаем размеры контейнера
            if (gameContainerRef.current) {
              gameContainerRef.current.style.width = `${containerWidth}px`;
              gameContainerRef.current.style.height = `${containerHeight}px`;
            }
            
            // Обновляем размер родительского контейнера
            if (game.scale.parent) {
              // Определяем, какая сторона ограничивает
              const scaleWidth = containerWidth / BASE_WIDTH;
              const scaleHeight = containerHeight / BASE_HEIGHT;
              
              // Используем меньший масштаб для сохранения соотношения сторон
              const scale = Math.min(scaleWidth, scaleHeight);
              
              // Вычисляем итоговые размеры с сохранением соотношения сторон
              const newWidth = Math.floor(BASE_WIDTH * scale);
              const newHeight = Math.floor(BASE_HEIGHT * scale);
              
              // Центрируем игру
              const canvas = game.canvas;
              if (canvas && canvas.parentElement) {
                canvas.parentElement.style.width = `${newWidth}px`;
                canvas.parentElement.style.height = `${newHeight}px`;
                canvas.parentElement.style.margin = '0 auto';
              }
            }
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
      return undefined;
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
      
      // Оповещаем родительский компонент о завершении перезапуска
      if (onRestartComplete) {
        onRestartComplete();
      }
    } catch (error) {
      console.error('Ошибка при перезапуске игры:', error);
      
      try {
        // Резервный сценарий: останавливаем текущую игру
        gameRef.current.scene.stop('MergeGameScene');
        
        // Удаляем сцену перед добавлением новой
        gameRef.current.scene.remove('MergeGameScene');
        
        // Создаем новую сцену
        gameRef.current.scene.add('MergeGameScene', MergeGameScene, true);
        
        // Сохраняем время начала игры
        gameRef.current.registry.set('gameStartTime', Date.now());
        gameRef.current.registry.set('gameOver', false);
        gameRef.current.registry.set('finalScore', 0);
        gameRef.current.registry.set('gameScore', 0);
        
        // Оповещаем родительский компонент о завершении перезапуска
        if (onRestartComplete) {
          onRestartComplete();
        }
      } catch (nestedError) {
        console.error('Критическая ошибка при перезапуске игры:', nestedError);
      }
    }
  };

  return (
    <>
      {/* Игровой контейнер без обводки */}
      <div 
        ref={gameContainerRef} 
        className="flex-grow outline-none flex items-center justify-center" 
        style={{
          willChange: 'transform', // Подсказка для оптимизации
          position: 'relative',
          touchAction: 'none', // Предотвращает масштабирование и скролл на мобильных устройствах
          overflow: 'hidden',
          width: '100%',
          // Устанавливаем соотношение сторон 85:112
          height: 'calc((100vw * 112 / 85) - 140px)',
          maxHeight: 'calc(100vh - 140px)', // Ограничение максимальной высоты
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
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