interface Window {
  // Определение типов для Farcaster SDK
  farcaster?: {
    fetchUserByFid: (fid: number) => Promise<any>;
    getFrame: () => any;
    getFrameData: () => any;
    signMessage: (message: string) => Promise<any>;
    // Добавьте другие методы, которые могут быть доступны в SDK
  };
} 