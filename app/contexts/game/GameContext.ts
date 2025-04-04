'use client';

import { createContext } from 'react';

export type GameContextType = {
  state: any;
  dispatch: (action: any) => void;
};

export const GameContext = createContext<GameContextType>({
  state: null,
  dispatch: () => {}
}); 