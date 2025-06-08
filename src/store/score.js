import { createSlice } from "@reduxjs/toolkit";
import { paradiddle as defaultScore, EMPTY_SCORE } from "../components/compose/sample-score";
import { getScoreVoices as getScoreVoicesUtil } from "../utils/score";
//import defaultScore from '../../data/default-score';
//import { smallMultiPart as defaultScore } from "../components/compose/sample-score";
import {
  modifyNote as modifyNoteService,
  toggleOrnament,
  setRepeat,
  incDecSelectedNote,
} from "../services/score-service";
import { mutate } from "../services/mutate/mutate-service";
import { addMeasure as addMeasureService, 
         deleteMeasure as deleteMeasureService,
        updateTimeSig as updateTimeSigService } from '../services/measure-service';
import { getEmptyMeasure } from "../helpers/score";
import _ from "lodash";
import { createSelector } from "reselect";
import { start as startToneJs, stop as stopToneJs } from "../lib/tone";
import {
  NON_ACCENT_VELOCITY,
  GRACE_VELOCITY,
  ACCENT_VELOCITY,
  DEFAULT_TEMPO,
  NOTE_CONFIG,
} from "../consts/score";
import {
  INSTRUMENT_NOTE_TO_VOICE_MAP,
  DEFAULT_MUTATION,
  DEFAULT_TIME_SIG,
} from "../consts/score";

export const ACCENT = "a";
export const FLAM = "f";
export const DIDDLE = "d";
export const CHEESE = "c";
export const BUZZ = "b";
export const LEFT_STICKING = "l";
export const RIGHT_STICKING = "r";

const initialState = {
  tempo: DEFAULT_TEMPO,
  timeSig: DEFAULT_TIME_SIG,
  score: defaultScore,
  /**
   * [{
   *  type: 'swap',
   *  context: 'E5',
   *  config: {
   *    probability: 0.25
   * }
   * }]
   *
   * */
  mutations: [DEFAULT_MUTATION],
  dynamic: false,
  scrollAmount: {
    top: 0,
    left: 0,
  },
  name: "",
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
      stickClickSelected: false,
      crossoverSelected: false,
      backstickSelected: false,
      buttSelected: false,
      rimSelected: false,
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
      b5Selected: false,
    },
    cymbals: {
      crashSelected: true,
      chokeSelected: false,
    },
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
  tuplet: {
    selected: false,
    actual: 3,
    normal: 2,
    type: 8, //VF duration
  },
  isPlaying: false,
};

