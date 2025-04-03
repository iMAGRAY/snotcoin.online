'use client'

import React from 'react'
import dynamic from 'next/dynamic'

interface MergeGameProps {
  onClose: () => void
}

// Динамически импортируем клиентский компонент с отключенным SSR
const MergeGameClient = dynamic(() => import('./MergeGameClient'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-90">
      <div className="w-full h-full max-w-6xl mx-auto flex flex-col">
        <div className="bg-gradient-to-r from-[#3a5c82] to-[#4a7a9e] p-4 flex justify-between items-center">
          <h2 className="text-white font-bold text-xl">Merge Game</h2>
          <div className="bg-red-500 px-3 py-1 rounded text-white">Exit</div>
        </div>
        <div className="flex-grow flex items-center justify-center text-white text-2xl">
          Загрузка игры...
        </div>
      </div>
    </div>
  )
})

const MergeGame: React.FC<MergeGameProps> = ({ onClose }) => {
  // Создаем объект настроек, который явно указывает, что начальная пауза должна быть false
  const gameOptions = {
    initialPause: false
  };
  
  return <MergeGameClient onClose={onClose} gameOptions={gameOptions} />
}

export default MergeGame 