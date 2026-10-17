import { canShuffleMeasure, shuffleMeasure } from "./measure-editing";
import { INSTRUMENT_NOTE_TO_VOICE_MAP } from "../consts/score";

export const MAX_VARIATION_TYPES = 2;

export const VARIATION_CATEGORIES = [
  ["stickings", "Stickings"], ["accents", "Accents"], ["diddles", "Diddles"], ["cheese", "Cheese"], ["flams", "Flams"],
];
const drumVoices = { kick: "F4", snare: "C5", hiHat: "E5", ride: "F5", hiHatFoot: "D4", tom1: "D5", tom2: "B4", tom3: "A4", tom4: "G4" };
const drumOptions = Object.entries(drumVoices).map(([key, pitch]) => [key, INSTRUMENT_NOTE_TO_VOICE_MAP.drumset[pitch].replace("Hi Hat", "Hi-hat")]);
export const instrumentLabel = (instrument = "") => instrument === "drumset" ? "Drum Set" : instrument.charAt(0).toUpperCase() + instrument.slice(1);
export const getVariationOptions = (instrument) => instrument === "drumset" ? drumOptions : VARIATION_CATEGORIES;
export const getVariationInstruments = (score) => [...new Set(score.measures.flatMap((measure) => measure.parts.map((part) => part.instrument)))].filter((instrument) => score.parts?.[instrument]?.enabled !== false);
const selection = (selected, instrument) => {
  const categories = [...new Set(Array.isArray(selected) ? selected : [selected])];
  return categories.length <= MAX_VARIATION_TYPES && categories.every((category) => getVariationOptions(instrument).some(([key]) => key === category)) ? categories : [];
};
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
  return JSON.stringify(measure, (key, value) => key === "ornaments" ? [...(value || "")].sort().join("") : key === "notes" && value.every((note) => typeof note === "string") ? [...value].sort() : value);
}

// Move only the chosen kit pitches on the existing rhythmic grid. An unselected
// pitch keeps its original onset, including when it shares a chord with a target.
function varyDrumVoices(part, categories, random) {
  for (const category of categories) {
    const pitch = drumVoices[category];
    const existing = part.voices.filter((voice) => voice.notes.some((note) => note.notes.includes(pitch)));
    const voices = existing.length ? existing : part.voices.slice(0, 1);
    for (const voice of voices) {
      const slots = voice.notes.filter((note) => note.notes.includes(pitch) || note.notes.length < 8);
      const before = slots.map((note) => note.notes.includes(pitch)), length = before.length;
      if (!length) continue;
      const originalCount = before.filter(Boolean).length;
      const count = originalCount === 0 ? 1 + Math.floor(random() * Math.max(1, Math.ceil(length / 3)))
        : originalCount === length && length > 1 ? length - 1 - Math.floor(random() * Math.ceil(length / 3)) : originalCount;
      let after = shuffled(Array.from({ length }, (_, index) => index < count), random);
      if (after.every((hit, index) => hit === before[index]) && count > 0 && count < length) after = [...after.slice(1), after[0]];
      slots.forEach((note, index) => {
        if (before[index] === after[index]) return;
        note.notes = note.notes.filter((value) => value !== pitch);
        if (after[index]) note.notes.push(pitch);
      });
    }
  }
}

// Prefer free notes when introducing ornaments. If every note already has a
// conflicting ornament, replace only the positions needed for the selected types.
export function varyMeasure(measure, selected, random = Math.random, instrument = measure.parts[0]?.instrument) {
  const categories = selection(selected, instrument);
  if (!categories.length) return null;
  const next = clone(measure), part = next.parts.find((part) => part.instrument === instrument);
  if (!part) return null;
  if (instrument === "drumset") { varyDrumVoices(part, categories, random); return next; }
  const notes = hits({ parts: [part] });
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

export function canAdjustMeasure(measure, category, instrument = measure?.parts[0]?.instrument) {
  if (!measure || !selection([category], instrument).length) return false;
  const target = { ...measure, parts: measure.parts.filter((part) => part.instrument === instrument) };
  if (instrument !== "drumset" && canShuffleMeasure(target, category)) return true;
  const varied = instrument === "drumset" || ornamentTypes.includes(category) ? varyMeasure(measure, [category], seededRandom(7), instrument) : null;
  return Boolean(varied && variationKey(varied) !== variationKey(measure));
}
export function adjustMeasure(measure, category, random = Math.random, instrument = measure.parts[0]?.instrument) {
  if (!selection([category], instrument).length) return clone(measure);
  const target = { ...measure, parts: measure.parts.filter((part) => part.instrument === instrument) };
  if (instrument !== "drumset" && canShuffleMeasure(target, category)) {
    const changed = shuffleMeasure(target, category, random);
    return { ...clone(measure), parts: measure.parts.map((part) => part.instrument === instrument ? changed.parts[0] : clone(part)) };
  }
  return instrument === "drumset" || ornamentTypes.includes(category) ? varyMeasure(measure, [category], random, instrument) || clone(measure) : clone(measure);
}

// Each page is bounded work. Small patterns have finitely many arrangements;
// callers can recycle them on later pages without pretending they are unique.
export function rhythmVariations(score, selected, limit = 12, random = Math.random, instrument = getVariationInstruments(score)[0]) {
  const categories = selection(selected, instrument);
  if (!categories.length || !getVariationInstruments(score).includes(instrument)) return [];
  const eligible = score.measures.map((measure, index) => varyMeasure(measure, categories, seededRandom(1), instrument) ? index : -1).filter((index) => index >= 0);
  const seen = new Set(), variations = [];
  for (let attempt = 0; eligible.length && attempt < limit * 12 && variations.length < limit; attempt++) {
    const measureIndex = eligible[Math.floor(random() * eligible.length)], source = score.measures[measureIndex];
    const measure = varyMeasure(source, categories, random, instrument);
    if (!measure) continue;
    const key = measureIndex + ":" + variationKey(measure);
    if (seen.has(key) || variationKey(measure) === variationKey(source)) continue;
    seen.add(key);
    variations.push({ key, measureIndex, measure, score: { ...score, measures: score.measures.map((value, index) => index === measureIndex ? measure : value) } });
  }
  return variations;
}