const scoreSlice = createSlice({
  name: "score",
  initialState,
  reducers: {
    updateScore(state, action) {
      const { score, name, tempo, mutations } = action.payload;
      state.score = score;
      state.name = name;
      state.tempo = tempo;
      state.repeat = {};
      state.selectedPartIndex = 0;
      state.selectedNoteIndex = null;
      state.dynamic = mutations && mutations.length > 0;

      state.mutations = [];
      if (mutations && mutations.length > 0) {
        mutations.forEach((mutation) => {
          const { type, context, grid, config } = mutation;

          //JARED_TODO: change this
          let _config = config;
          if(typeof config === 'string') {
            _config = JSON.parse(config);
          }

          state.mutations.push({ type, context, grid, config: _config });
        });
      } else {
        state.mutations.push(DEFAULT_MUTATION);
      }
    },
    updateTempo(state, action) {
      state.tempo = action.payload;
    },
    updateTimeSig(state, action) {
      updateTimeSigService(state, action);
    },
    setScrollAmount(state, action) {
      state.scrollAmount = action.payload;
    },
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

      //update the selected timeSig
      state.timeSig = state.score.measures[measureIndex].timeSig;
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
    toggleBuzz(state) {
      toggleOrnament(state, BUZZ);
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
      addMeasureService(state, action);
    },
    deleteMeasure(state) {
      deleteMeasureService(state);
    },
    clearScore(state) {
      state.score = EMPTY_SCORE
      state.selectedPartIndex = 0
      state.selectedNoteIndex = null
    },
    mutateNotes(state, action) {
      const numRepeats = action.payload;
      const mutations = state.mutations;

      mutate(
        state.score,
        mutations,
        numRepeats,
        Object.keys(getScoreVoices(state))
      );

      //We need to clear this out because mutating the notes might change the number of notes in the
      //score, which could cause the note index for the selected note to be for a non-existent note.
      state.selectedNoteIndex = null;
      //JARED_TODO: see if there is any way to get rid of this.
      state.dynamic = false;
    },
    updateMutateContext(state, action) {
      state.mutations[0].context = action.payload;
    },
    updateMutateGrid(state, action) {
      state.mutations[0].grid = action.payload;
    },
    updateMutateType(state, action) {
      state.mutations[0].type = action.payload;
    },
    //When user modifies a note in the score. Ex: 8th note to 16th note
    modifyNote(state, action) {
      const { type, isRest } = action.payload;
      let duration = NOTE_CONFIG[type].duration;
      const selectedNote = getSelectedNote(state);

      if (selectedNote) {
        modifyNoteService(state, duration, isRest, selectedNote);
      }
    },

    togglePartEnabled(state, action) {
      const instrument = action.payload;
      state.score.parts[instrument].enabled =
        !state.score.parts[instrument].enabled;
    },
    deletePart(state, action) {
      const instrument = action.payload;
      _.unset(state.score.parts, instrument);

      state.score.measures.forEach((measure) => {
        measure.parts.forEach((part, partIndex) => {
          if (part.instrument === instrument) {
            measure.parts.splice(partIndex, 1);
          }
        });
      });

      state.selectedNoteIndex = null;
      state.selectedPartIndex = 0;
    },
    addPart(state, action) {
      const instrument = action.payload;

      //Set up the top-level part config
      state.score.parts[instrument] = {
        enabled: true,
      };

      //Add the new part to each existing measure.
      state.score.measures.forEach((measure) => {
        measure.parts = measure.parts.concat(
          getEmptyMeasure(measure.timeSig, [instrument]).parts
        );
      });
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
    toggleTupletSelected(state) {
      state.tuplet.selected = !state.tuplet.selected;
    },
    changeTupletActualDuration(state, action) {
      state.tuplet.actual = action.payload;
    },
    changeTupletNormalDuration(state, action) {
      state.tuplet.normal = action.payload;
    },
    changeTupletType(state, action) {
      state.tuplet.type = action.payload;
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
    toggleStickClickSelected(state) {
      state.voices.snare.stickClickSelected = !state.voices.snare.stickClickSelected;
    },
    toggleCrossoverSelected(state) {
      state.voices.snare.crossoverSelected = !state.voices.snare.crossoverSelected;
    },
    toggleBackstickSelected(state) {
      state.voices.snare.backstickSelected = !state.voices.snare.backstickSelected;
    },
    toggleButtSelected(state) {
      state.voices.snare.buttSelected = !state.voices.snare.buttSelected;
    },

    toggleB1Selected(state) {
      state.voices.bass.b1Selected = !state.voices.bass.b1Selected;
    },
    toggleB2Selected(state) {
      state.voices.bass.b2Selected = !state.voices.bass.b2Selected;
    },
    toggleB3Selected(state) {
      state.voices.bass.b3Selected = !state.voices.bass.b3Selected;
    },
    toggleB4Selected(state) {
      state.voices.bass.b4Selected = !state.voices.bass.b4Selected;
    },
    toggleB5Selected(state) {
      state.voices.bass.b5Selected = !state.voices.bass.b5Selected;
    },

    toggleCrashSelected(state) {
      state.voices.cymbals.crashSelected = !state.voices.cymbals.crashSelected;
    },
    toggleChokeSelected(state) {
      state.voices.cymbals.chokeSelected = !state.voices.cymbals.chokeSelected;
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

//Assumes one part for now.
export const getScoreVoices = createSelector(
  [(state) => state.score],
  (score) => {
    return getScoreVoicesUtil(score)
  }
);

//Get the notes for playback
export const getToneJs = createSelector(
  [(state) => state.score, (state) => state.tempo],
  (score, tempo) => {
    let measures = score.measures;
    const partConfig = score.parts;
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
      let loopTimeDurationAddition = (measure.timeSig.num * spb);
      if(measure.timeSig.type == 8) {
        loopTimeDurationAddition /= 2;
      } else if(measure.timeSig.type == 16) {
        loopTimeDurationAddition /= 4;
      }

      loopTimeDuration += loopTimeDurationAddition;

      measureStartingTime += measureTimeLength;
      measureTimeLength = 0;
      let parts = measure.parts;
      let firstPart = true;

      parts = parts.filter((part) => partConfig[part.instrument].enabled);

      parts.forEach((part) => {
        const { voices, instrument } = part;
        let time = measureStartingTime;

        voices.forEach((voice) => {
          const notes = voice.notes;

          notes.forEach((note, noteIndex) => {
            let noteSecondsDuration = (spb * 4) / note.duration;

            const tuplets = voice.tuplets;
            tuplets.forEach((tuplet) => {
              if (noteIndex >= tuplet.start && noteIndex < tuplet.end) {
                noteSecondsDuration *= tuplet.normal / tuplet.actual;
              }
            });

            if (note.dots) {
              let extraDuration = noteSecondsDuration;

              //Add extra time for the dots
              for (let i = 0; i < note.dots; i++) {
                extraDuration /= 2;
                noteSecondsDuration += extraDuration;
              }
            }

            if (note.notes.length) {
              //Not a rest
              for (const tjsNote of note.notes) {
                const toneJsNote = {
                  time,
                  note: (note.ornaments && note.ornaments.indexOf('b') >= 0) ? 'G5' : tjsNote,
                  instrument,
                };

                toneJsNotes.push(toneJsNote);

                //Adjust the velocity depending on if there is an accent
                const hasOrnaments = note.ornaments;
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

                  return diddleNote;
                };

                if (hasOrnaments) {
                  //Add the diddle note.
                  if (note.ornaments.includes(DIDDLE)) {
                    toneJsNotes.push(
                      cloneNote(
                        toneJsNote,
                        noteSecondsDuration / 2,
                        note.velocity
                      )
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
                      cloneNote(
                        toneJsNote,
                        noteSecondsDuration / 2,
                        note.velocity
                      )
                    );
                    toneJsNotes.push(
                      cloneNote(toneJsNote, -0.0175, GRACE_VELOCITY)
                    );
                  }
                }
              }
            } else {
              //rest
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
  }
);

export const selectNote = (note, scrollAmount) => {
  return async (dispatch) => {
    dispatch(
      scoreActions.selectNote({
        measureIndex: note.measureIndex,
        partIndex: note.partIndex,
        voiceIndex: note.voiceIndex,
        noteIndex: note.noteIndex,
      })
    );
    dispatch(scoreActions.setScrollAmount(scrollAmount));
  };
};

export const modifyNote = (noteData, scrollAmount) => {
  return async (dispatch) => {
    dispatch(scoreActions.modifyNote(noteData));
    dispatch(scoreActions.setScrollAmount(scrollAmount));
  };
};
