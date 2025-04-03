// Настройки отладки
export const DEBUG_PHYSICS = false;

// Константы для шаров разных уровней
export const MAX_LEVEL = 12;
export const BASE_BALL_SIZE = 15;
export const BASE_GAME_WIDTH = 360; // Базовая ширина игры для расчета масштаба
export const BALL_COLORS = [
  0xf94144, // уровень 1 - красный
  0xf3722c, // уровень 2 - оранжевый
  0xf8961e, // уровень 3 - тёмно-оранжевый
  0xf9c74f, // уровень 4 - жёлтый
  0x90be6d, // уровень 5 - светло-зелёный
  0x43aa8b, // уровень 6 - зелёный
  0x4d908e, // уровень 7 - бирюзовый
  0x577590, // уровень 8 - голубой
  0x277da1, // уровень 9 - синий
  0x9c6ade, // уровень 10 - фиолетовый
  0xd66ba0, // уровень 11 - розовый
  0xf2cc8f  // уровень 12 - золотой
];

// Размеры и цвета
export const PLAYER_SIZE = 25;
export const PLAYER_COLOR = 0xbbeb25;
export const FLOOR_COLOR = 0x2a3b4d;
export const WALL_COLOR = 0x4a7a9e;
export const BACKGROUND_COLOR = 0x000000;
export const FOOTER_HEIGHT = 96; // Увеличено в 4 раза (с 24px до 96px)
export const FOOTER_HEIGHT_MOBILE = 64; // Увеличено в 4 раза (с 16px до 64px)
export const HEADER_HEIGHT = 80; // 80px на десктопе
export const HEADER_HEIGHT_MOBILE = 64; // 64px на мобильных
export const PHYSICAL_FLOOR_HEIGHT = 10; // Высота физического пола в пикселях

// Соотношение сторон игрового поля
export const GAME_ASPECT_RATIO = 0.667; // соотношение сторон игры (ширина к высоте 2:3)

// Константа для настройки разброса шаров при броске
export const THROW_X_VARIATION = 0.05; // Уменьшено для более предсказуемых бросков

// Константы физики
export const SCALE = 30; // масштаб между пикселями и физическими единицами
export const TIME_STEP = 1 / 20; // Уменьшено для замедления физики в 2 раза
export const VELOCITY_ITERATIONS = 8; // Увеличено для более точной обработки коллизий
export const POSITION_ITERATIONS = 3; // Увеличено для более точной обработки коллизий

// Скорость падения (гравитация)
export const GRAVITY_Y = 1.25; // Уменьшено в 2 раза для более медленного падения

// Константа для позиции шара по вертикали
export const FIXED_PLAYER_Y = 80; // пикселей от верха
export const PHYSICS_PLAYER_Y = FIXED_PLAYER_Y / SCALE; // переводим в физические единицы

// Частота проверки слияния шаров
export const CHECK_MERGE_FREQUENCY = 5; // Уменьшено для более частых проверок

// Максимальное количество шаров
export const MAX_BALLS_COUNT = 40; // Оптимизировано для производительности

// Константы для физического взаимодействия шаров
export const BALL_DENSITY = 2.0; // Значительно увеличена плотность шаров
export const BALL_FRICTION = 0.2; // Увеличено трение для лучшего контакта
export const BALL_RESTITUTION = 0.5; // Увеличена упругость для более активных столкновений

// Константы для броска шаров
export const THROW_VELOCITY_Y = 1.0; // Уменьшено до 1.0 как запрошено

// Константы для удаления "застрявших" шаров - устанавливаем очень высокие значения, чтобы шары не исчезали
export const STUCK_THRESHOLD_VELOCITY = 0.001; // Очень низкий порог, практически не удаляются
export const STUCK_TIME_MS = 99999999; // Очень долгое время ожидания - по сути никогда не исчезнут
export const FALL_TIMEOUT_MS = 99999999; // Шары никогда не будут удаляться из-за времени 