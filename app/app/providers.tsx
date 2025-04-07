import { SessionProvider } from 'next-auth/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ReactNode } from 'react';
import { PortalProvider } from '@/app/contexts/PortalContext';
import { GameProviderWrapper } from '@/app/components/GameProviderWrapper';
import { FarcasterContextProvider } from '@/app/components/FarcasterContext';
import { SaveManagerProvider } from '@/app/contexts/SaveManagerProvider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <PortalProvider>
          <SaveManagerProvider>
            <FarcasterContextProvider>
              <GameProviderWrapper>
                {children}
              </GameProviderWrapper>
            </FarcasterContextProvider>
          </SaveManagerProvider>
        </PortalProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </SessionProvider>
  );
} 