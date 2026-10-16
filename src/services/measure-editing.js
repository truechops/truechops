import { getEmptyMeasure } from "../helpers/score";

const categories = { stickings: "rl", accents: "a", diddles: "d", cheese: "c", flams: "f" };
const clone = (value) => JSON.parse(JSON.stringify(value));

function candidates(voice, category) {
  const letters = categories[category];
  if (!letters) return [];
  // Keep other ornaments intact: flams, diddles and cheese occupy the same slot.
  const conflicts = "fdc".includes(letters) ? [..."fdc"].filter((letter) => letter !== letters) : [];
  return voice.notes.filter((note) => note.notes?.length && !conflicts.some((letter) => (note.ornaments || "").includes(letter)));
}
const valueOf = (note, category) => [...(note.ornaments || "")].filter((letter) => categories[category].includes(letter)).join("");

export function canShuffleMeasure(measure, category) {
  return Boolean(categories[category] && measure?.parts.some((part) => part.voices.some((voice) =>
    new Set(candidates(voice, category).map((note) => valueOf(note, category))).size > 1)));
}

// Shuffle only the chosen markings within each voice. Durations, rests, pitches,
// tuplets and all other markings stay in place, including across mixed meters.
export function shuffleMeasure(measure, category, random = Math.random) {
  const next = clone(measure);
  if (!categories[category]) return next;
  for (const part of next.parts) for (const voice of part.voices) {
    const notes = candidates(voice, category);
    const before = notes.map((note) => valueOf(note, category));
    if (new Set(before).size < 2) continue;
    const after = [...before];
    for (let i = after.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [after[i], after[j]] = [after[j], after[i]];
    }
    // A shuffle should visibly change a pattern whenever a different one exists.
    if (after.every((value, index) => value === before[index])) after.push(after.shift());
    notes.forEach((note, index) => {
      note.ornaments = [...(note.ornaments || "")].filter((letter) => !categories[category].includes(letter)).join("") + after[index];
    });
  }
  return next;
}

export function insertCopiedMeasure(state, copied, targetIndex, side) {
  if (!copied || !state.score.measures[targetIndex] || !["left", "right"].includes(side)) return;
  const index = targetIndex + (side === "right" ? 1 : 0);
  const instruments = state.score.measures[0].parts.map((part) => part.instrument);
  const empty = getEmptyMeasure(copied.timeSig, instruments);
  const measure = { ...clone(copied), parts: empty.parts.map((part) => {
    const source = copied.parts.find((entry) => entry.instrument === part.instrument);
    return source ? clone(source) : part;
  }) };
  state.score.measures.splice(index, 0, measure);
  // Keep repeat markers attached to their original measures.
  for (const edge of ["start", "end"]) {
    if (Number.isInteger(state.repeat?.[edge]) && state.repeat[edge] >= index) state.repeat[edge]++;
  }
  const partIndex = Math.max(0, measure.parts.findIndex((part) => state.score.parts[part.instrument]?.enabled));
  state.selectedNoteIndex = { measureIndex: index, partIndex, voiceIndex: 0, noteIndex: 0 };
  state.selectedPartIndex = partIndex;
  state.measureSelection = true;
  state.timeSig = measure.timeSig;
}
