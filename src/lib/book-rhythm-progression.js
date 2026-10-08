const { normalizeRhythmPool, rhythmOrnamentKey } = require("./book-structure");

// This is the learning order, deliberately different from notes-per-beat order.
const RHYTHM_INCLUSION_ORDER = [
  { id: "quarters", title: "Quarter notes", subdivisions: ["quarters"] },
  { id: "eighths", title: "Eighth notes", subdivisions: ["eighths"] },
  { id: "sixteenths", title: "Sixteenth notes", subdivisions: ["sixteenths"] },
  { id: "triplets", title: "Eighth-note triplets", tuplets: [{ actual: 3, normal: 2, type: 8 }] },
  { id: "sextuplets", title: "Sextuplets", tuplets: [{ actual: 6, normal: 4, type: 16 }] },
  { id: "thirtyseconds", title: "Thirty-second notes", subdivisions: ["thirtyseconds"] },
  { id: "quintuplets", title: "Quintuplets", tuplets: [{ actual: 5, normal: 4, type: 16 }] },
  { id: "septuplets", title: "Septuplets", tuplets: [{ actual: 7, normal: 4, type: 16 }] },
  { id: "nontuplets", title: "Nontuplets", tuplets: [{ actual: 9, normal: 8, type: 32 }] },
];
const RHYTHM_DENSITIES = [
  { id: "sparse", title: "Sparse", range: [0.45, 0.6] },
  { id: "medium", title: "Medium", range: [0.6, 0.75] },
  { id: "dense", title: "Dense", range: [0.75, 0.9] },
];
const EXERCISES_PER_DENSITY = 44;
const INTRODUCTORY_EXERCISES = 12;
const ISOLATED_RHYTHM_DENSITIES = [
  { id: "dense", title: "Dense", range: [0.65, 0.9] },
  { id: "medium", title: "Medium", range: [0.45, 0.65] },
  { id: "sparse", title: "Sparse", range: [0.25, 0.45] },
  { id: "low", title: "Low density", range: [0.1, 0.25] },
];

function normalizeRhythmIsolation(value) {
  if (!value || !RHYTHM_INCLUSION_ORDER.some((rhythm) => rhythm.id === value.subdivision)) return null;
  if (!ISOLATED_RHYTHM_DENSITIES.some((density) => density.id === value.density)) return null;
  return { subdivision: value.subdivision, density: value.density };
}

function createIsolatedRhythmStudies(pdfSettings) {
  return RHYTHM_INCLUSION_ORDER.map((rhythm) => {
    const quarters = rhythm.id === "quarters";
    const roomy = ["sextuplets", "thirtyseconds", "septuplets", "nontuplets"].includes(rhythm.id);
    const settings = { ...pdfSettings, measuresPerLine: roomy ? 1 : 2,
      ...(quarters ? { measuresPerExercise: 2 } : {}) };
    const id = `rhythm-isolation-${rhythm.id}`;
    const pageCount = roomy ? 2 : 1;
    return {
      id, groupId: "isolated-subdivisions", title: rhythm.title,
      rhythmSpan: { count: 1, unit: 4 }, density: "mixed", pdfSettings: settings,
      primaryRhythms: normalizeRhythmPool(rhythm, false), secondaryRhythms: normalizeRhythmPool({}),
      pages: ISOLATED_RHYTHM_DENSITIES.flatMap((density) => Array.from({ length: pageCount }, () => ({
        subsectionId: `${id}-${density.id}`, subsectionPageCount: pageCount,
        title: `${density.title} - ${quarters ? "two-bar quarter-note exercises" : "subdivision only"}`,
        pdfSettings: settings,
        generationSettings: {
          rhythmOnly: true, ornaments: [], prompt: "", sampleJson: "{}",
          rhythmIsolation: { subdivision: rhythm.id, density: density.id },
          minPlayedNotes: 0, maxPlayedNotes: 0, playEveryNote: false,
          stickingTail: null, requiredSameHandStickingRuns: [],
        },
        lines: [],
      }))),
    };
  });
}

