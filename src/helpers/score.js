const noteHeadTypeLookup = {
  drumset: {
    E5: "x2",
  },
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
    duration: `${note.duration.toString() + (!note.notes.length ? "r" : "")}`,
  });
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
              velocity: 1.0,
            },
            {
              notes: [],
              duration: 4,
              velocity: 1.0,
            },
            {
              notes: [],
              duration: 4,
              velocity: 1.0,
            },
            {
              notes: [],
              duration: 4,
              velocity: 1.0,
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
