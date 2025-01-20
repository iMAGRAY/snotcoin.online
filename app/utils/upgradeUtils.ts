interface Improvement {
  baseCost: number;
  costMultiplier: number;
  level: number;
  effect: (level: number) => number;
}

export const calculateUpgradeCost = (improvement: Improvement): number => {
  return Math.floor(improvement.baseCost * Math.pow(improvement.costMultiplier, improvement.level));
};

export const getUpgradeEffect = (improvement: Improvement): string => {
  const currentEffect = improvement.effect(improvement.level);
  const nextEffect = improvement.effect(improvement.level + 1);

  return `${currentEffect} → ${nextEffect}`;
};

export const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};

