import { MergeGameProps as BaseMergeGameProps } from '../types';

export interface MergeGameProps extends BaseMergeGameProps {
  // Расширяем базовый интерфейс, если нужно
}

export enum ScaleType {
  NONE = 'NONE',
  FIT = 'FIT',
  RESIZE = 'RESIZE'
} 