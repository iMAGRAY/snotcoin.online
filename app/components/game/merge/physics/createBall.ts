import * as planck from 'planck';
import { World, Box, Vec2, Circle, Body } from 'planck';
import { ExtendedBall } from '../types';
import { BALL_COLORS, BALL_DENSITY, BALL_FRICTION, BALL_RESTITUTION, SCALE, BASE_BALL_SIZE, BASE_GAME_WIDTH } from '../constants/gameConstants';
import { Scene } from 'phaser';
import { getBallSize as getBallSizeUtil, getBallPhysicsSize as getBallPhysicsSizeUtil, hasUserDataProperty as hasUserDataPropertyUtil } from '../utils/ballUtils';

// Минимальный размер шара для физики
const MIN_BALL_RADIUS = 0.3;

// Базовая скорость движения шаров
const BASE_VELOCITY = 0.4;

// Реэкспортируем функции для обратной совместимости
export const getBallSize = getBallSizeUtil;
export const getBallPhysicsSize = getBallPhysicsSizeUtil;
export const hasUserDataProperty = hasUserDataPropertyUtil;

// Определяем интерфейс для шара в этом файле
export interface LocalBall {
  body: planck.Body;
  level: number;
  sprite: {
    container: any;
    circle: any; 
    text: any;
    effectsContainer?: any;
    glow?: any;
    stars?: any[];
  };
  originalGameWidth: number;
  specialType?: string | undefined;
  userData?: {
    isBall: boolean;
    level: number;
    specialType?: string;
    createdAt: number;
  };
}

