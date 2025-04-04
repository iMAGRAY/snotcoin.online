import { FarcasterContext } from '@/app/types/farcaster';
import { UserData } from '@/app/types/auth';
import { prisma } from '@/app/lib/prisma';
import { logAuth, AuthStep, AuthLogType } from '@/app/utils/auth-logger';
import { Prisma, PrismaClient } from '@prisma/client';

// Ключи и конфигурация Neynar API
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || '7678CEC2-9724-4CD9-B3AA-787932510E24';
const NEYNAR_CLIENT_ID = process.env.NEYNAR_CLIENT_ID || 'd14e5c4b-22a2-4b30-a2f4-0471a147a9b2';
const NEYNAR_API_URL = 'https://api.neynar.com';
const NEYNAR_HUB_URL = 'hub-grpc-api.neynar.com';

// Параметры для повторных попыток
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 секунда
const API_TIMEOUT = 10000; // 10 секунд

/**
 * Функция для выполнения запросов с повторными попытками
 * @param fetchFunction Функция для выполнения запроса
 * @param retries Количество повторных попыток
 * @param delay Задержка между попытками в мс
 */
async function fetchWithRetry<T>(
  fetchFunction: () => Promise<T>,
  retries: number = MAX_RETRIES,
  delay: number = RETRY_DELAY
): Promise<T> {
  try {
    return await fetchFunction();
  } catch (error) {
    if (retries > 0) {
      // Логируем повторную попытку
      console.warn(`[Neynar] Fetch failed, retrying... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`, error);
      
      // Ждем перед повторной попыткой
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Рекурсивно пытаемся снова с увеличенной задержкой
      return fetchWithRetry(fetchFunction, retries - 1, delay * 1.5);
    }
    
    // Если исчерпаны все попытки, выбрасываем ошибку
    throw error;
  }
}

/**
 * Создает сигнал для прерывания запроса по тайм-ауту
 * @param timeout Время ожидания в мс
 */
function createTimeoutSignal(timeout: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeout);
  return controller.signal;
}

/**
 * Класс для работы с Neynar API
 */
export class NeynarService {
  /**
   * Проверяет валидность данных пользователя Farcaster
   * @param userData Данные пользователя из Farcaster SDK
   * @returns Объект с результатом валидации
   */
  public async validateFarcasterUser(userData: FarcasterContext): Promise<{
    isValid: boolean;
    user?: UserData;
    error?: string;
  }> {
    try {
      if (!userData.user?.fid) {
        return { isValid: false, error: 'Missing FID in user data' };
      }

      const userContext = userData.user;
      if (!userContext) {
        return { isValid: false, error: 'Missing user data' };
      }

      // Логируем начало проверки
      logAuth(
        AuthStep.VALIDATE_DATA,
        AuthLogType.INFO,
        'Начало валидации пользователя через Neynar API',
        { fid: userContext.fid, username: userContext.username }
      );

      // Используем fetchWithRetry для запроса к Neynar API с повторными попытками
      let neynarData;
      try {
        neynarData = await fetchWithRetry(async () => {
          const response = await fetch(`${NEYNAR_API_URL}/v2/user?fid=${userContext.fid}`, {
            headers: {
              'Accept': 'application/json',
              'api_key': NEYNAR_API_KEY,
              'X-Client-ID': NEYNAR_CLIENT_ID
            },
            // Добавляем тайм-аут для запроса через контроллер
            signal: createTimeoutSignal(API_TIMEOUT)
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(`Neynar API error: ${errorData.message || response.statusText}`);
          }

          return response.json();
        });
      } catch (fetchError) {
        logAuth(
          AuthStep.VALIDATE_ERROR,
          AuthLogType.ERROR,
          'Ошибка при запросе к Neynar API',
          { fid: userContext.fid },
          fetchError
        );
        return { 
          isValid: false, 
          error: fetchError instanceof Error 
            ? fetchError.message 
            : 'Failed to connect to Neynar API' 
        };
      }

      // В API v2 данные находятся в поле result.user
      const user = neynarData?.result?.user || neynarData?.user;
      
      if (!user) {
        logAuth(
          AuthStep.VALIDATE_ERROR,
          AuthLogType.ERROR,
          'Neynar API вернул пустой ответ или нет пользователя',
          { fid: userContext.fid, response: JSON.stringify(neynarData).substring(0, 200) }
        );
        return { isValid: false, error: 'No user data found in Neynar response' };
      }

      // Проверяем, что данные с клиента соответствуют данным от Neynar
      if (user.fid !== userContext.fid) {
        logAuth(
          AuthStep.VALIDATE_ERROR,
          AuthLogType.ERROR,
          'Несоответствие FID',
          { clientFid: userContext.fid, neynarFid: user.fid }
        );
        return { isValid: false, error: 'FID mismatch between client and Neynar' };
      }

      // Нормализация данных пользователя
      const normalizedUser: UserData = {
        id: String(userContext.fid), // Используем FID как основной идентификатор
        username: user.username || userContext.username || `user_${userContext.fid}`,
        fid: userContext.fid,
        displayName: user.displayName || userContext.displayName || user.username || `User ${userContext.fid}`,
        avatar: user.pfp?.url || userContext.pfp?.url,
        verified: Boolean(user.verifications?.length) || false,
        metadata: {
          custody: user.custodyAddress || null,
          verifications: user.verifications || [],
          followerCount: user.followerCount || 0,
          followingCount: user.followingCount || 0,
          profile: {
            bio: user.profile?.bio?.text || user.bio?.text || '',
            location: user.profile?.location || ''
          }
        }
      };

      logAuth(
        AuthStep.VALIDATE_SUCCESS,
        AuthLogType.INFO,
        'Пользователь успешно валидирован через Neynar',
        { fid: userContext.fid, username: normalizedUser.username }
      );

      return { isValid: true, user: normalizedUser };
    } catch (error) {
      logAuth(
        AuthStep.VALIDATE_ERROR,
        AuthLogType.ERROR,
        'Ошибка при валидации пользователя',
        { fid: userData.user?.fid },
        error
      );
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown error during validation'
      };
    }
  }

