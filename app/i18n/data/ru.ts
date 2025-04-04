import { TranslationKeys } from '../types/translationTypes';

/**
 * Русские переводы
 */
export const ruTranslations: TranslationKeys = {
  // Навигация
  mainNavigation: {
    home: 'Главная',
    game: 'Игра',
    shop: 'Магазин',
    faq: 'Вопросы',
    about: 'О нас'
  },
  // Лаборатория
  laboratory: {
    title: 'Лаборатория',
    upgrades: 'Улучшения',
    research: 'Исследования'
  },
  // Улучшения
  upgrades: {
    title: 'Улучшения',
    buy: 'Купить',
    level: 'Уровень {level}',
    maxLevel: 'Макс. уровень',
    cost: 'Стоимость: {cost}'
  },
  // Общие элементы
  common: {
    loading: 'Загрузка...',
    save: 'Сохранить',
    cancel: 'Отмена',
    confirm: 'Подтвердить',
    back: 'Назад',
    next: 'Далее',
    close: 'Закрыть',
    yes: 'Да',
    no: 'Нет',
    success: 'Успех',
    error: 'Ошибка',
    warning: 'Предупреждение',
    info: 'Информация'
  },
  // Настройки
  settings: {
    title: 'Настройки',
    language: 'Язык',
    sound: 'Звук',
    music: 'Музыка',
    notifications: 'Уведомления',
    darkMode: 'Темная тема',
    reset: 'Сбросить прогресс',
    resetConfirm: 'Вы уверены, что хотите сбросить весь прогресс?'
  },
  // Игра
  game: {
    start: 'Начать игру',
    pause: 'Пауза',
    resume: 'Продолжить',
    restart: 'Рестарт',
    quit: 'Выход',
    score: 'Очки: {score}',
    level: 'Уровень: {level}',
    time: 'Время: {time}',
    gameOver: 'Игра окончена',
    victory: 'Победа!',
    newHighScore: 'Новый рекорд!'
  },
  
  // Типы для навигационной панели
  storage: 'Хранилище',
  quests: 'Задания',
  profile: 'Профиль',
  merge: 'Слияние',
  
  // Типы для улучшений
  upgrade: 'Улучшить',
  currentLevel: 'Текущий уровень',
  upgradeCost: 'Стоимость улучшения',
  currentEffect: 'Текущий эффект',
  nextEffect: 'Следующий эффект',
  upgradeButton: 'Улучшить',
  containerCapacity: 'Вместимость контейнера',
  increaseContainerCapacity: 'Увеличивает вместимость контейнера',
  fillingSpeedUpgrade: 'Скорость наполнения',
  fillingSpeedDescription: 'Увеличивает скорость наполнения контейнера',
  snotCoinImage: 'Изображение монеты',
  upgradeSuccess: 'Улучшение выполнено успешно',
  
  // Хранилище
  open: 'Открыть',
  openChest: 'Открыть сундук',
  commonChestDescription: 'Обычный сундук с ресурсами',
  rareChestDescription: 'Редкий сундук с улучшенными ресурсами',
  legendaryChestDescription: 'Легендарный сундук с эксклюзивными предметами',
  
  // Типы для общих элементов
  retry: 'Повторить',
  comingSoon: 'Скоро будет доступно',
  tokenomic: 'Токеномика',
  
  // Для обратной совместимости со старыми ключами
  loading: 'Загрузка',
  error: 'Ошибка',
  close: 'Закрыть',
  
  // Подсказки
  timeToFillTooltip: 'Время до полного заполнения контейнера',
  fillTimeTooltip: 'Время до полного заполнения контейнера',
  
  // Профиль и аутентификация
  connectFarcaster: 'Подключить Farcaster',
  logout: 'Выйти',
  farcasterInfo: 'Информация Farcaster',
  bio: 'О себе',
  followers: 'Подписчики',
  following: 'Подписки',
  verified: 'Подтвержден',
  location: 'Местоположение',
  consecutiveLoginDays: 'Дней подряд'
}; 