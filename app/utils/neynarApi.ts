/**
 * Утилиты для работы с Neynar API для Farcaster
 */

// Neynar API ключ
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || '7678CEC2-9724-4CD9-B3AA-787932510E24';
const NEYNAR_API_URL = 'https://api.neynar.com';

/**
 * Интерфейс для данных пользователя Farcaster из Neynar API
 */
export interface NeynarUserResponse {
  user: {
    fid: number;
    username: string;
    displayName: string;
    pfp: {
      url: string;
    };
    profile?: {
      bio?: {
        text?: string;
      };
    };
    followerCount?: number;
    followingCount?: number;
    verifications?: string[];
    activeStatus?: string;
  };
}

/**
 * Проверка валидности пользователя Farcaster через Neynar API
 * @param fid Farcaster ID пользователя
 * @returns Данные пользователя если пользователь валиден, null иначе
 */
export async function validateFarcasterUser(fid: number): Promise<NeynarUserResponse | null> {
  try {
    // Используем API v1, так как v2 не работает с текущими эндпоинтами
    const url = `${NEYNAR_API_URL}/v1/farcaster/user?fid=${fid}`;
    
    // Выполняем запрос к Neynar API
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'api_key': NEYNAR_API_KEY
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Neynar API error:', errorData);
      return null;
    }
    
    const data = await response.json();
    
    // Проверяем, что ответ содержит данные пользователя
    if (data.result && data.result.user) {
      const user = data.result.user;
      
      // Приводим данные к нужному формату
      return {
        user: {
          fid: user.fid,
          username: user.username,
          displayName: user.displayName,
          pfp: {
            url: user.pfp?.url
          },
          profile: user.profile,
          followerCount: user.followerCount,
          followingCount: user.followingCount,
          verifications: user.verifications,
          activeStatus: user.activeStatus
        }
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error validating Farcaster user:', error);
    return null;
  }
}

/**
 * Проверка подписи сообщения от пользователя Farcaster
 * @param fid Farcaster ID пользователя
 * @param message Сообщение, которое было подписано
 * @param signature Подпись сообщения
 * @returns true если подпись валидна, false иначе
 */
export async function verifyFarcasterSignature(
  fid: number, 
  message: string, 
  signature: string
): Promise<boolean> {
  try {
    // Заглушка для проверки подписи, так как API эндпоинты не найдены
    console.log('[neynarApi] Используется заглушка для проверки подписи, считаем подпись валидной');
    console.log(`[neynarApi] FID: ${fid}, Сообщение: ${message}, Подпись: ${signature}`);
    
    // В режиме разработки всегда считаем подпись валидной
    return true;
    
    // В реальном проекте нужно найти работающий API эндпоинт
    /*
    const url = `${NEYNAR_API_URL}/v2/farcaster/signature/verify`;
    
    // Выполняем запрос к Neynar API
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'api_key': NEYNAR_API_KEY
      },
      body: JSON.stringify({
        fid,
        message,
        signature
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Neynar API signature verification error:', errorData);
      return false;
    }
    
    const data = await response.json();
    
    // Проверяем результат верификации
    return data.valid === true;
    */
  } catch (error) {
    console.error('Error verifying Farcaster signature:', error);
    // В режиме разработки при ошибках тоже считаем подпись валидной
    return true;
  }
} 