"use client"

import React, { useRef, useEffect, useState, useCallback, memo } from "react";
import * as Phaser from 'phaser';
import { toast } from 'react-hot-toast';
import { AnimatePresence } from "framer-motion";
import { MergeGameSceneType } from "../../utils/types";
import MergeGameScene from "../../MergeGameScene";
import { setGameInstance, restartGame as restartGameAction } from './gameActions';

// Расширяем интерфейс Window для поддержки хранения экземпляров Phaser
declare global {
  interface Window {
    __PHASER_INSTANCES?: Phaser.Game[];
    __PHASER_SINGLETON?: Phaser.Game;
    __PHASER_IS_DESTROYING?: boolean;
    gc?: () => void;
  }
}

// Глобальная функция для проверки и очистки существующих экземпляров Phaser
function cleanupPhaserInstances() {
  // Если уже идет процесс уничтожения, пропускаем
  if (window.__PHASER_IS_DESTROYING) return;
  
  window.__PHASER_IS_DESTROYING = true;
  console.log('Очистка существующих инстансов Phaser перед созданием нового');
  
  // Более аккуратное уничтожение синглтона с задержкой
  const cleanupPromises = [];
  
  if (window.__PHASER_SINGLETON) {
    try {
      console.log('Уничтожение глобального синглтона Phaser');
      const promise = new Promise<void>((resolve) => {
        // Сначала останавливаем все сцены
        try {
          const scenes = window.__PHASER_SINGLETON?.scene?.scenes;
          if (scenes && scenes.length > 0) {
            scenes.forEach(scene => {
              if (scene.scene && scene.scene.key) {
                console.log(`Останавливаем сцену ${scene.scene.key}`);
                window.__PHASER_SINGLETON?.scene.stop(scene.scene.key);
              }
            });
          }
        } catch (error) {
          console.error('Ошибка при остановке сцен:', error);
        }
        
        // Добавляем небольшую задержку перед уничтожением
        setTimeout(() => {
          try {
            window.__PHASER_SINGLETON?.destroy(true, false);
            window.__PHASER_SINGLETON = undefined as unknown as Phaser.Game;
            console.log('Синглтон Phaser успешно уничтожен');
          } catch (error) {
            console.error('Ошибка при уничтожении синглтона Phaser:', error);
          }
          resolve();
        }, 100);
      });
      
      cleanupPromises.push(promise);
    } catch (error) {
      console.error('Ошибка при уничтожении синглтона Phaser:', error);
    }
  }
  
  if (window.__PHASER_INSTANCES && window.__PHASER_INSTANCES.length > 0) {
    console.log(`Найдено ${window.__PHASER_INSTANCES.length} активных инстансов Phaser, очищаем...`);
    
    // Очищаем все существующие экземпляры
    window.__PHASER_INSTANCES.forEach((instance, index) => {
      if (instance && instance !== window.__PHASER_SINGLETON) {
        try {
          console.log(`Уничтожение инстанса Phaser #${index}`);
          
          const promise = new Promise<void>((resolve) => {
            setTimeout(() => {
              try {
                instance.destroy(true, false);
                console.log(`Инстанс Phaser #${index} успешно уничтожен`);
              } catch (error) {
                console.error(`Ошибка при уничтожении инстанса Phaser #${index}:`, error);
              }
              resolve();
            }, 50 * index); // Небольшая задержка между уничтожениями
          });
          
          cleanupPromises.push(promise);
        } catch (error) {
          console.error(`Ошибка при уничтожении инстанса Phaser #${index}:`, error);
        }
      }
    });
    
    // Ждем завершения всех операций очистки
    Promise.all(cleanupPromises)
      .then(() => {
        // Сбрасываем массив и флаг уничтожения
        window.__PHASER_INSTANCES = [];
        window.__PHASER_IS_DESTROYING = false;
        console.log('Очистка всех инстансов Phaser завершена');
      })
      .catch(error => {
        console.error('Ошибка при очистке инстансов Phaser:', error);
        window.__PHASER_IS_DESTROYING = false;
      });
  } else {
    window.__PHASER_IS_DESTROYING = false;
  }
}

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
  const mountedRef = useRef(false);
  
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
  
  // Создание игры при монтировании компонента
  useEffect(() => {
    if (!gameContainerRef.current || mountedRef.current) return undefined;
    
    // Отмечаем, что компонент смонтирован
    mountedRef.current = true;
    console.log('Монтирование GameContainer, инициализируем Phaser');
    
    // Предотвращаем повторную инициализацию игры
    if (gameRef.current) {
      console.log('Игра уже инициализирована, пропускаем создание');
      return undefined;
    }
    
    // Очищаем существующие экземпляры Phaser перед созданием нового
    cleanupPhaserInstances();

    // Определяем базовые размеры с соотношением 11.5:16
    const BASE_WIDTH = 1200;   // 1200px для ширины (11.5)
    const BASE_HEIGHT = 1600; // 1600px для высоты (16)
    
    // Рассчитываем новые размеры с учетом пропорций 11.5:16
    const containerWidth = window.innerWidth;
    const containerHeight = window.innerHeight - 140;
    
    // Определяем, какая сторона ограничивает
    const scaleWidth = containerWidth / BASE_WIDTH;
    const scaleHeight = containerHeight / BASE_HEIGHT;
    
    // Используем меньший масштаб для сохранения пропорций
    const scale = Math.min(scaleWidth, scaleHeight);
    
    // Вычисляем итоговые размеры с сохранением пропорций
    const gameWidth = Math.floor(BASE_WIDTH * scale);
    const gameHeight = Math.floor(BASE_HEIGHT * scale);

    // Создаём игру Phaser
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.CANVAS,
      width: gameWidth,
      height: gameHeight,
      backgroundColor: 'transparent',
      parent: gameContainerRef.current,
      physics: {
        default: 'arcade',
        arcade: {
          debug: false,
        },
      },
      pixelArt: false,
      antialias: true,
      scene: [MergeGameScene],
      transparent: true,
      canvasStyle: 'display: block; touch-action: none; margin: 0 auto; image-rendering: high-quality; image-rendering: crisp-edges;',
      disableContextMenu: true,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: BASE_WIDTH,
        height: BASE_HEIGHT,
        min: {
          width: BASE_WIDTH / 4,
          height: BASE_HEIGHT / 4
        },
        max: {
          width: BASE_WIDTH * 2,
          height: BASE_HEIGHT * 2
        }
      },
      // Улучшенные настройки рендеринга для максимального сглаживания
      render: {
        powerPreference: 'high-performance',
        batchSize: 4096, // Увеличиваем для эффективности
        clearBeforeRender: true,
        antialias: true,
        preserveDrawingBuffer: false, 
        premultipliedAlpha: true,
        antialiasGL: true,
        mipmapFilter: 'LINEAR_MIPMAP_LINEAR', // Лучшее качество миньмапов
        roundPixels: false, // Отключаем для сглаженных линий
        maxTextures: 8192, // Максимальное количество текстур
        desynchronized: false // Синхронизированный режим для лучшего качества
      },
      // Не используем кастомную конфигурацию плагинов, полагаемся на дефолтные настройки Phaser
      audio: {
        disableWebAudio: false,
        noAudio: false
      },
      banner: {
        hidePhaser: false,
        text: '#ffffff',
        background: ['#000000']
      },
      callbacks: {
        postBoot: (game) => {
          console.log('Phaser успешно инициализирован');
          
          // Сохраняем как глобальный синглтон
          window.__PHASER_SINGLETON = game;
          
          // Также добавляем в массив инстансов для обратной совместимости
          if (!window.__PHASER_INSTANCES) {
            window.__PHASER_INSTANCES = [];
          }
          window.__PHASER_INSTANCES.push(game);
        }
      }
    };

    // Используем try/catch для более безопасной инициализации Phaser
    try {
      // Добавляем задержку перед созданием нового инстанса, чтобы дать время браузеру очистить предыдущие ресурсы
      console.log('Ожидаем перед созданием нового инстанса Phaser.Game...');
      
      // Вместо немедленного создания Phaser.Game, добавляем задержку
      setTimeout(() => {
        try {
          console.log('Создаем новый инстанс Phaser.Game');
          const game = new Phaser.Game(config);
          gameRef.current = game;
          
          // Проверяем количество созданных инстансов
          if (window.__PHASER_INSTANCES) {
            console.log(`Активных инстансов Phaser: ${window.__PHASER_INSTANCES.length}`);
          }
          
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
                // Рассчитываем новые размеры с учетом пропорций
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
                  
                  // Используем меньший масштаб для сохранения пропорций
                  const scale = Math.min(scaleWidth, scaleHeight);
                  
                  // Вычисляем итоговые размеры с сохранением пропорций
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
            console.log('Размонтирование GameContainer, очищаем ресурсы');
            
            // Сбрасываем флаг монтирования
            mountedRef.current = false;
            
            // Удаляем обработчик resize и интервал обновления счета
            window.removeEventListener('resize', handleResize);
            clearInterval(gameUpdateInterval);
            
            // Проверяем, что игра еще существует
            if (!gameRef.current) {
              console.log('Инстанс игры уже удален, пропускаем очистку');
              return;
            }
            
            const game = gameRef.current;
            
            // Принудительно удаляем инстанс из списка активных
            if (window.__PHASER_INSTANCES) {
              const index = window.__PHASER_INSTANCES.indexOf(game);
              if (index > -1) {
                window.__PHASER_INSTANCES.splice(index, 1);
                console.log(`Удален инстанс Phaser из списка активных. Осталось: ${window.__PHASER_INSTANCES.length}`);
              }
            }
            
            // Очищаем глобальный синглтон, если это наша игра
            if (window.__PHASER_SINGLETON === game) {
              window.__PHASER_SINGLETON = undefined as unknown as Phaser.Game;
              console.log('Очищен глобальный синглтон Phaser');
            }
            
            try {
              // Вызываем явную очистку, если метод доступен
              const scene = game.scene.getScene('MergeGameScene');
              if (scene && typeof (scene as any).cleanup === 'function') {
                try {
                  console.log('Вызываем метод cleanup на сцене');
                  (scene as any).cleanup();
                } catch (error) {
                  console.error('Ошибка при вызове cleanup:', error);
                }
              }
              
              // Останавливаем все сцены
              try {
                game.scene.scenes.forEach(scene => {
                  if (scene.scene && scene.scene.key) {
                    console.log(`Останавливаем сцену ${scene.scene.key}`);
                    game.scene.stop(scene.scene.key);
                  }
                });
              } catch (error) {
                console.error('Ошибка при остановке сцен:', error);
              }
              
              // Уничтожаем все текстуры и кэши
              try {
                if (game.textures) {
                  console.log('Очищаем текстуры игры');
                  // Просто логируем, что не можем очистить текстуры
                  // Phaser сам должен очистить их при destroy()
                  console.log('Полагаемся на game.destroy() для очистки текстур');
                }
                
                if (game.cache) {
                  console.log('Очищаем кэш игры');
                  // Также полагаемся на game.destroy()
                  console.log('Полагаемся на game.destroy() для очистки кэша');
                }
              } catch (error) {
                console.error('Ошибка при очистке ресурсов игры:', error);
              }
              
              // В любом случае уничтожаем игру
              try {
                console.log('Уничтожаем инстанс Phaser.Game');
                // Проверяем версию Phaser для совместимости
                const phaserVersion = Phaser.VERSION || '';
                console.log(`Версия Phaser: ${phaserVersion}`);
                
                // В более новых версиях используются разные параметры
                if (phaserVersion && phaserVersion.split('.').length > 0 && parseInt(phaserVersion.split('.')[0] || '0') >= 3) {
                  // Для Phaser 3+: (removeCanvas, noReturn)
                  // removeCanvas - удаляет canvas элемент
                  // noReturn - предотвращает повторное использование объекта
                  game.destroy(true, true);
                } else {
                  // Для старых версий
                  game.destroy(true);
                }
              } catch (error) {
                console.error('Ошибка при уничтожении игры:', error);
              }
              
              // Освобождаем ссылку на игру
              gameRef.current = null;
              
              // Принудительная очистка для сборщика мусора
              setTimeout(() => {
                if (typeof window.gc === 'function') {
                  try {
                    console.log('Принудительный запуск сборщика мусора');
                    window.gc();
                  } catch (error) {
                    console.error('Ошибка при запуске сборщика мусора:', error);
                  }
                }
              }, 100);
            } catch (error) {
              console.error('Общая ошибка при очистке ресурсов:', error);
              gameRef.current = null;
            }
          };
        } catch (innerError) {
          console.error('Ошибка при отложенной инициализации Phaser:', innerError);
          setIsLoaded(true); // Помечаем как загруженный, чтобы скрыть экран загрузки
          return undefined;
        }
      }, 300); // Ждем 300мс перед созданием нового инстанса
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
          height: 'calc(100vh - 140px)',
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