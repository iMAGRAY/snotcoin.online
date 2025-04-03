import { TranslationKeys } from '../types/translationTypes';

/**
 * Английские переводы
 */
export const enTranslations: TranslationKeys = {
  // Navigation
  mainNavigation: {
    home: 'Home',
    game: 'Game',
    shop: 'Shop',
    faq: 'FAQ',
    about: 'About'
  },
  // Laboratory
  laboratory: {
    title: 'Laboratory',
    upgrades: 'Upgrades',
    research: 'Research'
  },
  // Upgrades
  upgrades: {
    title: 'Upgrades',
    buy: 'Buy',
    level: 'Level {level}',
    maxLevel: 'Max Level',
    cost: 'Cost: {cost}'
  },
  // Common
  common: {
    loading: 'Loading...',
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm',
    back: 'Back',
    next: 'Next',
    close: 'Close',
    yes: 'Yes',
    no: 'No',
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
    info: 'Information'
  },
  // Settings
  settings: {
    title: 'Settings',
    language: 'Language',
    sound: 'Sound',
    music: 'Music',
    notifications: 'Notifications',
    darkMode: 'Dark Mode',
    reset: 'Reset Progress',
    resetConfirm: 'Are you sure you want to reset all progress?'
  },
  // Game
  game: {
    start: 'Start Game',
    pause: 'Pause',
    resume: 'Resume',
    restart: 'Restart',
    quit: 'Quit',
    score: 'Score: {score}',
    level: 'Level: {level}',
    time: 'Time: {time}',
    gameOver: 'Game Over',
    victory: 'Victory!',
    newHighScore: 'New High Score!'
  },
  // Типы для навигационной панели
  storage: 'Storage',
  quests: 'Quests',
  profile: 'Profile',
  
  // Типы для улучшений
  upgrade: 'Upgrade',
  currentLevel: 'Current Level',
  upgradeCost: 'Upgrade Cost',
  currentEffect: 'Current Effect',
  nextEffect: 'Next Effect',
  upgradeButton: 'Upgrade',
  containerCapacity: 'Container Capacity',
  increaseContainerCapacity: 'Increase Container Capacity',
  fillingSpeedUpgrade: 'Filling Speed',
  fillingSpeedDescription: 'Increases the container filling speed',
  snotCoinImage: 'Coin Image',
  upgradeSuccess: 'Upgrade Successful',
  
  // Хранилище
  open: 'Open',
  openChest: 'Open Chest',
  commonChestDescription: 'Common chest with resources',
  rareChestDescription: 'Rare chest with enhanced resources',
  legendaryChestDescription: 'Legendary chest with exclusive items',
  
  // Типы для общих элементов
  retry: 'Retry',
  comingSoon: 'Coming Soon',
  tokenomic: 'Tokenomics',
  
  // Backward compatibility with old keys
  loading: 'Loading',
  error: 'Error',
  close: 'Close',
  
  // Tooltips
  timeToFillTooltip: 'Time until container is full',
  fillTimeTooltip: 'Time until container is full'
}; 