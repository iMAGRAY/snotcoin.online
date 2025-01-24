import { useMemo } from "react"
import { GameState } from "../types/gameTypes"

type FormatFunction = (value: number, decimalPlaces?: number) => string

export const formatSnotValue: FormatFunction = (value, decimalPlaces = 4) => {
  if (value === undefined || value === null) return "0"
  if (value >= 1e9) return `${(value / 1e9).toFixed(decimalPlaces)}B`
  if (value >= 1e6) return `${(value / 1e6).toFixed(decimalPlaces)}M`
  if (value >= 1e3) return `${(value / 1e3).toFixed(decimalPlaces)}K`
  return value.toFixed(decimalPlaces)
}

export const useFormattedSnotValue = (value: number) => useMemo(() => formatSnotValue(value), [value])

export const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

export const useFormattedTime = (seconds: number) => useMemo(() => formatTime(seconds), [seconds])

export const formatPercentage = (value: number): string => `${(value * 100).toFixed(1)}%`

export const formatCurrency = (value: number): string => `$${value.toFixed(2)}`

export const calculateUpgradeCost = (baseCost: number, costMultiplier: number, level: number): number =>
  Math.floor(baseCost * Math.pow(costMultiplier, level - 1))

export const useCalculatedUpgradeCost = (baseCost: number, costMultiplier: number, level: number) =>
  useMemo(() => calculateUpgradeCost(baseCost, costMultiplier, level), [baseCost, costMultiplier, level])

export function getUpgradeEffect(currentEffect: number, nextEffect: number): string {
  return `${currentEffect.toFixed(2)} → ${nextEffect.toFixed(2)}`
}

export const calculateEnergyRecoveryTime = (currentEnergy: number, maxEnergy: number, recoveryRate: number): number =>
  Math.ceil((maxEnergy - currentEnergy) / recoveryRate)

export const calculateFillingTime = (containerSnot: number, maxContainerSnot: number, fillingSpeed: number): number =>
  Math.ceil((maxContainerSnot - containerSnot) / fillingSpeed)

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

