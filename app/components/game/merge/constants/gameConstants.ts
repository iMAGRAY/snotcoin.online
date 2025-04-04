// Настройки отладки
export const DEBUG_PHYSICS = false;

// Константы для шаров разных уровней
export const MAX_LEVEL = 12;
export const BASE_BALL_SIZE = 13;
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

// Специальные шары
export const BOMB_COLOR = 0x000000; // Черный для шара Bomb
export const BULL_COLOR = 0xff0000; // Красный для шара Bull

// Размеры и цвета
export const PLAYER_SIZE = 20;
export const PLAYER_COLOR = 0xbbeb25;
export const FLOOR_COLOR = 0x2a3b4d;
export const WALL_COLOR = 0x4a7a9e;
export const BACKGROUND_COLOR = 0x1e293b;
export const FOOTER_HEIGHT = 96; // Увеличено в 4 раза (с 24px до 96px)
export const FOOTER_HEIGHT_MOBILE = 64; // Увеличено в 4 раза (с 16px до 64px)
export const HEADER_HEIGHT = 80; // 80px на десктопе
export const HEADER_HEIGHT_MOBILE = 64; // 64px на мобильных
export const PHYSICAL_FLOOR_HEIGHT = 10; // Высота физического пола в пикселях

// Соотношение сторон игрового поля
export const GAME_ASPECT_RATIO = 0.749; // соотношение сторон игры (ширина к высоте 2:2.67)

// Константа для настройки разброса шаров при броске
export const THROW_X_VARIATION = 0.05; // Уменьшено для более предсказуемых бросков

// Константы физики
export const SCALE = 30; // масштаб между пикселями и физическими единицами
export const TIME_STEP = 1 / 60; // Частота обновления физики
export const VELOCITY_ITERATIONS = 10; // Возвращаю к прежнему значению для ускорения обработки
export const POSITION_ITERATIONS = 8; // Возвращаю к прежнему значению для оптимизации скорости

// Скорость падения (гравитация)
export const GRAVITY_Y = 15.0; // Значительно увеличиваю гравитацию, чтобы шары падали быстрее

// Константа для позиции шара по вертикали
export const FIXED_PLAYER_Y = 45; // пикселей от верха (изменено с 60 на 45)
export const PHYSICS_PLAYER_Y = FIXED_PLAYER_Y / SCALE; // переводим в физические единицы

// Частота проверки слияния шаров
export const CHECK_MERGE_FREQUENCY = 1; // Каждый кадр проверяем слияние

// Максимальное количество шаров
export const MAX_BALLS_COUNT = 40; // Оптимизировано для производительности

// Константы для физического взаимодействия шаров
export const BALL_DENSITY = 2.0; // Немного уменьшаю плотность шаров для более быстрого движения
export const BALL_FRICTION = 0.1; // Значительно уменьшаю трение для лучшего скольжения
export const BALL_RESTITUTION = 0.5; // Уменьшаю упругость для меньшей прыгучести

// Константы для броска шаров
export const THROW_VELOCITY_Y = 3.0; // Значительно увеличиваю скорость броска шаров

// Константы для удаления "застрявших" шаров - устанавливаем очень высокие значения, чтобы шары не исчезали
export const STUCK_THRESHOLD_VELOCITY = 0.001; // Очень низкий порог, практически не удаляются
export const STUCK_TIME_MS = 99999999; // Очень долгое время ожидания - по сути никогда не исчезнут
export const FALL_TIMEOUT_MS = 99999999; // Шары никогда не будут удаляться из-за времени 