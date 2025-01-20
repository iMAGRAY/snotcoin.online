'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useGameState, useGameDispatch } from '../contexts/GameContext'

const BackgroundMusic: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const { backgroundMusicVolume, isMuted } = useGameState()
  const dispatch = useGameDispatch()
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // Test the audio link.  If it's broken, replace with a valid URL or handle the error more gracefully.
    const audio = new Audio('https://hebbkx1anhila5yf.public.blob.vercel-storage.com/PixelAudio-E4zbw7XDlvpQbjjMR3HzZNyVB9A07O.mp3')
    audio.loop = true
    audioRef.current = audio

    const playAudio = () => {
      if (audioRef.current && !isMuted && isReady) {
        audioRef.current.play().catch(error => {
          console.error('Audio playback failed:', error)
          // You might want to dispatch an action here to update the game state
          // dispatch({ type: 'SET_AUDIO_ERROR', payload: error.message })
        })
      }
    }

    const handleInteraction = () => {
      setIsReady(true)
      playAudio()
      document.removeEventListener('click', handleInteraction)
    }

    document.addEventListener('click', handleInteraction)

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (audioRef.current) audioRef.current.pause()
      } else {
        playAudio()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      document.removeEventListener('click', handleInteraction)
    }
  }, [isMuted, isReady])

  useEffect(() => {
    if (audioRef.current) {
      const volume = isMuted ? 0 : Math.max(0, Math.min(1, backgroundMusicVolume));
      audioRef.current.volume = isNaN(volume) ? 0 : volume;
    }
  }, [backgroundMusicVolume, isMuted])

  useEffect(() => {
    console.log('Background Music Volume:', backgroundMusicVolume);
    console.log('Is Muted:', isMuted);
  }, [backgroundMusicVolume, isMuted]);

  return null
}

export default BackgroundMusic

