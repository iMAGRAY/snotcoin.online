import type { GameState } from '../types/gameTypes';
import { saveGameStateWithIntegrity } from './dataServiceModular';

interface AbortError extends Error {
  name: 'AbortError';
}

class StateManager {
  private activeRequests: Map<string, AbortController> = new Map();
  private beforeUnloadHandlers: Map<string, () => void> = new Map();

  async forceSaveGameState(userId: string, state: GameState): Promise<void> {
    try {
      const controller = new AbortController();
      this.activeRequests.set(userId, controller);

      await saveGameStateWithIntegrity(userId, state);
      console.log(`[StateManager] Принудительное сохранение успешно для пользователя ${userId}`);
    } catch (error: unknown) {
      if (this.isAbortError(error)) {
        console.log(`[StateManager] Сохранение отменено для пользователя ${userId}`);
        return;
      }
      throw error;
    } finally {
      this.activeRequests.delete(userId);
    }
  }

  private isAbortError(error: unknown): error is AbortError {
    return error instanceof Error && error.name === 'AbortError';
  }

  setupBeforeUnloadHandler(userId: string, handler: () => void): () => void {
    const existingHandler = this.beforeUnloadHandlers.get(userId);
    if (existingHandler) {
      window.removeEventListener('beforeunload', existingHandler);
    }

    this.beforeUnloadHandlers.set(userId, handler);
    window.addEventListener('beforeunload', handler);

    return () => {
      window.removeEventListener('beforeunload', handler);
      this.beforeUnloadHandlers.delete(userId);
    };
  }

  cancelAllRequests(): void {
    this.activeRequests.forEach((controller, userId) => {
      controller.abort();
      console.log(`[StateManager] Отменено сохранение для пользователя ${userId}`);
    });
    this.activeRequests.clear();
  }
}

export const stateManager = new StateManager(); 