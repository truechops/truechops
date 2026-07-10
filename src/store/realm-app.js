import { createSlice } from "@reduxjs/toolkit";
import { appActions } from './app';

const atlasAuthDeprecationError = () => {
  throw new Error("Atlas App Services auth has reached EOL. Use Google login instead.");
};

const app = {
  currentUser: null,
  emailPasswordAuth: {
    confirmUser: atlasAuthDeprecationError,
    registerUser: atlasAuthDeprecationError,
  },
};

const initialState = {
  app,
  currentUser: null,
  sessionLoaded: false,
};

const realmAppSlice = createSlice({
  name: "realm",
  initialState: initialState,
  reducers: {
    setCurrentUser(state, action) {
      state.currentUser = action.payload.user;
      state.sessionLoaded = true;
    },
    clearCurrentUser(state) {
      state.currentUser = null;
      state.sessionLoaded = true;
    },
  },
});

export const loadCurrentUser = () => {
  return async (dispatch) => {
    try {
      const response = await fetch("/api/auth/me");
      const payload = await response.json();
      dispatch(realmAppSlice.actions.setCurrentUser({ user: response.ok ? payload.user : null }));
    } catch {
      dispatch(realmAppSlice.actions.clearCurrentUser());
    }
  };
};

export const login = () => {
  return async () => {
    atlasAuthDeprecationError();
  };
};

export const logout = () => {
  return async (dispatch) => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Clear local auth state even if the server request fails.
    }

    dispatch(appActions.setNavOpen(false));
    dispatch(realmAppSlice.actions.clearCurrentUser());
  };
}

export default realmAppSlice.reducer;
