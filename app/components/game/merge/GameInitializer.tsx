handleResize = () => {
  // Проверяем, инициализирован ли контейнер и объект игры
  if (!this.containerRef.current || !this.game) return;

  // Получаем текущие размеры контейнера (родителя)
  const parentWidth = this.containerRef.current.offsetWidth;
  const parentHeight = this.containerRef.current.offsetHeight;

  // Обязательно учитываем высоту верхнего и нижнего бара
  const headerHeight = window.innerWidth <= 768 ? HEADER_HEIGHT_MOBILE : HEADER_HEIGHT;
  const footerHeight = window.innerWidth <= 768 ? FOOTER_HEIGHT_MOBILE : FOOTER_HEIGHT;
  
  // Высота игрового поля - это высота контейнера минус высота верхнего и нижнего бара
  const availableHeight = parentHeight - headerHeight - footerHeight;
  
  // Применяем соотношение сторон для расчета ширины
  // Поле должно быть выше, чем шире (соотношение 2:3)
  let newWidth = availableHeight * GAME_ASPECT_RATIO;
  let newHeight = availableHeight;
  
  // Проверяем, что ширина не превышает доступную ширину
  if (newWidth > parentWidth) {
    newWidth = parentWidth;
    newHeight = newWidth / GAME_ASPECT_RATIO;
  }
  
  // Логгируем информацию о размерах для диагностики
  console.log(`Изменение размера игры: с ${this.game.scale.width}x${this.game.scale.height} на ${newWidth}x${newHeight}`);
  
  // Обновляем размер игры
  this.game.scale.resize(newWidth, newHeight);
  
  // Обновляем физические границы игрового поля
  if (this.worldRef.current) {
    // Получаем метод createWalls из физических референсов
    // Метод createWalls доступен из physicsRefs, который передается в компонент
    if (typeof this.physicsRefs?.createWalls === 'function') {
      console.log(`Обновление физических границ игры: ${newWidth}x${newHeight}`);
      this.physicsRefs.createWalls(newWidth, newHeight);
    }
  }
  
  // Обновляем визуальные элементы игровой сцены
  if (this.game.scene && this.game.scene.scenes && this.game.scene.scenes[0]) {
    const mainScene = this.game.scene.scenes[0];
    // Используем новую функцию для обновления элементов сцены
    updateSceneElements(mainScene, newWidth, newHeight);
  }
  
  // Обновляем шары после изменения размера игры
  if (this.ballsRef.current && this.currentBallRef.current && this.worldRef.current) {
    const oldWidth = this.game.scale.width || BASE_GAME_WIDTH;
    
    console.log(`Вызов updateBallsOnResize: oldWidth=${oldWidth}, newWidth=${newWidth}`);
    
    // Обновляем шары с учетом нового размера
    updateBallsOnResize(
      this.ballsRef, 
      this.currentBallRef, 
      this.worldRef, 
      newWidth, 
      oldWidth
    );
  }
  
  // Дополнительно обновляем пользовательский интерфейс
  this.updateUI();
};

/**
 * Обновляет элементы сцены при изменении размера окна
 * 
 * @param scene Сцена Phaser
 * @param gameWidth Новая ширина игры
 * @param gameHeight Новая высота игры
 */
