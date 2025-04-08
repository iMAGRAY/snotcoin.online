/**
 * CRON-задача для регулярной очистки базы данных
 * Запускается автоматически по расписанию (например, раз в день)
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { apiLogger as logger } from '../../../lib/logger';

// Ключ для проверки подлинности CRON-запроса
const CRON_SECRET = process.env.CRON_SECRET || 'cron-secret-key';

// Заглушка для Prisma клиента
const prisma = {
  progress_history: {
    deleteMany: async (params: any) => ({ count: 0 })
  },
  sync_queue: {
    deleteMany: async (params: any) => ({ count: 0 })
  },
  progress: {
    findMany: async (params: any) => ([]),
    updateMany: async (params: any) => ({ count: 0 })
  },
  $executeRaw: async (template: any, ...values: any[]) => {}
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Проверяем авторизацию для CRON-запроса
  if (req.headers['x-cron-secret'] !== CRON_SECRET) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  
  try {
    logger.info('Запущена плановая очистка базы данных');
    
    // 1. Удаляем старые записи истории (старше 30 дней)
    const historyCleanup = await prisma.progress_history.deleteMany({
      where: {
        createdAt: {
          lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 дней
        }
      }
    });
    
    logger.info(`Удалено ${historyCleanup.count} старых записей истории`);
    
    // 2. Удаляем старые записи очереди синхронизации (старше 7 дней)
    const queueCleanup = await prisma.sync_queue.deleteMany({
      where: {
        timestamp: {
          lt: Date.now() - 7 * 24 * 60 * 60 * 1000 // 7 дней
        }
      }
    });
    
    logger.info(`Удалено ${queueCleanup.count} старых записей очереди синхронизации`);
    
    // 3. Сжимаем данные активных пользователей - оставляем только последние 3 сохранения для каждого
    const compressResult = await prisma.$executeRaw(
      `WITH ranked_history AS (
        SELECT 
          id, 
          user_id, 
          ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
        FROM progress_history
        WHERE created_at > ?
      )
      DELETE FROM progress_history
      WHERE id IN (
        SELECT id FROM ranked_history WHERE rn > 3
      )`,
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Только для записей последних 7 дней
    );
    
    // 4. Сжимаем данные для неактивных пользователей (не заходивших более 14 дней)
    // Находим неактивных пользователей
    const inactiveUsers = await prisma.progress.findMany({
      where: {
        updated_at: {
          lt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) // 14 дней
        }
      },
      select: {
        user_id: true
      }
    });
    
    // Явно приводим тип, чтобы исправить ошибку
    type UserWithId = { user_id: string };
    const inactiveUserIds = (inactiveUsers as UserWithId[]).map(user => user.user_id);
    
    // Сжимаем их данные
    if (inactiveUserIds.length > 0) {
      // Удаляем все записи истории, кроме последней для каждого неактивного пользователя
      const inactiveCleanup = await prisma.$executeRaw(
        `WITH ranked_history AS (
          SELECT 
            id, 
            user_id, 
            ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
          FROM progress_history
          WHERE user_id IN (?)
        )
        DELETE FROM progress_history
        WHERE id IN (
          SELECT id FROM ranked_history WHERE rn > 1
        )`,
        inactiveUserIds
      );
      
      logger.info(`Сжаты данные для ${inactiveUserIds.length} неактивных пользователей`);
    }
    
    // Возвращаем результат
    return res.status(200).json({
      success: true,
      cleaned: {
        history: historyCleanup.count,
        queue: queueCleanup.count,
        inactive_users: inactiveUserIds.length
      }
    });
    
  } catch (error) {
    logger.error('Ошибка при выполнении CRON-задачи очистки', {
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