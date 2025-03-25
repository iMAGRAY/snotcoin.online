"use client";

import React from 'react';
import Link from 'next/link';

/**
 * Страница для информации о системе сохранения
 */
export default function SaveSystemInfoPage() {
  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold text-gray-800">Система сохранения</h1>
            <div className="flex gap-4">
              <Link 
                href="/" 
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                Главная
              </Link>
              <Link 
                href="/game" 
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
              >
                Игра
              </Link>
            </div>
          </div>
          <p className="text-gray-600 max-w-3xl">
            Информация о системе сохранения игры SnotCoin, оптимизированной для 
            большого количества пользователей. Для использования сохранений необходима 
            аутентификация через Farcaster.
          </p>
        </header>
        
        <main>
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4">Необходима аутентификация</h2>
            <p className="text-lg mb-4">
              Для сохранения прогресса в игре требуется аутентификация через Farcaster. 
              Без авторизации ваш прогресс не сохранится.
            </p>
            
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 mb-6">
              <div className="flex items-start">
                <div className="mr-3 text-yellow-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-yellow-700">Внимание</h3>
                  <p className="text-yellow-600">
                    Тестовый режим отключен. Для сохранения прогресса игры необходимо авторизоваться 
                    через Farcaster на основной странице игры.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-10 bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4">Технические детали реализации</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold mb-2">Оптимизация размера данных</h3>
                <p className="text-gray-700">
                  Система использует структурированное хранение, разделяя данные на критические и 
                  некритические блоки. Критические данные (валюта, уровни) синхронизируются чаще, 
                  чем статистика и другие вспомогательные данные.
                </p>
              </div>
              
              <div>
                <h3 className="text-xl font-semibold mb-2">Сжатие и дельта-сохранения</h3>
                <p className="text-gray-700">
                  Для минимизации объема передаваемых данных используется сжатие (LZ-String) и 
                  дельта-сохранения (сохраняются только изменения). Это уменьшает нагрузку на сеть 
                  и хранилище в 5-10 раз.
                </p>
              </div>
              
              <div>
                <h3 className="text-xl font-semibold mb-2">Целостность данных</h3>
                <p className="text-gray-700">
                  Система включает проверку и восстановление целостности данных. Если данные повреждены, 
                  система пытается восстановить их или создать новое состояние с сохранением критической 
                  информации.
                </p>
              </div>
              
              <div>
                <h3 className="text-xl font-semibold mb-2">Асинхронная работа</h3>
                <p className="text-gray-700">
                  Все операции сохранения и загрузки выполняются асинхронно, что не блокирует 
                  основной поток выполнения и UI. Используется очередь операций для предотвращения 
                  конфликтов.
                </p>
              </div>
              
              <div>
                <h3 className="text-xl font-semibold mb-2">Разрешение конфликтов</h3>
                <p className="text-gray-700">
                  При синхронизации с сервером используется интеллектуальное разрешение конфликтов. 
                  Система может объединять локальные и серверные данные, давая приоритет более ценной 
                  информации.
                </p>
              </div>
              
              <div>
                <h3 className="text-xl font-semibold mb-2">Масштабируемость</h3>
                <p className="text-gray-700">
                  Архитектура оптимизирована для работы с миллионом пользователей. Используется 
                  минимальное количество запросов к серверу, интеллектуальная синхронизация и 
                  эффективное хранение данных.
                </p>
              </div>
            </div>
          </div>
        </main>
        
        <footer className="mt-12 text-center text-gray-500 text-sm">
          <p>Система сохранения для SnotCoin.online &copy; {new Date().getFullYear()}</p>
        </footer>
      </div>
    </div>
  );
} 