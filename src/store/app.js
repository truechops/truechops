import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    sideNavOpen: false,
    pageOffset: {
        x: 0,
        y: 0
    }
}

const appSlice = createSlice({
    name: 'app',
    initialState,
    reducers: {
        setNavOpen(state, action) {
            state.sideNavOpen = action.payload;
        },
        setPageOffset(state, action) {
            console.log("set page offset: " + JSON.stringify(action.payload));
            state.pageOffset = { x: action.payload.x, y: action.payload.y }
        }
    }
});

export default appSlice.reducer;
export const appActions = appSlice.actions;