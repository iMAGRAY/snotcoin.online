import { PrismaClient } from '@prisma/client';

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