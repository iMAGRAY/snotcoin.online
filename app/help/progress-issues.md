# Проблемы с сохранением прогресса

Если у вас возникают проблемы с сохранением игрового прогресса, вот несколько шагов для их устранения:

## Общие рекомендации

1. Убедитесь, что вы используете современный браузер с поддержкой локального хранилища (Chrome, Firefox, Safari, Edge).
2. Проверьте, что у вас включены cookie и локальное хранилище в настройках браузера.
3. Перезагрузите страницу и проверьте, сохраняется ли прогресс.
4. Попробуйте очистить кэш браузера, но не удаляйте данные сайтов и cookie.
5. Временно отключите блокировщики рекламы или расширения, которые могут мешать работе сайта.

## Тест локального хранилища

1. Убедитесь, что в настройках браузера разрешено хранение данных для сайта kingcoin.online
2. Откройте консоль разработчика в браузере (F12 или Ctrl+Shift+I)
3. Выполните следующий код в консоли, чтобы проверить, работает ли локальное хранилище:

```javascript
// Проверка наличия уникального ID пользователя
const userId = localStorage.getItem('kingcoin_persistent_user_id');
console.log('User ID:', userId);

// Если ID отсутствует, попробуйте создать новый
if (!userId) {
  try {
    localStorage.setItem('kingcoin_persistent_user_id', 'user_' + Date.now());
    console.log('Created new User ID:', localStorage.getItem('kingcoin_persistent_user_id'));
  } catch (e) {
    console.error('Local storage access error:', e);
  }
}
```

## Очистка и восстановление данных

Если проблемы с сохранением не решаются стандартными методами, попробуйте следующие шаги:

### Для опытных пользователей

1. Откройте консоль разработчика (F12)
2. Перейдите во вкладку "Application" (Chrome) или "Storage" (Firefox)
3. Найдите раздел "Local Storage" в левой панели
4. Выберите kingcoin.online в списке
5. Проверьте данные:
   - Должен быть ключ с идентификатором пользователя `kingcoin_persistent_user_id`
   - Должен быть ключ с сохранением состояния игры `kingcoin_game_state_[user_id]`

### Сохранение текущего прогресса в виде JSON

Если у вас есть важный прогресс, который вы не хотите потерять, выполните:

```javascript
const userId = localStorage.getItem('kingcoin_persistent_user_id');
const saveKey = `kingcoin_game_state_${userId}`;
const gameData = localStorage.getItem(saveKey);
console.log('Game data to save:', gameData);
// Скопируйте вывод консоли и сохраните его в текстовом файле
```

### Восстановление прогресса из сохранённых данных

Чтобы восстановить прогресс из сохранённой строки JSON:

```javascript
// Замените YOUR_JSON_STRING на сохранённую строку JSON
const savedData = `YOUR_JSON_STRING`;
const userId = 'user_' + Date.now(); // Создаём новый ID
localStorage.setItem('kingcoin_persistent_user_id', userId);
const saveKey = `kingcoin_game_state_${userId}`;
localStorage.setItem(saveKey, savedData);
console.log('Progress restored, refresh the page.');
// Перезагрузите страницу
```

## Контакты для помощи

Если вы по-прежнему испытываете проблемы с сохранением прогресса, обратитесь за помощью:

- Twitter: @kingcoin
- Farcaster: @kingcoin
- Добавьте скриншот и описание проблемы для более быстрого решения 