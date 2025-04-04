import { BASE_BALL_SIZE, SCALE, BASE_GAME_WIDTH, BALL_DENSITY, BALL_FRICTION, BALL_RESTITUTION } from '../constants/gameConstants';
import * as planck from 'planck';

// Минимальный размер шара для физики
const MIN_BALL_RADIUS = 0.45;

/**
 * Получает размер шара в пикселях для определенного уровня шара с учетом размера игры
 * @param level - Уровень шара
 * @param gameWidth - Текущая ширина игровой зоны
 * @returns Радиус шара в пикселях
 */
export const getBallSize = (level: number, gameWidth: number = BASE_GAME_WIDTH): number => {
  // Базовый радиус для шаров относительно ширины игры
  // Размер шара 1 уровня (маленький)
  const minSizeRatio = 0.05; // 5% от ширины игры для шара 1 уровня
  
  // Размер шара 12 уровня (максимально большой - примерно половина ширины)
  const maxSizeRatio = 0.24; // 24% от ширины игры для шара 12 уровня
  
  // Вычисляем шаг увеличения размера для каждого уровня
  const levelStep = (maxSizeRatio - minSizeRatio) / (12 - 1);
  
  // Определяем коэффициент размера для текущего уровня
  const sizeRatio = minSizeRatio + (level - 1) * levelStep;
  
  // Вычисляем итоговый размер в пикселях
  return Math.round(gameWidth * sizeRatio);
};

/**
 * Получает физический размер шара для коллизий
 * @param level - Уровень шара
 * @param gameWidth - Текущая ширина игровой зоны
 * @param specialType - Опциональный тип специального шара
 * @returns Физический радиус шара в единицах физического мира
 */
export const getBallPhysicsSize = (level: number, gameWidth: number = BASE_GAME_WIDTH, specialType?: string): number => {
  // Получаем визуальный размер в пикселях
  const visualSize = getBallSize(level, gameWidth);
  
  // Для физики используем немного меньший размер (85% от визуального)
  // чтобы предотвратить слишком раннее обнаружение коллизий
  let physicsSize = visualSize * 0.85 / SCALE;
  
  // Для больших шаров (уровень > 8) физическая модель должна быть еще меньше визуальной,
  // чтобы избежать проблем с застреванием
  if (level > 8) {
    physicsSize *= 0.95 - (level - 8) * 0.01; // Уменьшаем физический размер на 1% за каждый уровень выше 8
  }
  
  // Для специальных шаров делаем соответствующие корректировки
  if (specialType === 'Bull') {
    // Бык имеет немного больший физический объем для лучшего эффекта "тарана"
    physicsSize *= 1.1;
  } else if (specialType === 'Bomb') {
    // У бомбы физический размер чуть меньше визуального
    physicsSize *= 0.95;
  }
  
  // Убедимся, что физический размер не меньше минимально допустимого
  return Math.max(physicsSize, MIN_BALL_RADIUS);
};

