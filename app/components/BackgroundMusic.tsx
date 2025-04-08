"use client"

import React, { useEffect, useRef, useState } from "react"
import { useGameState } from "../contexts/game/hooks"
import audioService from "../services/audioService"

export const BackgroundMusic: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement>(null)
  const gameState = useGameState()
  const [isPlaying, setIsPlaying] = useState(false)

  // Безопасно получаем настройки звука с приведением типа для обхода проверок
  const soundSettings = (gameState.soundSettings || {}) as any
  const backgroundMusicVolume = soundSettings.backgroundMusicVolume ?? 0.25
  const isBackgroundMusicMuted = soundSettings.isBackgroundMusicMuted ?? false

  useEffect(() => {
    // Обновляем настройки в audioService
    audioService.setBackgroundMusicVolume(backgroundMusicVolume);
    
    if (isBackgroundMusicMuted) {
      audioService.stopBackgroundMusic();
    } else {
      audioService.playBackgroundMusic();
      setIsPlaying(true);
    }
    
    // Резервный вариант с аудио элементом
    const audio = audioRef.current
    if (!audio) return

    // Устанавливаем громкость
    audio.volume = isBackgroundMusicMuted ? 0 : backgroundMusicVolume

    // Воспроизводим музыку, если она еще не играет
    if (!isPlaying && !isBackgroundMusicMuted) {
      audio.play().catch(error => {
        console.error("Ошибка воспроизведения фоновой музыки:", error)
      })
      setIsPlaying(true)
    } else if (isPlaying && isBackgroundMusicMuted) {
      audio.pause()
      setIsPlaying(false)
    }
  }, [backgroundMusicVolume, isBackgroundMusicMuted, isPlaying])

  return (
    <audio
      ref={audioRef}
      src="/audio/background-music.mp3"
      loop
      preload="auto"
    />
  )
}

