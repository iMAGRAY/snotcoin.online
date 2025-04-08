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
  // Определяем режим разработки - если NODE_ENV не определен или пуст, считаем что это режим разработки
  const isDevelopment = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
  
  try {
    // В режиме разработки всегда возвращаем успешный результат
    if (isDevelopment) {
      console.log(`[neynarApi] Режим разработки: имитация успешной валидации для FID ${fid}`);
      return {
        user: {
          fid: fid,
          username: `user${fid}`,
          displayName: `User ${fid}`,
          pfp: {
            url: 'https://warpcast.com/~/default-avatar.png'
          }
        }
      };
    }

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
    
    // В режиме разработки при ошибках тоже возвращаем данные
    if (isDevelopment) {
      console.warn('[neynarApi] Режим разработки: возвращаем данные пользователя при ошибке');
      return {
        user: {
          fid: fid,
          username: `user${fid}`,
          displayName: `User ${fid}`,
          pfp: {
            url: 'https://warpcast.com/~/default-avatar.png'
          }
        }
      };
    }
    
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
  // Определяем режим разработки - если NODE_ENV не определен или пуст, считаем что это режим разработки
  const isDevelopment = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
  
  try {
    // В режиме разработки всегда возвращаем true
    if (isDevelopment) {
      console.log(`[neynarApi] Режим разработки: имитация успешной проверки подписи для FID ${fid}`);
      return true;
    }

    // Используем реальную проверку подписи через Neynar API
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
      const errorData = await response.json().catch(() => ({}));
      console.error('Neynar API signature verification error:', errorData);
      
      // В режиме разработки можно разрешить вход даже при ошибке проверки подписи
      if (isDevelopment) {
        console.warn('[neynarApi] Режим разработки: возвращаем true несмотря на ошибку проверки подписи');
        return true;
      }
      
      return false;
    }
    
    try {
      const data = await response.json();
      
      // Более надежная проверка результата верификации
      // Проверяем наличие поля valid и его значение
      const isValid = data && (data.valid === true || data.result?.valid === true);
      console.log(`[neynarApi] Результат проверки подписи: ${isValid ? 'валидна' : 'невалидна'}`);
      
      return isValid;
    } catch (parseError) {
      console.error('Error parsing Neynar API response:', parseError);
      
      // В режиме разработки при ошибках парсинга считаем подпись валидной
      if (isDevelopment) {
        console.warn('[neynarApi] Режим разработки: возвращаем true при ошибке парсинга');
        return true;
      }
      
      return false;
    }
  } catch (error) {
    console.error('Error verifying Farcaster signature:', error);
    
    // В режиме разработки при ошибках тоже считаем подпись валидной
    if (isDevelopment) {
      console.warn('[neynarApi] Режим разработки: возвращаем true при ошибке проверки подписи');
      return true;
    }
    
    return false;
  }
} 