import { createSlice } from "@reduxjs/toolkit";
import { small as defaultScore } from "../components/compose/sample-score";
import { modifyNote as modifyNoteService } from "./score-service";
import { getEmptyMeasure } from '../helpers/score';

const initialState = {
  selectedNote: {
    measureIndex: 0,
    partIndex: 0,
    voiceIndex: 0,
    noteIndex: 0,
  },
  kickSelected: false,
  snareSelected: true,
  hiHatSelected: false,
  rideSelected: false,
  hiHatFootSelected: false,
  tom1Selected: false,
  tom2Selected: false,
  tom3Selected: false,
  tom4Selected: false,
  dotSelected: false,
  toneJs: {
    notes: [],
    loopTimeDuration: 0
  },
  score: defaultScore
};

const scoreSlice = createSlice({
  name: "score",
  initialState,
  reducers: {
    updateToneJs(state, action) {
      state.toneJs = action.payload;
    },
    selectNote(state, action) {
      const { measureIndex, partIndex, voiceIndex, noteIndex } = action.payload;
      state.selectedNote.measureIndex = measureIndex;
      state.selectedNote.partIndex = partIndex;
      state.selectedNote.voiceIndex = voiceIndex;
      state.selectedNote.noteIndex = noteIndex;
    },
    addMeasure(state, action) {
      const { index, isRight } = action.payload;
      const { timeSig, parts } = state.score.measures[index];

      //Get the empty measure given the time signature and instruments
      const emptyMeasure = getEmptyMeasure(timeSig, parts.map(part => part.instrument));
      
      //Either insert the empty measure to the left or right of the currently selected measure.
      state.score.measures.splice(isRight ? index + 1 : index, 0, emptyMeasure);
    },
    deleteMeasure(state, action) {
      state.score.measures.splice(action.payload, 1);
    },
    //When user modifies a note in the score. Ex: 8th note to 16th note
    modifyNote(state, action) {
      const replacementNoteDuration = action.payload;
      if (!replacementNoteDuration) {
        return;
      }

      modifyNoteService(state, replacementNoteDuration);
    },
    toggleKickSelected(state) {
      state.kickSelected = !state.kickSelected;
    },
    toggleSnareSelected(state) {
      state.snareSelected = !state.snareSelected;
    },
    toggleHiHatSelected(state) {
      state.hiHatSelected = !state.hiHatSelected;
    },
    toggleRideSelected(state) {
      state.rideSelected = !state.rideSelected;
    },
    toggleHiHatFootSelected(state) {
      state.hiHatFootSelected = !state.hiHatFootSelected;
    },
    toggleTom1Selected(state) {
      state.tom1Selected = !state.tom1Selected;
    },
    toggleTom2Selected(state) {
      state.tom2Selected = !state.tom2Selected;
    },
    toggleTom3Selected(state) {
      state.tom3Selected = !state.tom3Selected;
    },
    toggleTom4Selected(state) {
      state.tom4Selected = !state.tom4Selected;
    },
    toggleDotSelected(state) {
      state.dotSelected = !state.dotSelected;
    },
  },
});

export default scoreSlice.reducer;
export const scoreActions = scoreSlice.actions;
