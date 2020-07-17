import * as GenreActions from "../actions/navbar.actions";

//define default state.
const defaultState:Map<String,String[]> = new Map();
defaultState.set("Puzzle", ["Soduku", "Rubix,", "Jenga"]);
defaultState.set("Action", ["MarioWorld", "Enter the Matrix", "World of Warcraft"])

export function GenreReducer(
  state:Map<String,String[]> = defaultState,
  action: GenreActions.Actions
) {
  switch (action.type) {
    case GenreActions.ADD_GENRE:
      return [...state, action.payload];
    default:
      return state;
  }
}
