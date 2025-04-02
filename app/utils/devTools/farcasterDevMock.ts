/**
 * Мок Farcaster SDK для режима разработчика
 * Позволяет симулировать работу игры внутри Warpcast
 */

import { FarcasterSDK } from '../../types/farcaster.d';

// Интерфейс для внутреннего использования
interface MockUserData {
  fid: number;
  username: string; 
  displayName?: string;
  pfpUrl?: string;
}

/**
 * Класс для создания мока Farcaster SDK
 */
export class FarcasterDevMock implements Partial<FarcasterSDK> {
  private mockFid: number = 123456789;
  private mockUsername: string = 'dev_user';
  private mockDisplayName: string = 'Dev User';
  private mockPfpUrl: string = 'https://cdn.warpcast.com/profile-pictures/default-profile.png';
  private mockReady: boolean = false;
  private isDevMode: boolean = false;

  // Улучшенный объект actions для полной совместимости с Farcaster SDK
  public actions = {
    // Улучшенная реализация ready
    ready: async (options?: { disableNativeGestures?: boolean }): Promise<void> => {
      console.log('[FarcasterDevMock] actions.ready() called', options);
      this.mockReady = true;
      // Запись в консоль для отладки
      if (options?.disableNativeGestures) {
        console.log('[FarcasterDevMock] Native gestures disabled');
      }
      return Promise.resolve();
    },
    
    // Метод для авторизации
    signIn: async ({ nonce }: { nonce: string }): Promise<any> => {
      console.log('[FarcasterDevMock] actions.signIn() called with nonce:', nonce);
      return Promise.resolve({
        signature: 'mock-signature-' + Date.now(),
        message: `I am signing in with my Farcaster account: ${this.mockUsername} (${this.mockFid})\n\nNonce: ${nonce}`
      });
    },
    
    // Просмотр профиля пользователя
    viewProfile: async ({ fid }: { fid: number }): Promise<void> => {
      console.log('[FarcasterDevMock] actions.viewProfile() called for FID:', fid);
      return Promise.resolve();
    },
    
    // Открытие URL
    openUrl: async ({ url }: { url: string }): Promise<void> => {
      console.log('[FarcasterDevMock] actions.openUrl() called with URL:', url);
      // В режиме разработки можно реально открыть URL в новой вкладке
      if (this.isDevMode && typeof window !== 'undefined') {
        window.open(url, '_blank');
      }
      return Promise.resolve();
    },
    
    // Отправка уведомления
    sendNotification: async ({ message, receiverFid }: { message: string; receiverFid: number }): Promise<void> => {
      console.log('[FarcasterDevMock] actions.sendNotification() called:', { message, receiverFid });
      return Promise.resolve();
    },
    
    // Добавление фрейма
    addFrame: async (): Promise<void> => {
      console.log('[FarcasterDevMock] actions.addFrame() called');
      return Promise.resolve();
    },
    
    // Закрытие мини-приложения
    close: async (): Promise<void> => {
      console.log('[FarcasterDevMock] actions.close() called');
      return Promise.resolve();
    }
  };

  constructor(mockData: Partial<MockUserData> = {}) {
    // Обновляем пользователя
    if (mockData.fid) this.mockFid = mockData.fid;
    if (mockData.username) this.mockUsername = mockData.username;
    if (mockData.displayName) this.mockDisplayName = mockData.displayName;
    if (mockData.pfpUrl) this.mockPfpUrl = mockData.pfpUrl;
    
    // Проверяем, находимся ли мы в режиме разработки
    this.isDevMode = process.env.NODE_ENV === 'development';
    
    console.log('[FarcasterDevMock] Initialized in', this.isDevMode ? 'development' : 'production', 'mode');
  }

  /**
   * Активировать мок SDK в режиме разработки
   */
  public activateMock() {
    if (!this.isDevMode) {
      console.warn('[FarcasterDevMock] Попытка активировать мок в продакшн режиме, операция отменена');
      return false;
    }

    if (typeof window !== 'undefined') {
      console.log('[FarcasterDevMock] Активирую мок Farcaster SDK');
      
      // Инъекция мок-объекта в window
      (window as any).farcaster = this;
      (window as any).__FARCASTER_DEV_MODE__ = true;
      
      console.log('[FarcasterDevMock] Мок Farcaster SDK активирован');
      return true;
    }
    
    return false;
  }

