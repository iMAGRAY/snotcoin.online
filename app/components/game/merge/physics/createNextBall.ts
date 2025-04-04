import { getBallSize } from './createBall';
import { BALL_COLORS, FIXED_PLAYER_Y, BASE_GAME_WIDTH } from '../constants/gameConstants';

// Функция для создания визуального шара для броска (без физики)
export const createNextBall = (
  scene: any, 
  playerBodyRef: React.MutableRefObject<any>, 
  level: number,
  specialType?: string
) => {
  if (!playerBodyRef.current) {
    console.error('Невозможно создать шар - нет игрока');
    return null;
  }
  
  // Функция для создания запасного варианта шара (круг с текстом)
  const createFallbackBall = (
    scene: any, 
    container: Phaser.GameObjects.Container, 
    ballSize: number, 
    level: number, 
    gameWidth: number
  ) => {
    // Получаем цвет для текущего уровня
    const ballColor = BALL_COLORS[(level - 1) % BALL_COLORS.length];
    
    // Создаем круг с этим цветом
    const ballSprite = scene.add.circle(0, 0, ballSize, ballColor);
    const outline = scene.add.circle(0, 0, ballSize + 2, 0xffffff, 0.3);
    
    // Масштабируем размер текста в зависимости от размера игры
    const scaleFactor = gameWidth / BASE_GAME_WIDTH;
    const fontSize = Math.max(Math.min(14, 10 + level) * scaleFactor, 8);
    
    // Добавляем текст с уровнем
    const text = scene.add.text(0, 0, level.toString(), {
      fontFamily: 'Arial',
      fontSize: `${fontSize}px`,
      color: '#ffffff',
      fontWeight: 'bold'
    }).setOrigin(0.5);
    
    // Добавляем элементы в контейнер
    container.add([outline, ballSprite, text]);
    
    return { ballSprite, text, outline };
  };
  
  try {
    // Проверяем валидность сцены
    if (!scene || !scene.add) {
      console.error('Невалидная сцена для создания шара', scene);
      return null;
    }
    
    // Получаем позицию игрока
    let playerPos: { x: number; y: number };
    try {
      playerPos = playerBodyRef.current.getPosition();
    } catch (error) {
      console.error('Ошибка при получении позиции игрока:', error);
      // Используем значения по умолчанию
      playerPos = { x: 30, y: 0 };
    }
    
    // Позиционируем шар НИЖЕ игрока, а не над ним
    const x = 30 * playerPos.x;
    const y = FIXED_PLAYER_Y + 24; // Опускаем шар на 24 пикселя НИЖЕ игрока
    
    // Получаем текущую ширину игры для масштабирования
    // Важная часть - использовать актуальную ширину игры, а не константу по умолчанию
    const gameWidth = scene.sys.game?.config?.width || BASE_GAME_WIDTH;
    
    // Получаем размер шара с учетом масштабирования
    let ballSize: number = 15; // Значение по умолчанию
    try {
      // Явно передаем текущую ширину игры для правильного масштабирования
      ballSize = specialType === 'Bull' || specialType === 'Bomb' 
        ? getBallSize(1, gameWidth)  // Для шаров Bull и Bomb используем размер шара 1 уровня
        : getBallSize(level, gameWidth);
    } catch (error) {
      console.error('Ошибка при получении размера шара:', error);
      // Используем значение по умолчанию, уже установленное
      // Рассчитываем приблизительный размер даже при ошибке
      const scaleFactor = gameWidth / BASE_GAME_WIDTH;
      ballSize = (15 + (level - 1) * 5) * scaleFactor;
    }
    
    // Контейнер для шара и всех его элементов
    let container: Phaser.GameObjects.Container;
    try {
      container = scene.add.container(x, y);
      container.setDepth(level + 20); // Высокий z-index для отображения поверх других элементов
    } catch (error) {
      console.error('Ошибка при создании контейнера:', error);
      return null;
    }
    
    let ballSprite, outline, text;
    
    // Определяем визуальное представление в зависимости от типа шара
    try {
      if (specialType === 'Bull') {
        // Используем изображение для шара Bull
        // Проверяем, есть ли такая текстура
        if (scene.textures.exists('bull-ball')) {
          const bullImage = scene.add.image(0, 0, 'bull-ball');
          
          // Масштабируем в соответствии с размером
          bullImage.setDisplaySize(ballSize * 2.5, ballSize * 2.5);
          
          // Добавляем красное свечение
          outline = scene.add.circle(0, 0, ballSize * 1.3, 0xff0000, 0.3);
          
          // Добавляем в контейнер
          container.add([outline, bullImage]);
          
          // Сохраняем ссылку на изображение
          ballSprite = bullImage;
          
          // Анимация пульсации
          scene.tweens.add({
            targets: outline,
            alpha: { from: 0.3, to: 0.7 },
            scale: { from: 1, to: 1.2 },
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
          });
          
          // Анимация вращения
          scene.tweens.add({
            targets: bullImage,
            angle: '+=5',
            duration: 3000,
            repeat: -1,
            ease: 'Linear'
          });
        } else {
          console.warn('Текстура bull-ball не найдена, используется fallback вариант');
          // Если изображение не найдено, создаем красный круг
          ballSprite = scene.add.circle(0, 0, ballSize, 0xff0000);
          outline = scene.add.circle(0, 0, ballSize * 1.2, 0xff0000, 0.3);
          
          // Добавляем текст "BULL"
          text = scene.add.text(0, 0, 'BULL', {
            fontFamily: 'Arial',
            fontSize: `${Math.max(14 * gameWidth / BASE_GAME_WIDTH, 10)}px`,
            color: '#ffffff'
          }).setOrigin(0.5);
          
          // Добавляем в контейнер
          container.add([outline, ballSprite, text]);
        }
      } else if (specialType === 'Bomb') {
        // Используем изображение для бомбы
        if (scene.textures.exists('bomb')) {
          const bombImage = scene.add.image(0, 0, 'bomb');
          
          // Масштабируем в соответствии с размером
          bombImage.setDisplaySize(ballSize * 2.2, ballSize * 2.2);
          
          // Добавляем свечение
          outline = scene.add.circle(0, 0, ballSize * 1.3, 0xff0000, 0.3);
          
          // Добавляем в контейнер
          container.add([outline, bombImage]);
          
          // Сохраняем ссылку на изображение
          ballSprite = bombImage;
          
          // Анимация пульсации
          scene.tweens.add({
            targets: outline,
            alpha: { from: 0.3, to: 0.7 },
            scale: { from: 1, to: 1.2 },
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
          });
          
          // Анимация вращения
          scene.tweens.add({
            targets: bombImage,
            angle: '+=10',
            duration: 2000,
            repeat: -1,
            ease: 'Linear'
          });
        } else {
          // Если изображение не найдено, создаем чёрный круг
          ballSprite = scene.add.circle(0, 0, ballSize, 0x000000);
          outline = scene.add.circle(0, 0, ballSize * 1.2, 0xff0000, 0.3);
          
          // Добавляем текст "BOMB"
          text = scene.add.text(0, 0, 'BOMB', {
            fontFamily: 'Arial',
            fontSize: `${Math.max(14 * gameWidth / BASE_GAME_WIDTH, 10)}px`,
            color: '#ffffff'
          }).setOrigin(0.5);
          
          // Добавляем в контейнер
          container.add([outline, ballSprite, text]);
        }
      } else if (level >= 1 && level <= 12) {
        // Для шаров уровней от 1 до 12 используем изображения монет SNOTCOIN
        // Сначала проверяем существование текстуры
        const ballTexture = `${level}`; // Используем прямое имя файла без префикса 'ball'
        
        let textureExists = false;
        try {
          textureExists = scene.textures.exists(ballTexture);
        } catch (error) {
          console.warn(`Ошибка при проверке существования текстуры ${ballTexture}:`, error);
          textureExists = false;
        }
        
        if (textureExists) {
          // Используем изображение для текущего уровня
          try {
            const ballImage = scene.add.image(0, 0, ballTexture);
            
            // Масштабируем изображение в соответствии с размером шара
            ballImage.setDisplaySize(ballSize * 1.8, ballSize * 1.8);
            
            // Добавляем легкое свечение
            outline = scene.add.circle(0, 0, ballSize * 1.1, 0xffffff, 0.2);
            
            // Добавляем в контейнер
            container.add([outline, ballImage]);
            
            // Сохраняем ссылку на изображение шара
            ballSprite = ballImage;
            
            // Добавляем легкое вращение для монет
            scene.tweens.add({
              targets: ballImage,
              angle: '+=2',
              duration: 4000,
              repeat: -1,
              ease: 'Linear'
            });
          } catch (imageError) {
            console.error(`Ошибка при создании изображения для уровня ${level}:`, imageError);
            // Создаем запасной вариант с кругом и текстом
            const fallback = createFallbackBall(scene, container, ballSize, level, gameWidth);
            ballSprite = fallback.ballSprite;
            text = fallback.text;
            outline = fallback.outline;
          }
        } else {
          // Если текстура не найдена, создаем запасной вариант
          console.warn(`Текстура ${ballTexture} не найдена, создается резервный вариант`);
          const fallback = createFallbackBall(scene, container, ballSize, level, gameWidth);
          ballSprite = fallback.ballSprite;
          text = fallback.text;
          outline = fallback.outline;
        }
      } else {
        // Для неизвестных уровней создаем запасной вариант
        console.warn(`Неизвестный уровень ${level}, создается резервный вариант`);
        const fallback = createFallbackBall(scene, container, ballSize, level, gameWidth);
        ballSprite = fallback.ballSprite;
        text = fallback.text;
        outline = fallback.outline;
      }
    } catch (error) {
      console.error('Ошибка при создании визуального представления шара:', error);
      
      // Создаем простейший резервный вариант при ошибке
      try {
        ballSprite = scene.add.circle(0, 0, ballSize, 0x00ff00);
        container.add(ballSprite);
      } catch (e) {
        console.error('Критическая ошибка при создании резервного шара:', e);
        return null;
      }
    }
    
    // Добавляем анимацию пульсации для привлечения внимания (для всех типов шаров, кроме Bull)
    if (specialType !== 'Bull') {
      try {
        scene.tweens.add({
          targets: container,
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      } catch (tweenError) {
        console.warn('Не удалось добавить анимацию пульсации:', tweenError);
        // Не критично, продолжаем без анимации
      }
    }
    
    // Проверяем, что шар был успешно создан
    if (!ballSprite) {
      console.error('Не удалось создать спрайт шара');
      // Пытаемся создать самый простой шар в качестве запасного варианта
      try {
        ballSprite = scene.add.circle(0, 0, ballSize, 0xffffff);
        container.add(ballSprite);
      } catch (e) {
        console.error('Невозможно создать даже простейший шар:', e);
        return null;
      }
    }
    
    // Возвращаем объект с шаром
    return {
      body: {
        getPosition: () => ({ x: x / 30, y: y / 30 })
      },
      level,
      sprite: {
        container,
        circle: ballSprite,
        text
      },
      specialType,
      originalGameWidth: gameWidth, // Сохраняем текущую ширину игры для последующего масштабирования
      userData: {
        level,
        specialType
      }
    };
  } catch (error) {
    console.error('Критическая ошибка при создании шара для броска:', error);
    return null;
  }
}; 