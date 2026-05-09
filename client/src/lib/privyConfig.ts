export const privyConfig = {
  appId: 'cm4winhli04jg1tvq07cb8942',
  config: {
    loginMethods: ['wallet', 'email', 'telegram'],
    appearance: {
      theme: '#f8fafc',
      accentColor: '#7c3aed',
      logo: '/bantahbrologo.png',
      landingHeader: 'BantahBro Sign In',
      loginMessage: 'Connect fast to place stakes and manage live battles.',
      showWalletLoginFirst: true,
    },
    embeddedWallets: {
      createOnLogin: 'users-without-wallets',
    },
    telegram: {
      botUsername: import.meta.env?.VITE_TELEGRAM_BOT_USERNAME || '@bantah_bot',
    },
  },
} as const;