// Функция для создания шара с правильными физическими свойствами и спрайтом
export const createBall = (
  scene: any,
  worldRef: React.MutableRefObject<planck.World | null>,
  ballsRef: React.MutableRefObject<LocalBall[]>,
  x: number,
  y: number,
  level: number,
  specialType?: string
): LocalBall | null => {
  if (!worldRef.current || !scene) {
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
      linearDamping: 0.05, // уменьшаем затухание для более быстрого движения шаров
    });
    
    // Физический размер шара с учетом масштабирования
    const physicalRadius = getBallPhysicsSize(level, gameWidth, specialType);
    
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
      exploded: false, // Добавляем флаг для бомбы, чтобы избежать повторного взрыва
      lastPosition: { x: x, y: y }, // Добавляем последнюю визуальную позицию для интерполяции
      lastMoved: Date.now(), // Время последнего движения для отслеживания зависших шаров
    });
    
    // Размер шара в пикселях с учетом масштабирования
    const ballSize = getBallSize(level, gameWidth);
    
    // Определяем цвет шара по уровню
    const color = level <= BALL_COLORS.length 
      ? BALL_COLORS[level - 1] 
      : 0xffffff;
    
    // Создаем контейнер для шара и текста
    const container = scene.add.container(x, y);
    
    // Предотвращаем артефакты интерполяции текстур
    scene.renderer.pipelines.renderer.antialias = true;
    scene.renderer.pipelines.renderer.roundPixels = false;
    
    let circle, text;
    
    // Проверяем, если это специальный шар Bull
    if (specialType === 'Bull') {
      // Используем изображение bull.webp вместо обычного шара
      // Предзагружаем текстуру, если ее еще нет в кэше
      if (!scene.textures.exists('bull-ball')) {
        scene.textures.addBase64('bull-ball', '/images/balls/bull.png');
      }
      
      const bullImage = scene.add.image(0, 0, 'bull-ball');
      
      // Улучшенная обработка текстур для предотвращения моргания
      bullImage.setOrigin(0.5, 0.5);
      bullImage.setTexture('bull-ball');
      
      // Устанавливаем антиалиасинг для более плавных границ
      bullImage.setInteractive();
      
      // Масштабируем изображение в соответствии с размером шара
      bullImage.setDisplaySize(ballSize * 2.2, ballSize * 2.2);
      
      // Добавляем свечение вокруг шара
      const outline = scene.add.circle(0, 0, ballSize * 1.2, 0xff0000, 0.3);
      
      // Добавляем в контейнер
      container.add([outline, bullImage]);
      
      // Сохраняем ссылку на основной элемент шара
      circle = bullImage;
      
      // Устанавливаем высокую глубину отображения с уникальным значением на основе уровня и времени создания
      const uniqueDepth = 100 + (Date.now() % 100) * 0.001;
      container.setDepth(uniqueDepth);
    } else if (specialType === 'Bomb') {
      // Аналогичные улучшения для шара типа Bomb
      // Предзагружаем текстуру, если ее еще нет в кэше
      if (!scene.textures.exists('bomb')) {
        scene.textures.addBase64('bomb', '/images/balls/bomb.png');
      }
      
      const bombImage = scene.add.image(0, 0, 'bomb');
      
      // Улучшенная обработка текстур
      bombImage.setOrigin(0.5, 0.5);
      bombImage.setTexture('bomb');
      
      // Устанавливаем антиалиасинг для более плавных границ
      bombImage.setInteractive();
      
      // Масштабируем изображение в соответствии с размером шара
      bombImage.setDisplaySize(ballSize * 2.0, ballSize * 2.0);
      
      // Добавляем свечение вокруг бомбы
      const outline = scene.add.circle(0, 0, ballSize * 1.2, 0xff0000, 0.3);
      
      // Добавляем в контейнер
      container.add([outline, bombImage]);
      
      // Сохраняем ссылку на основной элемент шара
      circle = bombImage;
      
      // Устанавливаем высокую глубину отображения с уникальным значением
      const uniqueDepth = 100 + (Date.now() % 100) * 0.001;
      container.setDepth(uniqueDepth);
    } else if (level >= 1 && level <= 12) {
      // Используем изображения для шаров уровней от 1 до 12 (монеты SNOTCOIN)
      const ballTexture = `${level}`;
      
      // Проверяем, существует ли такая текстура в кэше
      if (scene.textures.exists(ballTexture)) {
        const ballImage = scene.add.image(0, 0, ballTexture);
        
        // Улучшенная обработка текстур
        ballImage.setOrigin(0.5, 0.5);
        
        // Устанавливаем антиалиасинг
        ballImage.setInteractive();
        
        // Масштабируем изображение в соответствии с размером шара
        // Немного уменьшаем множитель с 1.8 до 1.75 для более точного соответствия физике
        ballImage.setDisplaySize(ballSize * 1.75, ballSize * 1.75);
        
        // Добавляем в контейнер
        container.add(ballImage);
        
        // Сохраняем ссылку на основной элемент шара
        circle = ballImage;
        
        // Устанавливаем глубину отображения с уникальным значением на основе Y-позиции и уровня
        // Это предотвратит "прыжки" z-index при наложении шаров
        const baseDepth = y + (level * 0.01);
        container.setDepth(baseDepth);
      } else {
        // Если текстура не найдена, создаем круг с цветом по умолчанию (запасной вариант)
        circle = scene.add.circle(0, 0, ballSize, color);
        
        // Масштабируем размер текста в зависимости от размера шара
        const scaleFactor = gameWidth / BASE_GAME_WIDTH;
        const fontSize = Math.max(Math.min(18, 12 + level) * scaleFactor, 8);
        
        // Добавляем текст с уровнем
        text = scene.add.text(0, 0, level.toString(), {
          fontFamily: 'Arial',
          fontSize: `${fontSize}px`,
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 2
        }).setOrigin(0.5);
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
        stroke: '#000000',
        strokeThickness: 2
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
    const ball: LocalBall = {
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
    
    // Добавляем эффекты частиц для шара максимального уровня
    if (level === 12) {
      try {
        // Создаем контейнер для эффектов
        const effectsContainer = scene.add.container(x, y);
        effectsContainer.setDepth(100); // Высокая глубина для эффектов над другими объектами
        
        // Проверяем наличие текстуры частиц
        if (scene.textures.exists('particle')) {
          // Создаем более простой эффект частиц без использования сложного API
          const particlesContainer = scene.add.container(0, 0);
          
          // Добавляем простые частицы как спрайты
          for (let i = 0; i < 10; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * ballSize * 2;
            const particle = scene.add.circle(
              Math.cos(angle) * distance,
              Math.sin(angle) * distance,
              ballSize * 0.1,
              0xffd700,
              0.7
            );
            
            particlesContainer.add(particle);
            
            // Анимируем частицы
            scene.tweens.add({
              targets: particle,
              alpha: 0,
              scale: 0,
              x: particle.x * 1.5,
              y: particle.y * 1.5,
              duration: 1000 + Math.random() * 1000,
              repeat: -1,
              yoyo: false,
              repeatDelay: Math.random() * 500
            });
          }
          
          // Добавляем контейнер с частицами в контейнер эффектов
          effectsContainer.add(particlesContainer);
        }
        
        // Добавляем свечение
        const glow = scene.add.image(0, 0, 'flare');
        glow.setBlendMode('ADD');
        glow.setAlpha(0.3);
        glow.setScale(1.1);
        glow.setTint(0xffff00);
        effectsContainer.add(glow);
        
        // Анимация свечения
        scene.tweens.add({
          targets: glow,
          scale: 1.3,
          alpha: 0.5,
          duration: 1000,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
        
        // Добавляем 5 звезд вокруг шара
        const stars = [];
        for (let i = 0; i < 5; i++) {
          const angle = i * (Math.PI * 2) / 5;
          const distance = ballSize * 2;
          
          const star = scene.add.image(
            Math.cos(angle) * distance,
            Math.sin(angle) * distance,
            'flare'
          );
          
          star.setScale(0.5);
          star.setAlpha(0.7);
          star.setTint(0xffd700);
          effectsContainer.add(star);
          stars.push(star);
          
          // Вращение звезд вокруг шара
          scene.tweens.add({
            targets: star,
            x: Math.cos(angle + Math.PI * 2) * distance,
            y: Math.sin(angle + Math.PI * 2) * distance,
            duration: 3000 + i * 500,
            repeat: -1,
            ease: 'Linear'
          });
          
          // Пульсация звезд
          scene.tweens.add({
            targets: star,
            scale: 0.7,
            alpha: 1,
            duration: 800 + i * 200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
          });
        }
        
        // Сохраняем ссылки на эффекты
        ball.sprite.effectsContainer = effectsContainer;
        ball.sprite.glow = glow;
        ball.sprite.stars = stars;
        
      } catch (e) {
        // Не удалось создать частицы для макс. уровня
      }
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
    // Ошибка при создании шара
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
    
    // Исправляем получение радиуса - используем фикстуру
    let radius = 0;
    const fixture = ball.getFixtureList();
    if (fixture) {
      const shape = fixture.getShape();
      if (shape.getType() === 'circle') {
        // Безопасное приведение типа
        const circleShape = shape as any;
        radius = circleShape.getRadius();
      }
    }
    
    const ballSize = radius * 30; // Переводим из физического размера в пиксели

    // Создаем контейнер для шара и всех его элементов
    const container = scene.add.container(pos.x * 30, pos.y * 30);
    
    // Устанавливаем z-index на основе уровня И позиции Y
    // Это важно для правильного отображения перекрывающихся шаров
    container.setDepth(pos.y * 30 + level + 10);

    // Для специального типа "Bull" создаем уникальный шар
    if (specialType === 'Bull') {
      if (scene.textures.exists('bull-ball')) {
        const bullImage = scene.add.image(0, 0, 'bull-ball');
        bullImage.setDisplaySize(ballSize * 2.5, ballSize * 2.5); // Делаем немного больше

        // Добавляем красное свечение
        const glow = scene.add.circle(0, 0, ballSize * 1.3, 0xff0000, 0.3);
        container.add([glow, bullImage]);

        // Добавляем текст "BULL" на шаре с исправленными стилями
        const specialText = scene.add.text(0, ballSize * 0.7, 'BULL', {
          fontFamily: 'Arial',
          fontSize: '12px',
          color: '#ffffff',
          stroke: '#ff0000',
          strokeThickness: 2,
          fontStyle: 'bold'
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
          fontStyle: 'bold'
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
          // Используем более простой способ создания частиц
          try {
            // Создаем контейнер для частиц
            const particlesContainer = scene.add.container(0, 0);
            
            // Добавляем простые частицы как спрайты
            for (let i = 0; i < 10; i++) {
              const angle = Math.random() * Math.PI * 2;
              const distance = Math.random() * ballSize * 2;
              const particle = scene.add.circle(
                Math.cos(angle) * distance,
                Math.sin(angle) * distance,
                ballSize * 0.1, 
                0xffd700,
                0.7
              );
              
              particlesContainer.add(particle);
              
              // Анимируем частицы
              scene.tweens.add({
                targets: particle,
                alpha: 0,
                scale: 0,
                x: particle.x * 1.5,
                y: particle.y * 1.5,
                duration: 1000 + Math.random() * 1000,
                repeat: -1,
                yoyo: false,
                repeatDelay: Math.random() * 500
              });
            }
            
            // Привязываем контейнер с частицами к контейнеру шара
            container.add(particlesContainer);
          } catch (error) {
            console.error('Ошибка при создании частиц для максимального уровня:', error);
          }
          
          ballSprite = ballImage;
        }
        
        ballSprite = ballImage;
      } else {
        // Если текстура не найдена, создаем круг с цветом
        ballSprite = scene.add.circle(0, 0, ballSize, 0xffffff);
        const glow = scene.add.circle(0, 0, ballSize + 2, 0xffffff, 0.3);
        
        // Масштабируем размер текста в зависимости от размера игры
        const scaleFactor = gameWidth / BASE_GAME_WIDTH;
        const fontSize = Math.max(Math.min(14, 10 + level) * scaleFactor, 8);
        
        text = scene.add.text(0, 0, level.toString(), {
          fontFamily: 'Arial',
          fontSize: `${fontSize}px`,
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 2
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