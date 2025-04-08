const handleClick = async () => {
  if (isCollecting || isClicked) {
    console.log('[CollectButton] Кнопка уже нажата или сбор идет, игнорируем клик');
    return;
  }
  
  setIsClicked(true); // Блокируем кнопку от множественных кликов
  
  try {
    setCollectStatus('collecting');
    setErrorMessage(null);
    
    console.log('[CollectButton] Начинаем сбор ресурсов');
    const success = await collect();
    
    // Если сбор не удался, но не было ошибки, выводим общее сообщение
    if (!success && !lastCollectError) {
      setErrorMessage('Не удалось собрать ресурсы. Попробуйте еще раз.');
      console.warn('[CollectButton] Сбор не удался, но ошибки не было');
    } else if (lastCollectError) {
      // Если была ошибка, показываем пользователю с понятным сообщением
      const userFriendlyError = lastCollectError === 'Контейнер пуст' 
        ? 'Контейнер пуст. Подождите, пока он наполнится.'
        : 'Не удалось собрать ресурсы. Попробуйте позже.';
        
      setErrorMessage(userFriendlyError);
      console.warn('[CollectButton] Ошибка при сборе:', lastCollectError);
    } else {
      console.log('[CollectButton] Сбор успешно завершен');
      setCollectStatus('collected');
      
      // Система сохранений отключена
      if (typeof forceSaveAfterCollect === 'function') {
        console.log('[CollectButton] Система сохранений отключена - данные только в памяти');
      }
      
      // Показываем анимацию успешного сбора
      setTimeout(() => {
        setCollectStatus('idle');
      }, 1000);
    }
  } catch (error) {
    console.error('[CollectButton] Исключение при сборе:', error);
    setErrorMessage('Произошла ошибка при сборе. Попробуйте еще раз.');
    setCollectStatus('idle');
  } finally {
    // Разблокируем кнопку через небольшую задержку для предотвращения слишком быстрых повторных кликов
    setTimeout(() => {
      setIsClicked(false);
    }, 500);
  }
}; 