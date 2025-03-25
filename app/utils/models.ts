import prisma from './prisma';

// Тип для хранения игрового состояния
export type GameStateData = Record<string, any>;

/**
 * Модель для работы с пользователями
 */
export class UserModel {
  /**
   * Поиск пользователя по farcaster_fid
   */
  static async findByFarcasterId(fid: number) {
    try {
      return await prisma.user.findUnique({
        where: { farcaster_fid: fid }
      });
    } catch (error) {
      console.error('Ошибка при поиске пользователя по farcaster_fid:', error);
      return null;
    }
  }

  /**
   * Создание нового пользователя
   */
  static async create(userData: {
    farcaster_fid: number;
    username?: string;
    first_name?: string;
    last_name?: string;
    photo_url?: string;
  }) {
    try {
      // Используем напрямую поля farcaster_*
      return await prisma.user.create({
        data: {
          farcaster_fid: userData.farcaster_fid,
          farcaster_username: userData.username || '',
          farcaster_displayname: userData.first_name || '',
          farcaster_pfp: userData.photo_url || '',
        }
      });
    } catch (error) {
      console.error('Ошибка при создании пользователя:', error);
      throw error;
    }
  }

  /**
   * Обновление данных пользователя
   */
  static async update(userData: {
    id: string;
    username?: string;
    first_name?: string;
    last_name?: string;
  }) {
    try {
      // Адаптируем поля к схеме Prisma
      return prisma.user.update({
        where: { id: userData.id },
        data: {
          farcaster_username: userData.username || undefined,
          farcaster_displayname: userData.first_name || undefined
        }
      });
    } catch (error) {
      console.error('Ошибка при обновлении пользователя:', error);
      throw error;
    }
  }

  /**
   * Обновление JWT токена пользователя
   */
  static async updateToken(userId: string, token: string) {
    try {
      return prisma.user.update({
        where: { id: userId },
        data: { jwt_token: token }
      });
    } catch (error) {
      console.error('Ошибка при обновлении токена:', error);
      throw error;
    }
  }

  /**
   * Проверка токена пользователя
   */
  static async validateToken(userId: string, token: string) {
    try {
      const user = await prisma.user.findFirst({
        where: { 
          id: userId,
          jwt_token: token
        }
      });
      
      return !!user;
    } catch (error) {
      console.error('Ошибка при валидации токена:', error);
      return false;
    }
  }
}

/**
 * Модель для работы с прогрессом игры
 */
export class ProgressModel {
  /**
   * Получение прогресса пользователя
   */
  static async findByUserId(userId: string) {
    try {
      return prisma.progress.findUnique({
        where: { user_id: userId }
      });
    } catch (error) {
      console.error('Ошибка при поиске прогресса:', error);
      return null;
    }
  }

  /**
   * Создание нового прогресса
   */
  static async create(userId: string, gameState: GameStateData) {
    try {
      return prisma.progress.create({
        data: {
          user_id: userId,
          game_state: gameState as any
        }
      });
    } catch (error) {
      console.error('Ошибка при создании прогресса:', error);
      throw error;
    }
  }

  /**
   * Обновление прогресса
   */
  static async update(userId: string, gameState: GameStateData) {
    try {
      const progress = await this.findByUserId(userId);
      
      if (!progress) {
        return this.create(userId, gameState);
      }
      
      return prisma.progress.update({
        where: { user_id: userId },
        data: {
          game_state: gameState as any,
          version: { increment: 1 }
        }
      });
    } catch (error) {
      console.error('Ошибка при обновлении прогресса:', error);
      throw error;
    }
  }
} 