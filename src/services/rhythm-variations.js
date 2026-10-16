import { canShuffleMeasure, shuffleMeasure } from "./measure-editing";

export const VARIATION_CATEGORIES = [
  ["stickings", "Stickings"], ["accents", "Accents"], ["diddles", "Diddles"], ["cheese", "Cheese"], ["flams", "Flams"],
];

// Change one measure at a time, keeping the timing and all other markings intact.
export function rhythmVariations(score, category, limit = 8, random = Math.random) {
  const eligible = score.measures.map((measure, index) => canShuffleMeasure(measure, category) ? index : -1).filter((index) => index >= 0);
  const seen = new Set([JSON.stringify(score)]), variations = [];
  for (let attempt = 0; eligible.length && attempt < limit * 24 && variations.length < limit; attempt++) {
    const index = eligible[attempt % eligible.length];
    const next = { ...score, measures: score.measures.map((measure, i) => i === index ? shuffleMeasure(measure, category, random) : measure) };
    const key = JSON.stringify(next);
    if (seen.has(key)) continue;
    seen.add(key);
    variations.push({ score: next, measureIndex: index });
  }
  return variations;
}
