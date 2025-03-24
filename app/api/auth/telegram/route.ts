import { NextResponse } from 'next/server'
import { validateTelegramAuth } from '../../../utils/validation'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { AuthLogType, AuthStep, logAuth } from '../../../utils/auth-logger'

// Создаем клиент Supabase за пределами обработчика
let supabaseAdmin: any = null
try {
  supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_KEY ?? ''
  )
} catch (error) {
  console.error('[SUPABASE_INIT_ERROR]', error)
  logAuth(AuthStep.SERVER_ERROR, AuthLogType.ERROR, 'Ошибка инициализации Supabase', null, error)
}

// Определяем поддерживаемые HTTP методы
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Функция для генерации ID логирования
 */
function generateLogId() {
  return `auth_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Структурированное логирование процесса авторизации
 */
function authLog(logId: string, step: string, message: string, data?: any, error?: any) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    logId,
    step,
    message,
    ...(data && { data }),
    ...(error && { error: typeof error === 'object' ? { 
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(error.code && { code: error.code }),
      ...(error.status && { status: error.status }),
    } : error }),
  };
  
  console.log(`[AUTH_LOG] ${JSON.stringify(logEntry)}`);
  
  // Дублируем логирование через новую систему
  const stepMapping: Record<string, AuthStep> = {
    'START': AuthStep.SERVER_REQUEST,
    'REQUEST_DATA': AuthStep.SERVER_REQUEST, 
    'REQUEST_PARSE_ERROR': AuthStep.SERVER_ERROR,
    'FORCE_LOGIN_CHECK': AuthStep.SERVER_REQUEST,
    'FORCE_LOGIN_GENERATION': AuthStep.SERVER_REQUEST,
    'FORCE_LOGIN_DATA': AuthStep.SERVER_REQUEST,
    'INVALID_INIT_DATA': AuthStep.VALIDATE_TELEGRAM,
    'FORCE_LOGIN_PARSED': AuthStep.VALIDATE_TELEGRAM,
    'PARSE_INIT_DATA': AuthStep.VALIDATE_TELEGRAM,
    'USER_DATA_PARSED': AuthStep.VALIDATE_TELEGRAM,
    'USER_DATA_PARSE_ERROR': AuthStep.SERVER_ERROR,
    'USER_DATA_MISSING': AuthStep.SERVER_ERROR,
    'INIT_DATA_PARSE_ERROR': AuthStep.SERVER_ERROR,
    'FALLBACK_TELEGRAM_ID': AuthStep.VALIDATE_TELEGRAM,
    'MISSING_TELEGRAM_ID': AuthStep.SERVER_ERROR,
    'VALIDATE_TELEGRAM_DATA': AuthStep.VALIDATE_TELEGRAM,
    'INVALID_TELEGRAM_DATA': AuthStep.SERVER_ERROR,
    'TELEGRAM_DATA_VALID': AuthStep.VALIDATE_TELEGRAM,
    'TELEGRAM_VALIDATION_ERROR': AuthStep.SERVER_ERROR,
    'DB_USER_SEARCH': AuthStep.DATABASE_QUERY,
    'DB_SEARCH_ERROR': AuthStep.SERVER_ERROR,
    'USER_SEARCH_RESULT': AuthStep.DATABASE_QUERY,
    'USER_CREATION': AuthStep.USER_CREATED,
    'DB_USER_INSERT': AuthStep.DATABASE_QUERY,
    'DB_USER_INSERT_ERROR': AuthStep.SERVER_ERROR,
    'USER_CREATED': AuthStep.USER_CREATED,
    'INITIAL_GAME_STATE': AuthStep.USER_CREATED,
    'AUTH_USER_CHECK': AuthStep.DATABASE_QUERY,
    'AUTH_USER_CREATION': AuthStep.USER_CREATED,
    'AUTH_USER_CREATION_ERROR': AuthStep.SERVER_ERROR,
    'AUTH_USER_CREATED': AuthStep.USER_CREATED,
    'AUTH_USER_CHECK_ERROR': AuthStep.SERVER_ERROR,
    'AUTH_USER_EXISTS': AuthStep.USER_UPDATED,
    'AUTH_USER_UPDATE_ERROR': AuthStep.SERVER_ERROR,
    'AUTH_USER_UPDATED': AuthStep.USER_UPDATED,
    'AUTH_USER_CRITICAL_ERROR': AuthStep.SERVER_ERROR,
    'EXISTING_USER': AuthStep.USER_UPDATED,
    'TOKEN_GENERATION': AuthStep.TOKEN_GENERATED,
    'TOKEN_UPDATE': AuthStep.DATABASE_QUERY,
    'TOKEN_UPDATE_ERROR': AuthStep.SERVER_ERROR,
    'TOKEN_UPDATED': AuthStep.TOKEN_GENERATED,
    'TOKEN_UPDATE_EXCEPTION': AuthStep.SERVER_ERROR,
    'AUTH_SUCCESS': AuthStep.SERVER_RESPONSE,
    'AUTH_CRITICAL_ERROR': AuthStep.SERVER_ERROR
  };
  
  const logType = error ? AuthLogType.ERROR : 
                 step.includes('ERROR') ? AuthLogType.ERROR : 
                 step.includes('WARNING') ? AuthLogType.WARNING :
                 AuthLogType.INFO;
                 
  const authStep = stepMapping[step] || AuthStep.SERVER_REQUEST;
  
  // Логируем через новую систему
  logAuth(authStep, logType, `[${logId}] ${message}`, data, error, {
    endpoint: '/api/auth/telegram',
    method: 'POST'
  });
  
  return logEntry;
}

export async function POST(request: Request) {
  const logId = generateLogId();
  authLog(logId, 'START', 'Начало процесса авторизации через Telegram');
  
  try {
    // Получаем данные от клиента
    let userData;
    try {
      userData = await request.json()
      authLog(logId, 'REQUEST_DATA', 'Данные запроса получены', { 
        hasInitData: !!userData?.initData,
        initDataLength: userData?.initData?.length,
        hasTelegramId: !!userData?.telegramId,
      });
    } catch (err) {
      const error = err as Error
      authLog(logId, 'REQUEST_PARSE_ERROR', 'Ошибка парсинга тела запроса', null, error);
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

    // Проверяем наличие заголовка принудительного входа
    const isForceLogin = request.headers.get('X-Force-Login') === 'true' || userData?.force_login === true;
    authLog(logId, 'FORCE_LOGIN_CHECK', `Принудительный вход: ${isForceLogin}`);

    // Проверяем наличие и качество initData
    if (!userData?.initData || userData?.initData?.length < 10) {
      // Если это принудительный вход, то не требуем корректных данных
      if (isForceLogin) {
        authLog(logId, 'FORCE_LOGIN_GENERATION', 'Генерация данных для принудительного входа');
        // Генерируем случайный ID если не предоставлен
        const telegramId = userData?.telegramId || Math.floor(Math.random() * 1000000) + 1000000;
        const username = userData?.username || `force_user_${telegramId}`;
        const firstName = userData?.first_name || 'Force';
        const lastName = userData?.last_name || 'Login';
        const authDate = userData?.auth_date || Math.floor(Date.now() / 1000);
        
        // Создаем фейковые данные для форсированного входа
        const params = new URLSearchParams();
        params.append('user', JSON.stringify({
          id: telegramId,
          first_name: firstName,
          last_name: lastName,
          username: username
        }));
        params.append('auth_date', String(authDate));
        params.append('hash', 'forced_login_hash');
        userData.initData = params.toString();
        userData.telegramId = telegramId;
        
        authLog(logId, 'FORCE_LOGIN_DATA', 'Сгенерированы данные для принудительного входа', { 
          telegramId, 
          username,
          authDate 
        });
      } else {
        authLog(logId, 'INVALID_INIT_DATA', 'Отсутствуют или некорректны данные initData', {
          initDataPresent: !!userData?.initData,
          initDataLength: userData?.initData?.length
        });
        return NextResponse.json(
          { error: 'Missing or invalid initData field' },
          { status: 400 }
        )
      }
    }
    
    // Извлекаем данные пользователя и auth_date из initData
    let telegramId: number | undefined;
    let username: string | undefined;
    let firstName: string | undefined;
    let lastName: string | undefined;
    let authDate: number | undefined;
    
    // Если это принудительный вход, используем переданные данные
    if (isForceLogin) {
      telegramId = userData.telegramId;
      username = userData.username;
      firstName = userData.first_name;
      lastName = userData.last_name;
      authDate = userData.auth_date;
      
      authLog(logId, 'FORCE_LOGIN_PARSED', 'Использованы переданные данные для принудительного входа', {
        telegramId,
        username,
        firstName,
        lastName,
        authDate
      });
    } else {
      // Разбираем initData в стандартном режиме
      authLog(logId, 'PARSE_INIT_DATA', 'Начало разбора данных initData');
      const parsedInitData = new URLSearchParams(userData.initData);
      
      try {
        // Пытаемся получить данные пользователя из initData
        const userDataStr = parsedInitData.get('user');
        if (userDataStr) {
          try {
            const user = JSON.parse(decodeURIComponent(userDataStr));
            telegramId = user.id;
            username = user.username;
            firstName = user.first_name || '';
            lastName = user.last_name || '';
            authDate = parseInt(parsedInitData.get('auth_date') || '0');
            
            authLog(logId, 'USER_DATA_PARSED', 'Данные пользователя успешно извлечены из initData', {
              telegramId,
              username,
              firstName,
              lastName,
              authDate
            });
          } catch (parseError) {
            authLog(logId, 'USER_DATA_PARSE_ERROR', 'Ошибка парсинга данных пользователя', {
              userDataStr: userDataStr?.substring(0, 100) + (userDataStr?.length > 100 ? '...' : '')
            }, parseError);
          }
        } else {
          authLog(logId, 'USER_DATA_MISSING', 'Отсутствуют данные пользователя в initData', {
            availableParams: Array.from(parsedInitData.keys())
          });
        }
      } catch (e) {
        authLog(logId, 'INIT_DATA_PARSE_ERROR', 'Ошибка обработки initData', {
          initData: userData.initData?.substring(0, 100) + (userData.initData?.length > 100 ? '...' : '')
        }, e);
      }
    }
    
    // Если не удалось получить ID из initData, пробуем резервные данные
    if (!telegramId && userData.telegramId) {
      telegramId = userData.telegramId;
      authLog(logId, 'FALLBACK_TELEGRAM_ID', 'Использован резервный telegramId из тела запроса', { telegramId });
    }
    
    // Если всё еще нет ID, возвращаем ошибку
    if (!telegramId) {
      authLog(logId, 'MISSING_TELEGRAM_ID', 'Не удалось определить telegramId пользователя');
      return NextResponse.json(
        { error: 'Could not extract telegramId' },
        { status: 400 }
      )
    }
    
    // Проверяем валидность данных Telegram, если это не принудительный вход
    if (!isForceLogin) {
      try {
        authLog(logId, 'VALIDATE_TELEGRAM_DATA', 'Проверка подлинности данных Telegram');
        const isValid = validateTelegramAuth(userData.initData);
        
        if (!isValid) {
          authLog(logId, 'INVALID_TELEGRAM_DATA', 'Проверка подлинности данных Telegram не пройдена');
          return NextResponse.json(
            { error: 'Invalid Telegram data' },
            { status: 401 }
          )
        }
        authLog(logId, 'TELEGRAM_DATA_VALID', 'Проверка подлинности данных Telegram успешно пройдена');
      } catch (error) {
        authLog(logId, 'TELEGRAM_VALIDATION_ERROR', 'Ошибка при проверке подлинности данных Telegram', null, error);
      }
    }

    // Стандартный путь с обращением к базе данных
    authLog(logId, 'DB_USER_SEARCH', 'Поиск пользователя в базе данных', { telegramId });
    const { data: existingUser, error: searchError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single()

    if (searchError && searchError.code !== 'PGRST116') {
      authLog(logId, 'DB_SEARCH_ERROR', 'Ошибка базы данных при поиске пользователя', null, searchError);
      return NextResponse.json(
        { error: 'Database error', details: searchError.message },
        { status: 500 }
      )
    }

    let userId = existingUser?.id
    authLog(logId, 'USER_SEARCH_RESULT', existingUser ? 'Пользователь найден в базе данных' : 'Пользователь не найден в базе данных', { 
      userId,
      isNewUser: !existingUser 
    });

    // Если пользователь не найден, создаем нового
    if (!existingUser) {
      authLog(logId, 'USER_CREATION', 'Создание нового пользователя');
      const usernameValue = username || `user_${telegramId}`
      const firstNameValue = firstName || 'New'
      const lastNameValue = lastName || 'User'
      
      // Создаем пользователя в таблице users
      authLog(logId, 'DB_USER_INSERT', 'Добавление нового пользователя в базу данных', { 
        telegramId, 
        username: usernameValue,
        firstName: firstNameValue,
        lastName: lastNameValue
      });
      
      const { data: newUser, error: createError } = await supabaseAdmin
        .from('users')
        .insert([{
          telegram_id: telegramId,
          username: usernameValue,
          first_name: firstNameValue,
          last_name: lastNameValue,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (createError) {
        authLog(logId, 'DB_USER_INSERT_ERROR', 'Ошибка создания пользователя в базе данных', null, createError);
        console.error('Ошибка создания пользователя:', createError);
        throw new Error(`Не удалось создать пользователя: ${createError.message}`);
      }
      userId = newUser.id
      authLog(logId, 'USER_CREATED', 'Пользователь успешно создан в базе данных', { userId, telegramId });

      // Создаем начальное состояние игры для нового пользователя
      authLog(logId, 'INITIAL_GAME_STATE', 'Создание начального состояния игры');
      const initialGameState = {
        user: {
          id: userData.id,
          telegram_id: userData.telegram_id,
          username: userData.username,
          first_name: userData.first_name,
          last_name: userData.last_name,
          photo_url: userData.photo_url
        },
        inventory: {
          snot: 0,
          snotCoins: 0,
          containerSnot: 0,
          containerCapacity: 1,
          Cap: 1,
          fillingSpeed: 1 / (24 * 60 * 60), // 1 единица в день
          containerCapacityLevel: 1,
          fillingSpeedLevel: 1,
          collectionEfficiency: 1.0
        },
        activeTab: 'laboratory',
        gameStarted: true,
        highestLevel: 1,
        consecutiveLoginDays: 1,
        settings: {
          language: 'en',
          theme: 'light',
          notifications: true,
          tutorialCompleted: false
        },
        soundSettings: {
          backgroundMusicVolume: 0.3,
          clickVolume: 0.5,
          effectsVolume: 0.5,
          isBackgroundMusicMuted: false,
          isEffectsMuted: false,
          isMuted: false
        },
        isPlaying: false
      };

      // Создаем auth пользователя
      try {
        authLog(logId, 'AUTH_USER_CHECK', 'Проверка существования учетной записи аутентификации');
        const { data: authUserData, error: authCheckError } = await supabaseAdmin.auth.admin.getUserByEmail(
          `${telegramId}@telegram.user`
        );
        
        if (authCheckError) {
          if (authCheckError.status === 404) {
            authLog(logId, 'AUTH_USER_CREATION', 'Создание учетной записи аутентификации', { email: `${telegramId}@telegram.user` });
            const { error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
              email: `${telegramId}@telegram.user`,
              password: telegramId.toString(),
              email_confirm: true
            });
            
            if (createAuthError) {
              authLog(logId, 'AUTH_USER_CREATION_ERROR', 'Ошибка создания учетной записи аутентификации', null, createAuthError);
              console.error('Ошибка создания учетной записи авторизации:', createAuthError);
            } else {
              authLog(logId, 'AUTH_USER_CREATED', 'Учетная запись аутентификации успешно создана');
              console.log('Успешно создана учетная запись авторизации для пользователя:', telegramId);
            }
          } else {
            authLog(logId, 'AUTH_USER_CHECK_ERROR', 'Ошибка при проверке существования учетной записи', null, authCheckError);
            console.error('Ошибка при проверке существования учетной записи:', authCheckError);
          }
        } else {
          authLog(logId, 'AUTH_USER_EXISTS', 'Учетная запись аутентификации уже существует, обновление метаданных', { authUserId: authUserData.user.id });
          const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            authUserData.user.id,
            {
              user_metadata: { 
                database_user_id: userId,
                telegram_id: telegramId,
                last_sync: new Date().toISOString()
              }
            }
          );
          
          if (updateError) {
            authLog(logId, 'AUTH_USER_UPDATE_ERROR', 'Ошибка обновления метаданных пользователя', null, updateError);
            console.error('Ошибка обновления метаданных пользователя:', updateError);
          } else {
            authLog(logId, 'AUTH_USER_UPDATED', 'Метаданные пользователя успешно обновлены');
            console.log('Успешно обновлены метаданные пользователя:', telegramId);
          }
        }
      } catch (authErr) {
        authLog(logId, 'AUTH_USER_CRITICAL_ERROR', 'Критическая ошибка при работе с аутентификацией', null, authErr);
        console.error('Критическая ошибка при работе с аутентификацией:', authErr);
        // Продолжаем выполнение, так как эта ошибка не должна блокировать основной процесс
      }

    } else {
      authLog(logId, 'EXISTING_USER', 'Использование существующего пользователя', { userId, telegramId });
    }

    // Создаем JWT токен для пользователя
    authLog(logId, 'TOKEN_GENERATION', 'Генерация JWT токена');
    const token = crypto.randomBytes(32).toString('hex')

    // Обновляем запись пользователя с новым токеном
    try {
      authLog(logId, 'TOKEN_UPDATE', 'Обновление токена пользователя в базе данных');
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({
          updated_at: new Date().toISOString(),
          jwt_token: token
        })
        .eq('id', userId)

      if (updateError) {
        authLog(logId, 'TOKEN_UPDATE_ERROR', 'Ошибка обновления токена пользователя', { userId }, updateError);
      } else {
        authLog(logId, 'TOKEN_UPDATED', 'Токен пользователя успешно обновлен');
      }
    } catch (tokenError) {
      authLog(logId, 'TOKEN_UPDATE_EXCEPTION', 'Исключение при обновлении токена', null, tokenError);
    }

    // Возвращаем данные пользователя и токен
    authLog(logId, 'AUTH_SUCCESS', 'Авторизация успешно завершена', { 
      userId, 
      telegramId,
      tokenGenerated: !!token 
    });
    
    return NextResponse.json({
      token,
      user: {
        id: userId,
        telegram_id: telegramId,
        username: username || `user_${telegramId}`,
        first_name: firstName || 'User',
        last_name: lastName || ''
      }
    })

  } catch (err) {
    const error = err as Error
    authLog(logId, 'AUTH_CRITICAL_ERROR', 'Критическая ошибка в процессе авторизации', null, error);
    return NextResponse.json(
      { error: 'Server error', details: error.message },
      { status: 500 }
    )
  }
}