// Choose attacks on just one grid. Existing notation rules later join rests
// and lengthen notes without changing those attack positions. Quarter studies
// use two-bar phrases: only 15 non-silent one-bar quarter patterns exist.
function createIsolatedRhythmScore(plan, random) {
  const rhythm = RHYTHM_INCLUSION_ORDER.find((item) => item.id === plan.subdivision);
  const density = ISOLATED_RHYTHM_DENSITIES.find((item) => item.id === plan.density);
  const tuplet = rhythm.tuplets?.[0];
  const duration = tuplet?.type || { quarters: 4, eighths: 8, sixteenths: 16, thirtyseconds: 32 }[rhythm.id];
  const perBeat = tuplet?.actual || duration / 4;
  const perMeasure = perBeat * 4;
  const measureCount = rhythm.id === "quarters" ? 2 : 1;
  const total = perMeasure * measureCount;
  // Boundary counts belong to the lower-density band. Reserve those patterns
  // for its later pages, especially the finite two-bar quarter-note vocabulary.
  const minimum = Math.max(measureCount, density.id === "low"
    ? Math.ceil(total * density.range[0]) : Math.floor(total * density.range[0]) + 1);
  const maximum = Math.max(minimum, Math.floor(total * density.range[1]));
  const playedCount = minimum + Math.floor(random() * (maximum - minimum + 1));
  const positions = Array.from({ length: total }, (_, index) => index);
  for (let index = positions.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [positions[index], positions[other]] = [positions[other], positions[index]];
  }
  const played = new Set(positions.slice(0, playedCount));
  // Keep both bars active, even in the lowest-density quarter exercises.
  for (let measure = 0; measure < measureCount; measure += 1) {
    const start = measure * perMeasure;
    if (![...played].some((slot) => slot >= start && slot < start + perMeasure)) {
      played.delete([...played][0]);
      played.add(start + Math.floor(random() * perMeasure));
    }
  }
  return { parts: { snare: { enabled: true } }, measures: Array.from({ length: measureCount }, (_, measure) => ({
    timeSig: { num: 4, type: 4 }, parts: [{ instrument: "snare", voices: [{
      notes: Array.from({ length: perMeasure }, (_, slot) => ({
        notes: played.has(measure * perMeasure + slot) ? ["C5"] : [], duration, velocity: 0.5,
      })),
      tuplets: tuplet ? Array.from({ length: 4 }, (_, beat) => ({
        start: beat * perBeat, end: (beat + 1) * perBeat, actual: tuplet.actual, normal: tuplet.normal,
      })) : [],
    }] }],
  })) };
}

function getRhythmKey(rhythm) {
  return rhythm.subdivisions?.[0] || rhythmOrnamentKey(rhythm.tuplets[0]);
}

function normalizeRhythmProgression(value) {
  if (!value || !Array.isArray(value.preceding)) return null;
  const allowed = new Set(RHYTHM_INCLUSION_ORDER.map(getRhythmKey));
  const preceding = [...new Set(value.preceding.filter((key) => allowed.has(key)))];
  const density = RHYTHM_DENSITIES.some((item) => item.id === value.density) ? value.density : "medium";
  return preceding.length ? { preceding, density } : null;
}

function getRhythmProgressionStep(value, exerciseIndex) {
  const plan = normalizeRhythmProgression(value);
  if (!plan) return null;
  const previous = plan.preceding;
  const index = Math.max(0, exerciseIndex);
  let keys;
  let introduced;
  if (index < INTRODUCTORY_EXERCISES) {
    // Early studies isolate each previous rhythm. Later studies begin with two
    // balanced groups, keeping the same total practice budget at every level.
    const groupCount = previous.length <= 3 ? previous.length : 2;
    const groupIndex = Math.min(groupCount - 1, Math.floor(index * groupCount / INTRODUCTORY_EXERCISES));
    const start = Math.floor(groupIndex * previous.length / groupCount);
    const end = Math.floor((groupIndex + 1) * previous.length / groupCount);
    keys = previous.slice(start, end);
    introduced = keys[index % keys.length];
  } else {
    const size = Math.min(previous.length, 2 + index - INTRODUCTORY_EXERCISES);
    keys = previous.slice(0, size);
    introduced = size < previous.length || index === INTRODUCTORY_EXERCISES + previous.length - 2
      ? keys.at(-1) : keys[(index - INTRODUCTORY_EXERCISES) % keys.length];
  }
  return { keys, requiredKey: introduced };
}

function getProgressionSecondaryPool(pool, step) {
  const source = normalizeRhythmPool(pool);
  return normalizeRhythmPool({
    ...source,
    subdivisions: source.subdivisions.filter((id) => step.keys.includes(id)),
    tuplets: source.tuplets.filter((tuplet) => step.keys.includes(rhythmOrnamentKey(tuplet))),
  });
}

