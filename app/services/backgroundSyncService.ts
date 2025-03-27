/**
 * Сервис фоновой синхронизации для обеспечения целостности данных между Redis и БД
 */

import { PrismaClient } from '@prisma/client';
import { redisService } from './redis';
import { encryptGameSave } from '../utils/saveEncryption';

// Расширяем тип PrismaClient для syncQueue
// @ts-ignore - Используем type assertion для того, чтобы обходить проверку типов
// Временное решение, пока syncQueue не будет добавлен в схему Prisma
type ExtendedPrismaClient = PrismaClient & {
  syncQueue: any
};

// Создаем экземпляр Prisma
const prisma = new PrismaClient() as ExtendedPrismaClient;

// Интервал обработки задач (30 секунд)
const SYNC_INTERVAL = 30 * 1000;

// Максимальное количество попыток выполнения задачи
const MAX_RETRY_ATTEMPTS = 5;

// Задержка между повторными попытками (в миллисекундах)
const RETRY_DELAY_BASE = 5000; // 5 секунд

// Типы задач синхронизации
export enum SyncTaskType {
  REDIS_SYNC = 'REDIS_SYNC',
  DB_SYNC = 'DB_SYNC',
  REPAIR_DATA = 'REPAIR_DATA',
  CLEAN_UP = 'CLEAN_UP'
}

// Статусы задач
export enum SyncTaskStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

/**
 * Сервис фоновой синхронизации
 */
class BackgroundSyncService {
  private isRunning: boolean = false;
  private interval: NodeJS.Timeout | null = null;
  private isProcessingTask: boolean = false;
  private lastSyncTime: Date | null = null;
  private processedTasksCount: number = 0;
  private failedTasksCount: number = 0;
  
  /**
   * Инициализирует сервис фоновой синхронизации
   */
  public initialize(): void {
    if (this.isRunning) {
      console.log('[BackgroundSync] Сервис уже запущен');
      return;
    }
    
    console.log('[BackgroundSync] Инициализация сервиса фоновой синхронизации');
    
    this.start();
    
    // Регистрируем обработчик завершения работы
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }
  
  /**
   * Запускает обработчик задач синхронизации
   */
  public start(): void {
    if (this.isRunning) {
      console.log('[BackgroundSync] Сервис уже запущен');
      return;
    }
    
    console.log('[BackgroundSync] Запуск сервиса фоновой синхронизации');
    
    this.isRunning = true;
    
    // Запускаем интервальную обработку задач
    this.interval = setInterval(() => this.processTasks(), SYNC_INTERVAL);
    
    // Сразу запускаем первую обработку
    this.processTasks();
  }
  
