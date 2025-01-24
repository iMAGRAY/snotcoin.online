import type React from "react"
import { createContext, useContext, useState } from "react"

type Language = "en" | "es" | "fr" | "de" | "ru"

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
    fusionTab: "Fusion Tab",
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
    fusionGame: "Fusion",
    fullIn: "Full in",
    loadingGameAssets: "Loading Game Assets",
    complete: "Complete",
    assetLoadFailed: "Some assets failed to load. The game will continue with reduced functionality.",
    commonChest: "Common Chest",
    commonChestDescription: "Costs 5 SNOT. Rewards 2-8 SnotCoins",
    rareChest: "Rare Chest",
    rareChestDescription: "Costs 50 SNOT. Rewards 25-70 SnotCoins",
    legendaryChest: "Legendary Chest",
    legendaryChestDescription: "Costs 400 SNOT. Rewards 200-500 SnotCoins",
    music: "Music",
    sounds: "Sounds",
    on: "On",
    off: "Off",
    game: "Game",
    roadmap: "Roadmap",
    tokenomic: "Tokenomic",
    socialMedia: "Social Media",
    backgroundAudio: "Background Audio",
    nonBackgroundAudio: "Non-Background Audio",
    comingSoon: "Coming Soon",
    exitGame: "Exit Game",
    pauseMenu: "Pause Menu",
    restart: "Restart",
    exit: "Exit",
    ballsLeft: "Balls Left",
    throwsLeft: "Throws left",
    addBall: "Add Ball",
    launchBall: "Launch Ball",
    fusionLab: "Fusion Laboratory",
    fusionDescription: "Merge microbes, create powerful combinations, and earn SNOT in this exciting fusion game!",
    fusionPower: "Fusion Power",
    lowRiskLowReward: "Low Risk",
    highRiskHighReward: "High Risk",
    fusing: "Fusing...",
    startFusion: "Start Fusion",
    fusionSuccess: "Fusion Successful!",
    fusionReward: "You gained {reward} SnotCoins!",
    fusionFailed: "Fusion Failed",
    fusionFailureMessage: "The fusion process was unstable. Try again!",
    allRightsReserved: "All rights reserved",
    score: "Score",
    resume: "Resume",
    gameOver: "Game Over",
    snotEarned: "SNOT Earned",
    home: "Home",
    upgrade: "Upgrade",
    upgrades: "Upgrades",
    upgradesComingSoon: "Upgrades coming soon!",
    currentLevel: "Current Level",
    upgradeCost: "Upgrade Cost",
    availableSnotCoins: "Available SnotCoins",
    containerCapacityUpgrade: "Container Capacity Upgrade",
    containerCapacityDescription: "Increase the maximum amount of SNOT your container can hold",
    fillingSpeedUpgrade: "Filling Speed Upgrade",
    fillingSpeedDescription: "Increase the rate at which your container fills with SNOT",
    explosiveBall: "Explosive Ball",
    joy: "Joy",
    achievements: "Achievements",
    all: "All",
    "First Snot": "First Snot",
    "Collect your first SNOT": "Collect your first SNOT",
    "Snot Master": "Snot Master",
    "Collect 1,000 SNOT": "Collect 1,000 SNOT",
    "Fusion Beginner": "Fusion Beginner",
    "Complete your first fusion game": "Complete your first fusion game",
    "Storage Upgrade": "Storage Upgrade",
    "Upgrade your storage container": "Upgrade your storage container",
    "Coin Collector": "Coin Collector",
    "Collect 100 SnotCoins": "Collect 100 SnotCoins",
    capacityLevel: "Capacity Level",
    fillingLevel: "Filling Level",
    attemptsLeft: "Attempts left",
    snotCollected: "SNOT collected!",
    collectionFailed: "Collection failed",
    total: "Total",
    notEnoughEnergy: "Not enough energy",
    capacityTooltip: "Maximum amount of SNOT your container can hold",
    capacityLevelTooltip: "Current level of your container's capacity",
    fillingLevelTooltip: "Current level of your container's filling speed",
    fillTimeTooltip: "Time until container is completely full",
    profile: "Profile",
    stats: "Statistics",
    inventory: "Inventory",
    settingsLabel: "Settings",
    statsDescription: "View your game statistics and progress",
    inventoryDescription: "Manage your collected items and resources",
    settingsDescription: "Customize your game preferences",
    playerName: "Player Name",
    playerLevel: "Level",
    profileStatsTitle: "Player Stats",
    achievementsButton: "View Achievements",
    depositInstructions: "To deposit ETH, send it to the following address:",
    hideQRCode: "Hide QR Code",
    showQRCode: "Show QR Code",
    depositDisclaimer: "Please note that deposits may take a few minutes to be reflected in your balance.",
    refreshBalance: "Refresh Balance",
    refreshEthBalance: "Refresh ETH Balance",
    Claim: "Claim",
    welcomeToSnotCoin: "Welcome to SnotCoin",
    gameDescription: "Collect, merge, and earn in this exciting crypto-mining game!",
    play: "Play Now",
    mainNavigation: "Main Navigation",
    back: "Back",
    about: "About",
    aboutDescription: "SnotCoin is an exciting crypto-mining game where you collect, merge, and earn virtual currency.",
    authentication: "Authentication",
    loginWithTelegram: "Login with Telegram",
    loginAsGuest: "Login as Guest",
    loginWithWarpCast: "Login with WarpCast",
    logout: "Log Out",
    guestLoginWarning: "Guest Login Warning",
    guestLoginWarningMessage:
      "Please note that as a guest, your game progress will not be saved. Are you sure you want to continue?",
    cancel: "Cancel",
    continue: "Continue",
  },
  es: {
    settings: "Ajustes",
    audio: "Audio",
    musicVolume: "Volumen de Música",
    effectsVolume: "Volumen de Efectos",
    muteAll: "Silenciar Todo",
    language: "Idioma",
    snotCoins: "SnotCoins",
    snot: "SNOT",
    collect: "Recolectar",
    laboratoryTab: "Laboratorio",
    storageTab: "Almacén",
    fusionTab: "Fusión Tab",
    gamesTab: "Juegos",
    achievementsTab: "Logros",
    containerEmpty: "El contenedor está vacío. Espera a que se llene.",
    level: "Nivel",
    capacity: "Cap",
    speedLevel: "Niv Vel",
    speed: "Velocidad",
    fillTime: "Llenado",
    progress: "Prog",
    storageMachine: "Máquina de Almacenamiento",
    open: "ABRIR",
    failed: "Fallido",
    fusionGame: "Fusión",
    fullIn: "Lleno en",
    loadingGameAssets: "Cargando recursos del juego",
    complete: "Completo",
    assetLoadFailed: "Algunos recursos no se pudieron cargar. El juego continuará con funcionalidad reducida.",
    commonChest: "Cofre Común",
    commonChestDescription: "Cuesta 5 SNOT. Recompensa 2-8 SnotCoins",
    rareChest: "Cofre Raro",
    rareChestDescription: "Cuesta 50 SNOT. Recompensa 25-70 SnotCoins",
    legendaryChest: "Cofre Legendario",
    legendaryChestDescription: "Cuesta 400 SNOT. Recompensa 200-500 SnotCoins",
    music: "Música",
    sounds: "Sonidos",
    on: "Activado",
    off: "Desactivado",
    game: "Juego",
    roadmap: "Hoja de ruta",
    tokenomic: "Tokenómica",
    socialMedia: "Redes Sociales",
    backgroundAudio: "Background Audio",
    nonBackgroundAudio: "Non-Background Audio",
    comingSoon: "Próximamente",
    exitGame: "Salir del juego",
    pauseMenu: "Menú de Pausa",
    restart: "Reiniciar",
    exit: "Salir",
    ballsLeft: "Bolas Restantes",
    throwsLeft: "Lanzamientos restantes",
    addBall: "Añadir Bola",
    launchBall: "Lanzar Bola",
    fusionLab: "¡Fusiona SnotCoins para potencialmente multiplicar tu riqueza!",
    fusionDescription: "Laboratorio de Fusión",
    fusionPower: "Poder de Fusión",
    lowRiskLowReward: "Bajo Riesgo",
    highRiskHighReward: "Alto Riesgo",
    fusing: "Fusionando...",
    startFusion: "Comenzar Fusión",
    fusionSuccess: "¡Fusión Exitosa!",
    fusionReward: "¡Ganaste {reward} SnotCoins!",
    fusionFailed: "Fusión Fallida",
    fusionFailureMessage: "El proceso de fusión fue inestable. ¡Inténtalo de nuevo!",
    allRightsReserved: "Todos los derechos reservados",
    score: "Puntuación",
    resume: "Reanudar",
    gameOver: "Juego Terminado",
    snotEarned: "SNOT Ganados",
    home: "Inicio",
    upgrade: "Mejorar",
    upgrades: "Mejoras",
    upgradesComingSoon: "¡Mejoras próximamente!",
    currentLevel: "Nivel Actual",
    upgradeCost: "Costo de Mejora",
    availableSnotCoins: "SnotCoins Disponibles",
    containerCapacityUpgrade: "Mejora de Capacidad del Contenedor",
    containerCapacityDescription: "Aumenta la cantidad máxima de SNOT que tu contenedor puede almacenar",
    fillingSpeedUpgrade: "Mejora de Velocidad de Llenado",
    fillingSpeedDescription: "Aumenta la velocidad a la que tu contenedor se llena con SNOT",
    explosiveBall: "Bola Explosiva",
    joy: "Alegría",
    achievements: "Logros",
    all: "Todos",
    "First Snot": "Primer Moco",
    "Collect your first SNOT": "Recolecta tu primer SNOT",
    "Snot Master": "Maestro de Mocos",
    "Collect 1,000 SNOT": "Recolecta 1,000 SNOT",
    "Fusion Beginner": "Principiante en Fusión",
    "Complete your first fusion game": "Completa tu primer juego de fusión",
    "Storage Upgrade": "Mejora de Almacenamiento",
    "Upgrade your storage container": "Mejora tu contenedor de almacenamiento",
    "Coin Collector": "Recolector de Monedas",
    "Collect 100 SnotCoins": "Recolecta 100 SnotCoins",
    capacityLevel: "Nivel de Capacidad",
    fillingLevel: "Nivel de Llenado",
    attemptsLeft: "Intentos restantes",
    snotCollected: "SNOT recolectado!",
    collectionFailed: "Recolección fallida",
    total: "Total",
    notEnoughEnergy: "No hay suficiente energía",
    capacityTooltip: "Cantidad máxima de SNOT que puede contener tu contenedor",
    capacityLevelTooltip: "Nivel actual de capacidad de tu contenedor",
    fillingLevelTooltip: "Nivel actual de velocidad de llenado de tu contenedor",
    fillTimeTooltip: "Tiempo hasta que el contenedor esté completamente lleno",
    profile: "Perfil",
    stats: "Estadísticas",
    inventory: "Inventario",
    settingsLabel: "Ajustes",
    statsDescription: "Ver tus estadísticas y progreso del juego",
    inventoryDescription: "Gestiona tus objetos y recursos recolectados",
    settingsDescription: "Personaliza tus preferencias del juego",
    refreshBalance: "Actualizar Saldo",
    refreshEthBalance: "Actualizar Saldo ETH",
    Claim: "Reclamar",
    welcomeToSnotCoin: "Bienvenido a SnotCoin",
    gameDescription: "¡Colecciona, fusiona y gana en este emocionante juego de criptominería!",
    play: "Jugar Ahora",
    mainNavigation: "Navegación principal",
    back: "Atrás",
    about: "Acerca de",
    aboutDescription:
      "SnotCoin es un emocionante juego de criptominería donde recolectas, fusionas y ganas moneda virtual.",
    authentication: "Autenticación",
    loginWithTelegram: "Iniciar sesión con Telegram",
    loginAsGuest: "Iniciar sesión como invitado",
    loginWithWarpCast: "Iniciar sesión con WarpCast",
    logout: "Cerrar Sesión",
    guestLoginWarning: "Advertencia de inicio de sesión de invitado",
    guestLoginWarningMessage:
      "¡Tenga en cuenta que, como invitado, su progreso en el juego no se guardará. ¿Está seguro de que desea continuar?",
    cancel: "Cancelar",
    continue: "Continuar",
  },
  fr: {
    settings: "Paramètres",
    audio: "Audio",
    musicVolume: "Volume de la Musique",
    effectsVolume: "Volume des Effets",
    muteAll: "Tout Couper",
    language: "Langue",
    snotCoins: "SnotCoins",
    snot: "SNOT",
    collect: "Collecter",
    laboratoryTab: "Laboratoire",
    storageTab: "Stockage",
    fusionTab: "Fusion Tab",
    gamesTab: "Jeux",
    achievementsTab: "Réalisations",
    containerEmpty: "Le conteneur est vide. Attendez qu'il se remplisse.",
    level: "Niveau",
    capacity: "Cap",
    speedLevel: "Niv Vit",
    speed: "Vitesse",
    fillTime: "Remplissage",
    progress: "Prog",
    storageMachine: "Machine de Stockage",
    open: "OUVRIR",
    failed: "Échoué",
    fusionGame: "Fusion",
    fullIn: "Plein dans",
    loadingGameAssets: "Chargement des ressources du jeu",
    complete: "Terminé",
    assetLoadFailed:
      "Certaines ressources n'ont pas pu être chargées. Le jeu continuera avec des fonctionnalités réduites.",
    commonChest: "Coffre Commun",
    commonChestDescription: "Coûte 5 SNOT. Récompense 2-8 SnotCoins",
    rareChest: "Coffre Rare",
    rareChestDescription: "Coûte 50 SNOT. Récompense 25-70 SnotCoins",
    legendaryChest: "Coffre Légendaire",
    legendaryChestDescription: "Coûte 400 SNOT. Récompense 200-500 SnotCoins",
    music: "Musique",
    sounds: "Sons",
    on: "Activé",
    off: "Désactivé",
    game: "Jeu",
    roadmap: "Feuille de route",
    tokenomic: "Tokenomique",
    socialMedia: "Réseaux sociaux",
    backgroundAudio: "Background Audio",
    nonBackgroundAudio: "Non-Background Audio",
    comingSoon: "Bientôt disponible",
    exitGame: "Quitter le jeu",
    pauseMenu: "Menu Pause",
    restart: "Redémarrer",
    exit: "Quitter",
    ballsLeft: "Balles Restantes",
    throwsLeft: "Lancers restants",
    addBall: "Ajouter Boule",
    launchBall: "Lancer la Balle",
    fusionLab: "Laboratoire de Fusion",
    fusionDescription: "Fusionnez des SnotCoins pour potentiellement multiplier votre richesse !",
    fusionPower: "Puissance de Fusion",
    lowRiskLowReward: "Faible Risque",
    highRiskHighReward: "Haut Risque",
    fusing: "Fusion en cours...",
    startFusion: "Lancer la Fusion",
    fusionSuccess: "Fusion réussie !",
    fusionReward: "Vous avez gagné {reward} SnotCoins !",
    fusionFailed: "Fusion échouée",
    fusionFailureMessage: "Le processus de fusion était instable. Réessayez !",
    allRightsReserved: "Tous droits réservés",
    score: "Score",
    resume: "Reprendre",
    gameOver: "Jeu terminé",
    snotEarned: "SNOT gagnés",
    home: "Accueil",
    upgrade: "Améliorer",
    upgrades: "Améliorations",
    upgradesComingSoon: "Améliorations à venir bientôt !",
    currentLevel: "Niveau Actuel",
    upgradeCost: "Coût de la Mise à Niveau",
    availableSnotCoins: "SnotCoins Disponibles",
    containerCapacityUpgrade: "Amélioration de la Capacité du Conteneur",
    containerCapacityDescription: "Augmente la quantité maximale de SNOT que votre conteneur peut contenir",
    fillingSpeedUpgrade: "Amélioration de la Vitesse de Remplissage",
    fillingSpeedDescription: "Augmente la vitesse à laquelle votre conteneur se remplit de SNOT",
    explosiveBall: "Boule Explosive",
    joy: "Joie",
    achievements: "Réalisations",
    all: "Tous",
    "First Snot": "Premier Snot",
    "Collect your first SNOT": "Collectez votre premier SNOT",
    "Snot Master": "Maître du Snot",
    "Collect 1,000 SNOT": "Collectez 1 000 SNOT",
    "Fusion Beginner": "Débutant en Fusion",
    "Complete your first fusion game": "Terminez votre premier jeu de fusion",
    "Storage Upgrade": "Amélioration du Stockage",
    "Upgrade your storage container": "Améliorez votre conteneur de stockage",
    "Coin Collector": "Collectionneur de Pièces",
    "Collect 100 SnotCoins": "Collectez 100 SnotCoins",
    capacityLevel: "Niveau de Capacité",
    fillingLevel: "Niveau de Remplissage",
    attemptsLeft: "Tentatives restantes",
    snotCollected: "SNOT collecté !",
    collectionFailed: "Collecte échouée",
    total: "Total",
    notEnoughEnergy: "Énergie insuffisante",
    capacityTooltip: "Quantité maximale de SNOT que votre conteneur peut contenir",
    capacityLevelTooltip: "Niveau actuel de capacité de votre conteneur",
    fillingLevelTooltip: "Niveau actuel de vitesse de remplissage de votre conteneur",
    fillTimeTooltip: "Temps jusqu'à ce que le conteneur soit complètement plein",
    profile: "Profil",
    stats: "Statistiques",
    inventory: "Inventaire",
    settingsLabel: "Paramètres",
    statsDescription: "Voir vos statistiques et votre progression dans le jeu",
    inventoryDescription: "Gérer vos objets et ressources collectés",
    settingsDescription: "Personnaliser vos préférences de jeu",
    refreshBalance: "Actualiser le solde",
    refreshEthBalance: "Actualiser le solde ETH",
    Claim: "Réclamer",
    welcomeToSnotCoin: "Bienvenue sur SnotCoin",
    gameDescription: "Collectionnez, fusionnez et gagnez dans ce jeu de crypto-minage passionnant !",
    play: "Jouer maintenant",
    mainNavigation: "Navigation principale",
    back: "Retour",
    about: "À propos",
    aboutDescription:
      "SnotCoin est un jeu de crypto-minage passionnant où vous collectez, fusionnez et gagnez de la monnaie virtuelle.",
    authentication: "Authentification",
    loginWithTelegram: "Se connecter avec Telegram",
    loginAsGuest: "Se connecter en tant qu'invité",
    loginWithWarpCast: "Se connecter avec WarpCast",
    logout: "Se Déconnecter",
    guestLoginWarning: "Avertissement de connexion invité",
    guestLoginWarningMessage:
      "Veuillez noter qu'en tant qu'invité, votre progression de jeu ne sera pas enregistrée. Êtes-vous sûr de vouloir continuer ?",
    cancel: "Annuler",
    continue: "Continuer",
  },
  de: {
    settings: "Einstellungen",
    audio: "Audio",
    musicVolume: "Musiklautstärke",
    effectsVolume: "Effektlautstärke",
    muteAll: "Alles Stummschalten",
    language: "Sprache",
    snotCoins: "SnotCoins",
    snot: "SNOT",
    collect: "Sammeln",
    laboratoryTab: "Labor",
    storageTab: "Lager",
    fusionTab: "Fusion Tab",
    gamesTab: "Spiele",
    achievementsTab: "Erfolge",
    containerEmpty: "Der Behälter ist leer. Warte, bis er sich füllt.",
    level: "Stufe",
    capacity: "Kap",
    speedLevel: "Geschw Stufe",
    speed: "Geschwindigkeit",
    fillTime: "Füllen",
    progress: "Fortschritt",
    storageMachine: "Lagermaschine",
    open: "ÖFFNEN",
    failed: "Fehlgeschlagen",
    fusionGame: "Fusion",
    fullIn: "Voll in",
    loadingGameAssets: "Lade Spielressourcen",
    complete: "Abgeschlossen",
    assetLoadFailed:
      "Einige Ressourcen konnten nicht geladen werden. Das Spiel wird mit eingeschränkter Funktionalität fortgesetzt.",
    commonChest: "Gewöhnliche Truhe",
    commonChestDescription: "Kostet 5 SNOT. Belohnung 2-8 SnotCoins",
    rareChest: "Seltene Truhe",
    rareChestDescription: "Kostet 50 SNOT. Belohnung 25-70 SnotCoins",
    legendaryChest: "Legendäre Truhe",
    legendaryChestDescription: "Kostet 400 SNOT. Belohnung 200-500 SnotCoins",
    music: "Musik",
    sounds: "Sounds",
    on: "An",
    off: "Aus",
    game: "Spiel",
    roadmap: "Roadmap",
    tokenomic: "Tokenomic",
    socialMedia: "Soziale Medien",
    backgroundAudio: "Background Audio",
    nonBackgroundAudio: "Non-Background Audio",
    comingSoon: "Bald verfügbar",
    exitGame: "Spiel beenden",
    pauseMenu: "Pause-Menü",
    restart: "Neustart",
    exit: "Beenden",
    ballsLeft: "Verbleibende Bälle",
    throwsLeft: "Würfe übrig",
    addBall: "Ball Hinzufügen",
    launchBall: "Ball Werfen",
    fusionLab: "Fusionslabor",
    fusionDescription:
      "Verschmelze Mikroben, erschaffe mächtige Kombinationen und verdiene SNOT in diesem aufregenden Fusionsspiel!",
    fusionPower: "Fusionskraft",
    lowRiskLowReward: "Niedriges Risiko",
    highRiskHighReward: "Hohes Risiko",
    fusing: "Verschmelze...",
    startFusion: "Fusion starten",
    fusionSuccess: "Fusion erfolgreich!",
    fusionReward: "Du hast {reward} SnotCoins erhalten!",
    fusionFailed: "Fusion fehlgeschlagen",
    fusionFailureMessage: "Der Fusionsprozess war instabil. Versuche es erneut!",
    allRightsReserved: "Alle Rechte vorbehalten",
    score: "Punktzahl",
    resume: "Fortsetzen",
    gameOver: "Spiel vorbei",
    snotEarned: "Verdiente SNOT",
    home: "Startseite",
    upgrade: "Verbessern",
    upgrades: "Verbesserungen",
    upgradesComingSoon: "Verbesserungen kommen bald!",
    currentLevel: "Aktuelles Level",
    upgradeCost: "Upgrade Kosten",
    availableSnotCoins: "Verfügbare SnotCoins",
    containerCapacityUpgrade: "Behälterkapazitäts-Upgrade",
    containerCapacityDescription: "Erhöht die maximale Menge an SNOT, die dein Behälter aufnehmen kann",
    fillingSpeedUpgrade: "Füllgeschwindigkeits-Upgrade",
    fillingSpeedDescription: "Erhöht die Geschwindigkeit, mit der sich dein Behälter mit SNOT füllt",
    explosiveBall: "Explosiver Ball",
    joy: "Freude",
    achievements: "Erfolge",
    all: "Alle",
    "First Snot": "Erster Snot",
    "Collect your first SNOT": "Sammle deinen ersten SNOT",
    "Snot Master": "Snot Meister",
    "Collect 1,000 SNOT": "Sammle 1.000 SNOT",
    "Fusion Beginner": "Fusionsanfänger",
    "Complete your first fusion game": "Schließe dein erstes Fusionsspiel ab",
    "Storage Upgrade": "Lagerupgrade",
    "Upgrade your storage container": "Verbessere deinen Lagerbehälter",
    "Coin Collector": "Münzensammler",
    "Collect 100 SnotCoins": "Sammle 100 SnotCoins",
    capacityLevel: "Kapazitätslevel",
    fillingLevel: "Füllstand",
    attemptsLeft: "Versuche übrig",
    snotCollected: "SNOT gesammelt!",
    collectionFailed: "Sammlung fehlgeschlagen",
    total: "Total",
    notEnoughEnergy: "Nicht genug Energie",
    capacityTooltip: "Maximale SNOT-Menge, die Ihr Behälter aufnehmen kann",
    capacityLevelTooltip: "Aktuelles Level der Behälterkapazität",
    fillingLevelTooltip: "Aktuelles Level der Füllgeschwindigkeit",
    fillTimeTooltip: "Zeit bis der Behälter vollständig gefüllt ist",
    profile: "Profil",
    stats: "Statistiken",
    inventory: "Inventar",
    settingsLabel: "Einstellungen",
    statsDescription: "Zeige deine Spielstatistiken und deinen Fortschritt",
    inventoryDescription: "Verwalte deine gesammelten Gegenstände und Ressourcen",
    settingsDescription: "Passe deine Spieleinstellungen an",
    refreshBalance: "Guthaben aktualisieren",
    refreshEthBalance: "ETH-Guthaben aktualisieren",
    Claim: "Beanspruchen",
    welcomeToSnotCoin: "Willkommen bei SnotCoin",
    gameDescription: "Sammle, fusioniere und verdiene in diesem aufregenden Krypto-Mining-Spiel!",
    play: "Jetzt spielen",
    mainNavigation: "Hauptnavigation",
    back: "Zurück",
    about: "Über",
    aboutDescription:
      "SnotCoin ist ein spannendes Krypto-Mining-Spiel, bei dem du virtuelle Währung sammelst, zusammenführst und verdienst.",
    authentication: "Authentifizierung",
    loginWithTelegram: "Mit Telegram anmelden",
    loginAsGuest: "Als Gast anmelden",
    loginWithWarpCast: "Mit WarpCast anmelden",
    logout: "Abmelden",
    guestLoginWarning: "Gast-Anmeldewarnung",
    guestLoginWarningMessage:
      "Bitte beachten Sie, dass Ihr Spielfortschritt als Gast nicht gespeichert wird. Sind Sie sicher, dass Sie fortfahren möchten?",
    cancel: "Abbrechen",
    continue: "Fortfahren",
  },
  ru: {
    settings: "Настройки",
    audio: "Аудио",
    musicVolume: "Громкость музыки",
    effectsVolume: "Громкость эффектов",
    muteAll: "Выключить звук",
    language: "Язык",
    snotCoins: "SnotCoins",
    snot: "SNOT",
    collect: "Собрать",
    laboratoryTab: "Лаборатория",
    storageTab: "Хранилище",
    fusionTab: "Fusion Tab",
    gamesTab: "Игры",
    achievementsTab: "Достижения",
    containerEmpty: "Контейнер пуст. Подождите, пока он наполнится.",
    level: "Уровень",
    capacity: "Ёмкость",
    speedLevel: "Ур. скорости",
    speed: "Скорость",
    fillTime: "Заполнение",
    progress: "Прогресс",
    storageMachine: "Машина хранения",
    open: "ОТКРЫТЬ",
    failed: "Неудача",
    fusionGame: "Слияние",
    fullIn: "Заполнится через",
    loadingGameAssets: "Загрузка игровых ресурсов",
    complete: "Завершено",
    assetLoadFailed: "Некоторые ресурсы не удалось загрузить. Игра продолжится с ограниченной функциональностью.",
    commonChest: "Обычный сундук",
    commonChestDescription: "Стоит 5 SNOT. Награда 2-8 SnotCoins",
    rareChest: "Редкий сундук",
    rareChestDescription: "Стоит 50 SNOT. Награда 25-70 SnotCoins",
    legendaryChest: "Легендарный сундук",
    legendaryChestDescription: "Стоит 400 SNOT. Награда 200-500 SnotCoins",
    music: "Музыка",
    sounds: "Звуки",
    on: "Вкл",
    off: "Выкл",
    game: "Игра",
    roadmap: "Дорожная карта",
    tokenomic: "Токеномика",
    socialMedia: "Социальные сети",
    backgroundAudio: "Фоновое аудио",
    nonBackgroundAudio: "Звуковые эффекты",
    comingSoon: "Скоро будет доступно",
    exitGame: "Выйти из игры",
    pauseMenu: "Меню паузы",
    restart: "Перезапустить",
    exit: "Выход",
    ballsLeft: "Осталось Шаров",
    throwsLeft: "Осталось бросков",
    addBall: "Добавить Шар",
    launchBall: "Запустить Шар",
    fusionLab: "Лаборатория слияния",
    fusionDescription:
      "Объединяйте микробы, создавайте мощные комбинации и зарабатывайте SNOT в этой захватывающей игре слияния!",
    fusionPower: "Мощность слияния",
    lowRiskLowReward: "Низкий риск",
    highRiskHighReward: "Высокий риск",
    fusing: "Слияние...",
    startFusion: "Начать слияние",
    fusionSuccess: "Слияние успешно!",
    fusionReward: "Вы получили {reward} SnotCoins!",
    fusionFailed: "Слияние не удалось",
    fusionFailureMessage: "Процесс слияния был нестабильным. Попробуйте еще раз!",
    allRightsReserved: "Все права защищены",
    score: "Счет",
    resume: "Продолжить",
    gameOver: "Игра окончена",
    snotEarned: "Заработано SNOT",
    home: "Главная",
    upgrade: "Улучшить",
    upgrades: "Улучшения",
    upgradesComingSoon: "Улучшения скоро появятся!",
    currentLevel: "Текущий уровень",
    upgradeCost: "Стоимость улучшения",
    availableSnotCoins: "Доступные SnotCoins",
    containerCapacityUpgrade: "Улучшение вместимости контейнера",
    containerCapacityDescription: "Увеличивает максимальное количество SNOT, которое может хранить ваш контейнер",
    fillingSpeedUpgrade: "Улучшение скорости заполнения",
    fillingSpeedDescription: "Увеличивает скорость, с которой ваш контейнер заполняется SNOT",
    explosiveBall: "Взрывной шар",
    joy: "Радость",
    achievements: "Достижения",
    all: "Все",
    "First Snot": "Первый SNOT",
    "Collect your first SNOT": "Соберите свой первый SNOT",
    "Snot Master": "Мастер SNOT",
    "Collect 1,000 SNOT": "Соберите 1000 SNOT",
    "Fusion Beginner": "Новичок в слиянии",
    "Complete your first fusion game": "Завершите свою первую игру слияния",
    "Storage Upgrade": "Улучшение хранилища",
    "Upgrade your storage container": "Улучшите свой контейнер для хранения",
    "Coin Collector": "Коллекционер монет",
    "Collect 100 SnotCoins": "Соберите 100 SnotCoins",
    capacityLevel: "Уровень ёмкости",
    fillingLevel: "Уровень заполнения",
    attemptsLeft: "Осталось попыток",
    snotCollected: "SNOT собран!",
    collectionFailed: "Сбор не удался",
    total: "Всего",
    notEnoughEnergy: "Недостаточно энергии",
    capacityTooltip: "Максимальное количество SNOT, которое может содержать ваш контейнер",
    capacityLevelTooltip: "Текущий уровень вместимости контейнера",
    fillingLevelTooltip: "Текущий уровень скорости заполнения",
    fillTimeTooltip: "Время до полного заполнения контейнера",
    profile: "Профиль",
    stats: "Статистика",
    inventory: "Инвентарь",
    settingsLabel: "Настройки",
    statsDescription: "Просмотр статистики и прогресса игры",
    inventoryDescription: "Управление собранными предметами и ресурсами",
    settingsDescription: "Настройка параметров игры",
    refreshBalance: "Обновить баланс",
    refreshEthBalance: "Обновить баланс ETH",
    Claim: "Заявить",
    welcomeToSnotCoin: "Добро пожаловать в SnotCoin",
    gameDescription: "Собирайте, объединяйте и зарабатывайте в этой захватывающей игре по добыче криптовалюты!",
    play: "Играть сейчас",
    mainNavigation: "Основная навигация",
    back: "Назад",
    about: "О Нас",
    aboutDescription:
      "SnotCoin — это захватывающая игра по добыче криптовалюты, в которой вы собираете, объединяйте и зарабатываете виртуальную валюту.",
    authentication: "Аутентификация",
    loginWithTelegram: "Войти через Telegram",
    loginAsGuest: "Войти как гость",
    loginWithWarpCast: "Войти через WarpCast",
    logout: "Выйти",
    guestLoginWarning: "Предупреждение о входе гостя",
    guestLoginWarningMessage:
      "Обратите внимание, что как гость ваш игровойprogress не будет сохранен. Вы уверены, что хотите продолжить?",
    cancel: "Отмена",
    continue: "Продолжить",
  },
}

interface TranslationContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined)

export const TranslationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>("en")

  const t = (key: string): string => {
    return translations[language][key] || key
  }

  return <TranslationContext.Provider value={{ language, setLanguage, t }}>{children}</TranslationContext.Provider>
}

export const useTranslation = () => {
  const context = useContext(TranslationContext)
  if (context === undefined) {
    throw new Error("useTranslation must be used within a TranslationProvider")
  }
  return context
}

