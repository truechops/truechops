import { createSlice } from "@reduxjs/toolkit";
import * as Realm from "realm-web";

const app = new Realm.App("drumtoolz-ywire");

const initialState = {
  app,
  currentUser: app.currentUser,
};

const realmAppSlice = createSlice({
  name: "realm",
  initialState: initialState,
  reducers: {
    login(state, action) {
      state.currentUser = action.payload.user;
    },
    logout(state, action) {
      state.currentUser = action.payload.user;
    },
  },
});

export const login = (credentials) => {
    return async (dispatch) => {
        await app.logIn(credentials);
        dispatch(realmAppSlice.actions.login({user: app.currentUser}));
    }
};

export const logout = () => {
    return async (dispatch) => {
        await app.currentUser?.logOut();
        dispatch(realmAppSlice.actions.logout({user: app.currentUser}));
    }
}

export default realmAppSlice.reducer;