  /**
   * Останавливает обработчик задач синхронизации
   */
  public stop(): void {
    if (!this.isRunning) {
      console.log('[BackgroundSync] Сервис уже остановлен');
      return;
    }
    
    console.log('[BackgroundSync] Остановка сервиса фоновой синхронизации');
    
    this.isRunning = false;
    
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
  
  /**
   * Завершает работу сервиса
   */
  public async shutdown(): Promise<void> {
    console.log('[BackgroundSync] Завершение работы сервиса');
    
    this.stop();
    
    if (this.isProcessingTask) {
      console.log('[BackgroundSync] Ожидание завершения текущей задачи...');
      
      // Ждем завершения текущей задачи (максимум 10 секунд)
      let waitTime = 0;
      while (this.isProcessingTask && waitTime < 10000) {
        await new Promise(resolve => setTimeout(resolve, 500));
        waitTime += 500;
      }
    }
    
    console.log('[BackgroundSync] Сервис успешно завершил работу');
  }
  
  /**
   * Обрабатывает задачи синхронизации
   */
  private async processTasks(): Promise<void> {
    if (this.isProcessingTask) {
      console.log('[BackgroundSync] Пропуск обработки, предыдущая задача ещё выполняется');
      return;
    }
    
    try {
      this.isProcessingTask = true;
      
      // Получаем pending задачи из базы данных
      const pendingTasks = await prisma.syncQueue.findMany({
        where: {
          status: SyncTaskStatus.PENDING,
          attempts: { lt: MAX_RETRY_ATTEMPTS }
        },
        orderBy: [
          { createdAt: 'asc' } // Сначала обрабатываем самые старые задачи
        ],
        take: 10 // Обрабатываем по 10 задач за раз
      });
      
      if (pendingTasks.length === 0) {
        console.log('[BackgroundSync] Нет задач для обработки');
        this.isProcessingTask = false;
        return;
      }
      
      console.log(`[BackgroundSync] Найдено ${pendingTasks.length} задач для обработки`);
      
      // Обрабатываем каждую задачу
      for (const task of pendingTasks) {
        if (!this.isRunning) {
          console.log('[BackgroundSync] Обработка задач прервана из-за остановки сервиса');
          break;
        }
        
        console.log(`[BackgroundSync] Обработка задачи #${task.id} (тип: ${task.operation}, попытка: ${task.attempts + 1}/${MAX_RETRY_ATTEMPTS})`);
        
        try {
          // Отмечаем задачу как обрабатываемую
          await prisma.syncQueue.update({
            where: { id: task.id },
            data: {
              status: SyncTaskStatus.PROCESSING,
              updatedAt: new Date()
            }
          });
          
          // Выполняем задачу в зависимости от типа
          let success = false;
          
          switch (task.operation) {
            case SyncTaskType.REDIS_SYNC:
              success = await this.handleRedisSyncTask(task);
              break;
              
            case SyncTaskType.DB_SYNC:
              success = await this.handleDbSyncTask(task);
              break;
              
            case SyncTaskType.REPAIR_DATA:
              success = await this.handleRepairDataTask(task);
              break;
              
            case SyncTaskType.CLEAN_UP:
              success = await this.handleCleanupTask(task);
              break;
              
            default:
              console.warn(`[BackgroundSync] Неизвестный тип задачи: ${task.operation}`);
              success = false;
          }
          
          if (success) {
            // Отмечаем задачу как выполненную
            await prisma.syncQueue.update({
              where: { id: task.id },
              data: {
                status: SyncTaskStatus.COMPLETED,
                updatedAt: new Date()
              }
            });
            
            console.log(`[BackgroundSync] Задача #${task.id} успешно выполнена`);
            this.processedTasksCount++;
          } else {
            // Увеличиваем счетчик попыток и отмечаем как ожидающую или проваленную
            const attempts = task.attempts + 1;
            const status = attempts >= MAX_RETRY_ATTEMPTS 
              ? SyncTaskStatus.FAILED 
              : SyncTaskStatus.PENDING;
            
            await prisma.syncQueue.update({
              where: { id: task.id },
              data: {
                status,
                attempts,
                updatedAt: new Date()
              }
            });
            
            if (status === SyncTaskStatus.FAILED) {
              console.error(`[BackgroundSync] Задача #${task.id} помечена как проваленная после ${attempts} попыток`);
              this.failedTasksCount++;
            } else {
              console.warn(`[BackgroundSync] Задача #${task.id} не выполнена, будет повторная попытка позже (${attempts}/${MAX_RETRY_ATTEMPTS})`);
            }
          }
        } catch (error) {
          console.error(`[BackgroundSync] Ошибка при обработке задачи #${task.id}:`, error);
          
          // Увеличиваем счетчик попыток
          const attempts = task.attempts + 1;
          const status = attempts >= MAX_RETRY_ATTEMPTS 
            ? SyncTaskStatus.FAILED 
            : SyncTaskStatus.PENDING;
          
          try {
            await prisma.syncQueue.update({
              where: { id: task.id },
              data: {
                status,
                attempts,
                updatedAt: new Date()
              }
            });
          } catch (updateError) {
            console.error(`[BackgroundSync] Ошибка при обновлении статуса задачи #${task.id}:`, updateError);
          }
          
          if (status === SyncTaskStatus.FAILED) {
            this.failedTasksCount++;
          }
        }
        
        // Делаем небольшую паузу между обработкой задач
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      this.lastSyncTime = new Date();
    } catch (error) {
      console.error('[BackgroundSync] Ошибка при обработке задач:', error);
    } finally {
      this.isProcessingTask = false;
    }
  }
  
  /**
   * Обрабатывает задачу синхронизации с Redis
   */
  private async handleRedisSyncTask(task: any): Promise<boolean> {
    try {
      const data = typeof task.data === 'string' ? JSON.parse(task.data) : task.data;
      const userId = data.userId || task.user_id;
      
      if (!userId) {
        console.error('[BackgroundSync] Ошибка: в задаче REDIS_SYNC отсутствует userId');
        return false;
      }
      
      // Получаем данные из БД
      const userProgress = await prisma.progress.findUnique({
        where: { userId: userId }
      });
      
      if (!userProgress) {
        console.warn(`[BackgroundSync] Прогресс пользователя ${userId} не найден в БД`);
        return true; // Считаем задачу выполненной, так как нечего синхронизировать
      }
      
      // Парсим данные игры
      const gameState = JSON.parse(userProgress.gameState as string);
      
      // Сохраняем в Redis
      const redisResult = await redisService.saveGameState(userId, gameState, { isCritical: true });
      
      if (!redisResult.success) {
        console.error(`[BackgroundSync] Ошибка сохранения в Redis: ${redisResult.error}`);
        return false;
      }
      
      console.log(`[BackgroundSync] Успешная синхронизация Redis для пользователя ${userId}`);
      return true;
    } catch (error) {
      console.error('[BackgroundSync] Ошибка при обработке задачи REDIS_SYNC:', error);
      return false;
    }
  }
  
  /**
   * Обрабатывает задачу синхронизации с БД
   */
  private async handleDbSyncTask(task: any): Promise<boolean> {
    try {
      const data = task.data;
      const userId = data.userId;
      const forceSave = data.forceSave === true;
      const encryptedSave = data.encryptedSave;
      
      // Получаем текущее состояние из Redis
      const redisResult = await redisService.loadGameState(userId);
      
      if (!redisResult.success || !redisResult.data) {
        console.error(`[BackgroundSync] Не удалось загрузить состояние из Redis для пользователя ${userId}`);
        return false;
      }
      
      const redisGameState = redisResult.data;
      const redisVersion = redisGameState._saveVersion || 1;
      
      try {
        // Получаем существующий прогресс из БД
        const existingProgress = await prisma.progress.findUnique({
          where: { userId: userId }
        });
        
        // Если нет зашифрованной версии в задаче, но мы можем создать её из Redis
        let encryptedGameState = encryptedSave;
        if (!encryptedGameState && redisGameState) {
          try {
            const { encryptedSave: newEncryptedSave } = await encryptGameSave(redisGameState, userId);
            encryptedGameState = newEncryptedSave;
          } catch (encryptError) {
            console.error(`[BackgroundSync] Ошибка при шифровании состояния:`, encryptError);
            // Продолжаем без шифрования
          }
        }
        
        // Преобразуем gameState в JSON строку
        const gameStateJson = JSON.stringify(redisGameState);
        
        // Проверяем, нужно ли сжимать данные
        const shouldCompress = gameStateJson.length > 50000; // ~50KB
        
        // Обновляем или создаем запись в базе данных
        if (existingProgress) {
          const currentVersion = existingProgress.version;
          
          if (redisVersion > currentVersion || forceSave) {
            await prisma.progress.update({
              where: { userId: userId },
              data: {
                gameState: gameStateJson,
                encryptedState: encryptedGameState, // Добавляем зашифрованную версию
                version: redisVersion > currentVersion ? redisVersion : currentVersion + 1,
                isCompressed: shouldCompress,
                updatedAt: new Date()
              }
            });
            
            console.log(`[BackgroundSync] Обновлен прогресс для пользователя ${userId}, версия: ${redisVersion}`);
            return true;
          } else {
            console.log(`[BackgroundSync] Пропуск обновления, нет новой версии для пользователя ${userId}`);
            return true;
          }
        } else {
          // Создаем новую запись прогресса
          await prisma.progress.create({
            data: {
              userId: userId,
              gameState: gameStateJson,
              encryptedState: encryptedGameState, // Добавляем зашифрованную версию
              version: redisResult.data._saveVersion || 1,
              isCompressed: shouldCompress,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          });
          
          console.log(`[BackgroundSync] Создан новый прогресс для пользователя ${userId}`);
          return true;
        }
      } catch (error) {
        console.error('[BackgroundSync] Ошибка при обработке задачи DB_SYNC:', error);
        return false;
      }
    } catch (error) {
      console.error('[BackgroundSync] Ошибка при обработке задачи DB_SYNC:', error);
      return false;
    }
  }
  
  /**
   * Обрабатывает задачу восстановления данных
   */
  private async handleRepairDataTask(task: any): Promise<boolean> {
    try {
      const data = typeof task.data === 'string' ? JSON.parse(task.data) : task.data;
      const userId = data.userId || task.user_id;
      
      if (!userId) {
        console.error('[BackgroundSync] Ошибка: в задаче REPAIR_DATA отсутствует userId');
        return false;
      }
      
      // Получаем данные из БД
      const userProgress = await prisma.progress.findUnique({
        where: { userId: userId }
      });
      
      if (!userProgress) {
        console.warn(`[BackgroundSync] Прогресс пользователя ${userId} не найден в БД`);
        return true; // Считаем задачу выполненной, нечего восстанавливать
      }
      
      // Парсим и проверяем данные игры
      try {
        const gameState = JSON.parse(userProgress.gameState as string);
        
        // Проверяем наличие основных полей
        const isValid = gameState &&
          gameState.inventory &&
          gameState.upgrades &&
          gameState.container;
        
        if (!isValid) {
          console.error(`[BackgroundSync] Некорректные данные для пользователя ${userId}`);
          
          // Отмечаем как некорректные
          await prisma.progress.update({
            where: { userId: userId },
            data: { 
              // Добавляем метку о некорректности данных в дополнительном поле, если есть
              // Или можно убрать эту строку, так как поля нет в схеме
            }
          });
          
          return false;
        }
        
        // Сохраняем проверенные данные в Redis
        await redisService.saveGameState(userId, gameState, { isCritical: true });
        
        return true;
      } catch (parseError) {
        console.error(`[BackgroundSync] Ошибка при парсинге данных для пользователя ${userId}:`, parseError);
        return false;
      }
    } catch (error) {
      console.error('[BackgroundSync] Ошибка при обработке задачи REPAIR_DATA:', error);
      return false;
    }
  }
  
  /**
   * Обрабатывает задачу очистки
   */
  private async handleCleanupTask(task: any): Promise<boolean> {
    try {
      // Удаляем выполненные задачи старше 7 дней
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      await prisma.syncQueue.deleteMany({
        where: {
          status: SyncTaskStatus.COMPLETED,
          updatedAt: { lt: sevenDaysAgo }
        }
      });
      
      // Получаем задачи, у которых превышено количество попыток
      const failedTasks = await prisma.syncQueue.findMany({
        where: {
          status: SyncTaskStatus.FAILED,
          attempts: { gte: MAX_RETRY_ATTEMPTS }
        }
      });
      
      if (failedTasks.length > 0) {
        console.log(`[BackgroundSync] Найдено ${failedTasks.length} проваленных задач`);
        
        // Создаем записи в логе ошибок
        for (const failedTask of failedTasks) {
          try {
            await prisma.$executeRaw`
              INSERT INTO error_logs (
                error_type, error_message, user_id, data, createdAt
              ) VALUES (
                ${'SYNC_TASK_FAILED'},
                ${'Превышено максимальное количество попыток'},
                ${failedTask.user_id},
                ${JSON.stringify({
                  taskId: failedTask.id,
                  operation: failedTask.operation,
                  attempts: failedTask.attempts,
                  data: failedTask.data
                })},
                ${new Date()}
              )
            `;
          } catch (logError) {
            console.error(`[BackgroundSync] Ошибка при логировании проваленной задачи #${failedTask.id}:`, logError);
          }
        }
        
        // Удаляем проваленные задачи старше 30 дней
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        await prisma.syncQueue.deleteMany({
          where: {
            status: SyncTaskStatus.FAILED,
            updatedAt: { lt: thirtyDaysAgo }
          }
        });
      }
      
      return true;
    } catch (error) {
      console.error('[BackgroundSync] Ошибка при обработке задачи CLEAN_UP:', error);
      return false;
    }
  }
  
  /**
   * Добавляет новую задачу синхронизации с Redis
   */
  public async addRedisSyncTask(userId: string): Promise<boolean> {
    try {
      await prisma.syncQueue.create({
        data: {
          user_id: userId,
          operation: SyncTaskType.REDIS_SYNC,
          data: JSON.stringify({ 
            userId, 
            operation: 'saveGameState',
            timestamp: Date.now() 
          }),
          status: SyncTaskStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      
      return true;
    } catch (error) {
      console.error(`[BackgroundSync] Ошибка при добавлении задачи REDIS_SYNC для ${userId}:`, error);
      return false;
    }
  }
  
  /**
   * Добавляет новую задачу синхронизации с БД
   */
  public async addDbSyncTask(userId: string, forceSave: boolean = false): Promise<boolean> {
    try {
      await prisma.syncQueue.create({
        data: {
          user_id: userId,
          operation: SyncTaskType.DB_SYNC,
          data: JSON.stringify({ 
            userId, 
            forceSave,
            timestamp: Date.now() 
          }),
          status: SyncTaskStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      
      return true;
    } catch (error) {
      console.error(`[BackgroundSync] Ошибка при добавлении задачи DB_SYNC для ${userId}:`, error);
      return false;
    }
  }
  
  /**
   * Получает статистику выполнения задач
   */
  public getStats(): { 
    isRunning: boolean, 
    lastSyncTime: Date | null, 
    processedTasks: number, 
    failedTasks: number 
  } {
    return {
      isRunning: this.isRunning,
      lastSyncTime: this.lastSyncTime,
      processedTasks: this.processedTasksCount,
      failedTasks: this.failedTasksCount
    };
  }
}

// Создаем и экспортируем экземпляр сервиса
export const backgroundSyncService = new BackgroundSyncService();

// Автоматически инициализируем сервис на сервере (не в браузере)
if (typeof window === 'undefined') {
  backgroundSyncService.initialize();
} 