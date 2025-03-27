import { NextRequest, NextResponse } from 'next/server';
import { sign, verify } from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { UserModel } from '../../../utils/models';

const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-do-not-use-in-production';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'your-refresh-secret-do-not-use-in-production';

// Срок действия JWT токена: 1 час
const TOKEN_EXPIRY = '1h';
// Срок действия Refresh токена: 30 дней
const REFRESH_EXPIRY = '30d';

/**
 * Обработчик для обновления JWT токена с помощью refresh token
 */
export async function POST(request: NextRequest) {
  try {
    // Получаем refresh_token из куки
    const cookieStore = cookies();
    const refreshToken = cookieStore.get('refresh_token')?.value;

    if (!refreshToken) {
      console.error('[API][Refresh] Отсутствует refresh token в запросе');
      return NextResponse.json(
        { success: false, error: 'Refresh token not provided' },
        { status: 401 }
      );
    }

    // Проверяем валидность refresh токена
    try {
      const decodedRefresh = verify(refreshToken, REFRESH_SECRET) as {
        fid: string;
        userId: string;
        provider?: string;
      };

      // Проверяем наличие необходимых полей в токене
      if (!decodedRefresh || !decodedRefresh.userId) {
        console.error('[API][Refresh] Некорректная структура refresh токена');
        return NextResponse.json(
          { success: false, error: 'Invalid refresh token structure' },
          { status: 401 }
        );
      }

      // Определяем провайдер
      const provider = decodedRefresh.provider || 
                    (decodedRefresh.fid ? 'farcaster' : 
                     decodedRefresh.userId.startsWith('google_') ? 'google' :
                     decodedRefresh.userId.startsWith('local_') ? 'local' : 'unknown');

      let userData;
      try {
        // Получаем пользователя из БД
        const user = await UserModel.findByFarcasterId(decodedRefresh.fid);

        if (user) {
          userData = {
            id: user.id,
            fid: Number(user.farcaster_fid),
            farcaster_fid: user.farcaster_fid,
            username: user.farcaster_username,
            displayName: user.farcaster_displayname
          };
        }
      } catch (userError) {
        console.warn('[API][Refresh] Ошибка при получении пользователя:', userError);
        // Продолжаем выполнение, используя данные из токена
      }

      // Если пользователь не найден в БД, используем данные из токена
      if (!userData) {
        console.warn('[API][Refresh] Пользователь не найден в БД, используем данные из токена');
        userData = {
          id: decodedRefresh.userId,
          fid: decodedRefresh.fid,
          farcaster_fid: decodedRefresh.fid,
          username: `user${decodedRefresh.fid}`,
          displayName: `User ${decodedRefresh.fid}`
        };
      }

      // Создаем новый access токен
      const token = sign(
        {
          fid: userData.fid,
          farcaster_fid: userData.farcaster_fid,
          username: userData.username,
          displayName: userData.displayName,
          userId: userData.id,
          provider: provider
        },
        JWT_SECRET,
        { expiresIn: TOKEN_EXPIRY }
      );

      // Создаем новый refresh токен
      const newRefreshToken = sign(
        {
          fid: userData.fid,
          userId: userData.id,
          provider: provider
        },
        REFRESH_SECRET,
        { expiresIn: REFRESH_EXPIRY }
      );

      // Устанавливаем новый refresh токен в куки
      cookieStore.set({
        name: 'refresh_token',
        value: newRefreshToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 30 * 24 * 60 * 60, // 30 дней в секундах
      });

      // Возвращаем новый access токен
      return NextResponse.json({
        success: true,
        token: token,
        user: userData
      });
    } catch (error) {
      console.error('[API][Refresh] Ошибка при проверке refresh токена:', error);
      return NextResponse.json(
        { success: false, error: 'Invalid refresh token' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('[API][Refresh] Общая ошибка при обновлении токена:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 