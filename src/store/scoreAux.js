import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  voices: {
    kickSelected: false,
    snareSelected: true,
    hiHatSelected: false,
    rideSelected: false,
    hiHatFootSelected: false,
    tom1Selected: false,
    tom2Selected: false,
    tom3Selected: false,
    tom4Selected: false,
  },
  dotSelected: false,
};

const scoreAuxSlice = createSlice({
  name: "scoreAux",
  initialState,
  reducers: {
    
    toggleKickSelected(state) {
      state.voices.set.kickSelected = !state.voices.set.kickSelected;
    },
    toggleSnareSelected(state) {
      state.voices.set.snareSelected = !state.voices.set.snareSelected;
    },
    toggleHiHatSelected(state) {
      state.voices.set.hiHatSelected = !state.voices.set.hiHatSelected;
    },
    toggleRideSelected(state) {
      state.voices.set.rideSelected = !state.voices.set.rideSelected;
    },
    toggleHiHatFootSelected(state) {
      state.voices.set.hiHatFootSelected = !state.voices.set.hiHatFootSelected;
    },
    toggleTom1Selected(state) {
      state.voices.set.tom1Selected = !state.voices.set.tom1Selected;
    },
    toggleTom2Selected(state) {
      state.voices.set.tom2Selected = !state.voices.set.tom2Selected;
    },
    toggleTom3Selected(state) {
      state.voices.set.tom3Selected = !state.voices.set.tom3Selected;
    },
    toggleTom4Selected(state) {
      state.voices.set.tom4Selected = !state.voices.set.tom4Selected;
    },
    toggleDotSelected(state) {
      state.dotSelected = !state.dotSelected;
    },
  }
});

export default scoreAuxSlice.reducer;
export const scoreAuxActions = scoreAuxSlice.actions;
