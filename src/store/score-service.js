import { getPowersOf2 } from "../helpers/math";
import _ from "lodash";
import { NON_ACCENT_VELOCITY } from "../../data/score-config";

//Translates the toneJs duration to the score duration
const vfDurationToTCDuration = {
  1: 64,
  2: 32,
  4: 16,
  8: 8,
  16: 4,
  32: 2,
};

const tcDurationToVfDuration = {
  64: 1,
  32: 2,
  16: 4,
  8: 8,
  4: 16,
  2: 32,
};

export function modifyNote(state, voices, value, isRest) {
  if (!state.selectedNoteIndex) {
    return;
  }

  let { measureIndex, partIndex, voiceIndex } = state.selectedNoteIndex;
  let noteIndex = state.selectedNoteIndex.noteIndex;
  const score = state.score;
  const notes =
    score.measures[measureIndex].parts[partIndex].voices[voiceIndex].notes;
  const note = notes[noteIndex];

  const selectedDuration = vfDurationToTCDuration[note.duration];

  //Get the note total after the note index. Lets us know if there is enough room
  //for the new note.
  let noteTotalAfterPos = notes
    .slice(noteIndex)
    .reduce(
      (total, note) => (total += vfDurationToTCDuration[note.duration]),
      0
    );

  if (selectedDuration > noteTotalAfterPos) {
    return;
  }

  let notesToDelete = 1;
  let newNotes = [];
  newNotes.push({
    notes: isRest ? [] : getSelectedInstrumentNotes(voices),
    duration: tcDurationToVfDuration[value],
    velocity: note.velocity,
  });

  if (value < selectedDuration) {
    const remainingDurations = getPowersOf2(selectedDuration - value);

    //Map powers of two numbers to 'rest' notes that fill up the empty space left by the smaller note
    remainingDurations.reduce((result, duration) => {
      result.push({
        notes: [],
        duration: tcDurationToVfDuration[duration],
        velocity: NON_ACCENT_VELOCITY,
      });
      return result;
    }, newNotes);
  } else if (value > selectedDuration) {
    let remainingDuration = value - selectedDuration;

    for (var i = noteIndex + 1; i < notes.length; i++) {
      const note = notes[i];
      let noteDuration = vfDurationToTCDuration[note.duration];
      remainingDuration -= noteDuration;
      notesToDelete++;
      if (remainingDuration === 0) {
        break;
      } else if (remainingDuration < 0) {
        //In this case, the next note to gobble up is bigger than the amount left.
        const remainingDurationAbs = Math.abs(remainingDuration);

        //Reduce the duration of the bigger note
        note.duration =
          tcDurationToVfDuration[note.duration - remainingDurationAbs];
        const remainingDurationRests = getPowersOf2(remainingDurationAbs);

        //Cut into the bigger note with rests
        remainingDurationRests.reduce((result, duration) => {
          result.push({
            notes: note.notes,
            duration: tcDurationToVfDuration[duration],
            velocity: NON_ACCENT_VELOCITY,
          });
          return result;
        }, newNotes);

        break;
      }
    }
  }

  notes.splice(noteIndex, notesToDelete, ...newNotes);
  incDecSelectedNote(state, true);
}

export function toggleOrnament(state, ornament) {
  if (!state.selectedNoteIndex) {
    return;
  }

  const { partIndex, measureIndex, voiceIndex, noteIndex } =
    state.selectedNoteIndex;

  if (
    !(partIndex >= 0 && measureIndex >= 0 && voiceIndex >= 0 && noteIndex >= 0)
  ) {
    return;
  }

  const notes =
    state.score.measures[measureIndex].parts[partIndex].voices[voiceIndex]
      .notes;

  const measures = state.score.measures;
  if (measures && measures.length > 0) {
    const measure = state.score.measures[measureIndex];
    if (measure && measure.parts && measure.parts.length > 0) {
      const part = measure.parts[partIndex];
      if (part && part.voices && part.voices.length > 0) {
        const voice = part.voices[voiceIndex];
        if (voice && voice.notes && voice.notes.length > 0) {
          const note = voice.notes[noteIndex];
          if (note) {
            if (note.ornaments) {
              let ornaments = note.ornaments;
              if (ornaments.includes(ornament)) {
                note.ornaments = note.ornaments.replace(ornament, "");
              } else {
                note.ornaments = note.ornaments.concat(ornament);
              }
            } else {
              note.ornaments = ornament;
            }

            incDecSelectedNote(state, true);
          }
        }
      }
    }
  }
}

