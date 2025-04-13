"use client"

import React, { useRef, useEffect, useState } from 'react'
import planck from 'planck'
import { useGameState } from '../../../../contexts'
import { TouchButton } from '../../../../ui/TouchButton'
import Image from 'next/image'

interface Ball {
  body: planck.Body
  level: number
  x: number
  y: number
  radius: number
}

interface MergeAppProps {
  onBack: () => void
}

const SCALE = 30
const BALL_RADIUS = 15
const SHOOT_FORCE = 10
const MAX_LEVEL = 11

export const MergeApp: React.FC<MergeAppProps> = ({ onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<planck.World | null>(null)
  const ballsRef = useRef<Ball[]>([])
  const nextBallRef = useRef<{ x: number; y: number; level: number } | null>(null)
  const animationFrameRef = useRef<number>(0)
  const [score, setScore] = useState(0)
  const [isGameOver, setIsGameOver] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const { inventory } = useGameState()

  // Инициализация мира и физики
  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Устанавливаем размеры canvas с учетом основного интерфейса
    const updateCanvasSize = () => {
      // Получаем видимую высоту окна
      const windowHeight = window.innerHeight
      // Корректируем высоту с учетом TabBar (прибл. 60px) и верхней панели приложения (прибл. 60px)
      // а также высоты нашего верхнего бара игры (70px)
      const tabbarHeight = 60
      const topBarHeight = 60
      const gameHeaderHeight = 70
      
      canvas.width = window.innerWidth
      canvas.height = windowHeight - tabbarHeight - topBarHeight - gameHeaderHeight
      
      console.log('[MergeApp] Canvas size updated:', canvas.width, 'x', canvas.height)
    }
    
    updateCanvasSize()

    // ... остальной код инициализации физики без изменений

    // Обязательно обновляем размер при изменении окна
    window.addEventListener('resize', updateCanvasSize)

    // ... остальной код игровой логики без изменений

    // Очистка
    return () => {
      // ... существующая очистка без изменений
      window.removeEventListener('resize', updateCanvasSize)
    }
  }, [isPaused])

  // ... остальные функции без изменений

  return (
    <div className="w-full h-full relative flex flex-col">
      {/* Верхний бар */}
      <div 
        className="w-full h-[70px] relative flex items-center justify-between px-6"
        style={{
          backgroundImage: "url('/images/merge/Game/ui/Header.webp')",
          backgroundRepeat: "repeat-x",
          backgroundSize: "auto 100%",
          backgroundPosition: "center"
        }}
      >
        <div className="flex items-center z-10">
          <TouchButton
            onClick={() => setIsPaused(!isPaused)}
            className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-105 active:scale-[0.98] mr-4"
          >
            <Image
              src="/images/merge/Game/ui/pause.webp"
              alt="Пауза"
              width={48}
              height={48}
              className="w-full h-full object-cover"
            />
          </TouchButton>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <Image
              src="/images/merge/Game/ui/score.webp"
              alt="Счет"
              width={32}
              height={32}
              className="mr-2"
            />
            <span className="text-white font-bold text-xl">{score}</span>
          </div>
        </div>
      </div>

      {/* Игровое поле */}
      <canvas
        ref={canvasRef}
        className="flex-1 bg-transparent"
        style={{
          backgroundImage: "url('/images/merge/background/merge-background.webp')",
          backgroundSize: "cover",
          backgroundPosition: "center"
        }}
      />

      {/* Модальные окна */}
      {isPaused && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-40">
          <div className="bg-gradient-to-b from-[#2a3b4d] to-[#1a2b3d] p-8 rounded-lg border-2 border-[#4a7a9e]">
            <h2 className="text-2xl font-bold mb-4 text-white text-center">Пауза</h2>
            <div className="flex space-x-4">
              <TouchButton
                onClick={() => setIsPaused(false)}
                className="bg-gradient-to-r from-blue-500 to-blue-700 text-white px-4 py-2 rounded w-full"
              >
                Продолжить
              </TouchButton>
              <TouchButton
                onClick={onBack}
                className="bg-gradient-to-r from-red-500 to-red-700 text-white px-4 py-2 rounded w-full"
              >
                В меню
              </TouchButton>
            </div>
          </div>
        </div>
      )}

      {isGameOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-40">
          <div className="bg-gradient-to-b from-[#2a3b4d] to-[#1a2b3d] p-8 rounded-lg border-2 border-[#4a7a9e]">
            <h2 className="text-2xl font-bold mb-4 text-white text-center">Игра окончена!</h2>
            <p className="mb-4 text-white text-center">Ваш счет: <span className="font-bold text-yellow-400">{score}</span></p>
            <div className="flex space-x-4">
              <TouchButton
                onClick={() => window.location.reload()}
                className="bg-gradient-to-r from-blue-500 to-blue-700 text-white px-4 py-2 rounded w-full"
              >
                Играть снова
              </TouchButton>
              <TouchButton
                onClick={onBack}
                className="bg-gradient-to-r from-red-500 to-red-700 text-white px-4 py-2 rounded w-full"
              >
                В меню
              </TouchButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 