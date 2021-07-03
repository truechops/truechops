import { createSlice } from "@reduxjs/toolkit";
//import { smallSinglePart as defaultScore } from "../components/compose/sample-score";
//import defaultScore from '../../data/default-score';
import { smallMultiPart as defaultScore } from "../components/compose/sample-score";
import {
  modifyNote as modifyNoteService,
  toggleOrnament,
  setRepeat,
  incDecSelectedNote,
} from "./score-service";
import { getEmptyMeasure } from "../helpers/score";
import _ from "lodash";
import { createSelector } from "reselect";
import { start as startToneJs, stop as stopToneJs } from "../lib/tone";
import {
  NON_ACCENT_VELOCITY,
  GRACE_VELOCITY,
  ACCENT_VELOCITY,
} from "../../data/score-config";
import useInstruments from "../components/compose/hooks/instruments-hook";

export const ACCENT = "a";
export const FLAM = "f";
export const DIDDLE = "d";
export const CHEESE = "c";
export const LEFT_STICKING = "l";
export const RIGHT_STICKING = "r";

const initialState = {
  score: defaultScore,
  voices: {
    drumset: {
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
    snare: {
      snareSelected: true,
      pingSelected: false,
      rimSelected: false
    },
    tenors: {
      spockSelected: false,
      t1Selected: true,
      t2Selected: false,
      t3Selected: false,
      t4Selected: false,
    },
    bass: {
      b1Selected: true,
      b2Selected: false,
      b3Selected: false,
      b4Selected: false,
      b5Selected: false
    },
    cymbal: {
      crashSelected: true,
      chokeSelected: false,
    }
  },
  selectedPartIndex: 0,

  /*
  selectedNoteIndex: {
    measureIndex: 0,
    partIndex: 1,
    voiceIndex: 0,
    noteIndex: 1,
  },*/

  repeat: {
    //start: 0,
    //end: 1,
  },

  dotSelected: false,
  isPlaying: false,
};

const scoreSlice = createSlice({
  name: "score",
  initialState,
  reducers: {
    toggleIsPlaying(state) {
      state.isPlaying = !state.isPlaying;
    },
    startStop(state) {
      if (!state.isPlaying) {
        startToneJs();
      } else {
        stopToneJs();
      }

      state.isPlaying = !state.isPlaying;
    },
    setRepeatStart(state) {
      setRepeat(state, "start");
    },
    setRepeatEnd(state) {
      setRepeat(state, "end");
    },
    selectNote(state, action) {
      const { measureIndex, partIndex, voiceIndex, noteIndex } = action.payload;

      //If the user is selecting the same note in the score, unselect the note
      if (_.isEqual(action.payload, state.selectedNoteIndex)) {
        _.unset(state, "selectedNoteIndex");
      } else {
        state.selectedNoteIndex = {
          measureIndex,
          partIndex,
          voiceIndex,
          noteIndex,
        };
      }

      if (partIndex !== state.selectedPartIndex) {
        state.selectedPartIndex = partIndex;
      }
    },
    selectPreviousNote(state) {
      incDecSelectedNote(state, false);
    },
    selectNextNote(state) {
      incDecSelectedNote(state, true);
    },
    toggleAccent(state) {
      toggleOrnament(state, ACCENT);
    },
    toggleLeftSticking(state) {
      toggleOrnament(state, LEFT_STICKING, RIGHT_STICKING);
    },
    toggleRightSticking(state) {
      toggleOrnament(state, RIGHT_STICKING, LEFT_STICKING);
    },
    toggleFlam(state) {
      toggleOrnament(state, FLAM, DIDDLE + CHEESE);
    },
    toggleDiddle(state) {
      toggleOrnament(state, DIDDLE, FLAM + CHEESE);
    },
    toggleCheese(state) {
      toggleOrnament(state, CHEESE, FLAM + DIDDLE);
    },
    addMeasure(state, action) {
      const measures = state.score.measures;
      const isRight = action.payload;
      let index = 0;
      if (!_.has(state, "selectedNoteIndex")) {
        index = isRight ? measures.length - 1 : 0;
      } else {
        index = state.selectedNoteIndex.measureIndex;
      }

      //make sure a measure is selected
      const { timeSig, parts } = state.score.measures[index];

      //Get the empty measure given the time signature and instruments
      const emptyMeasure = getEmptyMeasure(
        timeSig,
        parts.map((part) => part.instrument)
      );

      //Either insert the empty measure to the left or right of the currently selected measure.
      state.score.measures.splice(isRight ? index + 1 : index, 0, emptyMeasure);
    },
    deleteMeasure(state) {
      if (!_.has(state, "selectedNoteIndex")) {
        return;
      }

      const measureIndex = state.selectedNoteIndex.measureIndex;

      //make sure a measure is selected
      if (measureIndex >= 0) {
        //The initial splice arguments: deleting one entry at the specified measure index.
        let spliceArguments = [measureIndex, 1];

        //If they are removing the only measure in the score
        if (state.score.measures.length === 1) {
          const { timeSig, parts } = state.score.measures[measureIndex];

          //We need to add an empty measure if they are deleting the only measure in the score.
          spliceArguments.push(
            getEmptyMeasure(
              timeSig,
              parts.map((part) => part.instrument)
            )
          );
        }

        state.score.measures.splice.apply(
          state.score.measures,
          spliceArguments
        );
      }
    },
    shuffleNotes(state) {
      state.score.measures.forEach((measure, measureIndex) => {
        measure.parts.forEach((part, partIndex) => {
          part.voices.forEach((voice, voiceIndex) => {
            state.score.measures[measureIndex].parts[partIndex].voices[
              voiceIndex
            ].notes = _.shuffle(
              state.score.measures[measureIndex].parts[partIndex].voices[
                voiceIndex
              ].notes
            );
          });
        });
      });
    },
    //When user modifies a note in the score. Ex: 8th note to 16th note
    modifyNote(state, action) {
      const { value, isRest } = action.payload;
      const selectedNote = getSelectedNote(state);

      if (selectedNote) {
        modifyNoteService(state, value, isRest, selectedNote);
      }
    },

    togglePartEnabled(state, action) {
      const instrument = action.payload;
      state.score.parts[instrument].enabled = !state.score.parts[instrument].enabled;
    },
    deletePart(state, action) {
      const instrument = action.payload;
      _.unset(state.score.parts, instrument);

      state.score.measures.forEach(measure => {
        measure.parts.forEach((part, partIndex) => {
          if(part.instrument === instrument) {
            measure.parts.splice(partIndex, 1);
          }
        })
      })
    },
    addPart(state, action) {
      const instrument = action.payload;

      //Set up the top-level part config
      state.score.parts[instrument] = {
        enabled: true
      };

      //Add the new part to each existing measure.
      state.score.measures.forEach(measure => {
        measure.parts = measure.parts.concat(getEmptyMeasure(measure.timeSig, [instrument]).parts)
      })
    },
    toggleKickSelected(state) {
      state.voices.drumset.kickSelected = !state.voices.drumset.kickSelected;
    },
    toggleSnareSelected(state) {
      state.voices.drumset.snareSelected = !state.voices.drumset.snareSelected;
    },
    toggleHiHatSelected(state) {
      state.voices.drumset.hiHatSelected = !state.voices.drumset.hiHatSelected;
    },
    toggleRideSelected(state) {
      state.voices.drumset.rideSelected = !state.voices.drumset.rideSelected;
    },
    toggleHiHatFootSelected(state) {
      state.voices.drumset.hiHatFootSelected =
        !state.voices.drumset.hiHatFootSelected;
    },
    toggleTom1Selected(state) {
      state.voices.drumset.tom1Selected = !state.voices.drumset.tom1Selected;
    },
    toggleTom2Selected(state) {
      state.voices.drumset.tom2Selected = !state.voices.drumset.tom2Selected;
    },
    toggleTom3Selected(state) {
      state.voices.drumset.tom3Selected = !state.voices.drumset.tom3Selected;
    },
    toggleTom4Selected(state) {
      state.voices.drumset.tom4Selected = !state.voices.drumset.tom4Selected;
    },
    toggleDotSelected(state) {
      state.dotSelected = !state.dotSelected;
    },

    toggleSpockSelected(state) {
      state.voices.tenors.spockSelected = !state.voices.tenors.spockSelected;
    },
    toggleTenor1Selected(state) {
      state.voices.tenors.t1Selected = !state.voices.tenors.t1Selected;
    },
    toggleTenor2Selected(state) {
      state.voices.tenors.t2Selected = !state.voices.tenors.t2Selected;
    },
    toggleTenor3Selected(state) {
      state.voices.tenors.t3Selected = !state.voices.tenors.t3Selected;
    },
    toggleTenor4Selected(state) {
      state.voices.tenors.t4Selected = !state.voices.tenors.t4Selected;
    },

    toggleMarchingSnareSelected(state) {
      state.voices.snare.snareSelected = !state.voices.snare.snareSelected;
    },
    togglePingSelected(state) {
      state.voices.snare.pingSelected = !state.voices.snare.pingSelected;
    },
    toggleRimSelected(state) {
      state.voices.snare.rimSelected = !state.voices.snare.rimSelected;
    },

    toggleBass1Selected(state) {
      state.voices.bass.b1Selected = !state.voices.bass.b1Selected;
    },
    toggleBass2Selected(state) {
      state.voices.bass.b2Selected = !state.voices.bass.b2Selected;
    },
    toggleBass3Selected(state) {
      state.voices.bass.b3Selected = !state.voices.bass.b3Selected;
    },
    toggleBass4Selected(state) {
      state.voices.bass.b4Selected = !state.voices.bass.b4Selected;
    },
    toggleBass5Selected(state) {
      state.voices.bass.b5Selected = !state.voices.bass.b5Selected;
    },

    toggleCrashSelected(state) {
      state.voices.cymbal.crashSelected = !state.voices.cymbal.crashSelected;
    },
    toggleChokeSelected(state) {
      state.voices.cymbal.chokeSelected = !state.voices.cymbal.chokeSelected;
    },
  },
});

export default scoreSlice.reducer;
export const scoreActions = scoreSlice.actions;

export const getSelectedInstrument = createSelector(
  [(state) => state.selectedPartIndex, (state) => state.score],
  (selectedPartIndex, score) => {
    if ((selectedPartIndex != null) & (selectedPartIndex >= 0)) {
      return score.measures[0].parts[selectedPartIndex].instrument;
    } else {
      return null;
    }
  }
);

export const getScoreInstruments = createSelector(
  [(state) => state.score],
  (score) => score.measures[0].parts.map((part) => part.instrument)
);

export const getSelectedNote = createSelector(
  [(state) => state.selectedNoteIndex, (state) => state.score],
  (selectedNoteIndex, score) => {
    if (selectedNoteIndex) {
      const { measureIndex, partIndex, voiceIndex, noteIndex } =
        selectedNoteIndex;
      const part = score.measures[measureIndex].parts[partIndex];

      //We have to clone because the original object is not extensible.
      let selectedNote = _.cloneDeep(part.voices[voiceIndex].notes[noteIndex]);
      selectedNote.measureIndex = measureIndex;
      selectedNote.partIndex = partIndex;
      selectedNote.voiceIndex = voiceIndex;
      selectedNote.noteIndex = noteIndex;
      selectedNote.instrument = part.instrument;
      return selectedNote;
    } else {
      return null;
    }
  }
);

export const getToneJs = createSelector([(state) => state.score], (score) => {
  let measures = score.measures;
  const tempo = score.tempo;
  const spb = 60 / tempo;
  let toneJsNotes = [];

  const toneJs = {
    notes: [],
    duration: 0,
    numMeasures: measures.length,
  };

  let measureStartingTime = 0;
  let measureTimeLength = 0;
  let loopTimeDuration = 0;
  measures.forEach((measure) => {
    loopTimeDuration += measure.timeSig.num * spb;

    measureStartingTime += measureTimeLength;
    measureTimeLength = 0;
    const parts = measure.parts;
    let firstPart = true;
    parts.forEach((part) => {
      const { voices, instrument } = part;
      let time = measureStartingTime;

      voices.forEach((voice) => {
        const notes = voice.notes;
        notes.forEach((note) => {
          const noteSecondsDuration = (spb * 4) / note.duration;

          if (note.notes.length) {
            for (const tjsNote of note.notes) {
              const toneJsNote = {
                time,
                note: tjsNote,
                instrument,
              };

              toneJsNotes.push(toneJsNote);

              //Adjust the velocity depending on if there is an accent
              const hasOrnaments = "ornaments" in note;
              if (hasOrnaments) {
                if (!note.ornaments.includes(ACCENT)) {
                  toneJsNote.velocity = NON_ACCENT_VELOCITY;
                } else {
                  toneJsNote.velocity = ACCENT_VELOCITY;
                }
              } else {
                toneJsNote.velocity = NON_ACCENT_VELOCITY;
              }

              const cloneNote = (note, time, velocity) => {
                const diddleNote = _.cloneDeep(note);
                diddleNote.time = diddleNote.time + time;

                if (velocity) {
                  diddleNote.velocity = velocity;
                }

                toneJsNotes.push(diddleNote);
                return diddleNote;
              };

              if (hasOrnaments) {
                //Add the diddle note.
                if (note.ornaments.includes(DIDDLE)) {
                  toneJsNotes.push(
                    cloneNote(toneJsNote, noteSecondsDuration / 2)
                  );
                }

                //Add the flam note
                if (note.ornaments.includes(FLAM)) {
                  toneJsNotes.push(
                    cloneNote(toneJsNote, -0.0175, GRACE_VELOCITY)
                  );
                }

                if (note.ornaments.includes(CHEESE)) {
                  //Add the diddle and flam notes, respectively.
                  toneJsNotes.push(
                    cloneNote(toneJsNote, noteSecondsDuration / 2)
                  );
                  toneJsNotes.push(
                    cloneNote(toneJsNote, -0.0175, GRACE_VELOCITY)
                  );
                }
              }
            }
          } else {
            toneJsNotes.push({});
          }

          time += noteSecondsDuration;
          if (firstPart) {
            measureTimeLength += noteSecondsDuration;
          }
        });
      });
      firstPart = false;
    });
  });

  toneJs.notes = toneJsNotes;
  toneJs.duration = loopTimeDuration;

  return toneJs;
});
