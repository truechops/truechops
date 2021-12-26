import {
    DELAYED_STABILITY,
    RHYTHMIC_INVERSION,
    DENSITY_THINNING,
    EVOLVING_THINNING,
    EMERGENT_CYCLES,
    PROPABILISTIC_TRANSITIONS,
    RHYTHMIC_PHASING} from "./raTypes";

// The possible actions are Note(1), Rest(0), Unchanged(2) and Flip(3).
export const N='N';
export const R='R';
export const F='F';
export const U='U';
export const RF='RF'; // Rest or flip determined Randomly

export const raTypes = {
    DELAYED_STABILITY: {
        0: N,
        1: F,
        2: F,
        3: U,
    },
    RHYTHMIC_INVERSION: {
        0: F,
        1: F,
        2: F,
        3: F,
    },
    DENSITY_THINNING: {
        0: U,
        1: R,
        2: N,
        3: R,
    },
    EVOLVING_THINNING: {
        0: N,
        1: F,
        2: F,
        3: U,
    },
    EMERGENT_CYCLES: {
        0: N,
        1: R,
        2: R,
        3: U,
    },
    PROPABILISTIC_TRANSITIONS: {
        0: N,
        1: F,
        2: F,
        3: U,
    },
    RHYTHMIC_PHASING: {
        0: N,
        1: F,
        2: RF,
        3: U,
    }
}