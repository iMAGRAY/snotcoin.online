// Реэкспорт типа User из gameTypes.ts
import { User } from './gameTypes';

export type { User };

// Дополнительные типы связанные с пользователем можно определить здесь
export interface UserPreferences {
  theme: string;
  language: string;
  notifications: boolean;
}

export interface UserProfile {
  id: string;
  username: string | null;
  displayName: string | null;
  pfp: string | null;
  bio: string | null;
  location: string | null;
  socials: Record<string, string> | null;
} 