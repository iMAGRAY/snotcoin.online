import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useGameState } from '../contexts'

/**
 * Хук для перенаправления неавторизованных пользователей на главную страницу
 */
export function useAuthRedirect() {
  const gameState = useGameState()
  const router = useRouter()

  useEffect(() => {
    if (!gameState?.user?.id) {
      console.log('[useAuthRedirect] Пользователь не авторизован, перенаправление на главную')
      router.push('/')
    }
  }, [gameState?.user?.id, router])
} 