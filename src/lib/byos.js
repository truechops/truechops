import { map as alphabet } from "../../data/byos/alphabet/all";

export const BYOS_PHRASE_LIMIT = 64;
export const BYOS_TEMPO = 120;

export function byosLetters(phrase) {
  return (phrase.match(/[a-z]/gi) || []).map((letter) => letter.toLowerCase());
}

export function buildByosScore(phrase) {
  const letters = byosLetters(phrase);
  if (!letters.length) return null;
  // Clone repeated letters as well as the source so editing one measure in
  // Score cannot change another occurrence or the alphabet itself.
  return JSON.parse(JSON.stringify({
    parts: alphabet[letters[0]].score.parts,
    measures: letters.flatMap((letter) => alphabet[letter].score.measures),
  }));
}
