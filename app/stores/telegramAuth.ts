/**
 * Хранилище для данных телеграм-аутентификации в памяти браузера
 */
const telegramAuthStore = {
  // Данные для инициализации
  lastTgInitdata: null as string | null,
  fallbackAuthToken: null as string | null,
  
  // Методы для работы с данными
  saveInitData(data: string) {
    this.lastTgInitdata = data;
    
    // Опционально сохраняем в localStorage
    try {
      localStorage.setItem('tg_init_data', data);
    } catch (e) {
      console.warn('Не удалось сохранить initData в localStorage');
    }
  },
  
  getInitData(): string | null {
    // Если данные есть в памяти, возвращаем их
    if (this.lastTgInitdata) {
      return this.lastTgInitdata;
    }
    
    // Иначе пытаемся восстановить из localStorage
    try {
      const savedData = localStorage.getItem('tg_init_data');
      if (savedData) {
        this.lastTgInitdata = savedData;
        return savedData;
      }
    } catch (e) {
      console.warn('Не удалось получить initData из localStorage');
    }
    
    return null;
  },
  
  saveFallbackToken(token: string) {
    this.fallbackAuthToken = token;
    
    // Опционально сохраняем в localStorage
    try {
      localStorage.setItem('tg_fallback_token', token);
    } catch (e) {
      console.warn('Не удалось сохранить fallback токен в localStorage');
    }
  },
  
  getFallbackToken(): string | null {
    // Если токен есть в памяти, возвращаем его
    if (this.fallbackAuthToken) {
      return this.fallbackAuthToken;
    }
    
    // Иначе пытаемся восстановить из localStorage
    try {
      const savedToken = localStorage.getItem('tg_fallback_token');
      if (savedToken) {
        this.fallbackAuthToken = savedToken;
        return savedToken;
      }
    } catch (e) {
      console.warn('Не удалось получить fallback токен из localStorage');
    }
    
    return null;
  },
  
  // Очистка данных
  clear() {
    this.lastTgInitdata = null;
    this.fallbackAuthToken = null;
    
    try {
      localStorage.removeItem('tg_init_data');
      localStorage.removeItem('tg_fallback_token');
    } catch (e) {
      console.warn('Не удалось очистить данные Telegram в localStorage');
    }
  }
};

export default telegramAuthStore; 