export const updateSceneElements = (
  scene: any,
  gameWidth: number,
  gameHeight: number
) => {
  if (!scene || !scene.children || !scene.children.list) {
    return;
  }

  console.log(`Обновление элементов сцены: ${gameWidth}x${gameHeight}`);
  
  // Рассчитываем масштаб относительно базового размера
  const scaleX = gameWidth / BASE_GAME_WIDTH;
  const scaleY = gameHeight / (BASE_GAME_WIDTH * 1.5); // Используем базовое соотношение сторон 2:3
  
  // Обновляем масштаб камеры, если это возможно
  if (scene.cameras && scene.cameras.main) {
    scene.cameras.main.setZoom(1); // Сбрасываем зум к 1, чтобы избежать кумулятивного эффекта
  }
  
  // Обновляем фон с деревьями
  const treesImage = scene.children.list.find((child: any) => 
    child.texture && child.texture.key === 'trees'
  );
  if (treesImage) {
    treesImage.setPosition(gameWidth / 2, 0);
    // Используем setDisplaySize для сохранения пропорций
    treesImage.setDisplaySize(gameWidth, gameHeight);
    // Устанавливаем origin для правильного позиционирования
    treesImage.setOrigin(0.5, 0);
  }
  
  // Обновляем пол
  const floorImage = scene.children.list.find((child: any) => 
    child.texture && child.texture.key === 'floor'
  );
  if (floorImage) {
    const floorHeight = 30 * scaleY; // Масштабируем высоту пола
    floorImage.setPosition(gameWidth / 2, gameHeight - floorHeight / 2);
    floorImage.setDisplaySize(gameWidth, floorHeight);
    floorImage.setOrigin(0.5, 0.5);
  }
  
  // Обновляем позицию игрока
  const playerSprite = scene.children.list.find((child: any) => 
    child.type === 'Arc' && child.fillColor === 0x00ff00
  );
  if (playerSprite) {
    // Сохраняем позицию Y игрока (FIXED_PLAYER_Y) при обновлении позиции X
    playerSprite.setPosition(gameWidth / 2, playerSprite.y);
    // Масштабируем размер игрока
    const playerSize = PLAYER_SIZE * scaleX;
    if (playerSprite.setRadius) {
      playerSprite.setRadius(playerSize);
    }
  }
  
  // Обновляем текст инструкций
  const instructionsText = scene.children.list.find((child: any) => 
    child.type === 'Text' && 
    child.text && 
    typeof child.text === 'string' && 
    child.text.includes('Наведите')
  );
  if (instructionsText) {
    instructionsText.setPosition(gameWidth / 2, 64 * scaleY);
    // Обновляем размер шрифта в зависимости от масштаба
    const fontSize = Math.max(16 * scaleX, 10);
    instructionsText.setFontSize(`${fontSize}px`);
    instructionsText.setOrigin(0.5, 0.5);
  }
  
  // Обновляем оверлей замерзания, если он есть
  const freezeOverlay = scene.children.list.find((child: any) => 
    child.type === 'Rectangle' && 
    child.fillColor === 0x0088ff
  );
  if (freezeOverlay) {
    freezeOverlay.setPosition(gameWidth / 2, gameHeight / 2);
    freezeOverlay.setSize(gameWidth, gameHeight);
  }
  
  // Обновляем текст замерзки, если он есть
  const freezeText = scene.children.list.find((child: any) => 
    child.type === 'Text' && 
    child.text && 
    typeof child.text === 'string' && 
    child.text.includes('ЗАМОРОЗКА')
  );
  if (freezeText) {
    freezeText.setPosition(gameWidth / 2, 80 * scaleY);
    // Обновляем размер шрифта в зависимости от масштаба
    const fontSize = Math.max(20 * scaleX, 12);
    freezeText.setFontSize(`${fontSize}px`);
  }
  
  // Обновляем линию траектории, если она есть
  const trajectoryLine = scene.children.list.find((child: any) => 
    child.type === 'Graphics' && child._lineStyle && child._lineStyle.width
  );
  if (trajectoryLine) {
    // Обновляем толщину линии
    const lineWidth = Math.max(2 * scaleX, 1);
    trajectoryLine.lineStyle(lineWidth, trajectoryLine._lineStyle.color, trajectoryLine._lineStyle.alpha);
    // Перерисовываем линию, если доступен метод
    if (trajectoryLine.redraw) {
      trajectoryLine.redraw();
    }
  }
  
  // Масштабируем все частицы и эффекты, если они есть
  const particles = scene.children.list.filter((child: any) => 
    child.type === 'ParticleEmitter' || child.type === 'Particles'
  );
  particles.forEach((particle: any) => {
    if (particle.setScale) {
      particle.setScale(scaleX, scaleY);
    }
  });
}; 