/**
 * Мок Farcaster SDK для режима разработчика
 * Позволяет симулировать работу игры внутри Warpcast
 */

import { FarcasterContext, FarcasterSDK, FarcasterUser } from '../../types/farcaster';

// Мок данные пользователя
const DEFAULT_MOCK_USER: FarcasterUser = {
  fid: 19999, // Уникальный FID для разработки
  username: 'dev_user',
  displayName: 'Development User',
  pfp: {
    url: 'https://cdn.warpcast.com/profile-pictures/default-profile.png'
  },
  verified: true,
  custody: {
    address: '0x1234567890abcdef1234567890abcdef12345678',
    type: 'eoa'
  },
  verifications: ['0x1234567890abcdef1234567890abcdef12345678']
};

// Мок контекста
const DEFAULT_MOCK_CONTEXT: FarcasterContext = {
  user: DEFAULT_MOCK_USER,
  authenticated: true,
  verifiedAddresses: ['0x1234567890abcdef1234567890abcdef12345678'],
  requireFarcasterAuth: false
};

/**
 * Класс для создания мока Farcaster SDK
 */
export class FarcasterDevMock implements FarcasterSDK {
  private mockContext: FarcasterContext;
  private mockReady: boolean = false;
  private isDevMode: boolean = false;

  constructor(mockContext: Partial<FarcasterContext> = {}) {
    this.mockContext = {
      ...DEFAULT_MOCK_CONTEXT,
      ...mockContext
    };
    
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
  async getContext(): Promise<FarcasterContext> {
    console.log('[FarcasterDevMock] Getting mock context for user FID:', this.mockContext.user?.fid);
    return Promise.resolve(this.mockContext);
  }

  /**
   * Получение пользователя по FID
   */
  async fetchUserByFid(fid: number): Promise<FarcasterUser | null> {
    console.log('[FarcasterDevMock] Fetching user by FID:', fid);
    
    // Если запрошен наш мок пользователь, возвращаем его
    if (fid === this.mockContext.user?.fid) {
      return Promise.resolve(this.mockContext.user);
    }
    
    // Иначе симулируем другого пользователя
    return Promise.resolve({
      fid,
      username: `user_${fid}`,
      displayName: `User ${fid}`,
      pfp: {
        url: 'https://cdn.warpcast.com/profile-pictures/default-profile.png'
      },
      verified: false
    });
  }

  /**
   * Вход пользователя
   */
  async signIn(): Promise<FarcasterContext> {
    console.log('[FarcasterDevMock] SignIn called');
    return Promise.resolve(this.mockContext);
  }

  /**
   * Выход пользователя
   */
  async signOut(): Promise<void> {
    console.log('[FarcasterDevMock] SignOut called');
    return Promise.resolve();
  }

  /**
   * Изменение мок данных пользователя
   */
  public setMockUser(userData: Partial<FarcasterUser>) {
    this.mockContext.user = {
      ...this.mockContext.user as FarcasterUser,
      ...userData
    };
    console.log('[FarcasterDevMock] Updated mock user:', this.mockContext.user);
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
  get context(): Promise<FarcasterContext> {
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
export const activateFarcasterDevMock = (userData?: Partial<FarcasterUser>): boolean => {
  if (userData) {
    farcasterDevMock.setMockUser(userData);
  }
  return farcasterDevMock.activateMock();
};

// Экспорт функции для деактивации мока
export const deactivateFarcasterDevMock = (): boolean => {
  return farcasterDevMock.deactivateMock();
}; 