import { useMemo } from "react"

export function formatSnotValue(value: number | undefined | null, decimalPlaces = 0): string {
  if (value === undefined || value === null) {
    return "0"
  }
  if (value >= 1e9) return `${(value / 1e9).toFixed(decimalPlaces)}B`
  if (value >= 1e6) return `${(value / 1e6).toFixed(decimalPlaces)}M`
  if (value >= 1e3) return `${(value / 1e3).toFixed(decimalPlaces)}K`
  if (value < 1) return value.toFixed(5) // Show 5 decimal places for small values
  return value.toFixed(decimalPlaces)
}

export const useFormattedSnotValue = (value: number) => useMemo(() => formatSnotValue(value), [value])

export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else {
    return `${minutes}m`
  }
}

export const useFormattedTime = (seconds: number) => useMemo(() => formatTime(seconds), [seconds])

export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`
}

export function calculateUpgradeCost(baseCost: number, costMultiplier: number, level: number): number {
  return Math.floor(baseCost * Math.pow(costMultiplier, level))
}

export const useCalculatedUpgradeCost = (baseCost: number, costMultiplier: number, level: number) =>
  useMemo(() => calculateUpgradeCost(baseCost, costMultiplier, level), [baseCost, costMultiplier, level])

export function getUpgradeEffect(currentEffect: number, nextEffect: number): string {
  return `${currentEffect.toFixed(2)} → ${nextEffect.toFixed(2)}`
}

export function calculateEnergyRecoveryTime(currentEnergy: number, maxEnergy: number, recoveryRate: number): number {
  return Math.ceil((maxEnergy - currentEnergy) / recoveryRate)
}

export function calculateFillingTime(containerSnot: number, maxContainerSnot: number, fillingSpeed: number): number {
  return Math.ceil((maxContainerSnot - containerSnot) / fillingSpeed)
}

export const useCalculatedFillingTime = (containerSnot: number, maxContainerSnot: number, fillingSpeed: number) =>
  useMemo(
    () => calculateFillingTime(containerSnot, maxContainerSnot, fillingSpeed),
    [containerSnot, maxContainerSnot, fillingSpeed],
  )

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M"
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K"
  }
  return num.toString()
}

