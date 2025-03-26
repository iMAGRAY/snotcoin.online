import { createContext } from "react";
import { TranslationContextType } from "../types/translationTypes";

/**
 * Контекст для переводов
 */
export const TranslationContext = createContext<TranslationContextType | undefined>(undefined); 