export function incDecSelectedNote(state, inc) {
  const measures = state.score.measures;

  if (!_.has(state, "selectedNoteIndex")) {
    if (inc) {
      state.selectedNoteIndex = {
        measureIndex: 0,
        partIndex: 0,
        voiceIndex: 0,
        noteIndex: 0,
      };
    } else {
      const notes = measures[measures.length - 1].parts[0].voices[0].notes;
      state.selectedNoteIndex = {
        measureIndex: measures.length - 1,
        partIndex: 0,
        voiceIndex: 0,
        noteIndex: notes.length - 1,
      };
    }
  } else {
    //Note: we can't use object destructuring to get state vars to update since destructuring creates a new object and
    //we would be updating the new object and not the original state. That is why you see below a mix of destructing and
    //not.
    const selectedNoteIndex = state.selectedNoteIndex;
    const { measureIndex, partIndex, voiceIndex, noteIndex } =
      selectedNoteIndex;
    const notes =
      measures[measureIndex].parts[partIndex].voices[voiceIndex].notes;

    if (inc) {
      //Increment the note index so that the user can easily continue editing
      if (noteIndex + 1 >= notes.length) {
        //End of the measure
        if (measureIndex + 1 < measures.length) {
          //Go the next measure
            selectedNoteIndex.measureIndex++;
            selectedNoteIndex.noteIndex = 0;
        }
      } else {
        //Highlight the next note in the measure
        selectedNoteIndex.noteIndex = selectedNoteIndex.noteIndex + 1;
      }
    } else {
      //Decrement the note index so that the user can easily continue editing
      if (noteIndex - 1 < 0) { //before start of measure
        if (measureIndex - 1 >= 0) {
          //Go the next measure
            selectedNoteIndex.measureIndex--;
            selectedNoteIndex.noteIndex = 
              measures[selectedNoteIndex.measureIndex].parts[partIndex].voices[voiceIndex].notes.length - 1;
        }
      } else {
        //Highlight the next note in the measure
        selectedNoteIndex.noteIndex--;
      }
    }
  }
}

export function setRepeat(state, startOrEnd) {
  const selectedNoteIndex = state.selectedNoteIndex;

  //make sure a measure is selected
  if (selectedNoteIndex && selectedNoteIndex.measureIndex >= 0) {
    if (selectedNoteIndex.measureIndex === state.repeat[startOrEnd]) {
      _.unset(state.repeat, startOrEnd);
    } else {
      state.repeat[startOrEnd] = selectedNoteIndex.measureIndex;
    }
  }
}

function getSelectedInstrumentNotes(voices) {
  let notes = [];

  if (voices.kickSelected) {
    notes.push("F4");
  }

  if (voices.snareSelected) {
    notes.push("C5");
  }

  if (voices.hiHatSelected) {
    notes.push("E5");
  }

  if (voices.rideSelected) {
    notes.push("F5");
  }

  if (voices.hiHatFootSelected) {
    notes.push("D4");
  }

  if (voices.tom1Selected) {
    notes.push("D5");
  }

  if (voices.tom2Selected) {
    notes.push("B4");
  }

  if (voices.tom3Selected) {
    notes.push("A4");
  }

  if (voices.tom4Selected) {
    notes.push("G4");
  }

  return notes;
}
