import type { LocalState, LocalAction } from "../../../types/laboratory-types"

export const initialLocalState: LocalState = {
  showColorButtons: false,
  collectionResult: null,
  collectedAmount: null,
  flyingNumbers: [],
}

export function localReducer(state: LocalState, action: LocalAction): LocalState {
  switch (action.type) {
    case "SET_LOCAL_STATE":
      return { ...state, ...action.payload }
    case "ADD_FLYING_NUMBER":
      return { ...state, flyingNumbers: [...state.flyingNumbers, action.payload] }
    case "REMOVE_FLYING_NUMBER":
      return { ...state, flyingNumbers: state.flyingNumbers.filter((num) => num.id !== action.payload) }
    default:
      return state
  }
}

