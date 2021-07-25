import { getPowersOf2, getAdditionalDotDuration } from "../../helpers/math";
import { getTCDurationSingle, getRestsFromTCDuration } from "../../helpers/score";
import _ from "lodash";
import { NON_ACCENT_VELOCITY, tcDurationToVfDuration } from "../../consts/score";

export function modifyNote(state, newNoteValueIn, isRest, selectedNote) {
  console.log('duration: ' + newNoteValueIn);
  let { measureIndex, partIndex, voiceIndex, noteIndex } = selectedNote;
  const score = state.score;
  const dotSelected = state.dotSelected;
  const measureNotes =
    score.measures[measureIndex].parts[partIndex].voices[voiceIndex].notes;
  const note = measureNotes[noteIndex];
  const tuplet = state.tuplet;

  let selectedDuration = getTCDurationSingle(note.duration, note.dots);

  let newNoteValue = newNoteValueIn;

  if (tuplet.selected) {
    newNoteValue = tuplet.normal * getTCDurationSingle(tuplet.type, 0);
  }

  if (dotSelected) {
    newNoteValue += getAdditionalDotDuration(newNoteValue, 1);
  }

  let noteTotalAfterPos = 0;

  let tuplets =
    score.measures[measureIndex].parts[partIndex].voices[voiceIndex].tuplets;
  let selectedTuplet = null;

  //Used when updating tuplet start/end indices
  let nextTupletIndex = 0;

  if (tuplets.length) {
    for (var i = 0; i < tuplets.length; i++) {
      if (noteIndex >= tuplets[i].start && noteIndex < tuplets[i].end) {
        selectedTuplet = tuplets[i];

        //No nested tuplets.
        if(tuplet.selected) {
          return;
        }

        break;
      } 
    }
  }

  if (selectedTuplet) {
    noteTotalAfterPos = measureNotes
      .slice(noteIndex, selectedTuplet.end)
      .reduce((total, note) => {
        let duration = getTCDurationSingle(note.duration, note.dots);

        total += duration;
        return total;
      }, 0);
  } else {
    //Get the note total after the note index. Lets us know if there is enough room
    //for the new note.
    noteTotalAfterPos = measureNotes.slice(noteIndex).reduce((total, note) => {
      let duration = getTCDurationSingle(note.duration, note.dots);

      total += duration;
      return total;
    }, 0);
  }

  if (newNoteValue > noteTotalAfterPos) {
    return;
  }

  let notesToDelete = 1;
  let newNotes = [];

  let newNote = {
    notes: isRest ? [] : getSelectedInstrumentNotes(state.voices, selectedNote),

    //Undotted duration.
    duration: tcDurationToVfDuration[newNoteValueIn],
    velocity: note.velocity,
  };

  if (dotSelected) {
    newNote.dots = 1;
  }

  newNotes.push(newNote);

  // let numNewNotePushes = tuplet.selected ? tuplet.actual : 1;

  // for(let i = 0 ; i < numNewNotePushes; i++) {
  //   newNotes.push(newNote);
  // }

  let numTupletNotes = 0;

  if (tuplet.selected) {
    const singleNoteDuration = getTCDurationSingle(tuplet.type, 0);
    const tupletDuration = tuplet.actual * singleNoteDuration;

    //The note the user wants will not work with this tuplet; return.
    if (newNoteValueIn > tupletDuration) {
      return;
    }

    newNotes = newNotes.concat(
      getRestsFromTCDuration(tupletDuration - newNoteValueIn)
    );
    numTupletNotes = newNotes.length;
  }

  if (newNoteValue < selectedDuration) {
    newNotes = newNotes.concat(
      getRestsFromTCDuration(selectedDuration - newNoteValue)
    );
  } else if (newNoteValue > selectedDuration) {
    let remainingDuration = newNoteValue - selectedDuration;

    for (let j = noteIndex + 1; j < measureNotes.length; j++) {
      const note = measureNotes[j];
      let noteDuration = getTCDurationSingle(note.duration, note.dots);

      remainingDuration -= noteDuration;
      notesToDelete++;
      if (remainingDuration === 0) {
        break;
      } else if (remainingDuration < 0) {
        //In this case, the next note to gobble up is bigger than the amount left.
        const remainingDurationAbs = Math.abs(remainingDuration);

        //Reduce the duration of the bigger note
        note.duration =
          tcDurationToVfDuration[noteDuration - remainingDurationAbs];
        const remainingDurationRests = getPowersOf2(remainingDurationAbs);

        //Cut into the bigger note with rests
        remainingDurationRests.reduce((result, duration) => {
          result.push({
            notes: [],
            duration: tcDurationToVfDuration[duration],
            velocity: NON_ACCENT_VELOCITY,
          });
          return result;
        }, newNotes);

        break;
      }
    }
  }

  if (tuplet.selected) {
    tuplets.push({
      start: noteIndex,
      end: noteIndex + numTupletNotes,
      actual: tuplet.actual,
      normal: tuplet.normal,
    });
  }

  const numMoreNotes = newNotes.length - notesToDelete;
  if (selectedTuplet) {
    selectedTuplet.end += numMoreNotes;
  }

  //Adjust tuplet start/end after the selected tuplet
  for (let k = 0; k < tuplets.length; k++) {
    if(noteIndex < tuplets[k].start) {
      tuplets[k].start += numMoreNotes;
      tuplets[k].end += numMoreNotes;
    }
  }

  measureNotes.splice(noteIndex, notesToDelete, ...newNotes);
  incDecSelectedNote(state, true);
}

