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
    
    // Создаем шар в зависимости от специального типа
    if (specialType === 'Bull') {
      // Заменяем рисованный шар на изображение
      const bullImage = scene.add.image(0, 0, 'bull-ball');
      
      // Масштабируем изображение в соответствии с размером шара, делаем его немного больше
      bullImage.setDisplaySize(ballSize * 2.5, ballSize * 2.5);
      
      // Добавляем легкое свечение вокруг шара, увеличиваем радиус свечения
      outline = scene.add.circle(0, 0, ballSize * 1.3, 0xff0000, 0.3);
      
      // Добавляем в контейнер
      container.add([outline, bullImage]);
      
      // Добавляем анимацию вращения
      scene.tweens.add({
        targets: bullImage,
        angle: '+=5',
        duration: 3000,
        repeat: -1,
        ease: 'Linear'
      });
      
      // Добавляем эффект пульсации свечения для большей привлекательности
      scene.tweens.add({
        targets: outline,
        alpha: { from: 0.3, to: 0.7 },
        scale: { from: 1, to: 1.2 },
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
      
      // Устанавливаем глубину отображения
      container.setDepth(100); // Высокое значение для отображения поверх других элементов
      
      // Сохраняем ссылку на изображение шара
      ballSprite = bullImage;
    } else if (specialType === 'Bomb') {
      // Бомба (черный шар с фитилем)
      ballSprite = scene.add.circle(0, 0, ballSize, 0x000000); // Черный
      outline = scene.add.circle(0, 0, ballSize + 2, 0xff0000, 0.5); // Красное свечение
      
      // Добавляем фитиль
      const fuse = scene.add.graphics();
      fuse.lineStyle(2, 0xff8800, 1);
      fuse.beginPath();
      fuse.moveTo(0, -ballSize);
      fuse.lineTo(0, -ballSize*1.5);
      fuse.lineTo(ballSize/2, -ballSize*1.8);
      fuse.stroke();
      
      // Добавляем огонь на фитиле
      const flame = scene.add.circle(ballSize/2, -ballSize*1.8, ballSize/4, 0xff4400);
      
      // Добавляем блики на бомбе
      const highlight = scene.add.circle(-ballSize/2.5, -ballSize/2.5, ballSize/6, 0xffffff, 0.6);
      
      // Добавляем все элементы в контейнер
      container.add([outline, ballSprite, fuse, flame, highlight]);
      
      // Добавляем текст BOMB
      text = scene.add.text(0, 0, 'BOMB', {
        fontFamily: 'Arial',
        fontSize: `${Math.max(ballSize / 3, 10)}px`,
        color: '#ffffff',
        fontWeight: 'bold'
      }).setOrigin(0.5);
      container.add(text);
      
      // Добавляем анимацию мигания для бомбы
      scene.tweens.add({
        targets: outline,
        alpha: { from: 0.2, to: 0.8 },
        duration: 400,
        yoyo: true,
        repeat: -1
      });
      
      // Анимируем огонь
      scene.tweens.add({
        targets: flame,
        scaleX: { from: 0.8, to: 1.2 },
        scaleY: { from: 0.8, to: 1.2 },
        duration: 300,
        yoyo: true,
        repeat: -1
      });
    } else if (level === 1 || level === 2 || level === 12) {
      // Для шаров уровней 1, 2 и 12 используем изображения
      const ballTexture = `${level}`;
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
    
    return {
      sprite: { container, circle: ballSprite, text, outline },
      level,
      specialType
    };
  } catch (error) {
    console.error('Ошибка в функции createNextBall:', error);
    return null;
  }
}; 