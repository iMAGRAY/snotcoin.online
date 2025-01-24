declare module "@twa-dev/sdk" {
  interface WebApp {
    isInitialized: boolean
    initData: string
    initDataUnsafe: any
    ready: () => void
    expand: () => void
    close: () => void
    MainButton: {
      text: string
      color: string
      textColor: string
      isVisible: boolean
      isActive: boolean
      isProgressVisible: boolean
      show: () => void
      hide: () => void
      enable: () => void
      disable: () => void
      showProgress: (leaveActive: boolean) => void
      hideProgress: () => void
      onClick: (callback: () => void) => void
      offClick: (callback: () => void) => void
    }
  }

  const WebApp: WebApp
  export default WebApp
}

