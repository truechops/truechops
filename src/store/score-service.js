import { getPowersOf2 } from "../helpers/math";
import _ from "lodash";

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
  let { measureIndex, partIndex, voiceIndex } = state.selectedNote;
  let noteIndex = state.selectedNote.noteIndex;
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
        velocity: 1.0,
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
            velocity: 1.0,
          });
          return result;
        }, newNotes);

        break;
      }
    }
  }

  notes.splice(noteIndex, notesToDelete, ...newNotes);
  incrementSelectedNote(notes, score.measures, state.selectedNote);
}

export function toggleOrnament(state, ornament) {
  const { partIndex, measureIndex, voiceIndex, noteIndex } = state.selectedNote;

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

            incrementSelectedNote(
              notes,
              state.score.measures,
              state.selectedNote
            );
          }
        }
      }
    }
  }
}

function incrementSelectedNote(notes, measures, selectedNote) {
  //Increment the note index so that the user can easily continue editing
  if (selectedNote.noteIndex + 1 >= notes.length) {
    //End of the measure
    if (selectedNote.measureIndex + 1 < measures.length) {
      //Go the next measure
      selectedNote.measureIndex++;
      selectedNote.noteIndex = 0;
    }
  } else {
    //Highlight the next note in the measure
    selectedNote.noteIndex = selectedNote.noteIndex + 1;
  }
}

export function setRepeat(state, startOrEnd) {
  const selectedNote = state.selectedNote;

  //make sure a measure is selected
  if (!_.isEmpty(selectedNote) && selectedNote.measureIndex >= 0) {
    if (selectedNote.measureIndex === state.repeat[startOrEnd]) {
      state.repeat[startOrEnd] = -1;
    } else {
      state.repeat[startOrEnd] = selectedNote.measureIndex;
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
