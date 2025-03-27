'use client';

import { ReactNode } from 'react';
import { AuthProvider } from "./hooks/useAuth";
import { FarcasterProvider } from "./contexts/FarcasterContext";
import { TranslationProvider } from "./i18n/providers/TranslationProvider";
import { GameProvider } from "./contexts/game/providers/GameProvider";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider>
      <FarcasterProvider>
        <TranslationProvider>
          <GameProvider>
            {children}
          </GameProvider>
        </TranslationProvider>
      </FarcasterProvider>
    </AuthProvider>
  );
} 