//ornament - the ornament we want to remove/add.
//clear - the ornaments we want to clear each time. Used for example when adding
//a 'r' sticking when a 'l' sticking is already present.
export function toggleOrnament(state, ornament, clear) {
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

  let note = _.get(
    state.score,
    `measures[${measureIndex}].parts[${partIndex}].voices[${voiceIndex}].notes[${noteIndex}]`
  );

  if (note.notes.length) {
    let ornaments = note.ornaments;

    let newOrnaments = "";

    //If no ornaments, the ornament to change will be the only one.
    if (!ornaments) {
      newOrnaments = ornament;
    } else {
      //First, clear out the ornament to change ('ornament' param) and additional ornaments ('clear' param).
      //Then, if the ornament is already in the existing ornaments, remove it.
      //  if the ornament is NOT already in the existing ornaments, add it.
      newOrnaments = ornaments
        .replace(new RegExp(`[${ornament + (clear || "")}]`, "g"), "")
        .concat(ornaments.includes(ornament) ? "" : ornament);
    }

    note.ornaments = newOrnaments;
    incDecSelectedNote(state, true);
  } else {
    //It is a rest
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
      if (noteIndex - 1 < 0) {
        //before start of measure
        if (measureIndex - 1 >= 0) {
          //Go the next measure
          selectedNoteIndex.measureIndex--;
          selectedNoteIndex.noteIndex =
            measures[selectedNoteIndex.measureIndex].parts[partIndex].voices[
              voiceIndex
            ].notes.length - 1;
        }
      } else {
        //Highlight the next note in the measure
        selectedNoteIndex.noteIndex--;
      }
    }
  }
}

export function setRepeat(state, startOrEnd) {
  let measureIndex = 0;

  if (_.has(state, "selectedNoteIndex")) {
    measureIndex = state.selectedNoteIndex.measureIndex;
  } else {
    measureIndex = startOrEnd === "start" ? 0 : state.score.measures.length - 1;
  }

  if (measureIndex >= 0) {
    if (measureIndex === state.repeat[startOrEnd]) {
      _.unset(state.repeat, startOrEnd);
    } else {
      state.repeat[startOrEnd] = measureIndex;
    }
  }
}

function getSelectedSetNotes(voices) {
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

function getSelectedTenorNotes(voices) {
  let notes = [];
  if (voices.spockSelected) {
    notes.push("G5");
  }

  if (voices.t1Selected) {
    notes.push("E5");
  }

  if (voices.t2Selected) {
    notes.push("C5");
  }

  if (voices.t3Selected) {
    notes.push("A4");
  }

  if (voices.t4Selected) {
    notes.push("G4");
  }

  return notes;
}

function getSelectedSnareNotes(voices) {
  let notes = [];
  if (voices.snareSelected) {
    notes.push("C5");
  }

  if (voices.pingSelected) {
    notes.push("E5");
  }

  if (voices.rimSelected) {
    notes.push("F5");
  }

  return notes;
}

function getSelectedBassNotes(voices) {
  let notes = [];
  if (voices.b1Selected) {
    notes.push("G5");
  }

  if (voices.b2Selected) {
    notes.push("E5");
  }

  if (voices.b3Selected) {
    notes.push("C5");
  }

  if (voices.b4Selected) {
    notes.push("A4");
  }

  if (voices.b5Selected) {
    notes.push("F4");
  }

  return notes;
}

function getSelectedCymbalNotes(voices) {
  let notes = [];
  if (voices.crashSelected) {
    notes.push("E5");
  }

  if (voices.chokeSelected) {
    notes.push("C5");
  }

  return notes;
}

function getSelectedInstrumentNotes(voices, selectedNote) {
  const instrument = selectedNote.instrument;
  if (instrument === "drumset") {
    return getSelectedSetNotes(voices.drumset);
  } else if (instrument === "tenors") {
    return getSelectedTenorNotes(voices.tenors);
  } else if (instrument === "snare") {
    return getSelectedSnareNotes(voices.snare);
  } else if (instrument === "bass") {
    return getSelectedBassNotes(voices.bass);
  } else if (instrument === "cymbals") {
    return getSelectedCymbalNotes(voices.cymbals);
  }
}
