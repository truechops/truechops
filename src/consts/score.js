export const NON_ACCENT_VELOCITY = 0.5;
export const ACCENT_VELOCITY = 1.0;
export const GRACE_VELOCITY = 0.1;

export const GRACE_X_SHIFT = 13;

export const MIN_TEMPO = 40;
export const MAX_TEMPO = 250;
export const DEFAULT_TEMPO = 90;
export const DEFAULT_TIME_SIG = {
  num: 4,
  type: 4
}

export const NOTE_CONFIG = {
    whole: {
      duration: 32
    },
    half: {
      duration: 16
    },
    quarter: {
      duration: 8
    },
    eighth: {
      duration: 4
    },
    sixteenth: {
      duration: 2
    },
    thirtysecond: {
      duration: 1
    }
}

  //Translates the toneJs duration to the score duration
export const vfDurationToTcDuration = {
  1: 32,
  2: 16,
  4: 8,
  8: 4,
  16: 2,
  32: 1,
};

export const tcDurationToVfDuration = {
  32: 1,
  16: 2,
  8: 4,
  4: 8,
  2: 16,
  1: 32,
};

export const INSTRUMENT_NOTE_TO_VOICE_MAP = {
  drumset: {
    'D4': 'Hi Hat Foot',
    'F4': 'Kick',
    'C5': 'Snare',
    'E5': 'Hi Hat',
    'F5': "Ride",
    'D5': "Tom 1",
    'B4': "Tom 2",
    'A4': "Tom 3",
    'G4': "Tom 4"
  },
  snare: {
    C5: 'Snare',
    E5: 'Ping',
    F5: 'Rim'
  },
  tenors: {
    G5: 'Spock',
    E5: "Tenor 1",
    C5: "Tenor 2",
    A4: "Tenor 3",
    F4: 'Tenor 4'
  },
  bass: {
    G5: 'Bass 1',
    E5: 'Bass 2',
    C5: 'Bass 3',
    A4: 'Bass 4',
    F4: 'Bass 5'
  },
  cymbals: {
    E5: 'Crash',
    C5: 'Choke',
  }
}

export const NOTE_HIGHLIGHT_COLOR = '#00FF00';

export const DEFAULT_MUTATION_NUM_REPEATS = 1;
export const DEFAULT_MUTATION = {
  type: 'ra-emergent-cycles',
  context: 'All',
  grid: 16,
  config: {
    probability: 0.25
  }
};

export const score = {
  modalShown: false
}

export const timeSigs = {
  '2/4': {
    notes: ['4', '4'],
    groups: [[1, 4]]
  },
  '3/4': {
    notes: ['4', '4', '4'],
    groups: [[1, 4]]
  },
  '4/4': {
    notes: ['4', '4', '4', '4'],
    groups: [[1, 4]]
  },
  '5/4': {
    notes: ['4', '4', '4', '4', '4'],
    groups: [[1, 4]]
  },
  '5/8': {
    notes: ['4', '4d'],
    groups: [[1, 4], [3, 8]]
  },
  '6/8': {
    notes: ['4d', '4d'],
    groups: [[3, 8]]
  },
  '7/8':  {
    notes: ['4', '4', '4d'],
    groups: [[1, 4], [1, 4], [3, 8]]
  },
  '9/8': {
    note: ['4d', '4d', '4d'],
    groups: [[3, 8]]
  },
  "5/16": {
    notes: ['8', '8d'],
    groups: [[1, 8], [3, 16]]
  },
  "7/16": {
    notes: ['4', '8d'],
    groups: [[1, 4], [3, 16]]
  },
  "9/16": {
    notes: ['8d', '8d', '8d'],
    groups: [[3, 16]]
  },
  "11/16": {
    notes: ['4', '4', '8d'],
    groups: [[1, 4], [1, 4], [3, 16]]
  },
  "13/16": {
    notes: ['4', '4', '4', '16'],
    groups: [[1, 4], [1, 4], [1, 16]]
  },
  "15/16": {
    notes: ['4', '4', '4', '8d'],
    groups: [[1, 4], [1, 4], [1, 4], [3, 16]]
  },
  "17/16": {
    notes: ['4', '4', '4', '4', '16'],
    groups: [[1, 4], [1, 4], [1, 4], [1, 4], [1, 16]]
  }
}
