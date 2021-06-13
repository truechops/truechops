import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    sideNavOpen: false
}

const navigationSlice = createSlice({
    name: 'nav',
    initialState,
    reducers: {
        setNavOpen(state, action) {
            state.sideNavOpen = action.payload;
        }
    }
});

export default navigationSlice.reducer;
export const sideNavActions = navigationSlice.actions;