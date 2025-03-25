import { NextResponse } from "next/server";
import { UserModel } from "../../../utils/models";
import { generateToken } from "../../../utils/jwt";
import { AuthStep, logAuthInfo, logAuthError } from "../../../utils/auth-logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  logAuthInfo(AuthStep.SERVER_REQUEST, "Начало обработки запроса авторизации через Warpcast");

  try {
    // Получаем данные от клиента
    const userData = await request.json();
    logAuthInfo(AuthStep.SERVER_REQUEST, "Получены данные пользователя", { hasFid: !!userData?.fid });

    // Проверяем наличие FID
    if (!userData?.fid) {
      logAuthError(
        AuthStep.SERVER_ERROR,
        "Отсутствует Farcaster ID (FID)",
        new Error("Missing FID")
      );
      return NextResponse.json(
        { error: "FID is required" },
        { status: 400 }
      );
    }

    // Поиск пользователя в базе данных
    logAuthInfo(AuthStep.DATABASE_QUERY, "Поиск пользователя в базе данных", { fid: userData.fid });
    let existingUser = await UserModel.findByFid(userData.fid);

    // Определяем, новый ли это пользователь
    const isNewUser = !existingUser;
    
    // Создаем или обновляем пользователя
    let user = await UserModel.upsert({
      fid: userData.fid,
      username: userData.username,
      displayName: userData.displayName || null,
      pfp: userData.pfp || null,
      address: userData.address || null
    });

    logAuthInfo(
      isNewUser ? AuthStep.USER_CREATED : AuthStep.SERVER_REQUEST,
      isNewUser ? "Создан новый пользователь" : "Данные пользователя обновлены",
      { userId: user.id, fid: userData.fid }
    );

    // Создаем JWT токен
    logAuthInfo(AuthStep.TOKEN_GENERATED, "Генерация JWT токена");
    const token = generateToken({
      id: user.id,
      fid: userData.fid,
      username: userData.username,
      displayName: userData.displayName || null,
      pfp: userData.pfp || null,
      address: userData.address || null
    });

    // Обновляем токен в базе данных
    try {
      await UserModel.updateToken(user.id, token);
      logAuthInfo(AuthStep.TOKEN_GENERATED, "Токен пользователя успешно обновлен");
    } catch (tokenError) {
      logAuthError(
        AuthStep.SERVER_ERROR,
        "Ошибка при обновлении токена",
        tokenError instanceof Error ? tokenError : new Error("Unknown token update error")
      );
    }

    // Возвращаем данные пользователя и токен
    logAuthInfo(AuthStep.SERVER_RESPONSE, "Авторизация успешно завершена", { 
      userId: user.id, 
      fid: userData.fid,
      tokenGenerated: !!token 
    });
    
    return NextResponse.json({
      token,
      user: {
        id: user.id,
        fid: userData.fid,
        username: userData.username,
        displayName: userData.displayName || null,
        pfp: userData.pfp || null,
        address: userData.address || null
      }
    });

  } catch (err) {
    const error = err instanceof Error ? err : new Error("Unknown error");
    logAuthError(AuthStep.SERVER_ERROR, "Критическая ошибка в процессе авторизации", error);
    
    return NextResponse.json(
      { error: "Server error", details: error.message },
      { status: 500 }
    );
  }
} 