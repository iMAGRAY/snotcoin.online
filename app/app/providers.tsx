import { SessionProvider } from 'next-auth/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// Закомментированный импорт, создаем заглушку
// import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ReactNode } from 'react';
// Заглушки для отсутствующих модулей
// import { PortalProvider } from '@/app/contexts/PortalContext';
// import { GameProviderWrapper } from '@/app/components/GameProviderWrapper';
// import { FarcasterContextProvider } from '@/app/components/FarcasterContext';

// Заглушка для ReactQueryDevtools
const ReactQueryDevtools = ({ initialIsOpen }: { initialIsOpen: boolean }) => null;

// Заглушки для провайдеров
const PortalProvider = ({ children }: { children: ReactNode }) => <>{children}</>;
const FarcasterContextProvider = ({ children }: { children: ReactNode }) => <>{children}</>;
const GameProviderWrapper = ({ children }: { children: ReactNode }) => <>{children}</>;

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
          <FarcasterContextProvider>
            <GameProviderWrapper>
              {children}
            </GameProviderWrapper>
          </FarcasterContextProvider>
        </PortalProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </SessionProvider>
  );
} 