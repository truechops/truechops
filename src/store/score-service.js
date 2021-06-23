import { getPowersOf2 } from "../helpers/math";

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

export function modifyNote(state, replacementDuration) {
  const { score, selectedNote } = state;

  let { measureIndex, partIndex, voiceIndex, noteIndex } = selectedNote;
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
    notes: getSelectedInstrumentNotes(state),
    duration: tcDurationToVfDuration[replacementDuration],
    velocity: note.velocity
  });
  if (replacementDuration < selectedDuration) {
    const remainingDurations = getPowersOf2(
      selectedDuration - replacementDuration
    );

    //Map powers of two numbers to 'rest' notes that fill up the empty space left by the smaller note
    remainingDurations.reduce((result, duration) => {
      result.push({
        notes: [],
        duration: tcDurationToVfDuration[duration],
        velocity: 1.0,
      });
      return result;
    }, newNotes);
  } else if (replacementDuration > selectedDuration) {
    let remainingDuration = replacementDuration - selectedDuration;

    for (var i = noteIndex + 1; i < notes.length; i++) {
      const note = notes[i];
      let noteDuration = vfDurationToTCDuration[note.duration];
      remainingDuration -= noteDuration;
      notesToDelete++;
      if (remainingDuration === 0) {
         break;
      } else if (remainingDuration < 0) { //In this case, the next note to gobble up is bigger than the amount left.
        const remainingDurationAbs = Math.abs(remainingDuration);

        //Reduce the duration of the bigger note
        note.duration = tcDurationToVfDuration[note.duration - remainingDurationAbs];
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

  console.log(JSON.stringify(notes));

  //Increment the note index so that the user can easily continue editing
  if(noteIndex + 1 >= notes.length) { //End of the measure
    if(measureIndex + 1 < score.measures.length) { //Go the next measure
      state.selectedNote.measureIndex++;
      state.selectedNote.noteIndex = 0;
    }
  } else { //Highlight the next note in the measure
    state.selectedNote.noteIndex++;
  }
}

function getSelectedInstrumentNotes(state) {
  let notes = [];

  if (state.kickSelected) {
    notes.push("D4");
  }

  if (state.snareSelected) {
    notes.push("C5");
  }

  if (state.hiHatSelected) {
    notes.push("E5");
  }

  if (state.rideSelected) {
    notes.push("F5");
  }
  if (state.hiHatFootSelected) {
    notes.push("E4");
  }

  if (state.tom1Selected) {
    notes.push("F5");
  }

  if (state.tom2Selected) {
    notes.push("D5");
  }

  if (state.tom3Selected) {
    notes.push("B4");
  }

  if (state.tom4Selected) {
    notes.push("G4");
  }

  return notes;
}
