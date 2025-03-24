import { Prisma } from '@prisma/client';
import prisma from './prisma';

// Тип для хранения игрового состояния
export type GameStateData = Record<string, any>;

/**
 * Модель для работы с пользователями
 */
export class UserModel {
  /**
   * Поиск пользователя по telegram_id
   */
  static async findByTelegramId(telegramId: number) {
    return prisma.user.findUnique({
      where: { telegram_id: telegramId }
    });
  }

  /**
   * Создание нового пользователя
   */
  static async create(userData: {
    telegram_id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
  }) {
    return prisma.user.create({
      data: {
        telegram_id: userData.telegram_id,
        username: userData.username || null,
        first_name: userData.first_name || null,
        last_name: userData.last_name || null
      }
    });
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
    return prisma.user.update({
      where: { id: userData.id },
      data: {
        username: userData.username || undefined,
        first_name: userData.first_name || undefined,
        last_name: userData.last_name || undefined,
      }
    });
  }

  /**
   * Обновление JWT токена пользователя
   */
  static async updateToken(userId: string, token: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { jwt_token: token }
    });
  }

  /**
   * Проверка токена пользователя
   */
  static async validateToken(userId: string, token: string) {
    const user = await prisma.user.findUnique({
      where: { 
        id: userId,
        jwt_token: token
      }
    });
    
    return !!user;
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
    return prisma.progress.findUnique({
      where: { user_id: userId }
    });
  }

  /**
   * Создание нового прогресса
   */
  static async create(userId: string, gameState: GameStateData) {
    return prisma.progress.create({
      data: {
        user_id: userId,
        game_state: gameState as any
      }
    });
  }

  /**
   * Обновление прогресса
   */
  static async update(userId: string, gameState: GameStateData) {
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
  }
} 