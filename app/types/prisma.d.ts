import { PrismaClient, Prisma } from '@prisma/client';
import { JsonValue } from '@prisma/client/runtime/library';

declare global {
  namespace PrismaJson {
    type GameStateJson = {
      version: number;
      userId: string;
      inventory: {
        snot: number;
        [key: string]: number;
      };
      stats: {
        totalSnot: number;
        totalChestsOpened: number;
        [key: string]: number;
      };
      achievements: {
        [key: string]: boolean;
      };
      lastUpdate: number;
    };
  }
}

export interface UserModel {
  id: string;
  farcaster_fid: string | null;
  farcaster_username: string;
  farcaster_displayname: string | null;
  farcaster_pfp: string | null;
  jwt_token: string | null;
  refresh_token: string | null;
  token_expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ProgressModel {
  id: string;
  user_id: string;
  game_state: JsonValue;
  encrypted_state: string | null;
  version: number;
  created_at: Date;
  updated_at: Date;
  is_compressed: boolean;
}

export interface SyncQueueModel {
  id: number;
  user_id: string; 
  operation: string;
  data: JsonValue;
  status: string;
  created_at: Date;
  updated_at: Date;
  attempts: number;
}

export interface ProgressHistoryModel {
  id: number;
  user_id: string;
  client_id: string;
  save_type: string;
  save_reason: string;
  created_at: Date;
}

export interface PrismaError {
  code?: string;
  message: string;
  clientVersion?: string;
}

export interface PrismaQueryEvent {
  timestamp: Date;
  query: string;
  params: string;
  duration: number;
  target: string;
}

export type ExtendedPrismaClient = PrismaClient & {
  $on(eventType: 'error', callback: (event: PrismaError) => void): void;
  $on(eventType: 'warn', callback: (event: PrismaError) => void): void;
  $on(eventType: 'query', callback: (event: PrismaQueryEvent) => void): void;
  $on(eventType: string, callback: (event: unknown) => void): void;
};