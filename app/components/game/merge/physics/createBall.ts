import * as planck from 'planck';
import { World, Box, Vec2, Circle, Body } from 'planck';
import { Ball } from '../types/index';
import { BALL_COLORS, BALL_DENSITY, BALL_FRICTION, BALL_RESTITUTION, SCALE, BASE_BALL_SIZE, BASE_GAME_WIDTH } from '../constants/gameConstants';
import { Scene } from 'phaser';

// Минимальный размер шара для физики
const MIN_BALL_RADIUS = 0.45;

// Расширенный интерфейс Ball с опциональным полем specialType
export interface Ball {
  body: Body;
  level: number;
  sprite: {
    container: any;
    circle: any;
    text: any;
  };
  originalGameWidth: any;
  specialType: string | undefined;
}

// Интерфейс для совместимости с существующим кодом
export interface ExtendedBall extends Ball {
  specialType?: string;
}

// Функция для расчета размера шара в зависимости от уровня и размера игры
export const getBallSize = (level: number, gameWidth?: number): number => {
  // Прогрессивное увеличение размера: шары растут быстрее с увеличением уровня
  // Начальный размер: 15px для уровня 1
  // Максимальный размер: ~90px для уровня 12, чтобы в игру помещалось не более двух шаров 12 уровня
  // Применяем квадратичную прогрессию для более равномерного визуального роста
  const baseSize = BASE_BALL_SIZE + 4 * (level - 1) + 1.5 * Math.pow(level - 1, 1.5);
  
  // Если передан размер игры, масштабируем шар в зависимости от ширины игрового поля
  if (gameWidth && gameWidth !== BASE_GAME_WIDTH) {
    const scaleFactor = gameWidth / BASE_GAME_WIDTH;
    return Math.max(baseSize * scaleFactor, BASE_BALL_SIZE * 0.5); // Ограничиваем минимальный размер
  }
  
  return baseSize;
};

// Функция для расчета физического размера шара (в единицах физики)
export const getBallPhysicsSize = (level: number, gameWidth?: number): number => {
  // Конвертируем размер из пикселей в физические единицы
  // Используем минимальный радиус для предотвращения проблем с коллизиями
  const physicalSize = getBallSize(level, gameWidth) / SCALE;
  return Math.max(physicalSize, MIN_BALL_RADIUS);
};

