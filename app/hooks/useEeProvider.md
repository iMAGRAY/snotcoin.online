# useEeProvider Hook

Этот хук предоставляет простой интерфейс для работы с провайдером Ethereum из Farcaster SDK через метод `ee.getProvider`.

## Описание

`useEeProvider` обеспечивает безопасный доступ к Ethereum провайдеру через объект `ee` в Farcaster SDK. Хук автоматически применяет необходимые патчи, обрабатывает ошибки и предоставляет удобный API для работы с провайдером.

## API

### Импорт

```typescript
import { useEeProvider } from '@/app/hooks/useEeProvider';
```

### Параметры

```typescript
interface UseEeProviderOptions {
  autoConnect?: boolean;      // Автоматически подключаться к кошельку при инициализации (по умолчанию true)
  fallbackToWindow?: boolean; // Использовать window.ethereum как запасной вариант (по умолчанию true)
}
```

### Возвращаемые значения

```typescript
interface UseEeProviderResult {
  provider: any;                        // Ethereum провайдер (EIP-1193 совместимый)
  isLoading: boolean;                   // Загружается ли провайдер
  error: string | null;                 // Сообщение об ошибке, если есть
  connectWallet: () => Promise<any[]>;  // Функция для подключения кошелька
  isReady: boolean;                     // Готов ли провайдер к использованию
}
```

## Пример использования

### Базовое использование

```tsx
import { useEeProvider } from '@/app/hooks/useEeProvider';

const MyComponent = () => {
  const { provider, isLoading, error, connectWallet, isReady } = useEeProvider();
  
  const handleConnect = async () => {
    try {
      const accounts = await connectWallet();
      console.log('Connected accounts:', accounts);
    } catch (error) {
      console.error('Connection error:', error);
    }
  };
  
  if (isLoading) return <div>Loading provider...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return (
    <div>
      <p>Provider ready: {isReady ? 'Yes' : 'No'}</p>
      <button onClick={handleConnect}>Connect Wallet</button>
    </div>
  );
};
```

### С отключенным автоподключением

```tsx
const { provider, isLoading, connectWallet } = useEeProvider({
  autoConnect: false
});
```

### Без запасного варианта window.ethereum

```tsx
const { provider, error } = useEeProvider({
  fallbackToWindow: false
});
```

## Особенности

1. **Автоматическое применение патчей**: Хук использует `useFarcasterPatch` для обеспечения совместимости с Farcaster SDK.
2. **Обработка ошибок**: Все ошибки обрабатываются и логируются.
3. **Автоматические повторные попытки**: При ошибке инициализации хук автоматически повторяет попытку с экспоненциальной задержкой.
4. **Поддержка Fallback**: При отсутствии Farcaster SDK можно использовать стандартный `window.ethereum`.

## Внутренняя логика

1. Хук инициализирует состояние при монтировании компонента.
2. Пытается получить провайдер через `farcaster.ee.getProvider()`.
3. При неудаче выполняет fallback на `window.ethereum` (если разрешено).
4. Предоставляет методы для подключения кошелька и управления состоянием.

## Важные замечания

- Убедитесь, что Farcaster SDK загружен перед использованием хука.
- Хук работает только в браузерной среде, не использовать на сервере.
- При возникновении ошибок проверьте консоль браузера для подробной информации. 