'use client';

import React, { useState, useEffect } from 'react';
import { useEeProvider } from '@/app/hooks/useEeProvider';

/**
 * Пример использования useEeProvider хука
 */
const FarcasterProviderExample: React.FC = () => {
  const {
    provider,
    isLoading,
    error,
    connectWallet,
    isReady
  } = useEeProvider({
    autoConnect: false, // Не подключаемся автоматически
  });
  
  const [accounts, setAccounts] = useState<string[]>([]);
  const [chainId, setChainId] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  
  // Проверяем провайдер и получаем информацию при изменении
  useEffect(() => {
    const fetchProviderInfo = async () => {
      if (!provider || !isReady) return;
      
      try {
        // Получаем chainId
        const chainIdHex = await provider.request({ method: 'eth_chainId' });
        setChainId(parseInt(chainIdHex, 16).toString());
        
        // Если есть подключенные аккаунты, получаем их
        const connectedAccounts = await provider.request({ method: 'eth_accounts' });
        if (connectedAccounts.length > 0) {
          setAccounts(connectedAccounts);
          
          // Получаем баланс первого аккаунта
          const balanceHex = await provider.request({ 
            method: 'eth_getBalance', 
            params: [connectedAccounts[0], 'latest'] 
          });
          const balanceWei = parseInt(balanceHex, 16);
          const balanceEth = balanceWei / 1e18;
          setBalance(balanceEth.toFixed(6));
        }
      } catch (err) {
        console.error('Ошибка при получении информации из провайдера:', err);
      }
    };
    
    fetchProviderInfo();
  }, [provider, isReady]);
  
  // Функция для подключения кошелька
  const handleConnect = async () => {
    try {
      const newAccounts = await connectWallet();
      setAccounts(newAccounts);
      
      if (newAccounts.length > 0 && provider) {
        // Получаем баланс
        const balanceHex = await provider.request({ 
          method: 'eth_getBalance', 
          params: [newAccounts[0], 'latest'] 
        });
        const balanceWei = parseInt(balanceHex, 16);
        const balanceEth = balanceWei / 1e18;
        setBalance(balanceEth.toFixed(6));
      }
    } catch (err) {
      console.error('Ошибка при подключении:', err);
    }
  };
  
  return (
    <div className="p-6 bg-gray-800 text-white rounded-lg max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4">Farcaster Provider Example</h2>
      
      <div className="mb-6">
        <p className="text-gray-300 mb-2">Статус провайдера:</p>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${
            isLoading ? 'bg-yellow-400' : 
            error ? 'bg-red-500' : 
            isReady ? 'bg-green-500' : 'bg-gray-500'
          }`} />
          <span>
            {isLoading ? 'Загрузка...' : 
             error ? 'Ошибка' : 
             isReady ? 'Готов' : 'Не инициализирован'}
          </span>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-800 p-3 rounded-md mb-4 text-sm">
          <p className="font-bold">Ошибка:</p>
          <p>{error}</p>
        </div>
      )}
      
      {isReady && (
        <div className="mb-6 bg-gray-700 p-3 rounded-md">
          <p className="text-sm text-gray-300">Текущая сеть: {chainId ? `Chain ID ${chainId}` : 'Неизвестно'}</p>
          {accounts.length > 0 ? (
            <div className="mt-2">
              <p className="text-sm text-gray-300">Аккаунт: {accounts[0]}</p>
              {balance && <p className="text-sm text-gray-300">Баланс: {balance} ETH</p>}
            </div>
          ) : (
            <p className="text-sm text-gray-300 mt-2">Нет подключенных аккаунтов</p>
          )}
        </div>
      )}
      
      <div className="flex gap-3">
        <button
          onClick={handleConnect}
          disabled={isLoading || !isReady}
          className={`px-4 py-2 rounded-md ${
            isLoading || !isReady
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {accounts.length > 0 ? 'Переподключить' : 'Подключить кошелек'}
        </button>
      </div>
      
      <div className="mt-6 text-xs text-gray-400">
        <p>Используется useEeProvider для доступа к провайдеру через ee.getProvider</p>
        {provider && <p className="mt-1">Тип провайдера: {provider.constructor.name || 'Unknown'}</p>}
      </div>
    </div>
  );
};

export default FarcasterProviderExample; 