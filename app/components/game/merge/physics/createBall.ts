import * as planck from 'planck';
import { Ball } from '../types';
import { BALL_COLORS, BALL_DENSITY, BALL_FRICTION, BALL_RESTITUTION, SCALE, BASE_BALL_SIZE, BASE_GAME_WIDTH } from '../constants/gameConstants';

// Минимальный размер шара для физики
const MIN_BALL_RADIUS = 0.45;

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
  level: number
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
    
    // Создаем фикстуру с правильными параметрами
    const fixture = body.createFixture({
      shape: circleShape,
      density: BALL_DENSITY,
      friction: BALL_FRICTION,
      restitution: BALL_RESTITUTION,
      filterGroupIndex: 0, // все шары в одной группе столкновений
    });
    
    // Устанавливаем пользовательские данные для тела
    body.setUserData({
      isBall: true,
      level: level,
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
    
    // Создаем визуальное представление шара
    const circle = scene.add.circle(0, 0, ballSize, color);
    
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
    
    const text = scene.add.text(0, 0, level.toString(), textStyle);
    text.setOrigin(0.5, 0.5);
    
    // Добавляем визуальные элементы в контейнер
    container.add(circle);
    container.add(text);
    
    // Настраиваем глубину отображения, чтобы шары были поверх фона
    container.setDepth(10 + level);
    
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