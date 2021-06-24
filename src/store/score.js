import { createSlice } from "@reduxjs/toolkit";
import { smallSinglePart as defaultScore } from "../components/compose/sample-score";
import {
  modifyNote as modifyNoteService,
  toggleOrnament,
  setRepeat,
} from "./score-service";
import { getEmptyMeasure } from "../helpers/score";
import _ from "lodash";

const ACCENT = "a";
const FLAM = "f";
const DIDDLE = "d";
const CHEESE = "c";
const LEFT_STICKING = "l";
const RIGHT_STICKING = "r";

const initialState = {
  selectedNote: {
    measureIndex: -1,
    partIndex: -1,
    voiceIndex: -1,
    noteIndex: -1,
  },
  repeat: {
    start: -1,
    end: -1,
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
    duration: 0,
    numMeasures: 0
  },
  isPlaying: false,
  score: defaultScore,
};

const scoreSlice = createSlice({
  name: "score",
  initialState,
  reducers: {
    updateToneJs(state, action) {
      state.toneJs = action.payload;
    },
    toggleIsPlaying(state) {
      state.isPlaying = !state.isPlaying
    },
    setRepeatStart(state) {
      setRepeat(state, "start");
    },
    setRepeatEnd(state) {
      setRepeat(state, "end");
    },
    toggleRepeatEnabled(state) {
      state.repeat.enabled = !state.repeat.enabled;
    },
    toggleAccent(state) {
      toggleOrnament(state, ACCENT);
    },
    toggleLeftSticking(state) {
      toggleOrnament(state, LEFT_STICKING);
    },
    toggleRightSticking(state) {
      toggleOrnament(state, RIGHT_STICKING);
    },
    toggleFlam(state) {
      toggleOrnament(state, FLAM);
    },
    toggleDiddle(state) {
      toggleOrnament(state, DIDDLE);
    },
    toggleCheese(state) {
      toggleOrnament(state, CHEESE);
    },
    addMeasure(state, action) {
      const selectedNote = state.selectedNote;

      //make sure a measure is selected
      if (!_.isEmpty(selectedNote) && selectedNote.measureIndex >= 0) {
        const isRight = action.payload;
        const index = selectedNote.measureIndex;
        const { timeSig, parts } = state.score.measures[index];

        //Get the empty measure given the time signature and instruments
        const emptyMeasure = getEmptyMeasure(
          timeSig,
          parts.map((part) => part.instrument)
        );

        //Either insert the empty measure to the left or right of the currently selected measure.
        state.score.measures.splice(
          isRight ? index + 1 : index,
          0,
          emptyMeasure
        );
      }
    },
    deleteMeasure(state) {
      const selectedNote = state.selectedNote;

      //make sure a measure is selected
      if (!_.isEmpty(selectedNote) && selectedNote.measureIndex >= 0) {

        //The initial splice arguments: deleting one entry at the specified measure index.
        let spliceArguments = [selectedNote.measureIndex, 1];

        //If they are removing the only measure in the score
        if(state.score.measures.length === 1) {
          const { timeSig, parts } = state.score.measures[selectedNote.measureIndex];

          //We need to add an empty measure if they are deleting the only measure in the score.
          spliceArguments.push(getEmptyMeasure(
            timeSig,
            parts.map((part) => part.instrument)
          ));
        } 

        state.score.measures.splice.apply(state.score.measures, spliceArguments);
      }
    },
    //When user modifies a note in the score. Ex: 8th note to 16th note
    modifyNote(state, action) {
      const { value, isRest }  = action.payload;
      modifyNoteService(state, value, isRest);
    },
    selectNote(state, action) {
       const { measureIndex, partIndex, voiceIndex, noteIndex } = action.payload;

      //If the user is selecting the same note in the score, unselect the note
      if (
       _.isEqual(action.payload, state.selectedNote)
      ) {
        ["measureIndex", "partIndex", "voiceIndex", "noteIndex"].map(
          (key) => (state.selectedNote[key] = -1)
        );
      } else {
        state.selectedNote.measureIndex = measureIndex;
        state.selectedNote.partIndex = partIndex;
        state.selectedNote.voiceIndex = voiceIndex;
        state.selectedNote.noteIndex = noteIndex;
      }
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
