import {
  GRACE_X_SHIFT,
  NON_ACCENT_VELOCITY,
  tcDurationToVfDuration,
  vfDurationToTcDuration,
  timeSigs,
  HEAD6
} from "../consts/score";
import { getAdditionalDotDuration, getPowersOf2, isPowerOf2 } from "./math";

const noteHeadTypeLookup = {
  drumset: {
    E5: HEAD6,
    F5: HEAD6,
    D4: HEAD6,
  },
  snare: {
    E5: HEAD6,
    F5: HEAD6,
  },
  cymbals: {
    C5: HEAD6,
    E5: HEAD6,
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
          let notehead = ""

          if(note.head) {
            notehead = `/${note.head}`
          } else if(noteHeadTypeLookup[instrument] != null && noteHeadTypeLookup[instrument][n] != null) {
            notehead = `/${noteHeadTypeLookup[instrument][n]}`
          }

          return `${n[0]}/${n[1]}${notehead}`;
        })
      : ["r/4"],
    duration,
  });


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

export function getNotesLength(notes) {
  return notes.reduce((total, note) => {
    return total + getTCDurationSingle(note.duration, note.dots);
  }, 0);
}

//used so we can properly put tuplets back in place when mutating the rhythm.
export function getTupletLengths(voice) {
  let tupletLengths = [];
  const notes = voice.notes;
  for(const tuplet of voice.tuplets) {
    const { start, end } = tuplet;
    let tupletLength = 0;
    for(let i = start; i < end; i++) {
      tupletLength += getTCDurationSingle(notes[i].duration, notes[i].dots)
    }
    tupletLengths.push(tupletLength);
  }

  return tupletLengths;
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
        notes: timeSigs[`${timeSig.num}/${timeSig.type}`].notes.map(duration => ({
          notes: [],
          duration: +duration.replace('d', ''),
          dots: duration.includes('d') ? 1 : 0,
          velocity: NON_ACCENT_VELOCITY
        })),
        tuplets: [],
      },
    ],
  }));

  return {
    timeSig,
    parts,
  };
}
