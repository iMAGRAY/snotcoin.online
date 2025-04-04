import { GameState, Action } from '../../types/gameTypes';

export const gameReducer = (state: GameState, action: Action): GameState => {
  switch (action.type) {
    case 'UPDATE_INVENTORY':
      return {
        ...state,
        inventory: { ...state.inventory, ...action.payload }
      };
      
    case 'UPDATE_UPGRADES':
      return {
        ...state,
        upgrades: { ...state.upgrades, ...action.payload }
      };
      
    case 'SET_GAME_INSTANCE_RUNNING':
      return {
        ...state,
        isGameInstanceRunning: action.payload
      };

    default:
      return state;
  }
}; 