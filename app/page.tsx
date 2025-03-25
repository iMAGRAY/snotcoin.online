import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import dynamic from 'next/dynamic';
import LoadingScreen from './components/LoadingScreen';

// Динамический импорт HomeContent без SSR
const HomeContent = dynamic(() => import('./components/HomeContent'), {
  ssr: false,
  loading: () => <LoadingScreen progress={0} statusMessage="Loading game..." />,
});

interface SessionData {
  isAuthenticated: boolean;
  fid: string;
  username?: string;
  timestamp: number;
}

export default function Home() {
  const cookieStore = cookies();
  const session = cookieStore.get('session');

  // Если есть сессия и пользователь авторизован, показываем HomeContent
  if (session) {
    try {
      const sessionData = JSON.parse(session.value) as SessionData;
      if (sessionData.isAuthenticated && sessionData.fid) {
        return <HomeContent />;
      }
    } catch (error) {
      console.error('Session parsing error:', error);
    }
  }

  // Если нет сессии или она невалидна, редиректим на страницу авторизации
  const authUrl = new URL('/api/auth', process.env.NEXT_PUBLIC_DOMAIN || 'https://snotcoin.online');
  authUrl.searchParams.set('redirect', '/');
  authUrl.searchParams.set('embed', 'true');
  
  redirect(authUrl.toString());
}

