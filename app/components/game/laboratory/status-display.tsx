import React from 'react'
import { useTranslation } from '../../../contexts/TranslationContext'
import { formatTime, calculateFillingTime, formatSnotValue } from '../../../utils/gameUtils'

interface StatusDisplayProps {
  containerCapacity: number
  containerLevel: number
  containerSnot: number
  containerFillingSpeed: number
  fillingSpeedLevel: number
}

const StatusDisplay: React.FC<StatusDisplayProps> = ({
  containerCapacity,
  containerLevel,
  containerSnot,
  containerFillingSpeed,
  fillingSpeedLevel,
}) => {
  const { t } = useTranslation()

  return (
    <div 
      className="absolute left-4 right-4 z-50 bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-xl p-1.5 pointer-events-none shadow-lg border border-gray-700"
      style={{ 
        boxShadow: '0 0 10px rgba(59, 130, 246, 0.2)',
        top: 'calc(3.5rem + 4px)' // Position it below the Resources bar with a small gap
      }}
    >
      <div className="grid grid-cols-4 gap-x-4 text-xs">
        <div className="flex justify-between items-center">
          <span className="text-gray-300">{t('capacity')}:</span>
          <span className="text-blue-400 font-medium ml-1">{formatSnotValue(containerCapacity, 2)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-300">{t('capacityLevel')}:</span>
          <span className="text-blue-400 font-medium ml-1">{containerLevel}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-300">{t('fillingLevel')}:</span>
          <span className="text-blue-400 font-medium ml-1">{fillingSpeedLevel}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-300">{t('fillTime')}:</span>
          <span className="text-blue-400 font-medium ml-1">
            {formatTime(calculateFillingTime(containerSnot, containerCapacity, containerFillingSpeed))}
          </span>
        </div>
      </div>
    </div>
  )
}

export default React.memo(StatusDisplay)

