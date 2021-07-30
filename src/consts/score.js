export const NON_ACCENT_VELOCITY = 0.5;
export const ACCENT_VELOCITY = 1.0;
export const GRACE_VELOCITY = 0.1;

export const GRACE_X_SHIFT = 13;

export const MIN_TEMPO = 40;
export const MAX_TEMPO = 250;
export const DEFAULT_TEMPO = 90;

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

/**
 *  const tenorsSampler = new Tone.Sampler({
            urls: {
              G5: 'S.mp3',
              E5: "1.mp3",
              C5: "2.mp3",
              A4: "3.mp3",
              F4: '4.mp3'
            },
            release: 1,
            baseUrl: `${origin}/samples/tenors/`,
          }).toDestination();
          setTenorsSampler(tenorsSampler);

          const cymbalsSampler = new Tone.Sampler({
            urls: {
              E5: 'crash.mp3',
              C5: 'choke.mp3',
            },
 */

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

  }
}

export const NOTE_HIGHLIGHT_COLOR = '#00FF00';

export const DEFAULT_MUTATION_NUM_REPEATS = 1;
export const DEFAULT_MUTATION = {
  type: 'swap',
  context: 'All',
  grid: 16,
  config: {
    probability: 0.25,
    swapWithRests: true
  }
};
