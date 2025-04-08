/**
 * Сервис для управления звуками в игре
 */

class AudioService {
  private static instance: AudioService;
  private backgroundMusic: HTMLAudioElement | null = null;
  private soundEffects: { [key: string]: HTMLAudioElement } = {};
  private backgroundMusicEnabled: boolean = true;
  private soundEffectsEnabled: boolean = true;
  private backgroundMusicVolume: number = 0.25;
  private soundVolume: number = 0.5;
  private effectsVolume: number = 0.5;
  
  // Пути к звуковым файлам
  private readonly SOUND_PATHS = {
    backgroundMusic: '/sounds/BackGoundAudio.mp3',
    tabbarSound: '/sounds/TabBarSound.mp3',
    bombSound: '/sounds/Bang.mp3',
    earthquakeSound: '/sounds/ui.mp3',
    chestOpenSound: '/sounds/OpenChestSound.mp3'
  };

  private constructor() {
    // Конструктор приватный для Singleton
    if (typeof window !== 'undefined') {
      this.loadSounds();
      
      // Загружаем настройки звука из localStorage
      const musicEnabled = localStorage.getItem('backgroundMusicEnabled');
      const soundsEnabled = localStorage.getItem('soundEffectsEnabled');
      const backgroundMusicVolume = localStorage.getItem('backgroundMusicVolume');
      const soundVolume = localStorage.getItem('soundVolume');
      const effectsVolume = localStorage.getItem('effectsVolume');
      
      if (musicEnabled !== null) {
        this.backgroundMusicEnabled = musicEnabled === 'true';
      }
      
      if (soundsEnabled !== null) {
        this.soundEffectsEnabled = soundsEnabled === 'true';
      }

      if (backgroundMusicVolume !== null) {
        this.backgroundMusicVolume = parseFloat(backgroundMusicVolume);
        if (this.backgroundMusic) {
          this.backgroundMusic.volume = this.backgroundMusicVolume;
        }
      }

      if (soundVolume !== null) {
        this.soundVolume = parseFloat(soundVolume);
      }

      if (effectsVolume !== null) {
        this.effectsVolume = parseFloat(effectsVolume);
      }
    }
  }

  /**
   * Загрузка всех звуков
   */
  private loadSounds(): void {
    // Загрузка фоновой музыки
    this.backgroundMusic = new Audio(this.SOUND_PATHS.backgroundMusic);
    this.backgroundMusic.loop = true;
    this.backgroundMusic.volume = this.backgroundMusicVolume;
    
    // Загрузка звуковых эффектов
    for (const [key, path] of Object.entries(this.SOUND_PATHS)) {
      if (key !== 'backgroundMusic') {
        const audio = new Audio(path);
        audio.preload = 'auto';
        audio.volume = key.includes('Sound') ? this.soundVolume : this.effectsVolume;
        this.soundEffects[key] = audio;
      }
    }
  }

