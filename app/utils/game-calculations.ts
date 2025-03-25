/**
 * Утилиты для игровых расчетов
 * 
 * Этот модуль содержит функции для:
 * - Расчета стоимости улучшений
 * - Расчета восстановления энергии
 * - Расчета бонусов и прогресса
 */

/**
 * Интерфейс для улучшения в игре
 */
export interface Improvement {
  /** Базовая стоимость улучшения */
  baseCost: number;
  /** Множитель роста стоимости */
  costMultiplier: number;
  /** Текущий уровень улучшения */
  level: number;
  /** Функция, возвращающая эффект улучшения для указанного уровня */
  effect: (level: number) => number;
}

/**
 * Рассчитывает стоимость улучшения на текущем уровне
 * @param improvement - Объект улучшения
 * @returns Стоимость улучшения
 */
export const calculateUpgradeCost = (improvement: Improvement): number => {
  return Math.floor(improvement.baseCost * Math.pow(improvement.costMultiplier, improvement.level));
};

/**
 * Возвращает текущий и следующий эффект улучшения в читаемом формате
 * @param improvement - Объект улучшения
 * @returns Строка с текущим и следующим эффектом
 */
export const getUpgradeEffect = (improvement: Improvement): string => {
  const currentEffect = improvement.effect(improvement.level);
  const nextEffect = improvement.effect(improvement.level + 1);

  return `${currentEffect} → ${nextEffect}`;
};

/**
 * Интерфейс для расчета игрового прогресса
 */
export interface ProgressData {
  /** Текущий уровень */
  level: number;
  /** Текущий опыт */
  experience: number;
  /** Требуемый опыт для следующего уровня */
  experienceRequired: number;
}

/**
 * Рассчитывает требуемый опыт для указанного уровня
 * @param level - Уровень
 * @returns Необходимое количество опыта
 */
export const calculateRequiredExperience = (level: number): number => {
  // Формула: 100 * (1.5^(level-1))
  return Math.floor(100 * Math.pow(1.5, level - 1));
};

/**
 * Добавляет опыт и обновляет данные прогресса
 * @param progressData - Текущие данные прогресса
 * @param experienceGained - Полученный опыт
 * @returns Обновленные данные прогресса и информация о повышении уровня
 */
export const addExperience = (
  progressData: ProgressData,
  experienceGained: number
): { newData: ProgressData; leveledUp: boolean } => {
  let { level, experience, experienceRequired } = progressData;
  let leveledUp = false;
  
  // Добавляем опыт
  experience += experienceGained;
  
  // Проверяем повышение уровня
  if (experience >= experienceRequired) {
    level += 1;
    experience -= experienceRequired;
    experienceRequired = calculateRequiredExperience(level);
    leveledUp = true;
  }
  
  return {
    newData: { level, experience, experienceRequired },
    leveledUp
  };
};

/**
 * Рассчитывает процент выполнения текущего уровня
 * @param progressData - Данные прогресса
 * @returns Процент выполнения (0-1)
 */
export const calculateProgressPercentage = (progressData: ProgressData): number => {
  return progressData.experience / progressData.experienceRequired;
}; 