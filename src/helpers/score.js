import {
  GRACE_X_SHIFT,
  NON_ACCENT_VELOCITY,
  tcDurationToVfDuration,
  vfDurationToTcDuration,
} from "../consts/score";
import { getAdditionalDotDuration, getPowersOf2, isPowerOf2 } from "./math";

const noteHeadTypeLookup = {
  drumset: {
    E5: "x2",
    F5: "x2",
    D4: "x2",
  },
  snare: {
    E5: "x2",
    F5: "x2",
  },
  cymbals: {
    C5: "x2",
    E5: "x2",
  },
};

//Since this file gets compiled server-side by Next and since VexFlow will only compile client-side, 
//we cannot import VexFlow. Also, it would not be prudent to do a dynamic import of VexFlow every time
//we construct a note. Therefore, we have to pass in the VF.StaveNote constructor.
export function getNote(staveNoteConstructor, note, instrument) {
  
  //Note: the 'd' must be before the 'r' for vexFlow to not break.
  const duration = `${note.duration.toString() + (note.dots ? "d" : "") + (!note.notes.length ? "r" : "")}`;
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
    duration,
  });

  //Add dots to the note
  const numDots = note.dots != null ? note.dots : 0;
  for (var i = 0; i < numDots; i++) {
    returnNote = returnNote.addDotToAll();
  }

  return returnNote;
}

export function getRestsFromTCDuration(duration) {
  const remainingDurations = getPowersOf2(duration);

  let returnResult = [];
  //Map powers of two numbers to 'rest' notes that fill up the empty space left by the smaller note
  remainingDurations.reduce((result, duration) => {
    result.push({
      notes: [],
      duration: tcDurationToVfDuration[duration],
      velocity: NON_ACCENT_VELOCITY,
    });
    return result;
  }, returnResult);

  return returnResult;
}

//
export function getVFDurations(tcDuration) {
  let duration = tcDurationToVfDuration[tcDuration];
  if (duration) {
    return [duration.toString()];
  } else {
    let durations = [];
    let durationLeft = tcDuration;

    //Only support one dot. Two dots will confuse some people.
    let hadDot = false;

    let failedPowerOfTwo = false;
    for (let i = tcDuration; i >= 1 && durationLeft > 0; i--) {
      if (isPowerOf2(i)) {
        if (i <= durationLeft) {
          //If there is already a power of two and there
          //have been no failed power of twos, and there has not been a dot
          //yet, then this is a dotted note.
          if (durations.length > 0 && !failedPowerOfTwo && !hadDot) {
            durations[0] += "d";
            hadDot = true;
          } else {
            durations.push(tcDurationToVfDuration[i].toString());
          }

          durationLeft -= i;
        } else {
          failedPowerOfTwo = true;
        }

      }
    }

    return durations;
  }
}

//Get the TrueChops duration value, with or without including additional duration for dots.
//Assumes the VF duration given will map to a TC Duration.
export function getTCDurationSingle(duration, numDots) {
  let selectedDuration = vfDurationToTcDuration[duration];

  //If we want to include time for dots.
  if (numDots) {
    selectedDuration += getAdditionalDotDuration(selectedDuration, numDots);
  }

  return selectedDuration;
}

export function getGraceNote(graceNoteConstructor) {
  const graceNote = new graceNoteConstructor({
    keys: ["C/5"],
    duration: "8",
    slash: false,
  });

  graceNote.x_shift = GRACE_X_SHIFT;

  return graceNote;
}

export function getEmptyMeasure(timeSig, instruments) {
  let parts = instruments.map((instrument) => ({
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
          },
        ],
        tuplets: [],
      },
    ],
  }));

  return {
    timeSig,
    parts,
  };
}
