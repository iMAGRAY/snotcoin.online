/**
 * API-маршрут для проверки и исправления целостности сохранений (админ)
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { verifyGameStateIntegrity, repairGameState } from '../../../utils/integrityChecker';
import { decryptGameSave, encryptGameSave } from '../../../utils/saveEncryption';
import { prisma } from '../../../lib/prisma';
import { apiLogger as logger } from '../../../lib/logger';
import { ExtendedGameState } from '../../../types/gameTypes';

// Секретный ключ для доступа к API (должен быть в переменных окружения)
const API_SECRET = process.env.ADMIN_API_SECRET || 'admin-secret-key';

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
    const integrityResult = verifyGameStateIntegrity(gameState, encryptedState || undefined);
    
    // Если нужно автоматическое исправление и есть ошибки
    if (autoRepair && !integrityResult.valid) {
      try {
        // Применяем исправления
        const { repairedState, appliedFixes } = repairGameState(gameState);
        
        // Создаем новое зашифрованное состояние
        const { encryptedSave } = encryptGameSave(repairedState, userId);
        
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
        
        // Создаем запись в истории исправлений
        await prisma.$executeRaw`
          INSERT INTO progress_history (
            userId, clientId, saveType, saveReason, createdAt
          ) VALUES (
            ${userId},
            ${'admin-repair'},
            ${'repair'},
            ${'integrity-check'},
            NOW()
          )
        `;
        
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
      gameStateVersion: gameState._saveVersion,
      encryptedStateExists: !!encryptedState,
      integrityVerified: integrityResult.valid,
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