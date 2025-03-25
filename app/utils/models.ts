import { PrismaClient } from '@prisma/client';
import { WarpcastUser } from '../types/warpcastAuth';

const prisma = new PrismaClient();

// Тип для хранения игрового состояния
export type GameStateData = Record<string, any>;

/**
 * Модель для работы с пользователями
 */
export class UserModel {
  /**
   * Поиск пользователя по fid (Farcaster ID)
   */
  static async findByFid(fid: number) {
    return await prisma.user.findUnique({
      where: { fid }
    });
  }

  /**
   * Создание нового пользователя
   */
  static async create(userData: {
    fid: number;
    username: string;
    displayName?: string | null;
    pfp?: string | null;
    address?: string | null;
  }) {
    return await prisma.user.create({
      data: {
        fid: userData.fid,
        username: userData.username,
        displayName: userData.displayName || null,
        pfp: userData.pfp || null,
        address: userData.address || null
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
    return await prisma.user.update({
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

  /**
   * Создание или обновление пользователя
   */
  static async upsert(user: WarpcastUser) {
    return await prisma.user.upsert({
      where: { fid: user.fid },
      update: {
        username: user.username,
        displayName: user.displayName,
        pfp: user.pfp,
        address: user.address
      },
      create: {
        fid: user.fid,
        username: user.username,
        displayName: user.displayName,
        pfp: user.pfp,
        address: user.address
      }
    });
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