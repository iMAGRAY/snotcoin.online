import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import HomeContent from './components/HomeContent';

export default function Home() {
  const cookieStore = cookies();
  const session = cookieStore.get('session');

  // Если есть сессия и пользователь авторизован, показываем HomeContent
  if (session) {
    try {
      const sessionData = JSON.parse(session.value);
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

