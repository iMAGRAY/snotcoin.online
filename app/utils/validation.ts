import * as crypto from 'crypto'

/**
 * Валидация данных авторизации Telegram с расширенной отладкой
 * 
 * Строго следуя официальной документации:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app
 */
export async function validateTelegramAuth(initData: string): Promise<boolean> {
  try {
    // Проверка на наличие данных
    if (!initData) {
      return false;
    }

    // Проверка наличия токена бота
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      return false;
    }
    
    const params = new URLSearchParams(initData);
    const pairs = Array.from(params.entries());
    
    // Находим и проверяем хеш
    const hash = params.get('hash');
    if (!hash) {
      return false;
    }
    
    // Находим и проверяем auth_date
    const auth_date = params.get('auth_date');
    if (!auth_date) {
      return false;
    }
    
    // Находим и проверяем user
    const user = params.get('user');
    if (!user) {
      return false;
    }
    
    // Проверка срока действия данных аутентификации (24 часа)
    const authTime = parseInt(auth_date, 10) * 1000; // Convert to milliseconds
    const now = Date.now();
    const timeDiff = Math.floor((now - authTime) / 1000);
    
    // Данные устарели (больше 24 часов)
    if (timeDiff > 86400) {
      return false;
    }
    
    // Формируем строку для проверки
    const filteredPairs = pairs.filter(([key]) => key !== 'hash');
    filteredPairs.sort(([a], [b]) => a.localeCompare(b));
    
    const dataCheckString = filteredPairs.map(([key, value]) => `${key}=${value}`).join('\n');
    
    // Создаем HMAC-SHA-256 для проверки
    const secretKey = crypto.createHash('sha256')
      .update(process.env.TELEGRAM_BOT_TOKEN)
      .digest();
    
    const calculatedHash = crypto.createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');
    
    // Проверяем совпадение хешей
    const hashesMatch = calculatedHash === hash;
    
    if (!hashesMatch) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

