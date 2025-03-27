/**
 * Типы для работы с Farcaster SDK
 * @module
 */

declare module '@farcaster/auth-kit' {
  export interface FarcasterContext {
    fid: number;
    username: string;
    displayName: string;
    pfp?: {
      url: string;
      verified: boolean;
    };
    verified: boolean;
    custody?: {
      address: string;
      type: string;
    };
    verifications?: string[];
    domain?: string;
    url?: string;
  }

  export interface FarcasterCastOption {
    text: string;
    embeds?: {
      url?: string;
      image?: {
        url: string;
      };
    }[];
    replyTo?: {
      fid: number;
      hash: string;
    };
    mentions?: number[];
    mentionsPositions?: number[];
  }

  export interface FarcasterSDK {
    ready: () => void;
    getContext: () => Promise<FarcasterContext>;
    fetchUserByFid: (fid: number) => Promise<any>;
    publishCast: (text: string | FarcasterCastOption) => Promise<any>;
    reactToCast?: (hash: string, reaction: 'like' | 'recast') => Promise<any>;
    followUser?: (fid: number) => Promise<any>;
    checkFollowing?: (targetFid: number) => Promise<boolean>;
    frame?: any;
    [key: string]: any;
  }
}

declare global {
  interface Window {
    farcaster?: import('@farcaster/auth-kit').FarcasterSDK;
  }
}

export {}; 