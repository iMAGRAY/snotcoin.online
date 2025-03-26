/**
 * Этот файл сохранен для обратной совместимости.
 * Рекомендуется использовать импорт из контекста напрямую:
 * import { useTranslation } from '@/app/i18n/contexts/TranslationContext';
 * @deprecated
 */

'use client';

import * as React from 'react';
import { TranslationContext } from '../contexts/TranslationContext';
import { TranslationContextType } from '../types/translationTypes';

/**
 * Хук для доступа к функциям локализации
 */
export function useTranslation(): TranslationContextType {
  const context = React.useContext(TranslationContext);
  
  if (!context) {
    throw new Error('useTranslation должен использоваться внутри TranslationProvider');
  }
  
  return context;
}