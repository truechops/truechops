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
    thirtysecon: {
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

export const NOTE_HIGHLIGHT_COLOR = '#00FF00';