  /**
   * Деактивировать мок SDK
   */
  public deactivateMock() {
    if (typeof window !== 'undefined' && (window as any).__FARCASTER_DEV_MODE__) {
      delete (window as any).farcaster;
      delete (window as any).__FARCASTER_DEV_MODE__;
      console.log('[FarcasterDevMock] Мок Farcaster SDK деактивирован');
      return true;
    }
    
    return false;
  }

  /**
   * Инициализация SDK
   */
  async ready(): Promise<void> {
    console.log('[FarcasterDevMock] SDK ready() called');
    this.mockReady = true;
    return Promise.resolve();
  }

  /**
   * Получение контекста пользователя
   */
  async getContext(): Promise<any> {
    console.log('[FarcasterDevMock] Getting mock context for user FID:', this.mockFid);
    
    // Обновленный формат для совместимости с Mini App SDK и Context
    return Promise.resolve({
      fid: this.mockFid,
      username: this.mockUsername, 
      displayName: this.mockDisplayName,
      pfp: { 
        url: this.mockPfpUrl,
        verified: true
      },
      // Дополнительные необходимые поля
      user: {
        fid: this.mockFid,
        username: this.mockUsername,
        displayName: this.mockDisplayName,
        pfp: { 
          url: this.mockPfpUrl,
          verified: true
        }
      },
      custody: {
        address: '0x1234567890123456789012345678901234567890',
        type: 'eoa'
      },
      client: {
        clientFid: 9152, // Warpcast FID
        added: true,
        safeAreaInsets: {
          top: 0,
          bottom: 20,
          left: 0,
          right: 0
        }
      },
      verifications: [],
      authenticated: true,
      verifiedAddresses: ['0x1234567890123456789012345678901234567890'],
      requireFarcasterAuth: false
    });
  }

  /**
   * Получение пользователя по FID
   */
  async fetchUserByFid(fid: number): Promise<any> {
    console.log('[FarcasterDevMock] Fetching user by FID:', fid);
    
    // Если запрошен наш мок пользователь, возвращаем его
    if (fid === this.mockFid) {
      return Promise.resolve({
        fid: this.mockFid,
        username: this.mockUsername,
        displayName: this.mockDisplayName,
        pfp: { 
          url: this.mockPfpUrl,
          verified: true
        }
      });
    }
    
    // Иначе симулируем другого пользователя
    return Promise.resolve({
      fid,
      username: `user_${fid}`,
      displayName: `User ${fid}`,
      pfp: { 
        url: 'https://cdn.warpcast.com/profile-pictures/default-profile.png',
        verified: false
      }
    });
  }

  /**
   * Публикация каста (заглушка)
   */
  async publishCast(text: string | any): Promise<{ hash: string; timestamp: number }> {
    console.log('[FarcasterDevMock] PublishCast called with:', text);
    return Promise.resolve({
      hash: `mock-hash-${Date.now()}`,
      timestamp: Date.now()
    });
  }

  /**
   * Изменение мок данных пользователя
   */
  public setMockUser(userData: Partial<MockUserData>) {
    // Обновляем пользователя
    if (userData.fid) this.mockFid = userData.fid;
    if (userData.username) this.mockUsername = userData.username; 
    if (userData.displayName) this.mockDisplayName = userData.displayName;
    if (userData.pfpUrl) this.mockPfpUrl = userData.pfpUrl;
    
    console.log('[FarcasterDevMock] Updated mock user:', {
      fid: this.mockFid,
      username: this.mockUsername,
      displayName: this.mockDisplayName,
      pfp: { 
        url: this.mockPfpUrl,
        verified: true
      }
    });
  }

  /**
   * Получить статус готовности SDK
   */
  get isReady(): boolean {
    return this.mockReady;
  }

  /**
   * Получить контекст
   */
  get context(): Promise<any> {
    return this.getContext();
  }
}

// Экспорт экземпляра мока для использования в приложении
export const farcasterDevMock = new FarcasterDevMock();

// Экспорт функции для проверки, активирован ли мок
export const isFarcasterDevMockActive = (): boolean => {
  return typeof window !== 'undefined' && !!(window as any).__FARCASTER_DEV_MODE__;
};

// Экспорт функции для активации мока
export const activateFarcasterDevMock = (userData?: Partial<MockUserData>): boolean => {
  if (userData) {
    farcasterDevMock.setMockUser(userData);
  }
  return farcasterDevMock.activateMock();
};

// Экспорт функции для деактивации мока
export const deactivateFarcasterDevMock = (): boolean => {
  return farcasterDevMock.deactivateMock();
}; 