/**
 * Централизованные константы пользовательского интерфейса
 * 
 * Этот файл содержит константы, используемые в разных компонентах
 * для обеспечения согласованности стилей и поведения.
 */

// Пути к иконкам и изображениям
export const ICONS = {
  KINGCOIN: '/images/common/icons/kingcoin.webp',
  SNOT: '/images/common/icons/snot.webp',
  ENERGY: '/images/common/icons/energy.webp',
  PLACEHOLDER: '/images/common/placeholder.svg',
  LABORATORY: {
    MACHINE: '/images/laboratory/laboratory-machine.webp',
    MAIN: '/images/laboratory/Laboratory.webp',
    BACKGROUND: '/images/laboratory/background/laboratory-bg.webp',
    BUTTONS: {
      CLAIM: '/images/laboratory/buttons/claim-button.webp',
      UPGRADE: '/images/laboratory/buttons/upgrade-button.webp',
    }
  },
  MERGE: {
    MAIN: '/images/merge/merge.webp',
  },
  STORAGE: {
    MAIN: '/images/storage/Storage.webp',
    BACKGROUND: '/images/storage/background/storage-background.webp',
    LEVELS: {
      LEVEL1: '/images/storage/levels/level1.webp',
      LEVEL2: '/images/storage/levels/level2.webp',
      LEVEL3: '/images/storage/levels/level3.webp',
      LEVEL1_OPEN: '/images/storage/levels/level1open.webp',
      LEVEL2_OPEN: '/images/storage/levels/level2open.webp',
      LEVEL3_OPEN: '/images/storage/levels/level3open.webp',
    }
  },
  QUESTS: {
    MAIN: '/images/quests/Quests.webp',
    BACKGROUND: '/images/quests/background/quests-background.webp',
  },
  PROFILE: {
    MAIN: '/images/profile/Profile.webp',
    BACKGROUND: '',
    AVATAR: {
      DEFAULT: '/images/profile/avatar/default.webp',
    }
  },
  COMMON: {
    LOADING: '/images/common/loading.webp',
    FIRST_VISIT: '/images/common/firstvisit/firstvisit.webp',
    COINS: {
      COIN: '/images/common/coins/coin.webp',
      get COIN_PNG() {
        return this.COIN;
      }
    }
  },
  AUTH: {
    BACKGROUND: '/images/auth/authentication.webp',
  },
};

// Цветовые классы
export const COLORS = {
  SNOT: "text-[#bbeb25]",
  KINGCOIN: "text-yellow-400",
  DEFAULT: ""
}

// Классы для панели ресурсов и статуса
export const UI_CLASSES = {
  // Общие классы для панелей
  PANEL: {
    CONTAINER: "z-50 fixed top-0 left-0 right-0 bg-transparent",
    TRANSPARENT: "z-50 bg-transparent",
  },
  
  // Классы для статусной панели
  STATUS: {
    CONTAINER: "bg-black/30 backdrop-blur-sm rounded-full py-1 px-2 shadow-lg",
    ICON: "w-3 h-3 sm:w-4 sm:h-4 text-white",
    TEXT: "text-[10px] sm:text-xs font-medium text-white",
    BOLD_TEXT: "text-[10px] sm:text-xs font-bold text-white"
  },
  
  // Классы для ресурсных элементов
  RESOURCE_ITEM: {
    CONTAINER: "flex items-center space-x-1.5 py-1 px-2 sm:px-3 rounded-lg hover:bg-[#2a3b4d]/30 transition-all duration-300",
    IMAGE_CONTAINER: "relative w-6 h-6 sm:w-7 sm:h-7 flex-shrink-0",
    TEXT: "text-lg sm:text-xl font-bold leading-none"
  }
}

// Временные константы для анимаций (в миллисекундах)
export const ANIMATION_DURATIONS = {
  FLYING_NUMBER: 1000,
  STATUS_FADE: 300,
  COLLECTION_COOLDOWN: 200,
  CLICK_COOLDOWN: 100,
  RESOURCE_UPDATE_INTERVAL: 1000,
  COLLECT_COOLDOWN: 500,
  BUTTON_FEEDBACK: 300,
  UI_TRANSITION: 200
}

// Анимации
export const ANIMATIONS = {
  STATUS_ITEM: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3 }
  },
  RESOURCE_PANEL: {
    initial: { y: -50, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    transition: { type: "spring", stiffness: 260, damping: 20 }
  }
}

// Макеты и размеры (используются для отступов и размеров)
export const LAYOUT = {
  TOP_PADDING: "pt-24", // Отступ для контента под верхней панелью
  RESOURCE_ICON_SIZE: 28 // Размер иконок ресурсов
}

// Определения ресурсов
export const RESOURCES = {
  DEFAULTS: {
    MIN_CAPACITY: 1,
    MIN_LEVEL: 1,
    MIN_FILLING_SPEED: 0.01,
    MAX_COLLECTION_PER_CLICK: 1
  }
} 