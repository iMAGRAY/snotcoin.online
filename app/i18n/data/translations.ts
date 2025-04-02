/**
 * Устаревший файл со старыми переводами.
 * Используйте отдельные файлы ru.ts и en.ts
 * @deprecated
 */

import { TranslationDictionary } from '../types/translationTypes';

interface OldTranslations {
  [lang: string]: TranslationDictionary;
}

export const translations: OldTranslations = {
  ru: {
    // Навигация
    merge: 'Слияние',
    laboratory: 'Лаборатория', 
    storage: 'Хранилище',
    quests: 'Задания',
    profile: 'Профиль',
    
    // Вкладки
    mergeTab: 'Слияние',
    laboratoryTab: 'Лаборатория',
    storageTab: 'Хранилище',
    questsTab: 'Задания',
    
    // Улучшения
    upgrade: 'Улучшить',
    currentLevel: 'Текущий уровень',
    upgradeCost: 'Стоимость улучшения',
    currentEffect: 'Текущий эффект',
    nextEffect: 'Следующий эффект',
    upgradeButton: 'Улучшить',
    containerCapacity: 'Вместимость контейнера',
    increaseContainerCapacity: 'Увеличивает максимальную вместимость контейнера',
    fillingSpeedUpgrade: 'Скорость наполнения',
    fillingSpeedDescription: 'Увеличивает скорость наполнения контейнера',
    back: 'Назад',
    snotCoinImage: 'Изображение монеты',
    upgradeSuccess: 'Улучшение выполнено',
    
    // Общие элементы
    loading: 'Загрузка',
    error: 'Ошибка',
    retry: 'Повторить',
    close: 'Закрыть',
    comingSoon: 'Скоро будет доступно'
  },
  en: {
    // Навигация
    merge: 'Merge',
    laboratory: 'Laboratory',
    storage: 'Storage',
    quests: 'Quests',
    profile: 'Profile',
    
    // Вкладки
    mergeTab: 'Merge',
    laboratoryTab: 'Laboratory',
    storageTab: 'Storage',
    questsTab: 'Quests',
    
    // Улучшения
    upgrade: 'Upgrade',
    currentLevel: 'Current Level',
    upgradeCost: 'Upgrade Cost',
    currentEffect: 'Current Effect',
    nextEffect: 'Next Effect',
    upgradeButton: 'Upgrade',
    containerCapacity: 'Container Capacity',
    increaseContainerCapacity: 'Increases the maximum container capacity',
    fillingSpeedUpgrade: 'Filling Speed',
    fillingSpeedDescription: 'Increases the container filling speed',
    back: 'Back',
    snotCoinImage: 'Coin Image',
    upgradeSuccess: 'Upgrade Successful',
    
    // Общие элементы
    loading: 'Loading',
    error: 'Error',
    retry: 'Retry',
    close: 'Close',
    comingSoon: 'Coming Soon'
  }
}; 