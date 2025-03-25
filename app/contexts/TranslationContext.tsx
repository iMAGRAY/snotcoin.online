"use client"

import type React from "react"
import { createContext, useContext } from "react"

// Оставляем только английский язык
type Language = "en"

interface Translations {
  [key: string]: {
    [key: string]: string
  }
}

const translations: Translations = {
  en: {
    settings: "Settings",
    audio: "Audio",
    musicVolume: "Music Volume",
    effectsVolume: "Effects Volume",
    muteAll: "Mute All",
    language: "Language",
    snotCoins: "SnotCoins",
    snot: "SNOT",
    collect: "Collect",
    laboratoryTab: "Laboratory",
    storageTab: "Storage",
    gamesTab: "Games",
    achievementsTab: "Achievements",
    containerEmpty: "Container is empty. Wait for it to fill up.",
    level: "Level",
    capacity: "Cap",
    speedLevel: "Spd Lvl",
    speed: "Speed",
    fillTime: "Fill",
    progress: "Prog",
    storageMachine: "Storage Machine",
    open: "OPEN",
    failed: "Failed",
    complete: "Complete",
    assetLoadFailed: "Some assets failed to load. The game will continue with reduced functionality.",
    commonChest: "Common Chest",
    commonChestDescription: "Costs 5 SNOT. Rewards 2-8 SnotCoins",
    rareChest: "Rare Chest",
    rareChestDescription: "Costs 50 SNOT. Rewards 25-70 SnotCoins",
    legendaryChest: "Legendary Chest",
    legendaryChestDescription: "Costs 400 SNOT. Rewards 200-500 SnotCoins",
    notEnoughSnot: "Not enough SNOT",
    buyChest: "Buy",
    cancel: "Cancel",
    confirm: "Confirm",
    areYouSure: "Are you sure?",
    chestPurchaseConfirmation: "Do you want to purchase this chest?",
    laboratorySummary: "Laboratory Summary",
    availableSnot: "Available SNOT",
    collectionRate: "Collection Rate",
    totalContainers: "Total Containers",
    upgrade: "Upgrade",
    maxLevel: "MAX LEVEL",
    notEnoughCoins: "Not enough SnotCoins",
    needMoreCoins: "You need more SnotCoins to upgrade.",
    upgradeDetail: "Upgrade Detail",
    currentLevel: "Current Level",
    nextLevel: "Next Level",
    capacityIncrease: "Capacity Increase",
    fillSpeedIncrease: "Fill Speed Increase",
    upgradeCost: "Upgrade Cost",
    upgradeConfirmation: "Do you want to upgrade this container?",
    congratulations: "Congratulations!",
    containerUpgraded: "Container has been upgraded!",
    storageUpgraded: "Storage has been upgraded!",
    currentCapacity: "Current Capacity",
    newCapacity: "New Capacity",
    ok: "OK",
    purchaseComplete: "Purchase Complete",
    balanceUpdated: "Your balance has been updated.",
    chestReward: "Chest Reward",
    youReceived: "You received",
    loginRequired: "Login Required",
    loginRequiredDescription: "You need to login to access this feature.",
    openChest: "Open Chest",
    viewAd: "View Ad",
    chestOpeningFailed: "Chest Opening Failed",
    tryAgainLater: "Please try again later.",
    dailyRewards: "Daily Rewards",
    day: "Day",
    collect_rewards: "Collect Rewards",
    youReceivedReward: "You received your daily reward!",
    comeBackTomorrow: "Come back tomorrow for another reward!",
    rewardClaimed: "Reward Claimed",
    notifications: "Notifications",
    notificationsDescription: "Enable notifications to receive updates about your containers and special offers.",
    enable: "Enable",
    later: "Later",
    containerFull: "Container Full",
    containerFullDescription: "One of your containers is full. Collect the SNOT!",
    specialOffer: "Special Offer",
    specialOfferDescription: "Limited time offer on chests! Check the store now.",
    welcomeBack: "Welcome Back",
    dailyRewardAvailable: "Your daily reward is available now!",
    achievementUnlocked: "Achievement Unlocked",
    achievementUnlockedDescription: "You have unlocked a new achievement!",
    gameEvents: "Game Events",
    gameEventsDescription: "Special events are available now. Check them out!",
    systemNotification: "System Notification",
    chat: "Chat",
    chatDescription: "Chat with other players and friends.",
    message: "Message",
    send: "Send",
    chatPlaceholder: "Type your message here...",
    friends: "Friends",
    friendsDescription: "Manage your friends list and send requests.",
    addFriend: "Add Friend",
    removeFriend: "Remove Friend",
    friendRequests: "Friend Requests",
    accept: "Accept",
    decline: "Decline",
    online: "Online",
    offline: "Offline",
    achievements: "Achievements",
    achievementsDescription: "Track your progress and earn rewards.",
    points: "Points",
    total: "Total",
    completed: "Completed",
    inProgress: "In Progress",
    locked: "Locked",
    profile: "Profile",
    profileDescription: "View and edit your profile information.",
    username: "Username",
    email: "Email",
    joinDate: "Join Date",
    totalPlayTime: "Total Play Time",
    edit: "Edit",
    save: "Save",
    changeAvatar: "Change Avatar",
    stats: "Stats",
    statsDescription: "View your game statistics and progress.",
    inventory: "Inventory",
    inventoryDescription: "Manage your collected items and resources.",
    settingsDescription: "Configure your game settings.",
    refreshBalance: "Refresh Balance",
    Claim: "Claim",
    welcomeToSnotCoin: "Welcome to SnotCoin",
    gameDescription: "Collect, merge, and earn in this exciting crypto mining game!",
    play: "Play Now",
    mainNavigation: "Main Navigation",
    back: "Back",
    about: "About",
    aboutDescription:
      "SnotCoin is an exciting crypto mining game where you collect, merge, and earn virtual currency.",
    authentication: "Authentication",
    loginWithFarcaster: "Login with Farcaster",
    loginAsGuest: "Login as Guest",
    logout: "Logout",
    questsTab: "Quests",
    consecutiveLoginDays: "Consecutive Login Days",
  },
}

interface TranslationContextType {
  language: Language
  t: (key: string) => string
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined)

export const TranslationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Упрощенный провайдер - всегда используем английский язык
  const language: Language = "en"

  const t = (key: string): string => {
    return translations[language][key] || key
  }

  return <TranslationContext.Provider value={{ language, t }}>{children}</TranslationContext.Provider>
}

export const useTranslation = () => {
  const context = useContext(TranslationContext)
  if (context === undefined) {
    throw new Error("useTranslation must be used within a TranslationProvider")
  }
  return context
}

