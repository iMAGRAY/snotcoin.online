import { Redis } from 'ioredis';

declare module 'ioredis' {
  interface RedisCommander<Context> {
    setex(key: string, seconds: number, value: string): Promise<'OK'>;
    get(key: string): Promise<string | null>;
    del(key: string): Promise<number>;
    exists(key: string): Promise<number>;
    expire(key: string, seconds: number): Promise<number>;
  }
}

export type RedisClient = Redis; 