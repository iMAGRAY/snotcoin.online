/**
 * Утилиты для работы с Neynar API для Farcaster
 */

// Neynar API ключ
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || '7678CEC2-9724-4CD9-B3AA-787932510E24';
const NEYNAR_API_URL = 'https://api.neynar.com/v2';

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
 * @returns Данные пользователя если пользователь валидный, null иначе
 */
export async function validateFarcasterUser(fid: number): Promise<NeynarUserResponse | null> {
  try {
    // URL для получения пользователя по FID
    const url = `${NEYNAR_API_URL}/farcaster/user?fid=${fid}`;
    
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
    
    // Получаем данные пользователя
    const data = await response.json();
    return data as NeynarUserResponse;
  } catch (error) {
    console.error('Error validating Farcaster user:', error);
    return null;
  }
}

/**
 * Верифицирует подпись сообщения от пользователя Farcaster
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
    // URL для проверки подписи
    const url = `${NEYNAR_API_URL}/farcaster/signature/verify`;
    
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
    
    // Получаем результат проверки
    const data = await response.json();
    return data.valid === true;
  } catch (error) {
    console.error('Error verifying Farcaster signature:', error);
    return false;
  }
}

/**
 * Создает временный код для аутентификации через QR-код или глубокую ссылку
 * @returns Временный код для аутентификации
 */
export async function createSignInWithFarcasterRequest(): Promise<{
  token: string;
  url: string;
  qrCode: string;
  expiresAt: Date;
} | null> {
  try {
    const url = `${NEYNAR_API_URL}/farcaster/auth/request`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'api_key': NEYNAR_API_KEY
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Neynar API auth request error:', errorData);
      return null;
    }
    
    const data = await response.json();
    
    // Вычисляем срок действия токена (10 минут от текущего времени)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);
    
    return {
      token: data.token,
      url: data.url,
      qrCode: data.qr_code,
      expiresAt
    };
  } catch (error) {
    console.error('Error creating Farcaster auth request:', error);
    return null;
  }
}

/**
 * Проверяет статус аутентификации по временному коду
 * @param token Временный код для аутентификации
 * @returns Данные пользователя если аутентификация успешна, null иначе
 */
export async function checkFarcasterAuthStatus(token: string): Promise<{
  status: 'pending' | 'approved' | 'expired';
  fid?: number;
  username?: string;
  displayName?: string;
  pfp?: string;
} | null> {
  try {
    const url = `${NEYNAR_API_URL}/farcaster/auth/status?token=${token}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'api_key': NEYNAR_API_KEY
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Neynar API auth status error:', errorData);
      return null;
    }
    
    const data = await response.json();
    
    // Если статус "approved", извлекаем данные пользователя
    if (data.status === 'approved' && data.user) {
      return {
        status: 'approved',
        fid: data.user.fid,
        username: data.user.username,
        displayName: data.user.display_name,
        pfp: data.user.pfp_url
      };
    }
    
    // Если статус "pending" или "expired"
    return {
      status: data.status
    };
  } catch (error) {
    console.error('Error checking Farcaster auth status:', error);
    return null;
  }
} 