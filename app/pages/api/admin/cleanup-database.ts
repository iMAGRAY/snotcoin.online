/**
 * API-маршрут для очистки устаревших данных в базе данных (админ)
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { apiLogger as logger } from '../../../lib/logger';

// Секретный ключ для доступа к API (должен быть в переменных окружения)
const API_SECRET = process.env.ADMIN_API_SECRET || 'admin-secret-key';

// Заглушка для Prisma клиента
const prisma = {
  progress_history: {
    deleteMany: async (params: any) => ({ count: 0 })
  },
  sync_queue: {
    deleteMany: async (params: any) => ({ count: 0 })
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
    const { olderThanDays = 30, limit = 1000 } = req.body;
    
    if (olderThanDays < 1) {
      return res.status(400).json({ 
        success: false, 
        error: 'olderThanDays must be at least 1' 
      });
    }
    
    // Вычисляем дату для фильтрации старых записей
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    // Очищаем старые записи из progress_history
    const historyDeleted = await prisma.progress_history.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate
        }
      },
      take: limit
    });
    
    // Очищаем старые записи из sync_queue (можно адаптировать структуру под реальную)
    const queueDeleted = await prisma.sync_queue.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate.getTime()
        }
      },
      take: limit
    });
    
    // Очищаем ненужные сохранения пользователей - оставляем только последние 5 для каждого
    const cleanupResult = await prisma.$executeRaw(
      `WITH ranked_history AS (
        SELECT 
          id, 
          user_id, 
          ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
        FROM progress_history
      )
      DELETE FROM progress_history
      WHERE id IN (
        SELECT id FROM ranked_history WHERE rn > 5
      )`
    );
    
    logger.info('Выполнена очистка устаревших данных в БД', {
      historyDeleted: historyDeleted.count,
      queueDeleted: queueDeleted.count,
      olderThanDays,
      limit
    });
    
    return res.status(200).json({
      success: true,
      cleaned: {
        historyDeleted: historyDeleted.count,
        queueDeleted: queueDeleted.count,
        cutoffDate: cutoffDate.toISOString()
      }
    });
    
  } catch (error) {
    logger.error('Ошибка при очистке БД', {
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