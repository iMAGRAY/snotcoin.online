import { FarcasterContext } from '@/app/types/farcaster';
import { UserData } from '@/app/types/auth';
import { prisma } from '@/app/lib/prisma';
import { logAuth, AuthStep, AuthLogType } from '@/app/utils/auth-logger';
import { Prisma, PrismaClient } from '@prisma/client';

// Ключи и конфигурация Neynar API
const NEYNAR_API_KEY = '7678CEC2-9724-4CD9-B3AA-787932510E24';
const NEYNAR_CLIENT_ID = 'd14e5c4b-22a2-4b30-a2f4-0471a147a9b2';
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
      if (!userData.fid) {
        return { isValid: false, error: 'Missing FID in user data' };
      }

      // Логируем начало проверки
      logAuth(
        AuthStep.VALIDATE_DATA,
        AuthLogType.INFO,
        'Начало валидации пользователя через Neynar API',
        { fid: userData.fid, username: userData.username }
      );

      // Используем fetchWithRetry для запроса к Neynar API с повторными попытками
      let neynarData;
      try {
        neynarData = await fetchWithRetry(async () => {
          const response = await fetch(`${NEYNAR_API_URL}/v1/farcaster/user?fid=${userData.fid}`, {
            headers: {
              'Accept': 'application/json',
              'api_key': NEYNAR_API_KEY
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
          { fid: userData.fid },
          fetchError
        );
        return { 
          isValid: false, 
          error: fetchError instanceof Error 
            ? fetchError.message 
            : 'Failed to connect to Neynar API' 
        };
      }

      // В API v1 данные находятся в поле result.user
      if (!neynarData || !neynarData.result || !neynarData.result.user) {
        logAuth(
          AuthStep.VALIDATE_ERROR,
          AuthLogType.ERROR,
          'Neynar API вернул пустой ответ или нет пользователя',
          { fid: userData.fid }
        );
        return { isValid: false, error: 'No user data found' };
      }

      const user = neynarData.result.user;

      // Проверяем, что данные с клиента соответствуют данным от Neynar
      if (user.fid !== userData.fid) {
        logAuth(
          AuthStep.VALIDATE_ERROR,
          AuthLogType.ERROR,
          'Несоответствие FID',
          { clientFid: userData.fid, neynarFid: user.fid }
        );
        return { isValid: false, error: 'FID mismatch' };
      }

      // Нормализация данных пользователя
      const normalizedUser: UserData = {
        id: userData.fid.toString(),
        username: user.username || userData.username,
        fid: userData.fid,
        displayName: user.displayName || userData.displayName,
        avatar: user.pfp?.url || userData.pfp?.url,
        verified: user.verifications?.length > 0 || userData.verified,
        metadata: {
          custody: userData.custody || user.custodyAddress,
          verifications: user.verifications || userData.verifications,
          followerCount: user.followerCount,
          followingCount: user.followingCount,
          profile: {
            bio: user.profile?.bio?.text,
            location: user.profile?.location
          }
        }
      };

      logAuth(
        AuthStep.VALIDATE_SUCCESS,
        AuthLogType.INFO,
        'Пользователь успешно валидирован через Neynar',
        { fid: userData.fid, username: normalizedUser.username }
      );

      return { isValid: true, user: normalizedUser };
    } catch (error) {
      logAuth(
        AuthStep.VALIDATE_ERROR,
        AuthLogType.ERROR,
        'Ошибка при валидации пользователя',
        { fid: userData.fid },
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
        farcaster_pfp: userData.avatar || null
      };

      let updatedUser;
      try {
        if (existingUser) {
          // Обновляем существующего пользователя
          updatedUser = await prisma.user.update({
            where: { id: existingUser.id },
            data: userDataToSave
          });

          logAuth(
            AuthStep.USER_SAVE,
            AuthLogType.INFO,
            'Пользователь успешно обновлен в БД',
            { userId: updatedUser.id, fid: userData.fid }
          );
        } else {
          // Создаем нового пользователя
          updatedUser = await prisma.user.create({
            data: userDataToSave
          });

          logAuth(
            AuthStep.USER_SAVE,
            AuthLogType.INFO,
            'Новый пользователь успешно создан в БД',
            { userId: updatedUser.id, fid: userData.fid }
          );
        }
      } catch (saveError) {
        logAuth(
          AuthStep.USER_SAVE,
          AuthLogType.ERROR,
          'Ошибка при сохранении пользователя в БД',
          { fid: userData.fid },
          saveError
        );
        
        // Обработка известных ошибок Prisma
        const prismaError = saveError as Error;
        if (prismaError.name === 'PrismaClientKnownRequestError' && 
            'code' in prismaError && 
            prismaError.code === 'P2002') {
          return {
            success: false,
            error: 'Duplicate user record'
          };
        }
        
        return {
          success: false,
          error: 'Database error during user save'
        };
      }

      return {
        success: true,
        user: {
          ...userData,
          id: updatedUser.id
        }
      };
    } catch (error) {
      logAuth(
        AuthStep.USER_SAVE,
        AuthLogType.ERROR,
        'Непредвиденная ошибка при сохранении пользователя',
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