  /**
   * Воспроизведение фоновой музыки
   */
  public playBackgroundMusic(): void {
    if (!this.backgroundMusic || !this.backgroundMusicEnabled) return;
    
    // Пытаемся воспроизвести музыку (необходимо взаимодействие пользователя с сайтом)
    const playPromise = this.backgroundMusic.play();
    
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.log('Фоновая музыка будет воспроизведена после взаимодействия пользователя с сайтом', error);
      });
    }
  }

  /**
   * Остановка фоновой музыки
   */
  public stopBackgroundMusic(): void {
    if (!this.backgroundMusic) return;
    
    this.backgroundMusic.pause();
    this.backgroundMusic.currentTime = 0;
  }

  /**
   * Установка громкости фоновой музыки
   */
  public setBackgroundMusicVolume(volume: number): void {
    this.backgroundMusicVolume = volume;
    localStorage.setItem('backgroundMusicVolume', volume.toString());
    
    if (this.backgroundMusic) {
      this.backgroundMusic.volume = volume;
    }
  }

  /**
   * Установка громкости звуковых эффектов
   */
  public setSoundVolume(volume: number): void {
    this.soundVolume = volume;
    localStorage.setItem('soundVolume', volume.toString());
    
    // Обновляем громкость для всех звуковых эффектов
    for (const [key, sound] of Object.entries(this.soundEffects)) {
      if (key.includes('Sound')) {
        sound.volume = volume;
      }
    }
  }

  /**
   * Установка громкости эффектов
   */
  public setEffectsVolume(volume: number): void {
    this.effectsVolume = volume;
    localStorage.setItem('effectsVolume', volume.toString());
    
    // Обновляем громкость для всех звуковых эффектов, которые не являются обычными звуками
    for (const [key, sound] of Object.entries(this.soundEffects)) {
      if (!key.includes('Sound')) {
        sound.volume = volume;
      }
    }
  }

  /**
   * Применение настроек звука из состояния игры
   */
  public applySettings(settings: {
    musicEnabled?: boolean,
    soundEnabled?: boolean,
    backgroundMusicVolume?: number,
    soundVolume?: number,
    effectsVolume?: number
  }): void {
    if (settings.musicEnabled !== undefined) {
      this.backgroundMusicEnabled = settings.musicEnabled;
      localStorage.setItem('backgroundMusicEnabled', String(settings.musicEnabled));
      
      if (this.backgroundMusicEnabled) {
        this.playBackgroundMusic();
      } else {
        this.stopBackgroundMusic();
      }
    }
    
    if (settings.soundEnabled !== undefined) {
      this.soundEffectsEnabled = settings.soundEnabled;
      localStorage.setItem('soundEffectsEnabled', String(settings.soundEnabled));
    }
    
    if (settings.backgroundMusicVolume !== undefined) {
      this.setBackgroundMusicVolume(settings.backgroundMusicVolume);
    }
    
    if (settings.soundVolume !== undefined) {
      this.setSoundVolume(settings.soundVolume);
    }
    
    if (settings.effectsVolume !== undefined) {
      this.setEffectsVolume(settings.effectsVolume);
    }
  }

  /**
   * Воспроизведение звукового эффекта
   */
  public playSound(soundName: keyof typeof this.SOUND_PATHS): void {
    if (!this.soundEffectsEnabled || soundName === 'backgroundMusic') return;
    
    const soundEffect = this.soundEffects[soundName];
    if (!soundEffect) return;
    
    // Сбрасываем звук если он уже играет
    soundEffect.currentTime = 0;
    
    // Воспроизводим звук
    const playPromise = soundEffect.play();
    
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.log(`Ошибка воспроизведения звука ${soundName}:`, error);
      });
    }
  }

  /**
   * Включение/выключение фоновой музыки
   */
  public toggleBackgroundMusic(): boolean {
    this.backgroundMusicEnabled = !this.backgroundMusicEnabled;
    localStorage.setItem('backgroundMusicEnabled', String(this.backgroundMusicEnabled));
    
    if (this.backgroundMusicEnabled) {
      this.playBackgroundMusic();
    } else {
      this.stopBackgroundMusic();
    }
    
    return this.backgroundMusicEnabled;
  }

  /**
   * Включение/выключение звуковых эффектов
   */
  public toggleSoundEffects(): boolean {
    this.soundEffectsEnabled = !this.soundEffectsEnabled;
    localStorage.setItem('soundEffectsEnabled', String(this.soundEffectsEnabled));
    return this.soundEffectsEnabled;
  }

  /**
   * Получение статуса фоновой музыки
   */
  public isBackgroundMusicEnabled(): boolean {
    return this.backgroundMusicEnabled;
  }

  /**
   * Получение статуса звуковых эффектов
   */
  public isSoundEffectsEnabled(): boolean {
    return this.soundEffectsEnabled;
  }

  /**
   * Получение громкости фоновой музыки
   */
  public getBackgroundMusicVolume(): number {
    return this.backgroundMusicVolume;
  }

  /**
   * Получение громкости звуков
   */
  public getSoundVolume(): number {
    return this.soundVolume;
  }

  /**
   * Получение громкости эффектов
   */
  public getEffectsVolume(): number {
    return this.effectsVolume;
  }

  /**
   * Получение экземпляра синглтона
   */
  public static getInstance(): AudioService {
    if (!AudioService.instance) {
      AudioService.instance = new AudioService();
    }
    
    return AudioService.instance;
  }
}

const audioService = AudioService.getInstance();
export default audioService; 