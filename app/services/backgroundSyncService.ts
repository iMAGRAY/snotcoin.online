/**
 * Сервис фоновой синхронизации для обеспечения целостности данных между локальным хранилищем и БД
 */

import { apiLogger as logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { encryptGameSave, decryptGameSave } from '../utils/saveEncryption';
import { logTiming } from '../lib/logger';
import * as dataIntegrityService from '../services/validation/dataIntegrityService';
import { gameMetrics } from '../lib/metrics';
import { ENV } from '../lib/env';

// Время между попытками выполнения задач (в миллисекундах)
const TASK_INTERVAL = 5000; // 5 секунд
const MAX_ATTEMPTS = 5;     // Максимальное число попыток выполнения задачи

// Статусы задач
enum TaskStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

/**
 * Класс сервиса фоновой синхронизации
 */
export class BackgroundSyncService {
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private lastTaskRun: number = 0;
  
  /**
   * Запуск сервиса
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('[BackgroundSync] Сервис уже запущен');
      return;
    }
    
    logger.info('[BackgroundSync] Запуск сервиса фоновой синхронизации');
    this.isRunning = true;
    
    // Запускаем таймер для регулярного выполнения задач
    this.timer = setInterval(() => {
      this.processQueuedTasks().catch(error => {
        logger.error('[BackgroundSync] Ошибка при обработке очереди задач', {
          error: error instanceof Error ? error.message : String(error)
        });
      });
    }, TASK_INTERVAL);
    
    // Запускаем первую обработку сразу
    await this.processQueuedTasks();
  }
  
  /**
   * Остановка сервиса
   */
  public stop(): void {
    if (!this.isRunning) {
      logger.warn('[BackgroundSync] Сервис не запущен');
      return;
    }
    
    logger.info('[BackgroundSync] Остановка сервиса фоновой синхронизации');
    
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    
    this.isRunning = false;
  }
  
  /**
   * Обработка задач в очереди
   */
  private async processQueuedTasks(): Promise<void> {
    // Проверяем, что не слишком часто запускаем обработку
    const now = Date.now();
    if (now - this.lastTaskRun < TASK_INTERVAL) {
      return;
    }
    
    this.lastTaskRun = now;
    
    try {
      // Получаем несколько задач в статусе "ожидает"
      const tasks = await prisma.syncQueue.findMany({
        where: {
          status: TaskStatus.PENDING,
          attempts: { lt: MAX_ATTEMPTS }
        },
        orderBy: [
          { updated_at: 'asc' }  // Сначала обрабатываем самые старые задачи
        ],
        take: 5  // Ограничиваем количество задач для обработки за один раз
      });
      
      if (tasks.length === 0) {
        return;
      }
      
      logger.info(`[BackgroundSync] Найдено ${tasks.length} задач для обработки`);
      
      // Обрабатываем задачи
      for (const task of tasks) {
        await this.processTask(task);
      }
    } catch (error) {
      logger.error('[BackgroundSync] Ошибка при получении задач из очереди', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  /**
   * Обработка отдельной задачи
   */
  private async processTask(task: any): Promise<void> {
    const { id, user_id, operation, data } = task;
    
    try {
      // Помечаем задачу как обрабатываемую
      await prisma.syncQueue.update({
        where: { id },
        data: {
          status: TaskStatus.PROCESSING,
          updated_at: new Date()
        }
      });
      
      logger.info(`[BackgroundSync] Начало обработки задачи ID=${id}, пользователь=${user_id}, операция=${operation}`);
      
      let success = false;
      
      // Определяем тип задачи и вызываем соответствующий обработчик
      switch (operation) {
        case 'save_progress':
          success = await this.handleSaveTask(task);
          break;
        default:
          logger.warn(`[BackgroundSync] Неизвестный тип операции: ${operation}`);
          success = false;
      }
      
      // Обновляем статус задачи
      if (success) {
        await prisma.syncQueue.update({
          where: { id },
          data: {
            status: TaskStatus.COMPLETED,
            updated_at: new Date()
          }
        });
        
        logger.info(`[BackgroundSync] Задача ID=${id} успешно выполнена`);
      } else {
        // Увеличиваем счетчик попыток и помечаем как ожидающую
        await prisma.syncQueue.update({
          where: { id },
          data: {
            status: TaskStatus.PENDING,
            attempts: { increment: 1 },
            updated_at: new Date()
          }
        });
        
        logger.warn(`[BackgroundSync] Задача ID=${id} не выполнена, будет повторена позже`);
      }
    } catch (error) {
      logger.error(`[BackgroundSync] Ошибка при обработке задачи ID=${id}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Помечаем задачу как ожидающую с увеличенным счетчиком попыток
      try {
        await prisma.syncQueue.update({
          where: { id },
          data: {
            status: TaskStatus.PENDING,
            attempts: { increment: 1 },
            updated_at: new Date()
          }
        });
      } catch (updateError) {
        logger.error(`[BackgroundSync] Ошибка при обновлении статуса задачи ID=${id}`, {
          error: updateError instanceof Error ? updateError.message : String(updateError)
        });
      }
    }
  }
  
  /**
   * Обрабатывает задачу сохранения прогресса
   */
  private async handleSaveTask(task: any): Promise<boolean> {
    const { user_id, data } = task;
    
    try {
      if (!data || !data.gameState) {
        logger.warn(`[BackgroundSync] Задача не содержит данных состояния игры, пользователь=${user_id}`);
        return false;
      }
      
      // Проверка существующего прогресса
      const existingProgress = await prisma.progress.findUnique({
        where: { user_id }
      });
      
      // Шифруем состояние игры
      const gameState = data.gameState;
      const encryptedData = encryptGameSave(gameState, user_id);
      const encryptedState = encryptedData.encryptedSave;
      
      // Если запись существует - обновляем, иначе создаем новую
      if (existingProgress) {
        await prisma.progress.update({
          where: { user_id },
          data: {
            game_state: encryptedState,
            updated_at: new Date()
          }
        });
      } else {
        await prisma.progress.create({
          data: {
            user_id,
            game_state: encryptedState,
            created_at: new Date(),
            updated_at: new Date()
          }
        });
      }
      
      logger.info(`[BackgroundSync] Успешное сохранение прогресса для пользователя ${user_id}`);
      
      return true;
    } catch (error) {
      logger.error(`[BackgroundSync] Ошибка при сохранении прогресса для пользователя ${user_id}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }
  
  /**
   * Загружает состояние игры из базы данных
   */
  private async loadGameStateFromDB(userId: string): Promise<{success: boolean, data?: any}> {
    try {
      const progress = await prisma.progress.findUnique({
        where: { user_id: userId }
      });
      
      if (!progress || !progress.game_state) {
        logger.warn(`[BackgroundSync] Прогресс не найден для пользователя ${userId}`);
        return { success: false };
      }
      
      try {
        // Декодируем сохранение
        const decryptedState = decryptGameSave(progress.game_state as string, userId);
        
        if (!decryptedState) {
          logger.warn(`[BackgroundSync] Не удалось расшифровать состояние для пользователя ${userId}`);
          return { success: false };
        }
        
        // Валидируем загруженное состояние
        const isValid = dataIntegrityService.validateLoadedGameState(decryptedState, userId);
        
        if (!isValid) {
          logger.warn(`[BackgroundSync] Загруженное состояние не прошло валидацию для пользователя ${userId}`);
          return { success: false };
        }
        
        logger.info(`[BackgroundSync] Состояние успешно загружено из БД для пользователя ${userId}`);
        return { success: true, data: decryptedState };
      } catch (parseError) {
        logger.error(`[BackgroundSync] Ошибка декодирования/парсинга состояния для пользователя ${userId}`, {
          error: parseError instanceof Error ? parseError.message : String(parseError)
        });
        return { success: false };
      }
    } catch (dbError) {
      logger.error(`[BackgroundSync] Ошибка при загрузке прогресса из БД для пользователя ${userId}`, {
        error: dbError instanceof Error ? dbError.message : String(dbError)
      });
      return { success: false };
    }
  }
  
  /**
   * Проверяет наличие задач для указанного пользователя
   */
  public async hasTasksForUser(userId: string): Promise<boolean> {
    try {
      const count = await prisma.syncQueue.count({
        where: {
          user_id: userId,
          status: { in: [TaskStatus.PENDING, TaskStatus.PROCESSING] }
        }
      });
      
      return count > 0;
    } catch (error) {
      logger.error(`[BackgroundSync] Ошибка при проверке задач для пользователя ${userId}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }
  
  /**
   * Добавляет новую задачу сохранения данных в БД
   */
  public async addSaveTask(userId: string, gameState: any): Promise<boolean> {
    try {
      // Проверяем существует ли уже задача для этого пользователя
      const existingTask = await prisma.syncQueue.findFirst({
        where: {
          user_id: userId,
          operation: 'save_progress',
          status: { in: [TaskStatus.PENDING, TaskStatus.PROCESSING] }
        }
      });
      
      // Если задача уже существует, обновляем данные
      if (existingTask) {
        await prisma.syncQueue.update({
          where: { id: existingTask.id },
          data: {
            data: JSON.stringify({ gameState, timestamp: Date.now() }),
            updated_at: new Date(),
            // Сбрасываем счетчик попыток, если задача была неудачной
            ...(existingTask.status === TaskStatus.FAILED ? { attempts: 0 } : {})
          }
        });
        
        logger.info(`[BackgroundSync] Обновлена существующая задача сохранения для пользователя ${userId}`);
      } else {
        // Создаем новую задачу
        await prisma.syncQueue.create({
          data: {
            user_id: userId,
            operation: 'save_progress',
            status: TaskStatus.PENDING,
            data: JSON.stringify({ gameState, timestamp: Date.now() }),
            created_at: new Date(),
            updated_at: new Date(),
            attempts: 0
          }
        });
        
        logger.info(`[BackgroundSync] Создана новая задача сохранения для пользователя ${userId}`);
      }
      
      return true;
    } catch (error) {
      logger.error(`[BackgroundSync] Ошибка при добавлении задачи сохранения для пользователя ${userId}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Создает новый экземпляр сервиса
   */
  static create(): BackgroundSyncService {
    return new BackgroundSyncService();
  }
}

// Экспортируем экземпляр сервиса
export const backgroundSyncService = BackgroundSyncService.create(); 