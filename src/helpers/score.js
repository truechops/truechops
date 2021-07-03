import { GRACE_X_SHIFT, NON_ACCENT_VELOCITY } from '../../data/score-config';

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
  cymbal: {
    C5: 'x2',
    E5: 'x2'
  }
};

export function getNote(staveNoteConstructor, note, instrument) {
  return new staveNoteConstructor({
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
    duration: `${note.duration.toString() + (!note.notes.length ? "r" : "")}`
  });
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
