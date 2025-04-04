import { BASE_BALL_SIZE, SCALE, BASE_GAME_WIDTH, BALL_DENSITY, BALL_FRICTION, BALL_RESTITUTION } from '../constants/gameConstants';
import * as planck from 'planck';

// Минимальный размер шара для физики
const MIN_BALL_RADIUS = 0.45;

// Функция для расчета размера шара на основе уровня и размера игры
export const getBallSize = (level: number, gameWidth?: number): number => {
  // Базовый размер шара с прогрессивным увеличением в зависимости от уровня
  const baseSize = BASE_BALL_SIZE + (level - 1) * 5; // увеличиваем размер на 5 пикселей для каждого уровня
  
  // Если передан размер игры, масштабируем шар в зависимости от ширины игрового поля
  if (gameWidth && gameWidth !== BASE_GAME_WIDTH) {
    const scaleFactor = gameWidth / BASE_GAME_WIDTH;
    // Правильное масштабирование: шары должны увеличиваться при увеличении игровой зоны
    return baseSize * scaleFactor;
  }
  
  return baseSize;
};

// Функция для расчета физического размера шара с учетом масштабирования
export const getBallPhysicsSize = (level: number, gameWidth?: number, specialType?: string): number => {
  // Используем MIN_BALL_RADIUS, чтобы предотвратить проникновение шаров друг в друга
  const visualSize = getBallSize(level, gameWidth);
  
  // Физический размер шара (масштабируем визуальный размер)
  const physicalSize = visualSize / SCALE;
  
  // Применяем модификаторы для специальных типов шаров
  let sizeMultiplier = 1.0;
  
  if (specialType === 'Bull') {
    sizeMultiplier = 1.2; // Bull шары немного больше
  } else if (specialType === 'Bomb') {
    sizeMultiplier = 1.1; // Bomb шары тоже больше
  }
  
  return Math.max(physicalSize * sizeMultiplier, MIN_BALL_RADIUS);
};

