interface FarcasterSDK {
  ready: () => void;
}

interface Window {
  farcaster?: FarcasterSDK;
} 