import { createSlice } from "@reduxjs/toolkit";
import { scoreActions } from "./score";
import _ from "lodash";

const { modifyNote } = scoreActions;

import { setRepeat } from "./score-service";

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
      state.voices.kickSelected = !state.voices.kickSelected;
    },
    toggleSnareSelected(state) {
      state.voices.snareSelected = !state.voices.snareSelected;
    },
    toggleHiHatSelected(state) {
      state.voices.hiHatSelected = !state.voices.hiHatSelected;
    },
    toggleRideSelected(state) {
      state.voices.rideSelected = !state.voices.rideSelected;
    },
    toggleHiHatFootSelected(state) {
      state.voices.hiHatFootSelected = !state.voices.hiHatFootSelected;
    },
    toggleTom1Selected(state) {
      state.voices.tom1Selected = !state.voices.tom1Selected;
    },
    toggleTom2Selected(state) {
      state.voices.tom2Selected = !state.voices.tom2Selected;
    },
    toggleTom3Selected(state) {
      state.voices.tom3Selected = !state.voices.tom3Selected;
    },
    toggleTom4Selected(state) {
      state.voices.tom4Selected = !state.voices.tom4Selected;
    },
    toggleDotSelected(state) {
      state.voices.dotSelected = !state.voices.dotSelected;
    },
  }
});

export default scoreAuxSlice.reducer;
export const scoreAuxActions = scoreAuxSlice.actions;
