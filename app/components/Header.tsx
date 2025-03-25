'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import FarcasterUserInfo from './auth/FarcasterUserInfo';
import { useFarcaster } from '@/app/contexts/FarcasterContext';

const Header = () => {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated, isLoading } = useFarcaster();

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <header className="bg-gray-900 text-white shadow-md fixed w-full z-10">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Логотип */}
          <Link href="/" className="flex items-center">
            <span className="text-xl font-bold ml-2">Snotcoin</span>
          </Link>

          {/* Навигация для десктопа */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link 
              href="/game"
              className={`hover:text-green-400 transition ${pathname === '/game' ? 'text-green-400' : ''}`}
            >
              Играть
            </Link>
            <Link 
              href="/leaderboard"
              className={`hover:text-green-400 transition ${pathname === '/leaderboard' ? 'text-green-400' : ''}`}
            >
              Рейтинг
            </Link>
            <Link 
              href="/help"
              className={`hover:text-green-400 transition ${pathname === '/help' ? 'text-green-400' : ''}`}
            >
              Помощь
            </Link>
          </nav>

          {/* Кнопка авторизации или инфо о пользователе */}
          <div className="hidden md:flex items-center">
            {isLoading ? (
              <div className="text-gray-400">
                <span className="animate-spin inline-block mr-1">⟳</span>
                Загрузка...
              </div>
            ) : isAuthenticated ? (
              <FarcasterUserInfo compact />
            ) : (
              <Link 
                href="/auth"
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition"
              >
                Войти через Farcaster
              </Link>
            )}
          </div>

          {/* Кнопка мобильного меню */}
          <button 
            className="md:hidden text-white"
            onClick={toggleMobileMenu}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-6 w-6" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16m-7 6h7"} 
              />
            </svg>
          </button>
        </div>

        {/* Мобильное меню */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 px-2 space-y-3">
            <Link 
              href="/game"
              className={`block py-2 px-4 rounded hover:bg-gray-800 ${pathname === '/game' ? 'bg-gray-800' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Играть
            </Link>
            <Link 
              href="/leaderboard"
              className={`block py-2 px-4 rounded hover:bg-gray-800 ${pathname === '/leaderboard' ? 'bg-gray-800' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Рейтинг
            </Link>
            <Link 
              href="/help"
              className={`block py-2 px-4 rounded hover:bg-gray-800 ${pathname === '/help' ? 'bg-gray-800' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Помощь
            </Link>
            
            <div className="mt-4 pt-4 border-t border-gray-700">
              {isLoading ? (
                <div className="text-gray-400 py-2 px-4">
                  <span className="animate-spin inline-block mr-1">⟳</span>
                  Загрузка...
                </div>
              ) : isAuthenticated ? (
                <div className="py-2 px-4">
                  <FarcasterUserInfo />
                </div>
              ) : (
                <Link 
                  href="/auth"
                  className="block text-center bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg transition"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Войти через Farcaster
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header; 