import { GRACE_X_SHIFT, NON_ACCENT_VELOCITY } from '../../data/score-config';
import { getAdditionalDotDuration } from './math';

const noteHeadTypeLookup = {
  drumset: {
    E5: "x2",
    F5: 'x2',
    D4: 'x2'
  },
  snare: {
    E5: "x2",
    F5: "x2"
  },
  cymbals: {
    C5: 'x2',
    E5: 'x2'
  }
};

//Translates the toneJs duration to the score duration
const vfDurationToTCDuration = {
  1: 64,
  2: 32,
  4: 16,
  8: 8,
  16: 4,
  32: 2,
};

export function getNote(staveNoteConstructor, note, instrument) {
 let returnNote = new staveNoteConstructor({
    clef: "percussion",
    keys: note.notes.length
      ? note.notes.map((n) => {
          const noteHead =
            noteHeadTypeLookup[instrument] != null
              ? noteHeadTypeLookup[instrument][n] != null
                ? "/" + noteHeadTypeLookup[instrument][n]
                : ""
              : "";

          return `${n[0]}/${n[1]}${noteHead}`;
        })
      : ["r/4"],
    duration: `${note.duration.toString() + (!note.notes.length ? "r" : "") + (note.dots ? 'd' : '')}`
  });

  //Add dots to the note
  const numDots = returnNote.dots != null ? returnNote.dots : 0;
  for(var i = 0; i < numDots; i++) {
    returnNote = returnNote.addDotToAll();
  }

  return returnNote;
}

//Get the vex flow duration value, with or without including additional duration for dots.
export function getVfDuration(note, withDots) {
  let selectedDuration = vfDurationToTCDuration[note.duration];

  //If we want to include time for dots.
  if (withDots && note.dots) {
    selectedDuration += getAdditionalDotDuration(selectedDuration, note.dots);
  }

  return selectedDuration;
}

export function getGraceNote(graceNoteConstructor) {
  const graceNote = new graceNoteConstructor({
    keys: ["C/5"],
    duration: "8",
    slash: false
  });

  graceNote.x_shift = GRACE_X_SHIFT;

  return graceNote;
}

export function getEmptyMeasure(timeSig, instruments) {
  let parts = instruments.map(instrument => ({
      instrument: instrument,
      voices: [
        {
          notes: [
            {
              notes: [],
              duration: 4,
              velocity: NON_ACCENT_VELOCITY,
            },
            {
              notes: [],
              duration: 4,
              velocity: NON_ACCENT_VELOCITY,
            },
            {
              notes: [],
              duration: 4,
              velocity: NON_ACCENT_VELOCITY,
            },
            {
              notes: [],
              duration: 4,
              velocity: NON_ACCENT_VELOCITY,
            }
          ]
        }
      ]
    }
  ));

  return {
    timeSig,
    parts
  }
}
