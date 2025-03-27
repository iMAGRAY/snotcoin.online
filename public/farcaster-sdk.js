// Farcaster SDK (local backup)
// This is a simplified version of the Farcaster SDK
// It provides basic functionality for authentication purposes

(function() {
  const FARCASTER_SDK_VERSION = '0.2.1';

  const mockUser = {
    fid: 1,
    username: 'local_user',
    displayName: 'Local User',
    pfp: {
      url: '/images/default_avatar.png',
      verified: false
    },
    verified: false,
    custody: {
      address: '0x0000000000000000000000000000000000000000',
      type: 'eoa'
    },
    verifications: []
  };

  // Initialize SDK
  window.farcaster = {
    // Track ready state
    _isReady: false,
    isReady: false,

    // Initialize SDK
    ready: async function() {
      console.log('[Farcaster SDK] Local SDK initializing...');
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      this._isReady = true;
      this.isReady = true;
      
      console.log('[Farcaster SDK] Local SDK initialized');
      return true;
    },

    // Get user context (mocked)
    getContext: async function() {
      console.log('[Farcaster SDK] Getting local user context');
      
      if (!this._isReady) {
        await this.ready();
      }
      
      // Generate random local user ID to mimic Farcaster
      const localId = `local_${Math.random().toString(36).substring(2, 10)}`;
      const timestamp = Date.now();
      
      // Save local ID to localStorage for consistency
      localStorage.setItem('farcaster_local_id', localId);
      
      return {
        ...mockUser,
        username: `local_${localId}`,
        fid: Math.floor(Math.random() * 9000) + 1000, // Random 4-digit number
        custody: {
          ...mockUser.custody,
          address: `0x${timestamp.toString(16)}${localId}`
        }
      };
    },

    // Fetch user by FID (mocked)
    fetchUserByFid: async function(fid) {
      console.log(`[Farcaster SDK] Fetching user data for FID: ${fid}`);
      
      if (!this._isReady) {
        await this.ready();
      }
      
      // Return mock user with the requested FID
      return {
        ...mockUser,
        fid: fid
      };
    },

    // Mock publish cast functionality
    publishCast: async function(textOrOptions) {
      console.log('[Farcaster SDK] Publishing cast (mocked)');
      
      const text = typeof textOrOptions === 'string' 
        ? textOrOptions 
        : textOrOptions.text;
      
      console.log(`[Farcaster SDK] Publishing: "${text}"`);
      
      // Generate random hash
      const hash = `0x${Math.random().toString(16).substring(2, 14)}`;
      
      return {
        hash,
        timestamp: Date.now()
      };
    }
  };

  console.log(`[Farcaster SDK] Local SDK (v${FARCASTER_SDK_VERSION}) loaded`);
})(); 