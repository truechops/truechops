const { normalizeRhythmPool } = require("./book-structure");
const { RHYTHM_INCLUSION_ORDER, RHYTHM_DENSITIES, getRhythmKey } = require("./book-rhythm-progression");

// These are fixed pools, in the requested teaching order. A later section does
// not inherit rhythms from an earlier section unless they are listed here.
const BOOK_ONE_COMBINATIONS = [
  { title: "Quarters and eighths", main: "eighths", rhythms: ["quarters", "eighths"] },
  { title: "Quarters, eighths and sixteenths", main: "sixteenths", rhythms: ["quarters", "eighths", "sixteenths"] },
  { title: "Triplets and eighths", main: "triplets", rhythms: ["triplets", "eighths"] },
  { title: "Triplets, eighths and sixteenths", main: "triplets", rhythms: ["triplets", "eighths", "sixteenths"] },
  { title: "Sextuplets, sixteenths and eighths", main: "sextuplets", rhythms: ["sextuplets", "sixteenths", "eighths"] },
  { title: "Sextuplets, sixteenths, eighths and triplets", main: "sextuplets", rhythms: ["sextuplets", "sixteenths", "eighths", "triplets"] },
  { title: "Sextuplets, sixteenths, eighths, triplets and 32nds", main: "sextuplets", rhythms: ["sextuplets", "sixteenths", "eighths", "triplets", "thirtyseconds"] },
  { title: "Quintuplets, sixteenths and eighths", main: "quintuplets", rhythms: ["quintuplets", "sixteenths", "eighths"] },
  { title: "Quintuplets, sixteenths, triplets and eighths", main: "quintuplets", rhythms: ["quintuplets", "sixteenths", "triplets", "eighths"] },
  { title: "Quintuplets, sextuplets, sixteenths, triplets and eighths", main: "quintuplets", rhythms: ["quintuplets", "sextuplets", "sixteenths", "triplets", "eighths"] },
  { title: "Quintuplets, sextuplets, sixteenths, triplets and 32nds", main: "quintuplets", rhythms: ["quintuplets", "sextuplets", "sixteenths", "triplets", "thirtyseconds"] },
  { title: "Septuplets, sixteenths, triplets and quintuplets", main: "septuplets", rhythms: ["septuplets", "sixteenths", "triplets", "quintuplets"] },
  { title: "Septuplets, sixteenths, triplets, sextuplets, 32nds and quintuplets", main: "septuplets", rhythms: ["septuplets", "sixteenths", "triplets", "sextuplets", "thirtyseconds", "quintuplets"] },
  { title: "Septuplets, sixteenths, triplets, sextuplets, 32nds, quintuplets and nontuplets", main: "septuplets", rhythms: ["septuplets", "sixteenths", "triplets", "sextuplets", "thirtyseconds", "quintuplets", "nontuplets"] },
];
const COMBINATION_EXERCISES_PER_SECTION = 66;
const byId = new Map(RHYTHM_INCLUSION_ORDER.map((rhythm) => [rhythm.id, rhythm]));

function normalizeRhythmCombination(value) {
  if (!value || !Array.isArray(value.rhythms) || !byId.has(value.main)) return null;
  const rhythms = [...new Set(value.rhythms.filter((id) => byId.has(id)))];
  if (rhythms.length < 2 || !rhythms.includes(value.main)) return null;
  if (!RHYTHM_DENSITIES.some((density) => density.id === value.density)) return null;
  const exerciseOffset = Math.max(0, Math.floor(Number(value.exerciseOffset) || 0));
  return { main: value.main, rhythms, density: value.density,
    ...(exerciseOffset ? { exerciseOffset } : {}) };
}

function getRhythmCombinationStep(value, exerciseIndex) {
  const plan = normalizeRhythmCombination(value);
  if (!plan) return null;
  const companions = plan.rhythms.filter((id) => id !== plan.main);
  let required = companions;
  if (companions.length > 3) {
    // Four beats cannot hold five or more distinct one-beat families. Cycle
    // through every companion pair; the spare beat draws from the full pool.
    const pairs = companions.flatMap((first, index) => companions.slice(index + 1).map((second) => [first, second]));
    required = pairs[(Math.max(0, Math.floor(exerciseIndex)) + (plan.exerciseOffset || 0)) % pairs.length];
  }
  return { requiredKeys: required.map((id) => getRhythmKey(byId.get(id))) };
}

function createBookOneCombinationStudies(pdfSettings) {
  return BOOK_ONE_COMBINATIONS.map((combination, index) => {
    const id = `rhythm-combination-${String(index + 1).padStart(2, "0")}`;
    const companions = combination.rhythms.filter((rhythm) => rhythm !== combination.main).map((rhythm) => byId.get(rhythm));
    const roomy = combination.rhythms.some((rhythm) => ["thirtyseconds", "nontuplets"].includes(rhythm));
    const settings = { ...pdfSettings, measuresPerLine: roomy ? 1 : 2, measuresPerExercise: 1 };
    const exercisesPerPage = 11 * settings.measuresPerLine;
    const pageCount = COMBINATION_EXERCISES_PER_SECTION / exercisesPerPage;
    const levels = pageCount === 3 ? ["Dense", "Medium", "Low density"]
      : ["Dense", "Moderately dense", "Medium", "Moderately sparse", "Sparse", "Low density"];
    return {
      id, groupId: "rhythm-combinations", title: combination.title,
      rhythmSpan: { count: 1, unit: 4 }, density: "mixed", pdfSettings: settings,
      primaryRhythms: normalizeRhythmPool(byId.get(combination.main), false),
      secondaryRhythms: normalizeRhythmPool({
        subdivisions: companions.flatMap((rhythm) => rhythm.subdivisions || []),
        tuplets: companions.flatMap((rhythm) => rhythm.tuplets || []),
      }),
      pages: levels.map((title, pageIndex) => {
        // Each physical page holds one level. Equal steps between pages keep
        // the same dense opening and low ending without a late density cliff.
        const progress = pageIndex / (pageCount - 1);
        const range = [0.75, 0.9].map((share) => Number((share - 0.6 * progress).toFixed(2)));
        const density = ["dense", "medium", "sparse"][Math.floor(pageIndex * 3 / pageCount)];
        return {
          subsectionId: `${id}-density-${pageIndex + 1}`, subsectionPageCount: 1,
          title: `${title} - combination exercises`, pdfSettings: settings,
          generationSettings: {
            rhythmOnly: true, ornaments: [], prompt: "", sampleJson: "{}",
            rhythmCombination: { main: combination.main, rhythms: combination.rhythms, density,
              exerciseOffset: pageIndex * exercisesPerPage },
            playedShareRamp: { start: range, end: range },
            minPlayedNotes: 0, maxPlayedNotes: 0, playEveryNote: false,
            stickingTail: null, maxSameHandStickingRun: 2, requiredSameHandStickingRuns: [],
          },
          lines: [],
        };
      }),
    };
  });
}

module.exports = { BOOK_ONE_COMBINATIONS, COMBINATION_EXERCISES_PER_SECTION,
  normalizeRhythmCombination, getRhythmCombinationStep, createBookOneCombinationStudies };
