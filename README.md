# SnotCoin Telegram Mining Game

## Описание проекта

SnotCoin - это увлекательная игра для Telegram, основанная на концепции майнинга криптовалюты. Игроки собирают виртуальную валюту SNOT, участвуют в мини-играх и улучшают свое оборудование для майнинга. Проект разработан с использованием современных веб-технологий и предлагает уникальный игровой опыт в мессенджере Telegram.

## Структура проекта

\`\`\`
TelegramMiningGame/
├── app/
│   ├── components/
│   │   ├── auth/
│   │   │   ├── telegram/
│   │   │   │   └── TelegramAuth.tsx
│   │   │   ├── warpcast/
│   │   │   │   └── WarpCastAuth.tsx
│   │   │   └── AuthenticationWindow.tsx
│   │   ├── common/
│   │   │   ├── BackButton.tsx
│   │   │   ├── LoadingScreens.tsx
│   │   │   ├── Resources.tsx
│   │   │   ├── StatusPanel.tsx
│   │   │   └── TabBar.tsx
│   │   ├── effects/
│   │   │   ├── ExplosionEffect.tsx
│   │   │   └── FallingRewards.tsx
│   │   ├── game/
│   │   │   ├── fusion/
│   │   │   │   ├── game/
│   │   │   │   │   ├── power-ups/
│   │   │   │   │   │   ├── bull.tsx
│   │   │   │   │   │   ├── explosive-ball.tsx
│   │   │   │   │   │   └── joy.tsx
│   │   │   │   │   ├── Footer.tsx
│   │   │   │   │   ├── FusionGame.tsx
│   │   │   │   │   ├── GameArea.tsx
│   │   │   │   │   ├── GameBackground.tsx
│   │   │   │   │   ├── GameOverMenu.tsx
│   │   │   │   │   ├── GameWalls.tsx
│   │   │   │   │   ├── Header.tsx
│   │   │   │   │   ├── Launcher.tsx
│   │   │   │   │   └── PauseMenu.tsx
│   │   │   │   ├── Ball.tsx
│   │   │   │   ├── Fusion.tsx
│   │   │   │   ├── FusionMenu.tsx
│   │   │   │   ├── Header.tsx
│   │   │   │   └── StatusBar.tsx
│   │   │   ├── laboratory/
│   │   │   │   ├── background-image.tsx
│   │   │   │   ├── CollectButton.tsx
│   │   │   │   ├── CollectOptions.tsx
│   │   │   │   ├── flying-number.tsx
│   │   │   │   ├── laboratory-state.ts
│   │   │   │   ├── laboratory.tsx
│   │   │   │   ├── status-display.tsx
│   │   │   │   └── UpgradeButton.tsx
│   │   │   ├── profile/
│   │   │   │   ├── achievements/
│   │   │   │   │   └── Achievements.tsx
│   │   │   │   ├── modals/
│   │   │   │   │   ├── DepositModal.tsx
│   │   │   │   │   └── SettingsModal.tsx
│   │   │   │   ├── sections/
│   │   │   │   │   ├── AchievementsSection.tsx
│   │   │   │   │   ├── InventorySection.tsx
│   │   │   │   │   └── StatsSection.tsx
│   │   │   │   ├── withdraw/
│   │   │   │   │   ├── AmountInput.tsx
│   │   │   │   │   ├── CurrencySelector.tsx
│   │   │   │   │   ├── SubmitButton.tsx
│   │   │   │   │   ├── WalletAddressInput.tsx
│   │   │   │   │   └── WithdrawModal.tsx
│   │   │   │   ├── ProfilePage.tsx
│   │   │   │   └── WalletBar.tsx
│   │   │   ├── Settings.tsx
│   │   │   └── Storage.tsx
│   │   ├── icons/
│   │   │   └── SocialIcons.tsx
│   │   ├── storage/
│   │   │   ├── ChestCarousel.tsx
│   │   │   ├── ChestImage.tsx
│   │   │   └── OpenButton.tsx
│   │   └── ui/
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       └── ErrorDisplay.tsx
│   ├── contexts/
│   │   ├── GameContext.tsx
│   │   └── TranslationContext.tsx
│   ├── fusion-game/
│   │   └── page.tsx
│   ├── hooks/
│   │   ├── useFusionGame.ts
│   │   ├── useGameLoop.ts
│   │   ├── useGamePhysics.ts
│   │   └── useGameState.ts
│   ├── types/
│   │   ├── fusion-game.ts
│   │   ├── game.ts
│   │   ├── gameTypes.ts
│   │   ├── laboratory-types.ts
│   │   └── profile-types.ts
│   ├── upgrade/
│   │   └── page.tsx
│   └── utils/
│       ├── AudioManager.ts
│       ├── ballMerging.ts
│       ├── cache.ts
│       ├── collisionDetection.ts
│       ├── formatters.ts
│       ├── fusion-game-utils.ts
│       ├── gameUtils.ts
│       ├── supabase.ts
│       ├── telegramAuth.ts
│       └── upgradeUtils.ts
├── lib/
│   └── utils.ts
├── .env.local
├── .eslintrc.json
├── .gitignore
├── next.config.mjs
├── package.json
└── README.md
\`\`\`

