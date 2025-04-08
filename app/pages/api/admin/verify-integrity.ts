/**
 * API-маршрут для проверки и исправления целостности сохранений (админ)
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { apiLogger as logger } from '../../../lib/logger';
import { ExtendedGameState } from '../../../types/gameTypes';

// Секретный ключ для доступа к API (должен быть в переменных окружения)
const API_SECRET = process.env.ADMIN_API_SECRET || 'admin-secret-key';

// Интерфейсы для результатов проверки и восстановления
interface IntegrityCheckResult {
  isValid: boolean;
  errors: string[];
}

interface RepairResult {
  repairedState: any;
  appliedFixes: string[];
}

// Заглушки для функций проверки и восстановления
const gameIntegrity = {
  verify(state: any): IntegrityCheckResult {
    return { isValid: true, errors: [] };
  },
  repair(state: any): RepairResult {
    return { repairedState: state, appliedFixes: [] };
  },
  encrypt(state: any): { encryptedSave: string } {
    return { encryptedSave: JSON.stringify(state) };
  },
  decrypt(encrypted: string): any {
    return JSON.parse(encrypted);
  }
};

// Заглушка для Prisma клиента
const prisma = {
  gameState: {
    findMany: async () => [],
    update: async () => {},
  },
  progress: {
    findUnique: async (params: any) => ({
      user_id: '',
      game_state: '{}',
      encrypted_state: '',
      version: 1,
      updated_at: new Date()
    }),
    update: async (params: any) => ({})
  },
  $executeRaw: async (template: any, ...values: any[]) => {}
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Проверяем метод
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  
  // Проверяем авторизацию
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== API_SECRET) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  
  try {
    const { userId, autoRepair = false } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing userId' 
      });
    }
    
    // Получаем сохранение пользователя
    const userProgress = await prisma.progress.findUnique({
      where: { user_id: userId }
    });
    
    if (!userProgress) {
      return res.status(404).json({ 
        success: false, 
        error: 'User progress not found' 
      });
    }
    
    // Получаем данные из gameState и encryptedState
    let gameState: ExtendedGameState;
    
    try {
      // Парсим JSON строку в объект
      gameState = JSON.parse(userProgress.game_state as string) as ExtendedGameState;
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid game state format',
        details: 'Cannot parse game state JSON'
      });
    }
    
    const encryptedState = userProgress.encrypted_state;
    
    // Проверяем целостность сохранения
    const integrityResult = gameIntegrity.verify(gameState);
    
    // Если нужно автоматическое исправление и есть ошибки
    if (autoRepair && !integrityResult.isValid) {
      try {
        // Применяем исправления
        const { repairedState, appliedFixes } = gameIntegrity.repair(gameState);
        
        // Создаем новое зашифрованное состояние
        const { encryptedSave } = gameIntegrity.encrypt(repairedState);
        
        // Преобразуем объект в JSON строку для записи в БД
        const gameStateJson = JSON.stringify(repairedState);
        
        // Обновляем запись в базе данных
        await prisma.progress.update({
          where: { user_id: userId },
          data: {
            game_state: gameStateJson,
            encrypted_state: encryptedSave,
            version: userProgress.version + 1,
            updated_at: new Date()
          }
        });
        
        // Создаем запись в истории исправлений и удаляем старые записи
        await prisma.$executeRaw(
          "INSERT INTO progress_history (userId, clientId, saveType, saveReason, createdAt) VALUES (?, ?, ?, ?, NOW())",
          userId,
          'admin-repair',
          'repair',
          'integrity-check'
        );
        
        // Удаляем старые записи из истории - оставляем только последние 10 записей для пользователя
        await prisma.$executeRaw(
          "DELETE FROM progress_history WHERE userId = ? AND id NOT IN (SELECT id FROM (SELECT id FROM progress_history WHERE userId = ? ORDER BY createdAt DESC LIMIT 10) temp)",
          userId,
          userId
        );
        
        logger.info('Автоматически исправлено сохранение', {
          userId,
          fixes: appliedFixes,
          errors: integrityResult.errors
        });
        
        // Возвращаем результат с информацией об исправлениях
        return res.status(200).json({
          success: true,
          originalCheck: integrityResult,
          repaired: true,
          appliedFixes,
          repairedAt: new Date().toISOString()
        });
      } catch (repairError) {
        logger.error('Ошибка при исправлении сохранения', {
          userId,
          error: repairError instanceof Error ? repairError.message : String(repairError)
        });
        
        return res.status(500).json({
          success: false,
          error: 'Failed to repair game state',
          originalCheck: integrityResult,
          repaired: false
        });
      }
    }
    
    // Возвращаем результат проверки без исправлений
    return res.status(200).json({
      success: true,
      integrityCheck: integrityResult,
      userId,
      gameStateVersion: gameState.validationStatus || 'unknown',
      encryptedStateExists: !!encryptedState,
      integrityVerified: integrityResult.isValid,
      repaired: false
    });
    
  } catch (error) {
    logger.error('Ошибка при проверке целостности', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    });
  }
} 