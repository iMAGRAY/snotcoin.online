export const calculateEnergyReplenishment = (
  lastLoginTime: number,
  currentEnergy: number,
  maxEnergy: number,
  replenishRate: number,
): number => {
  const now = Date.now()
  const elapsedTime = now - lastLoginTime
  const replenishedEnergy = Math.floor((elapsedTime / 1000 / 60) * replenishRate) // replenishRate is energy per minute
  return Math.min(currentEnergy + replenishedEnergy, maxEnergy)
}