  /**
   * Сохраняет или обновляет пользователя в базе данных
   * @param userData Проверенные данные пользователя
   * @returns Объект с результатом операции
   */
  public async saveUserToDatabase(userData: UserData): Promise<{
    success: boolean;
    user?: UserData;
    error?: string;
  }> {
    try {
      logAuth(
        AuthStep.USER_SAVE,
        AuthLogType.INFO,
        'Начало сохранения пользователя в БД',
        { fid: userData.fid, username: userData.username }
      );

      // Проверка и подготовка данных
      if (!userData.fid) {
        return {
          success: false,
          error: 'Missing required field: fid'
        };
      }

      // Проверяем, существует ли пользователь
      let existingUser;
      try {
        existingUser = await prisma.user.findFirst({
          where: { 
            farcaster_fid: userData.fid.toString()  // Используем правильное имя поля из базы данных
          }
        });
      } catch (dbError) {
        logAuth(
          AuthStep.USER_SAVE,
          AuthLogType.ERROR,
          'Ошибка при поиске пользователя в БД',
          { fid: userData.fid },
          dbError
        );
        return {
          success: false,
          error: 'Database error during user lookup'
        };
      }

      // Подготовка данных пользователя для сохранения
      const userDataToSave = {
        farcaster_fid: userData.fid.toString(),
        farcaster_username: userData.username || '',
        farcaster_displayname: userData.displayName || null,
        farcaster_pfp: userData.avatar || null,
        metadata: userData.metadata || {}
      };

      let updatedUser;
      try {
        if (existingUser) {
          // Обновляем существующего пользователя
          logAuth(
            AuthStep.USER_SAVE,
            AuthLogType.INFO,
            'Обновление существующего пользователя',
            { userId: existingUser.id, fid: userData.fid }
          );
          
          updatedUser = await prisma.user.update({
            where: { id: existingUser.id },
            data: userDataToSave
          });
          
          // Проверка наличия прогресса игры
          const progress = await prisma.progress.findUnique({
            where: { user_id: existingUser.id }
          });
          
          // Если прогресса нет, создаем его с начальным состоянием
          if (!progress) {
            logAuth(
              AuthStep.USER_SAVE,
              AuthLogType.INFO,
              'Создание нового прогресса для существующего пользователя',
              { userId: existingUser.id, fid: userData.fid }
            );
            
            await prisma.progress.create({
              data: {
                user_id: existingUser.id,
                game_state: {
                  _saveVersion: 1,
                  _savedAt: new Date().toISOString(),
                  level: 1,
                  score: 0,
                  inventory: [],
                  achievements: [],
                  tutorials_seen: []
                },
                version: 1
              }
            });
          }
        } else {
          // Создаем нового пользователя
          logAuth(
            AuthStep.USER_SAVE,
            AuthLogType.INFO,
            'Создание нового пользователя',
            { fid: userData.fid }
          );
          
          // Генерируем стабильный ID на основе FID
          const stableUserId = `user_${userData.fid}_${Date.now()}`;
          
          // Создаем пользователя с указанным ID
          updatedUser = await prisma.user.create({
            data: {
              id: stableUserId,
              ...userDataToSave,
              progress: {
                create: {
                  game_state: {
                    _saveVersion: 1,
                    _savedAt: new Date().toISOString(),
                    level: 1,
                    score: 0,
                    inventory: [],
                    achievements: [],
                    tutorials_seen: []
                  },
                  version: 1
                }
              }
            }
          });
          
          logAuth(
            AuthStep.USER_SAVE,
            AuthLogType.INFO,
            'Создан новый пользователь с прогрессом',
            { userId: stableUserId, fid: userData.fid }
          );
        }
      } catch (dbSaveError) {
        logAuth(
          AuthStep.USER_SAVE,
          AuthLogType.ERROR,
          'Ошибка при сохранении пользователя в БД',
          { fid: userData.fid },
          dbSaveError
        );
        return {
          success: false,
          error: dbSaveError instanceof Error ? 
            dbSaveError.message : 
            'Database error during user save/update'
        };
      }

      // Возвращаем успешный результат
      return {
        success: true,
        user: {
          id: updatedUser.id,
          fid: Number(updatedUser.farcaster_fid),
          username: updatedUser.farcaster_username || `user_${updatedUser.farcaster_fid}`,
          displayName: updatedUser.farcaster_displayname || updatedUser.farcaster_username || `User ${updatedUser.farcaster_fid}`,
          avatar: updatedUser.farcaster_pfp,
          verified: userData.verified || false,
          metadata: updatedUser.metadata || userData.metadata || {}
        }
      };
    } catch (error) {
      logAuth(
        AuthStep.USER_SAVE,
        AuthLogType.ERROR,
        'Общая ошибка при сохранении пользователя',
        { fid: userData.fid },
        error
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during user save'
      };
    }
  }
}

export const neynarService = new NeynarService(); 