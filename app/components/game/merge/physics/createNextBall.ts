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
  
  try {
    const playerPos = playerBodyRef.current.getPosition();
    
    // Позиционируем шар НИЖЕ игрока, а не над ним
    const x = 30 * playerPos.x;
    const y = FIXED_PLAYER_Y + 24; // Опускаем шар на 24 пикселя НИЖЕ игрока
    
    // Проверяем валидность сцены
    if (!scene || !scene.add) {
      console.error('Невалидная сцена для создания шара', scene);
      return null;
    }
    
    // Получаем текущую ширину игры для масштабирования
    const gameWidth = scene.sys.game.config.width || BASE_GAME_WIDTH;
    
    // Получаем размер шара с учетом масштабирования
    const ballSize = specialType === 'Bull' || specialType === 'Bomb' 
      ? getBallSize(1, gameWidth)  // Для шаров Bull и Bomb используем размер шара 1 уровня
      : getBallSize(level, gameWidth);
    
    // Контейнер для шара и всех его элементов
    const container = scene.add.container(x, y);
    container.setDepth(level + 20); // Высокий z-index для отображения поверх других элементов
    
    let ballSprite, outline, text;
    
    // Определяем визуальное представление в зависимости от типа шара
    if (specialType === 'Bull') {
      // Используем изображение для шара Bull
      // Проверяем, есть ли такая текстура
      if (scene.textures.exists('bull-ball')) {
        const bullImage = scene.add.image(0, 0, 'bull-ball');
        
        // Масштабируем в соответствии с размером
        bullImage.setDisplaySize(ballSize * 2.5, ballSize * 2.5);
        
        // Добавляем красное свечение
        outline = scene.add.circle(0, 0, ballSize * 1.3, 0xff0000, 0.3);
        
        // Добавляем специальный текст "BULL"
        const specialText = scene.add.text(0, ballSize * 0.7, 'BULL', {
          fontFamily: 'Arial',
          fontSize: '12px',
          color: '#ffffff',
          fontWeight: 'bold',
          stroke: '#ff0000',
          strokeThickness: 2
        }).setOrigin(0.5);
        
        // Добавляем все элементы в контейнер
        container.add([outline, bullImage, specialText]);
        
        // Сохраняем ссылку на изображение
        ballSprite = bullImage;
        text = specialText;
        
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
        // Если изображение не найдено, создаем красный круг
        ballSprite = scene.add.circle(0, 0, ballSize, 0xff0000);
        outline = scene.add.circle(0, 0, ballSize * 1.2, 0xff0000, 0.3);
        
        // Добавляем текст "BULL"
        text = scene.add.text(0, 0, 'BULL', {
          fontFamily: 'Arial',
          fontSize: '14px',
          color: '#ffffff',
          fontWeight: 'bold'
        }).setOrigin(0.5);
        
        // Добавляем в контейнер
        container.add([outline, ballSprite, text]);
      }
    } else if (level >= 1 && level <= 6 || level === 12) {
      // Для шаров уровней от 1 до 6 и 12 используем изображения
      const ballTexture = `${level}`;
      
      // Проверяем, существует ли такая текстура в кэше
      if (scene.textures.exists(ballTexture)) {
        // Используем изображение для текущего уровня
        const ballImage = scene.add.image(0, 0, ballTexture);
        
        // Масштабируем изображение в соответствии с размером шара
        ballImage.setDisplaySize(ballSize * 2, ballSize * 2);
        
        // Добавляем легкое свечение
        outline = scene.add.circle(0, 0, ballSize * 1.1, 0xffffff, 0.2);
        
        // Добавляем в контейнер
        container.add([outline, ballImage]);
        
        // Сохраняем ссылку на изображение шара
        ballSprite = ballImage;
      } else {
        // Если текстура не найдена, создаем обычный круг с текстом
        console.warn(`Текстура для шара уровня ${level} не найдена, создаем круг с цветом`);
        
        const ballColor = BALL_COLORS[(level - 1) % BALL_COLORS.length];
        ballSprite = scene.add.circle(0, 0, ballSize, ballColor);
        outline = scene.add.circle(0, 0, ballSize + 2, 0xffffff, 0.3);
        
        // Масштабируем размер текста в зависимости от размера игры
        const scaleFactor = gameWidth / BASE_GAME_WIDTH;
        const fontSize = Math.max(Math.min(14, 10 + level) * scaleFactor, 8);
        
        // Добавляем текст с уровнем
        text = scene.add.text(0, 0, level.toString(), {
          fontFamily: 'Arial',
          fontSize: `${fontSize}px`,
          color: '#ffffff',
          fontWeight: 'bold'
        }).setOrigin(0.5);
        
        // Добавляем элементы в контейнер
        container.add([outline, ballSprite, text]);
      }
    } else {
      // Обычный шар
      const ballColor = BALL_COLORS[(level - 1) % BALL_COLORS.length];
      ballSprite = scene.add.circle(0, 0, ballSize, ballColor);
      outline = scene.add.circle(0, 0, ballSize + 2, 0xffffff, 0.3);
      
      // Масштабируем размер текста в зависимости от размера игры
      const scaleFactor = gameWidth / BASE_GAME_WIDTH;
      const fontSize = Math.max(Math.min(14, 10 + level) * scaleFactor, 8);
      
      // Добавляем текст с уровнем
      text = scene.add.text(0, 0, level.toString(), {
        fontFamily: 'Arial',
        fontSize: `${fontSize}px`,
        color: '#ffffff',
        fontWeight: 'bold'
      }).setOrigin(0.5);
      
      // Добавляем элементы в контейнер
      container.add([outline, ballSprite, text]);
    }
    
    // Добавляем анимацию пульсации для привлечения внимания (для всех типов шаров, кроме Bull)
    if (specialType !== 'Bull') {
      scene.tweens.add({
        targets: container,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }
    
    // Возвращаем объект с шаром
    return {
      sprite: {
        container,
        circle: ballSprite,
        text
      },
      level,
      specialType
    };
  } catch (error) {
    console.error('Ошибка при создании следующего шара:', error);
    return null;
  }
}; 