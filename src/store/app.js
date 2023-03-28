import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    sideNavOpen: false,
    pageOffset: {
        x: 0,
        y: 0
    },
    loaded: false,
}

const appSlice = createSlice({
    name: 'app',
    initialState,
    reducers: {
        setNavOpen(state, action) {
            state.sideNavOpen = action.payload;
        },
        setPageOffset(state, action) {
            state.pageOffset = { x: action.payload.x, y: action.payload.y }
        },
        setPageLoaded(state) {
            state.loaded = true;
        }
    }
});

export default appSlice.reducer;
export const appActions = appSlice.actions;