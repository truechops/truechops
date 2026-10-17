import { canShuffleMeasure, shuffleMeasure } from "./measure-editing";

export const VARIATION_CATEGORIES = [
  ["stickings", "Stickings"], ["accents", "Accents"], ["diddles", "Diddles"], ["cheese", "Cheese"], ["flams", "Flams"],
];
const letters = { stickings: "rl", accents: "a", diddles: "d", cheese: "c", flams: "f" };
const ornamentTypes = ["diddles", "cheese", "flams"];
const clone = (value) => JSON.parse(JSON.stringify(value));
const hits = (measure) => measure.parts.flatMap((part) => part.voices.flatMap((voice) => voice.notes.filter((note) => note.notes?.length)));
const shuffled = (values, random) => {
  const next = [...values];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};
export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}

export function variationKey(measure) {
  return JSON.stringify(measure, (key, value) => key === "ornaments" ? [...(value || "")].sort().join("") : value);
}

// Prefer free notes when introducing ornaments. If every note already has a
// conflicting ornament, replace only the positions needed for the selected types.
export function varyMeasure(measure, selected, random = Math.random) {
  const categories = [...new Set(selected)].filter((category) => letters[category]);
  if (!categories.length) return null;
  const next = clone(measure), notes = hits(next);
  if (!notes.length) return null;
  if (categories.includes("stickings")) {
    for (const note of notes) note.ornaments = (note.ornaments || "").replace(/[rl]/g, "") + (random() < .5 ? "r" : "l");
  }
  if (categories.includes("accents")) {
    const count = 1 + Math.floor(random() * Math.max(1, Math.ceil(notes.length / 3)));
    if (count > notes.length) return null;
    for (const note of notes) note.ornaments = (note.ornaments || "").replace(/a/g, "");
    for (const note of shuffled(notes, random).slice(0, count)) note.ornaments += "a";
  }
  const ornaments = ornamentTypes.filter((category) => categories.includes(category));
  if (ornaments.length) {
    const chosenLetters = ornaments.map((category) => letters[category]).join("");
    const available = notes.filter((note) => ![...(note.ornaments || "")].some((letter) => "fdc".includes(letter) && !chosenLetters.includes(letter)));
    if (available.length < ornaments.length) available.push(...shuffled(notes.filter((note) => !available.includes(note)), random).slice(0, ornaments.length - available.length));
    for (const note of available) note.ornaments = [...(note.ornaments || "")].filter((letter) => !chosenLetters.includes(letter)).join("");
    const counts = Object.fromEntries(ornaments.map((category) => [category, 1]));
    let required = Object.values(counts).reduce((total, count) => total + count, 0);
    if (required > available.length) return null;
    for (const category of shuffled(ornaments, random)) {
      const extra = Math.floor(random() * (Math.min(available.length - required, Math.floor(available.length / 3)) + 1));
      counts[category] += extra; required += extra;
    }
    const positions = shuffled(available, random);
    let index = 0;
    for (const category of ornaments) for (let i = 0; i < counts[category]; i++) {
      const note = positions[index++];
      note.ornaments = note.ornaments.replace(/[fdc]/g, "") + letters[category];
    }
  }
  return next;
}

export function canAdjustMeasure(measure, category) {
  if (canShuffleMeasure(measure, category)) return true;
  return ornamentTypes.includes(category) && Boolean(measure && varyMeasure(measure, [category], seededRandom(7)));
}
export function adjustMeasure(measure, category, random = Math.random) {
  if (canShuffleMeasure(measure, category)) return shuffleMeasure(measure, category, random);
  return ornamentTypes.includes(category) ? varyMeasure(measure, [category], random) || clone(measure) : clone(measure);
}

// Each page is bounded work. Small patterns have finitely many arrangements;
// callers can recycle them on later pages without pretending they are unique.
export function rhythmVariations(score, selected, limit = 12, random = Math.random) {
  const categories = Array.isArray(selected) ? selected : [selected];
  if (!categories.some((category) => letters[category])) return [];
  const activeParts = (measure) => ({ ...measure, parts: measure.parts.filter((part) => score.parts?.[part.instrument]?.enabled !== false) });
  const eligible = score.measures.map((measure, index) => varyMeasure(activeParts(measure), categories, seededRandom(1)) ? index : -1).filter((index) => index >= 0);
  const seen = new Set(), variations = [];
  for (let attempt = 0; eligible.length && attempt < limit * 12 && variations.length < limit; attempt++) {
    const measureIndex = eligible[Math.floor(random() * eligible.length)], source = score.measures[measureIndex];
    const changed = varyMeasure(activeParts(source), categories, random);
    if (!changed) continue;
    const measure = { ...source, parts: source.parts.map((part) => changed.parts.find((entry) => entry.instrument === part.instrument) || part) };
    const key = measureIndex + ":" + variationKey(measure);
    if (seen.has(key) || variationKey(measure) === variationKey(source)) continue;
    seen.add(key);
    variations.push({ key, measureIndex, measure, score: { ...score, measures: score.measures.map((value, index) => index === measureIndex ? measure : value) } });
  }
  return variations;
}
