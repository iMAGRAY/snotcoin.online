import { type LucideIcon } from 'lucide-react';

export interface Achievement {
  name: string;
  description: string;
  points: number;
  completed: boolean;
}

export interface AchievementCategory {
  category: string;
  items: Achievement[];
}

export interface ProfileSection {
  label: string;
  icon: LucideIcon;
  color: string;
  content: React.ReactNode;
}

export interface WalletSection {
  title: string;
  items: Array<{ label: string; value: string; } | string>;
}

