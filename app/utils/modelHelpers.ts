/**
 * Вспомогательные функции для работы с моделями Prisma
 */

import { UserModel, ProgressModel, SyncQueueModel, ProgressHistoryModel } from '../types/prisma';
import { Prisma } from '@prisma/client';

/**
 * Функция для создания данных User модели
 */
export function createUserData(data: Partial<UserModel>): Partial<UserModel> {
  return {
    ...data
  };
}

/**
 * Функция для создания данных Progress модели
 */
export function createProgressData(data: Partial<ProgressModel>): any {
  const { id, user_id, game_state, encrypted_state, version, created_at, updated_at, is_compressed } = data;
  
  const result: any = {};
  
  if (id !== undefined) result.id = id;
  if (user_id !== undefined) result.user_id = user_id;
  if (game_state !== undefined) result.game_state = game_state;
  if (encrypted_state !== undefined) result.encrypted_state = encrypted_state;
  if (version !== undefined) result.version = version;
  if (created_at !== undefined) result.created_at = created_at;
  if (updated_at !== undefined) result.updated_at = updated_at;
  if (is_compressed !== undefined) result.is_compressed = is_compressed;
  
  return result;
}

/**
 * Функция для создания данных SyncQueue модели
 */
export function createSyncQueueData(data: Partial<SyncQueueModel>): Partial<SyncQueueModel> {
  return {
    ...data
  };
}

/**
 * Функция для создания данных ProgressHistory модели
 */
export function createProgressHistoryData(data: Partial<ProgressHistoryModel>): Partial<ProgressHistoryModel> {
  return {
    ...data
  };
}

/**
 * Функция для получения имен полей моделей
 * Помогает избежать ошибок опечаток в именах полей
 */
export const ModelFields = {
  User: {
    id: 'id',
    farcaster_fid: 'farcaster_fid',
    farcaster_username: 'farcaster_username',
    farcaster_displayname: 'farcaster_displayname',
    farcaster_pfp: 'farcaster_pfp',
    jwt_token: 'jwt_token',
    refresh_token: 'refresh_token',
    token_expires_at: 'token_expires_at',
    created_at: 'created_at',
    updated_at: 'updated_at'
  },
  Progress: {
    id: 'id',
    user_id: 'user_id',
    game_state: 'game_state',
    encrypted_state: 'encrypted_state',
    version: 'version',
    created_at: 'created_at',
    updated_at: 'updated_at',
    is_compressed: 'is_compressed'
  },
  SyncQueue: {
    id: 'id',
    user_id: 'user_id',
    operation: 'operation',
    data: 'data',
    status: 'status',
    created_at: 'created_at',
    updated_at: 'updated_at',
    attempts: 'attempts'
  },
  ProgressHistory: {
    id: 'id',
    user_id: 'user_id',
    client_id: 'client_id',
    save_type: 'save_type',
    save_reason: 'save_reason',
    created_at: 'created_at'
  }
} as const; 