// Функция для создания шара с правильными физическими свойствами и спрайтом
export const createBall = (
  scene: any,
  worldRef: React.MutableRefObject<planck.World | null>,
  ballsRef: React.MutableRefObject<Ball[]>,
  x: number,
  y: number,
  level: number,
  specialType?: string
): Ball | null => {
  if (!worldRef.current || !scene) {
    console.error('Не удалось создать шар: нет мира или сцены');
    return null;
  }

  try {
    const world = worldRef.current;
    
    // Получаем текущий размер игры
    const gameWidth = scene.sys.game.config.width || BASE_GAME_WIDTH;
    
    // Создаем тело в физическом мире
    const body = world.createDynamicBody({
      position: planck.Vec2(x / SCALE, y / SCALE),
      allowSleep: true,
      fixedRotation: false,
      bullet: false, // отключаем режим "пули" для оптимизации
      linearDamping: 0.1, // небольшое затухание для предотвращения бесконечных отскоков
    });
    
    // Физический размер шара с учетом масштабирования
    const physicalRadius = getBallPhysicsSize(level, gameWidth);
    
    // Создаем форму круга для физики
    const circleShape = planck.Circle(physicalRadius);
    
    // Настраиваем физические параметры в зависимости от типа шара
    let ballDensity = BALL_DENSITY;
    let ballFriction = BALL_FRICTION;
    let ballRestitution = BALL_RESTITUTION;
    
    // Специальные физические параметры для шара Bull
    if (specialType === 'Bull') {
      ballDensity = BALL_DENSITY * 1.5; // Более тяжелый
      ballFriction = BALL_FRICTION * 0.5; // Меньше трение для лучшего скольжения
      ballRestitution = BALL_RESTITUTION * 1.2; // Более упругий для лучшего отскока
    }
    
    // Создаем фикстуру с правильными параметрами
    const fixture = body.createFixture({
      shape: circleShape,
      density: ballDensity,
      friction: ballFriction,
      restitution: ballRestitution,
      filterGroupIndex: 0, // все шары в одной группе столкновений
    });
    
    // Устанавливаем пользовательские данные для тела
    body.setUserData({
      type: 'ball',
      isBall: true,
      level: level,
      specialType: specialType, // Добавляем тип специального шара
      createdAt: Date.now(),
      gameWidth: gameWidth, // Сохраняем текущий размер игры
    });
    
    // Размер шара в пикселях с учетом масштабирования
    const ballSize = getBallSize(level, gameWidth);
    
    // Определяем цвет шара по уровню
    const color = level <= BALL_COLORS.length 
      ? BALL_COLORS[level - 1] 
      : 0xffffff;
    
    // Создаем контейнер для шара и текста
    const container = scene.add.container(x, y);
    
    let circle, text;
    
    // Проверяем, если это специальный шар Bull
    if (specialType === 'Bull') {
      // Используем изображение Bull.webp вместо обычного шара
      const bullImage = scene.add.image(0, 0, 'bull-ball');
      
      // Масштабируем изображение в соответствии с размером шара
      bullImage.setDisplaySize(ballSize * 2.5, ballSize * 2.5);
      
      // Добавляем свечение вокруг шара
      const outline = scene.add.circle(0, 0, ballSize * 1.3, 0xff0000, 0.3);
      
      // Добавляем в контейнер
      container.add([outline, bullImage]);
      
      // Сохраняем ссылку на основной элемент шара
      circle = bullImage;
      
      // Устанавливаем высокую глубину отображения
      container.setDepth(100); // Высокое значение для отображения поверх других элементов
      
      // Добавляем эффект пульсации свечения
      scene.tweens.add({
        targets: outline,
        alpha: { from: 0.3, to: 0.7 },
        scale: { from: 1, to: 1.2 },
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
      
      // Добавляем анимацию вращения
      scene.tweens.add({
        targets: bullImage,
        angle: '+=5',
        duration: 3000,
        repeat: -1,
        ease: 'Linear'
      });
    } else if (level >= 1 && level <= 6 || level === 12) {
      // Используем изображения для шаров уровней от 1 до 6 и 12
      // Загружаем изображение шара соответствующего уровня
      const ballTexture = `${level}`;
      
      // Проверяем, существует ли такая текстура в кэше
      if (scene.textures.exists(ballTexture)) {
        const ballImage = scene.add.image(0, 0, ballTexture);
        
        // Масштабируем изображение в соответствии с размером шара
        ballImage.setDisplaySize(ballSize * 2, ballSize * 2);
        
        // Добавляем в контейнер
        container.add(ballImage);
        
        // Сохраняем ссылку на основной элемент шара
        circle = ballImage;
        
        // Устанавливаем глубину отображения
        container.setDepth(10 + level);
      } else {
        // Если текстура не найдена, создаем круг с цветом по умолчанию
        console.warn(`Текстура для шара уровня ${level} не найдена, создаем круг с цветом`);
        circle = scene.add.circle(0, 0, ballSize, color);
        
        // Масштабируем размер текста в зависимости от размера шара
        const scaleFactor = gameWidth / BASE_GAME_WIDTH;
        const fontSize = Math.max(Math.min(18, 12 + level) * scaleFactor, 8);
        
        // Добавляем текст с уровнем
        text = scene.add.text(0, 0, level.toString(), {
          fontFamily: 'Arial',
          fontSize: `${fontSize}px`,
          color: '#ffffff',
          fontStyle: 'bold',
        });
        text.setOrigin(0.5, 0.5);
        
        // Добавляем визуальные элементы в контейнер
        container.add(circle);
        if (text) container.add(text);
        
        // Настраиваем глубину отображения
        container.setDepth(10 + level);
      }
    } else {
      // Создаем визуальное представление обычного шара
      circle = scene.add.circle(0, 0, ballSize, color);
      
      // Масштабируем размер текста в зависимости от размера шара
      const scaleFactor = gameWidth / BASE_GAME_WIDTH;
      const fontSize = Math.max(Math.min(18, 12 + level) * scaleFactor, 8); // Ограничиваем минимальный размер
      
      // Добавляем текст с уровнем
      const textStyle = {
        fontFamily: 'Arial',
        fontSize: `${fontSize}px`,
        color: '#ffffff',
        fontStyle: 'bold',
      };
      
      text = scene.add.text(0, 0, level.toString(), textStyle);
      text.setOrigin(0.5, 0.5);
      
      // Добавляем визуальные элементы в контейнер
      container.add(circle);
      container.add(text);
      
      // Настраиваем глубину отображения, чтобы шары были поверх фона
      container.setDepth(10 + level);
    }
    
    // Создаем объект шара
    const ball: Ball = {
      body,
      level,
      sprite: {
        container,
        circle,
        text,
      },
      originalGameWidth: gameWidth, // Сохраняем размер игры при создании шара
      specialType: specialType // Добавляем тип специального шара
    };
    
    // Специальные эффекты для максимального уровня
    if (level === 12) {
      // Создаем контейнер для эффектов
      const effectsContainer = scene.add.container(x, y);
      effectsContainer.setDepth(30); // поверх всех шаров
      
      // Добавляем свечение
      const glow = scene.add.circle(0, 0, ballSize * 1.15, 0xf2cc8f, 0.3);
      effectsContainer.add(glow);
      
      // Добавляем частицы
      try {
        const particles = scene.add.particles(0, 0, 'flare', {
          speed: 20,
          scale: { start: 0.3, end: 0 },
          blendMode: 'ADD',
          lifespan: 500,
          frequency: 100,
        });
        effectsContainer.add(particles);
      } catch (e) {
        console.warn('Не удалось создать частицы для макс. уровня:', e);
      }
      
      // Анимация пульсации
      scene.tweens.add({
        targets: glow,
        alpha: 0.7,
        scale: 1.1,
        duration: 800,
        yoyo: true,
        repeat: -1,
      });
      
      // Сохраняем эффекты
      ball.sprite.effectsContainer = effectsContainer;
    }
    
    // Добавляем шар в массив шаров
    ballsRef.current.push(ball);
    
    // Добавляем небольшое начальное вращение для более естественной физики
    if (!body.isStatic() && !body.isKinematic()) {
      const randomAngularVelocity = (Math.random() - 0.5) * 2; // от -1 до 1
      body.setAngularVelocity(randomAngularVelocity);
    }
    
    return ball;
  } catch (error) {
    console.error('Ошибка при создании шара:', error);
    return null;
  }
};

// Создаем визуальное представление для шара
const createVisualBall = (bodyRef: any, ballDetails: ExtendedBall, scene: Scene, gameWidth: number, worldRef: React.MutableRefObject<World>) => {
  try {
    const ball = ballDetails.body;
    if (!ball || !ballDetails || !scene || !worldRef.current) {
      return;
    }

    const level = ballDetails.level;
    const specialType = ballDetails.specialType;
    let ballSprite, text;

    const pos = ball.getPosition();
    const radius = ball.getCircle().r;
    const ballSize = radius * 30; // Переводим из физического размера в пиксели

    // Контейнер для шара и всех его элементов
    const container = scene.add.container(pos.x * 30, pos.y * 30);
    container.setDepth(level + 10); // Устанавливаем глубину отображения в зависимости от уровня

    // Для специального типа "Bull" создаем уникальный шар
    if (specialType === 'Bull') {
      if (scene.textures.exists('bull-ball')) {
        const bullImage = scene.add.image(0, 0, 'bull-ball');
        bullImage.setDisplaySize(ballSize * 2.5, ballSize * 2.5); // Делаем немного больше

        // Добавляем красное свечение
        const glow = scene.add.circle(0, 0, ballSize * 1.3, 0xff0000, 0.3);
        container.add([glow, bullImage]);

        // Добавляем текст "BULL" на шаре
        const specialText = scene.add.text(0, ballSize * 0.7, 'BULL', {
          fontFamily: 'Arial',
          fontSize: '12px',
          color: '#ffffff',
          fontWeight: 'bold',
          stroke: '#ff0000',
          strokeThickness: 2
        }).setOrigin(0.5);
        container.add(specialText);

        // Анимация вращения
        scene.tweens.add({
          targets: bullImage,
          angle: '+=5',
          duration: 3000,
          repeat: -1,
          ease: 'Linear'
        });

        // Анимация пульсации свечения
        scene.tweens.add({
          targets: glow,
          alpha: { from: 0.3, to: 0.7 },
          scale: { from: 1, to: 1.2 },
          duration: 700,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });

        ballSprite = bullImage;
      } else {
        // Запасной вариант, если текстура не найдена
        ballSprite = scene.add.circle(0, 0, ballSize, 0xff0000);
        const glow = scene.add.circle(0, 0, ballSize * 1.2, 0xff0000, 0.3);
        text = scene.add.text(0, 0, 'BULL', {
          fontFamily: 'Arial',
          fontSize: '14px',
          color: '#ffffff',
          fontWeight: 'bold'
        }).setOrigin(0.5);
        container.add([glow, ballSprite, text]);
      }
    } 
    // Для уровней 1, 2, 3, 4, 5, 6, и 12 используем изображения
    else if (level >= 1 && level <= 6 || level === 12) {
      const ballTexture = `${level}`;
      
      if (scene.textures.exists(ballTexture)) {
        // Используем изображение для текущего уровня
        const ballImage = scene.add.image(0, 0, ballTexture);
        ballImage.setDisplaySize(ballSize * 2, ballSize * 2);
        
        // Добавляем легкое свечение
        const glow = scene.add.circle(0, 0, ballSize * 1.1, 0xffffff, 0.2);
        container.add([glow, ballImage]);
        
        // Для максимального уровня (12) добавляем особые эффекты
        if (level === 12) {
          // Добавляем более сильное свечение для уровня 12
          const maxLevelGlow = scene.add.circle(0, 0, ballSize * 1.4, 0xffff00, 0.5);
          container.add(maxLevelGlow);
          container.sendToBack(maxLevelGlow);
          
          // Добавляем анимацию пульсации свечения
          scene.tweens.add({
            targets: maxLevelGlow,
            alpha: { from: 0.3, to: 0.7 },
            scale: { from: 1, to: 1.2 },
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
          });
          
          // Добавляем частицы вокруг шара
          const particles = scene.add.particles('particle');
          const emitter = particles.createEmitter({
            speed: 50,
            scale: { start: 0.2, end: 0 },
            blendMode: 'ADD',
            lifespan: 1000,
            frequency: 200,
            tint: 0xffd700
          });
          emitter.startFollow(container);
          
          // Установка частиц под шаром в иерархии отображения
          container.sendToBack(particles);
        }
        
        ballSprite = ballImage;
      } else {
        // Если текстура не найдена, создаем круг с цветом
        console.warn(`Текстура для шара уровня ${level} не найдена, создаем цветной круг`);
        
        const ballColor = BALL_COLORS[(level - 1) % BALL_COLORS.length];
        ballSprite = scene.add.circle(0, 0, ballSize, ballColor);
        const glow = scene.add.circle(0, 0, ballSize + 2, 0xffffff, 0.3);
        
        // Масштабируем размер текста в зависимости от размера игры
        const scaleFactor = gameWidth / BASE_GAME_WIDTH;
        const fontSize = Math.max(Math.min(14, 10 + level) * scaleFactor, 8);
        
        text = scene.add.text(0, 0, level.toString(), {
          fontFamily: 'Arial',
          fontSize: `${fontSize}px`,
          color: '#ffffff',
          fontWeight: 'bold'
        }).setOrigin(0.5);
        
        container.add([glow, ballSprite, text]);
      }
    } else {
      // ... existing code ...
    }
  } catch (error) {
    console.error('Ошибка при создании визуального шара:', error);
  }
}; 