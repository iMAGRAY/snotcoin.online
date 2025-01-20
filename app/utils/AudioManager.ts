interface Window {
  webkitAudioContext: typeof AudioContext
}

class AudioManager {
  private audioContext: AudioContext | null = null
  private audioElements: { [key: string]: HTMLAudioElement } = {}
  private volumes: { [key: string]: number } = {}
  private muted: { [key: string]: boolean } = {}
  private loadingPromises: { [key: string]: Promise<void> | null } = {}
  private retryAttempts: { [key: string]: number } = {}
  private maxRetries = 3

  constructor() {
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this)
    document.addEventListener("visibilitychange", this.handleVisibilityChange)
    this.initAudioContext()
    this.loadAndPlayBackgroundMusic()
  }

  async loadAudio(
    key: string,
    src: string,
    volume = 1,
    preload: "auto" | "metadata" | "none" = "metadata",
  ): Promise<void> {
    if (this.loadingPromises[key] !== null) {
      return this.loadingPromises[key] || Promise.resolve()
    }

    this.loadingPromises[key] = new Promise((resolve, reject) => {
      try {
        const audio = new Audio()
        audio.preload = preload

        audio.onerror = (error) => {
          console.error(`Error loading audio ${key}:`, {
            error,
            src,
            readyState: audio.readyState,
            networkState: audio.networkState,
          })
          delete this.loadingPromises[key]
          reject(new Error(`Failed to load audio ${key}: ${error}`))
        }

        audio.oncanplaythrough = () => {
          this.audioElements[key] = audio
          this.volumes[key] = volume
          this.muted[key] = false
          console.log(`Audio ${key} loaded successfully`)
          delete this.loadingPromises[key]
          resolve()
        }

        audio.src = src
        audio.volume = volume
        if (key.includes("background")) {
          audio.loop = true
        }

        audio.load()
      } catch (error) {
        console.error(`Error initializing audio ${key}:`, error)
        delete this.loadingPromises[key]
        reject(error)
      }
    })

    try {
      await this.loadingPromises[key]
    } catch (error) {
      console.error(`Failed to load audio ${key}, will retry if needed`)
      delete this.loadingPromises[key]
      throw error
    }

    return this.loadingPromises[key] || Promise.resolve()
  }

  async play(key: string): Promise<void> {
    const audio = this.audioElements[key]
    if (audio && !this.muted[key]) {
      try {
        const playPromise = audio.play()
        if (playPromise !== undefined) {
          await playPromise
          console.log(`Audio ${key} started playing`)
        }
      } catch (error) {
        console.error(`Error playing audio ${key}:`, error)
        throw error
      }
    } else {
      // Background music handling removed
    }
    return Promise.resolve()
  }

  pause(key: string): void {
    const audio = this.audioElements[key]
    if (audio && !audio.paused) {
      try {
        audio.pause()
      } catch (error) {
        console.error(`Error pausing audio ${key}:`, error)
      }
    }
  }

  stop(key: string): void {
    const audio = this.audioElements[key]
    if (audio) {
      try {
        audio.pause()
        audio.currentTime = 0
      } catch (error) {
        console.error(`Error stopping audio ${key}:`, error)
      }
    }
  }

  async fadeOut(key: string, duration = 300): Promise<void> {
    // Fade out disabled
    console.log(`Fade out disabled for: ${key}`)
  }

  async fadeIn(key: string, duration = 300): Promise<void> {
    // Fade in disabled
    console.log(`Fade in disabled for: ${key}`)
  }

  setVolume(key: string, volume: number): void {
    // Volume setting disabled
    console.log(`Volume setting disabled for: ${key}`)
  }

  setMuted(key: string, muted: boolean): void {
    // Mute setting disabled
    console.log(`Mute setting disabled for: ${key}`)
  }

  setNonBackgroundMuted(muted: boolean): void {
    Object.keys(this.audioElements).forEach((key) => {
      if (!key.includes("background")) {
        this.muted[key] = muted
        const audio = this.audioElements[key]
        if (audio) {
          audio.volume = muted ? 0 : this.volumes[key]
          if (muted && !audio.paused) {
            audio.pause()
          }
        }
      }
    })
  }

  isNonBackgroundMuted(): boolean {
    return Object.keys(this.audioElements).some((key) => !key.includes("background") && this.muted[key])
  }

  isAudioLoaded(key: string): boolean {
    return key in this.audioElements && this.audioElements[key].readyState === 4
  }

  isAudioPlayable(key: string): boolean {
    const audio = this.audioElements[key]
    return Boolean(audio && audio.readyState === 4 && !audio.error && audio.duration > 0 && !isNaN(audio.duration))
  }

  private async handleVisibilityChange(): Promise<void> {
    if (document.hidden) {
      Object.keys(this.audioElements).forEach((key) => this.pause(key))
    } else {
      for (const [key, audio] of Object.entries(this.audioElements)) {
        if (key.includes("background") && !this.muted[key]) {
          try {
            await this.play(key)
          } catch (error) {
            console.error(`Error resuming audio ${key} after visibility change:`, error)
          }
        }
      }
    }
  }

  private initAudioContext(): void {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (AudioContextClass) {
        this.audioContext = new AudioContextClass()
      } else {
        console.warn("AudioContext is not supported in this browser")
      }
    } catch (error) {
      console.warn("AudioContext initialization failed:", error)
    }
  }

  cleanup(): void {
    Object.values(this.audioElements).forEach((audio) => {
      try {
        audio.pause()
        audio.src = ""
      } catch (error) {
        console.error("Error cleaning up audio:", error)
      }
    })
    this.audioElements = {}
    this.volumes = {}
    this.muted = {}
    this.loadingPromises = {}
    this.retryAttempts = {}
    document.removeEventListener("visibilitychange", this.handleVisibilityChange)

    if (this.audioContext) {
      try {
        this.audioContext.close()
      } catch (error) {
        console.error("Error closing AudioContext:", error)
      }
    }
  }

  async loadAndPlayBackgroundMusic(): Promise<void> {
    const key = "backgroundMusic"
    const src =
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/vibrant-adventures-255544%20(2)-cEBWKoYUdvJ7yO1lnfaAPW7YrTc0N8.mp3"

    try {
      await this.loadAudio(key, src, 0.5, "auto")
      console.log("Background music loaded successfully")

      const playAttempt = () => {
        this.play(key)
          .then(() => {
            console.log("Background music started playing")
            document.removeEventListener("click", playAttempt)
          })
          .catch((error) => {
            console.error("Failed to play background music:", error)
          })
      }

      document.addEventListener("click", playAttempt)

      this.play(key).catch(() => console.log("Autoplay prevented. Click to start music."))
    } catch (error) {
      console.error("Failed to load background music:", error)
    }
  }

  getAudioState(key: string): string {
    const audio = this.audioElements[key]
    if (!audio) return "Not loaded"
    if (audio.paused) return "Paused"
    return "Playing"
  }
}

export const audioManager = new AudioManager()