// Функция для обновления размеров и позиций шаров при изменении размера игры
export const updateBallsOnResize = (
  ballsRef: any,
  currentBallRef: any,
  worldRef: any,
  newGameWidth: number,
  oldGameWidth: number
) => {
  if (!ballsRef.current || !worldRef.current) return;
  
  // Рассчитываем коэффициенты масштабирования
  const widthScaleFactor = newGameWidth / oldGameWidth;
  const baseSizeFactor = newGameWidth / BASE_GAME_WIDTH;
  
  console.log(`Масштабирование шаров: widthScaleFactor=${widthScaleFactor}, baseSizeFactor=${baseSizeFactor}`);
  
  try {
    // Сначала обновляем все визуальные элементы шаров, чтобы они оставались видимыми
    // во время обновления физических свойств
    for (const ball of ballsRef.current) {
      if (ball && ball.body && ball.sprite && ball.sprite.container && !ball.sprite.container.destroyed) {
        try {
          // Получаем текущую позицию в физическом мире
          const oldPos = ball.body.getPosition();
          
          // Сохраняем вертикальную позицию и масштабируем только горизонтальную
          const oldPixelX = oldPos.x * SCALE;
          const oldPixelY = oldPos.y * SCALE;
          
          // Применяем масштабирование только к горизонтальной позиции
          const newPixelX = oldPixelX * widthScaleFactor;
          const newPixelY = oldPixelY; // Оставляем Y без изменений
          
          // Обновляем визуальную позицию шара перед обновлением физики
          if (ball.sprite.container && !ball.sprite.container.destroyed) {
            // Устанавливаем новую позицию с плавным переходом
            ball.sprite.container.setPosition(newPixelX, newPixelY);
            
            // Получаем новый размер шара с явным указанием текущей ширины игры
            const ballSize = getBallSize(ball.level, newGameWidth);
            
            // Обновляем размер визуального представления в зависимости от типа шара
            if (ball.specialType === 'Bull' && ball.sprite.circle) {
              // Используем точные множители для каждого типа шара
              ball.sprite.circle.setDisplaySize(ballSize * 2.5, ballSize * 2.5);
              
              // Если есть свечение или дополнительные эффекты, обновляем их тоже
              const outline = ball.sprite.container.list?.find((child: any) => 
                child.type === 'Arc' && child.fillColor === 0xff0000
              );
              if (outline) {
                outline.setRadius(ballSize * 1.3);
              }
            } else if (ball.specialType === 'Bomb' && ball.sprite.circle) {
              ball.sprite.circle.setDisplaySize(ballSize * 2.2, ballSize * 2.2);
              
              // Обновляем эффекты бомбы
              const outline = ball.sprite.container.list?.find((child: any) => 
                child.type === 'Arc' && child.fillColor === 0xff0000
              );
              if (outline) {
                outline.setRadius(ballSize * 1.2);
              }
            } else if (ball.sprite.circle && typeof ball.sprite.circle.setDisplaySize === 'function') {
              // Обычные шары
              ball.sprite.circle.setDisplaySize(ballSize * 1.8, ballSize * 1.8);
              
              // Обновляем контур обычного шара, если он есть
              const outline = ball.sprite.container.list?.find((child: any) => 
                child.type === 'Arc' && child.fillColor === 0xffffff
              );
              if (outline) {
                outline.setRadius(ballSize * 1.1);
              }
            }
            
            // Обновляем размер текста на шаре, если он есть
            if (ball.sprite.text) {
              const fontSize = Math.max(Math.min(18, 12 + ball.level) * baseSizeFactor, 10);
              ball.sprite.text.setFontSize(fontSize);
              // Центрируем текст
              ball.sprite.text.setOrigin(0.5, 0.5);
            }
          }
        } catch (error) {
          console.error("Ошибка при обновлении визуального представления шара:", error);
        }
      }
    }
    
    // После того как все визуальные элементы обновлены, обновляем физические свойства
    for (const ball of ballsRef.current) {
      if (ball && ball.body && !ball.body.isDestroyed) {
        try {
          // Получаем текущую позицию в физическом мире
          const oldPos = ball.body.getPosition();
          
          // Сохраняем вертикальную позицию и масштабируем только горизонтальную
          const oldPixelX = oldPos.x * SCALE;
          const oldPixelY = oldPos.y * SCALE;
          
          // Применяем масштабирование только к горизонтальной позиции
          const newPixelX = oldPixelX * widthScaleFactor;
          const newPixelY = oldPixelY; // Оставляем Y без изменений
          
          // Сохраняем текущую скорость - масштабируем только горизонтальную составляющую
          const velocity = ball.body.getLinearVelocity();
          const newVelocity = planck.Vec2(
            velocity.x * widthScaleFactor, 
            velocity.y // Вертикальную скорость не меняем
          );
          
          // Устанавливаем новую позицию физического тела
          ball.body.setPosition(planck.Vec2(newPixelX / SCALE, newPixelY / SCALE));
          
          // Применяем новую скорость
          ball.body.setLinearVelocity(newVelocity);
          
          // Обновляем физический размер коллайдера шара
          try {
            const fixtures = ball.body.getFixtureList();
            if (fixtures) {
              // Получаем новый физический размер с учетом текущей ширины игры
              const newPhysicalSize = getBallPhysicsSize(ball.level, newGameWidth, ball.specialType);
              
              // Удаляем старую физическую фикстуру
              ball.body.destroyFixture(fixtures);
              
              // Создаем новую фикстуру с обновленным размером
              const circleShape = planck.Circle(newPhysicalSize);
              
              // Сохраняем физические свойства в зависимости от типа шара
              let friction = BALL_FRICTION;
              let restitution = BALL_RESTITUTION;
              let density = BALL_DENSITY;
              
              if (ball.specialType === 'Bull') {
                density = BALL_DENSITY * 1.5;
                friction = BALL_FRICTION * 0.5;
                restitution = BALL_RESTITUTION * 1.2;
              } else if (ball.specialType === 'Bomb') {
                density = BALL_DENSITY * 1.2;
                friction = BALL_FRICTION * 0.8;
                restitution = BALL_RESTITUTION * 1.1;
              }
              
              // Создаем новую фикстуру с обновленными параметрами
              ball.body.createFixture({
                shape: circleShape,
                density: density,
                friction: friction,
                restitution: restitution,
                filterGroupIndex: 0
              });
              
              // Запоминаем обновленный размер игры для будущего масштабирования
              ball.originalGameWidth = newGameWidth;
            }
          } catch (error) {
            console.error("Ошибка при обновлении физического размера шара:", error);
          }
        } catch (error) {
          console.error("Ошибка при обновлении физических свойств шара:", error);
        }
      }
    }
  } catch (error) {
    console.error("Общая ошибка при обновлении шаров:", error);
  }
  
  // Обновляем текущий шар для броска, если он есть
  if (currentBallRef.current && currentBallRef.current.sprite && 
      currentBallRef.current.sprite.container && !currentBallRef.current.sprite.container.destroyed) {
    try {
      const currentBall = currentBallRef.current;
      
      // Получаем координаты "игрока" или устройства броска
      // Обычно это где-то вверху по центру
      const playerX = newGameWidth / 2;
      
      // Плавно обновляем позицию шара для броска
      currentBall.sprite.container.setPosition(playerX, currentBall.sprite.container.y);
      
      // Получаем новый размер шара с учетом текущей ширины игры
      const ballSize = getBallSize(currentBall.level, newGameWidth);
      
      // Обновляем размер визуального представления в зависимости от типа шара
      if (currentBall.specialType === 'Bull' && currentBall.sprite.circle) {
        currentBall.sprite.circle.setDisplaySize(ballSize * 2.5, ballSize * 2.5);
        
        // Обновляем эффекты, если они есть
        const outline = currentBall.sprite.container.list?.find((child: any) => 
          child.type === 'Arc' && child.fillColor === 0xff0000
        );
        if (outline) {
          outline.setRadius(ballSize * 1.3);
        }
      } else if (currentBall.specialType === 'Bomb' && currentBall.sprite.circle) {
        currentBall.sprite.circle.setDisplaySize(ballSize * 2.2, ballSize * 2.2);
        
        // Обновляем эффекты, если они есть
        const outline = currentBall.sprite.container.list?.find((child: any) => 
          child.type === 'Arc' && child.fillColor === 0xff0000
        );
        if (outline) {
          outline.setRadius(ballSize * 1.3);
        }
      } else if (currentBall.sprite.circle && typeof currentBall.sprite.circle.setDisplaySize === 'function') {
        currentBall.sprite.circle.setDisplaySize(ballSize * 1.8, ballSize * 1.8);
        
        // Обновляем эффекты, если они есть
        const outline = currentBall.sprite.container.list?.find((child: any) => 
          child.type === 'Arc' && child.fillColor === 0xffffff
        );
        if (outline) {
          outline.setRadius(ballSize * 1.1);
        }
      }
      
      // Обновляем размер текста, если он есть
      if (currentBall.sprite.text) {
        const fontSize = Math.max(Math.min(14, 10 + currentBall.level) * baseSizeFactor, 10);
        currentBall.sprite.text.setFontSize(fontSize);
        // Центрируем текст
        currentBall.sprite.text.setOrigin(0.5, 0.5);
      }
      
      // Сохраняем новый размер игры для будущих обновлений
      currentBall.originalGameWidth = newGameWidth;
      
      // Добавляем логирование для диагностики
      console.log(`Обновлен шар для броска: уровень ${currentBall.level}, размер ${ballSize}px, ширина игры ${newGameWidth}px`);
    } catch (error) {
      console.error("Ошибка при обновлении текущего шара:", error);
    }
  }
}; 