function createRhythmProgressionStudies(pdfSettings) {
  // Quarters are introduced alongside eighths, rather than padding the 15
  // possible non-silent quarter-only measures into repeated practice pages.
  return RHYTHM_INCLUSION_ORDER.slice(1).map((rhythm, rhythmIndex) => {
    const previous = RHYTHM_INCLUSION_ORDER.slice(0, rhythmIndex + 1);
    const id = `rhythm-progression-${rhythm.id}`;
    const settings = { ...pdfSettings, measuresPerLine: ["thirtyseconds", "nontuplets"].includes(rhythm.id) ? 1 : 2 };
    const pageCount = EXERCISES_PER_DENSITY / (11 * settings.measuresPerLine);
    return {
      id, groupId: "one-quarter",
      title: rhythm.id === "eighths" ? "Quarters and eighths" : rhythm.title,
      rhythmSpan: { count: 1, unit: 4 }, density: "mixed", pdfSettings: settings,
      primaryRhythms: normalizeRhythmPool(rhythm, false),
      secondaryRhythms: normalizeRhythmPool({
        subdivisions: previous.flatMap((item) => item.subdivisions || []),
        tuplets: previous.flatMap((item) => item.tuplets || []),
      }),
      pages: RHYTHM_DENSITIES.flatMap((density) => Array.from({ length: pageCount }, () => ({
        subsectionId: `${id}-${density.id}`, subsectionPageCount: pageCount,
        title: `${density.title} - focused pairs to growing pool`, pdfSettings: settings,
        generationSettings: {
          rhythmOnly: true, ornaments: [], prompt: "", sampleJson: "{}",
          rhythmProgression: { preceding: previous.map(getRhythmKey), density: density.id },
          playedShareRamp: { start: density.range, end: density.range },
          minPlayedNotes: 0, maxPlayedNotes: 0, playEveryNote: false,
          stickingTail: null, maxSameHandStickingRun: 2, requiredSameHandStickingRuns: [],
        },
        lines: [],
      }))),
    };
  });
}

// Quarters plus eighths have a finite vocabulary. Enumerate it rather than
// repeatedly drawing the same rhythms and counting different stickings.
const QUARTER_EIGHTH_PATTERNS = Array.from({ length: 256 }, (_, mask) => {
  const beats = Array.from({ length: 4 }, (_, beat) => (mask >> (beat * 2)) & 3);
  const quarters = beats.filter((beat) => beat === 1).length;
  const eighths = beats.filter((beat) => beat >= 2).length;
  const played = beats.reduce((total, beat) => total + (beat === 3 ? 2 : beat ? 1 : 0), 0);
  return { mask, quarters, eighths, density: played / (8 - quarters) };
}).filter((pattern) => pattern.quarters && pattern.eighths)
  .sort((a, b) => a.density - b.density || a.mask - b.mask);

function createQuarterEighthScore(density, index) {
  const offset = density === "sparse" ? 0 : density === "dense"
    ? QUARTER_EIGHTH_PATTERNS.length - EXERCISES_PER_DENSITY
    : Math.floor((QUARTER_EIGHTH_PATTERNS.length - EXERCISES_PER_DENSITY) / 2);
  const { mask } = QUARTER_EIGHTH_PATTERNS[offset + index % EXERCISES_PER_DENSITY];
  const notes = Array.from({ length: 8 }, (_, slot) => ({
    notes: mask & (1 << slot) ? ["C5"] : [], duration: 8, velocity: 0.5,
  }));
  return { parts: { snare: { enabled: true } }, measures: [{ timeSig: { num: 4, type: 4 },
    parts: [{ instrument: "snare", voices: [{ notes, tuplets: [] }] }],
  }] };
}

module.exports = {
  RHYTHM_INCLUSION_ORDER, RHYTHM_DENSITIES, EXERCISES_PER_DENSITY, INTRODUCTORY_EXERCISES,
  ISOLATED_RHYTHM_DENSITIES, normalizeRhythmIsolation, createIsolatedRhythmStudies, createIsolatedRhythmScore,
  getRhythmKey, normalizeRhythmProgression, getRhythmProgressionStep,
  getProgressionSecondaryPool, createRhythmProgressionStudies,
  createQuarterEighthScore,
};