// Функция для обновления размеров и позиций шаров при изменении размера игры
export const updateBallsOnResize = (
  ballsRef: any,
  currentBallRef: any,
  worldRef: any,
  newGameWidth: number,
  oldGameWidth: number,
  baseScaleFactor?: number
) => {
  if (!ballsRef.current || !worldRef.current) return;
  
  // Рассчитываем коэффициенты масштабирования
  const widthScaleFactor = newGameWidth / oldGameWidth;
  // Если передан baseScaleFactor, то используем его для расчета размеров
  // иначе вычисляем относительно базовой ширины
  const sizeFactor = baseScaleFactor || (newGameWidth / BASE_GAME_WIDTH);
  
  console.log(`Масштабирование шаров: widthScaleFactor=${widthScaleFactor.toFixed(3)}, sizeFactor=${sizeFactor.toFixed(3)}`);
  
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
            
            // Используем относительный размер, чтобы шары занимали одинаковую долю от экрана
            const relativeBallSize = Math.round(ballSize);
            
            // Обновляем размер визуального представления в зависимости от типа шара
            if (ball.specialType === 'Bull' && ball.sprite.circle) {
              // Используем точные множители для каждого типа шара
              ball.sprite.circle.setDisplaySize(relativeBallSize * 2.3, relativeBallSize * 2.3);
              
              // Если есть свечение или дополнительные эффекты, обновляем их тоже
              const outline = ball.sprite.container.list?.find((child: any) => 
                child.type === 'Arc' && child.fillColor === 0xff0000
              );
              if (outline) {
                outline.setRadius(relativeBallSize * 1.25);
              }
            } else if (ball.specialType === 'Bomb' && ball.sprite.circle) {
              ball.sprite.circle.setDisplaySize(relativeBallSize * 2.0, relativeBallSize * 2.0);
              
              // Обновляем эффекты бомбы
              const outline = ball.sprite.container.list?.find((child: any) => 
                child.type === 'Arc' && child.fillColor === 0xff0000
              );
              if (outline) {
                outline.setRadius(relativeBallSize * 1.2);
              }
            } else if (ball.sprite.circle && typeof ball.sprite.circle.setDisplaySize === 'function') {
              // Постепенно уменьшаем множитель для больших шаров, чтобы изображение не было слишком большим
              const displayMultiplier = ball.level > 8 ? 1.7 - (ball.level - 8) * 0.05 : 1.7;
              ball.sprite.circle.setDisplaySize(relativeBallSize * displayMultiplier, relativeBallSize * displayMultiplier);
              
              // Обновляем контур обычного шара, если он есть
              const outline = ball.sprite.container.list?.find((child: any) => 
                child.type === 'Arc' && child.fillColor === 0xffffff
              );
              if (outline) {
                outline.setRadius(relativeBallSize * 1.1);
              }
            }
            
            // Обновляем размер текста на шаре, если он есть
            if (ball.sprite.text) {
              // Размер шрифта должен быть пропорционален размеру шара
              // и зависеть от уровня шара
              const fontSize = Math.max(Math.min(18, 12 + ball.level) * sizeFactor, 10);
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
      
      // Относительный размер шара
      const relativeBallSize = Math.round(ballSize);
      
      // Обновляем размер визуального представления в зависимости от типа шара
      if (currentBall.specialType === 'Bull' && currentBall.sprite.circle) {
        currentBall.sprite.circle.setDisplaySize(relativeBallSize * 2.3, relativeBallSize * 2.3);
        
        // Обновляем эффекты, если они есть
        const outline = currentBall.sprite.container.list?.find((child: any) => 
          child.type === 'Arc' && child.fillColor === 0xff0000
        );
        if (outline) {
          outline.setRadius(relativeBallSize * 1.25);
        }
      } else if (currentBall.specialType === 'Bomb' && currentBall.sprite.circle) {
        currentBall.sprite.circle.setDisplaySize(relativeBallSize * 2.0, relativeBallSize * 2.0);
        
        // Обновляем эффекты, если они есть
        const outline = currentBall.sprite.container.list?.find((child: any) => 
          child.type === 'Arc' && child.fillColor === 0xff0000
        );
        if (outline) {
          outline.setRadius(relativeBallSize * 1.2);
        }
      } else if (currentBall.sprite.circle && typeof currentBall.sprite.circle.setDisplaySize === 'function') {
        // Постепенно уменьшаем множитель для больших шаров, чтобы изображение не было слишком большим
        const displayMultiplier = currentBall.level > 8 ? 1.7 - (currentBall.level - 8) * 0.05 : 1.7;
        currentBall.sprite.circle.setDisplaySize(relativeBallSize * displayMultiplier, relativeBallSize * displayMultiplier);
        
        // Обновляем эффекты, если они есть
        const outline = currentBall.sprite.container.list?.find((child: any) => 
          child.type === 'Arc' && child.fillColor === 0xffffff
        );
        if (outline) {
          outline.setRadius(relativeBallSize * 1.1);
        }
      }
      
      // Обновляем размер текста, если он есть
      if (currentBall.sprite.text) {
        // Размер текста пропорционален размеру шара
        const fontSize = Math.max(Math.min(14, 10 + currentBall.level) * sizeFactor, 10);
        currentBall.sprite.text.setFontSize(fontSize);
        // Центрируем текст
        currentBall.sprite.text.setOrigin(0.5, 0.5);
      }
      
      // Сохраняем новый размер игры для будущих обновлений
      currentBall.originalGameWidth = newGameWidth;
      
      // Добавляем логирование для диагностики
      console.log(`Обновлен шар для броска: уровень ${currentBall.level}, размер ${relativeBallSize}px, ширина игры ${newGameWidth}px`);
    } catch (error) {
      console.error("Ошибка при обновлении текущего шара:", error);
    }
  }
}; 