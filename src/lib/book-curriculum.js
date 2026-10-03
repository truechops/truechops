const { normalizeRhythmPool } = require("./book-structure");

const STUDY_TOPICS = [
  { id: "nothing", title: "Nothing", ornaments: [] },
  { id: "accents", title: "Accents", ornaments: ["accents"] },
  { id: "accents-stickings", title: "Accents with stickings", ornaments: ["accents", "stickings"] },
  { id: "accents-stickings-diddles", title: "Accents with stickings and diddles", ornaments: ["accents", "stickings", "diddles"] },
  { id: "accents-stickings-flams", title: "Accents with stickings and flams", ornaments: ["accents", "stickings", "flams"] },
  { id: "accents-stickings-cheese", title: "Accents with stickings and cheese", ornaments: ["accents", "stickings", "cheese"] },
  { id: "accents-stickings-diddles-flams", title: "Accents with stickings, diddles and flams", ornaments: ["accents", "stickings", "diddles", "flams"] },
  { id: "everything", title: "Everything", ornaments: ["accents", "stickings", "diddles", "flams", "cheese"] },
];

const STUDY_FAMILIES = [
  { id: "sixteenths", title: "16s", subdivisions: ["sixteenths"], notesPerQuarter: 4 },
  { id: "eighth-triplets", title: "Eighth-note triplets", tuplets: [{ actual: 3, normal: 2, type: 8 }], notesPerQuarter: 3 },
  { id: "quintuplets", title: "Quintuplets", tuplets: [{ actual: 5, normal: 4, type: 16 }], notesPerQuarter: 5 },
  { id: "sextuplets", title: "Sextuplets", tuplets: [{ actual: 6, normal: 4, type: 16 }], notesPerQuarter: 6 },
  { id: "septuplets", title: "Septuplets", tuplets: [{ actual: 7, normal: 4, type: 16 }], notesPerQuarter: 7 },
  { id: "thirtyseconds", title: "32nd notes", subdivisions: ["thirtyseconds"], notesPerQuarter: 8 },
  { id: "nine-eight-thirtyseconds", title: "9:8 32nds", tuplets: [{ actual: 9, normal: 8, type: 32 }], notesPerQuarter: 9 },
];

function createStudySections(groupId, pdfSettings, tailUnit = "staffRows") {
  return STUDY_FAMILIES.flatMap((family) => ["sparse", "full"].map((density) => {
    const id = `${groupId}-${family.id}-${density}`;
    const full = density === "full";
    const primaryRhythms = normalizeRhythmPool(family, false);
    const topics = full ? STUDY_TOPICS.slice(1) : STUDY_TOPICS;
    return {
      id, groupId, title: `${family.title} ${density}`,
      studyFamily: family.id, density,
      primaryRhythms,
      secondaryRhythms: normalizeRhythmPool(),
      pdfSettings,
      pages: topics.map((topic) => ({
        subsectionId: `${id}-${topic.id}`,
        title: topic.title,
        pdfSettings,
        generationSettings: {
          prompt: "", sampleJson: "", ornaments: topic.ornaments,
          minPlayedNotes: full ? 0 : Math.ceil(family.notesPerQuarter * 4 * 0.6),
          maxPlayedNotes: full ? 0 : Math.floor(family.notesPerQuarter * 4 * 0.82),
          playEveryNote: full,
          maxSameHandStickingRun: 2,
          requiredSameHandStickingRuns: [],
          stickingTail: full && topic.ornaments.includes("stickings")
            ? { count: 5, unit: tailUnit, maxSameHandStickingRun: 4, requiredSameHandStickingRuns: [3, 4] }
            : null,
        },
        lines: [],
      })),
    };
  }));
}

// Span studies (over two beats, over three eighths) put every ornament topic on
// one page, about three exercises each, to keep the book short.
const TWO_BEAT_FAMILY_IDS = ["eighth-triplets", "quintuplets", "septuplets", "nine-eight-thirtyseconds"];
const TWO_BEAT_ORNAMENT_SEGMENTS = [
  { ...STUDY_TOPICS[1], count: 4 },
  ...STUDY_TOPICS.slice(2).map((topic) => ({ ...topic, count: 3 })),
].map(({ title, ornaments, count }) => ({ title, ornaments, count }));
// Secondary ornaments: everything on triplets, sixteenths, and quintuplets; only
// flams on sextuplets; none on eighths, septuplets, thirty-seconds, or 9s.
// Stickings follow each exercise's topic on every note.
const ALL_SECONDARY_ORNAMENTS = ["accents", "flams", "diddles", "cheese"];
const ONE_BEAT_SECONDARY_RHYTHMS = {
  subdivisions: ["eighths", "sixteenths", "thirtyseconds"],
  tuplets: STUDY_FAMILIES.flatMap((family) => family.tuplets || []),
  rhythmOrnaments: {
    sixteenths: ALL_SECONDARY_ORNAMENTS,
    "3:2:8": ALL_SECONDARY_ORNAMENTS,
    "5:4:16": ALL_SECONDARY_ORNAMENTS,
    "6:4:16": ["flams"],
  },
};
const SPAN_DENSITIES = [
  { id: "full", title: "Every note", playEveryNote: true },
  { id: "sparse", title: "Sparse", playEveryNote: false },
];
// Spans longer than two quarter notes (four eighths) get one sparse page in which
// about half the primary groups are fully played and the rest include rests.
const CONDENSED_SPAN_DENSITIES = [
  { id: "sparse", title: "Sparse", playEveryNote: false, fullPrimaryGroupShare: 0.5 },
];
const isLongerThanTwoQuarters = (span) => span.count * 4 / span.unit > 2;

// The secondary pool grows down the page: the printed row where each rhythm
// joins. Eighths are not used on these pages.
const SECONDARY_RHYTHM_ROWS = {
  sixteenths: 1, "3:2:8": 1, "6:4:16": 1,
  thirtyseconds: 3,
  "5:4:16": 4,
  "7:4:16": 8,
  "9:8:32": 10,
};

// Over three eighths, only the counts that are new rhythms: 4:3 and 5:3 eighths, 7:6 and 8:6 sixteenths.
const THREE_EIGHTHS_FAMILY_IDS = ["sixteenths", "quintuplets", "septuplets", "thirtyseconds"];

const familyIdsByCount = (counts) => counts.map((count) =>
  STUDY_FAMILIES.find((family) => family.notesPerQuarter === count).id);

// Span groups after the one-beat sections. Each lists the counts (3-9) that are
// new rhythms over its span; counts whose notes-per-beat already appear earlier
// in the book are skipped (5 over five eighths is plain eighths, 8 over three
// quarters is two 4-over-three-eighths groups, 6 over four quarters is two
// quarter-note triplets).
const SPAN_STUDIES = [
  { groupId: "two-quarters", title: "Over two quarter notes", rhythmSpan: { count: 2, unit: 4 }, label: "two beats", familyIds: TWO_BEAT_FAMILY_IDS },
  { groupId: "three-eighths", title: "Over three eighth notes", rhythmSpan: { count: 3, unit: 8 }, label: "three eighths", familyIds: THREE_EIGHTHS_FAMILY_IDS },
  { groupId: "five-eighths", title: "Over five eighth notes", rhythmSpan: { count: 5, unit: 8 }, label: "five eighths", familyIds: familyIdsByCount([3, 4, 6, 7, 8, 9]) },
  { groupId: "three-quarters", title: "Over three quarter notes", rhythmSpan: { count: 3, unit: 4 }, label: "three quarters", familyIds: familyIdsByCount([4, 5, 7]) },
  { groupId: "seven-eighths", title: "Over seven eighth notes", rhythmSpan: { count: 7, unit: 8 }, label: "seven eighths", familyIds: familyIdsByCount([3, 4, 5, 6, 8, 9]) },
  { groupId: "four-quarters", title: "Over four quarter notes", rhythmSpan: { count: 4, unit: 4 }, label: "four quarters", familyIds: familyIdsByCount([3, 5, 7, 9]) },
  // Sixteenth-note spans may string several primary groups together.
  ...[
    [3, "three", [5, 7, 8, 9]],
    [5, "five", [6, 7, 8, 9]],
    [7, "seven", [5, 6, 8, 9]],
    [9, "nine", [4, 5, 7, 8]],
    [11, "eleven", [3, 4, 5, 6, 7, 8, 9]],
    [13, "thirteen", [3, 4, 5, 6, 7, 8, 9]],
    [15, "fifteen", [3, 4, 7, 8]],
  ].map(([count, word, counts]) => ({
    groupId: `${word}-sixteenths`, title: `Over ${word} sixteenth notes`, rhythmSpan: { count, unit: 16 },
    label: `${word} sixteenths`, familyIds: familyIdsByCount(counts), chainPrimaryGroups: true,
  })),
];

function createSpanStudy(study, pdfSettings) {
  return {
    group: { id: study.groupId, title: study.title, rhythmSpan: study.rhythmSpan },
    sections: createSpanSections(study.groupId, pdfSettings, study.familyIds, study.label, {
      ...study,
      densities: isLongerThanTwoQuarters(study.rhythmSpan) ? CONDENSED_SPAN_DENSITIES : SPAN_DENSITIES,
    })
      .map((section) => ({ ...section, rhythmSpan: study.rhythmSpan })),
  };
}

function createTwoBeatSections(groupId, pdfSettings) {
  return createSpanSections(groupId, pdfSettings, TWO_BEAT_FAMILY_IDS, "two beats");
}

function createThreeEighthsSections(groupId, pdfSettings) {
  return createSpanSections(groupId, pdfSettings, THREE_EIGHTHS_FAMILY_IDS, "three eighths");
}

function createSpanSections(groupId, pdfSettings, familyIds, spanLabel, {
  chainPrimaryGroups = false, densities = SPAN_DENSITIES,
} = {}) {
  return familyIds.map((familyId) => {
    const family = STUDY_FAMILIES.find((candidate) => candidate.id === familyId);
    const id = `${groupId}-${family.id}`;
    return {
      id, groupId, title: `${family.notesPerQuarter} over ${spanLabel}`,
      studyFamily: family.id, density: "mixed",
      primaryRhythms: normalizeRhythmPool(family, false),
      secondaryRhythms: normalizeRhythmPool(ONE_BEAT_SECONDARY_RHYTHMS),
      pdfSettings,
      pages: densities.map((density) => ({
        subsectionId: `${id}-${density.id}`,
        title: density.title,
        pdfSettings,
        generationSettings: {
          prompt: "", sampleJson: "",
          ornaments: [...new Set(TWO_BEAT_ORNAMENT_SEGMENTS.flatMap((segment) => segment.ornaments))],
          ornamentSegments: TWO_BEAT_ORNAMENT_SEGMENTS,
          secondaryRhythmRows: SECONDARY_RHYTHM_ROWS,
          ...(chainPrimaryGroups ? { chainPrimaryGroups: true } : {}),
          ...(density.fullPrimaryGroupShare != null ? { fullPrimaryGroupShare: density.fullPrimaryGroupShare } : {}),
          minPlayedNotes: 0,
          maxPlayedNotes: 0,
          playEveryNote: density.playEveryNote,
          maxSameHandStickingRun: 2,
          requiredSameHandStickingRuns: [],
          stickingTail: null,
        },
        lines: [],
      })),
    };
  });
}

// Combined-subdivision studies close the book. Each page draws every exercise at
// random from a pool of rhythms, and each section adds one rhythm to the pool.
// No rhythm is required; within a page the ornaments grow from none to everything.
const COMBINED_ORNAMENT_SEGMENTS = [
  { ...STUDY_TOPICS[0], count: 2 },
  { ...STUDY_TOPICS[1], count: 2 },
  ...STUDY_TOPICS.slice(2).map((topic) => ({ ...topic, count: 3 })),
].map(({ title, ornaments, count }) => ({ title, ornaments, count }));

// Rhythms in printed form (the pool is generated over one quarter note, so
// longer groupings keep their own note values).
const POOL_RHYTHMS = {
  eighths: { name: "eighths", pool: { subdivisions: ["eighths"] } },
  triplets: { name: "triplets", pool: { tuplets: [{ actual: 3, normal: 2, type: 8 }] } },
  sixteenths: { name: "sixteenths", pool: { subdivisions: ["sixteenths"] } },
  sextuplets: { name: "sextuplets", pool: { tuplets: [{ actual: 6, normal: 4, type: 16 }] } },
  thirtyseconds: { name: "32nds", pool: { subdivisions: ["thirtyseconds"] } },
  quintuplets: { name: "quintuplets", pool: { tuplets: [{ actual: 5, normal: 4, type: 16 }] } },
  septuplets: { name: "septuplets", pool: { tuplets: [{ actual: 7, normal: 4, type: 16 }] } },
  nontuplets: { name: "nontuplets", pool: { tuplets: [{ actual: 9, normal: 8, type: 32 }] } },
  quarterTriplets: { name: "quarter-note triplets", pool: { tuplets: [{ actual: 3, normal: 2, type: 4 }] } },
  fiveOverTwo: { name: "5 over two beats", pool: { tuplets: [{ actual: 5, normal: 4, type: 8 }] } },
  sevenOverTwo: { name: "7 over two beats", pool: { tuplets: [{ actual: 7, normal: 4, type: 8 }] } },
  nineOverTwo: { name: "9 over two beats", pool: { tuplets: [{ actual: 9, normal: 8, type: 16 }] } },
  fourOverThree: { name: "4 over three eighths", pool: { tuplets: [{ actual: 4, normal: 3, type: 8 }] } },
  fiveOverThree: { name: "5 over three eighths", pool: { tuplets: [{ actual: 5, normal: 3, type: 8 }] } },
  sevenOverThree: { name: "7 over three eighths", pool: { tuplets: [{ actual: 7, normal: 6, type: 16 }] } },
  eightOverThree: { name: "8 over three eighths", pool: { tuplets: [{ actual: 8, normal: 6, type: 16 }] } },
};
const ONE_BEAT_KEYS = ["triplets", "sixteenths", "sextuplets", "thirtyseconds", "quintuplets", "septuplets", "nontuplets"];
const TWO_QUARTER_KEYS = ["quarterTriplets", "fiveOverTwo", "sevenOverTwo", "nineOverTwo"];
const THREE_EIGHTH_KEYS = ["fourOverThree", "fiveOverThree", "sevenOverThree", "eightOverThree"];
// Each group's pools, one per section; every pool adds one rhythm to the last.
const COMBINED_GROUPS = [
  {
    id: "combined-one-beat", title: "Combined subdivisions",
    pools: [["eighths", "triplets"], ...ONE_BEAT_KEYS.slice(1).map((_, index) => ONE_BEAT_KEYS.slice(0, index + 2))],
  },
  {
    id: "combined-two-quarters", title: "Combined subdivisions with two-quarter groupings",
    pools: TWO_QUARTER_KEYS.map((_, index) => [...ONE_BEAT_KEYS, ...TWO_QUARTER_KEYS.slice(0, index + 1)]),
  },
  {
    id: "combined-three-eighths", title: "Combined subdivisions with three-eighth groupings",
    pools: THREE_EIGHTH_KEYS.map((_, index) => [...ONE_BEAT_KEYS, ...TWO_QUARTER_KEYS, ...THREE_EIGHTH_KEYS.slice(0, index + 1)]),
  },
].map((group) => ({ ...group, rhythmSpan: { count: 1, unit: 4 } }));

const capitalize = (text) => `${text[0].toUpperCase()}${text.slice(1)}`;

function mergePools(pools) {
  return {
    subdivisions: [...new Set(pools.flatMap((pool) => pool.subdivisions || []))],
    tuplets: pools.flatMap((pool) => pool.tuplets || []),
  };
}

function createCombinedStudies(pdfSettings) {
  const sections = COMBINED_GROUPS.flatMap((group) => group.pools.map((keys, index) => {
    const id = `${group.id}-${index + 1}`;
    const names = keys.map((key) => POOL_RHYTHMS[key].name);
    // The first pools are named in full; later ones by the rhythm they add.
    const title = group.id === "combined-one-beat" && index < 2
      ? capitalize(`${names[0]} and ${names[1]}`)
      : `+ ${capitalize(names.at(-1))}`;
    const pool = mergePools(keys.map((key) => POOL_RHYTHMS[key].pool));
    return {
      id, groupId: group.id, title, density: "mixed",
      rhythmSpan: group.rhythmSpan,
      primaryRhythms: normalizeRhythmPool(pool, false),
      secondaryRhythms: normalizeRhythmPool({ ...pool, rhythmOrnaments: ONE_BEAT_SECONDARY_RHYTHMS.rhythmOrnaments }),
      pdfSettings,
      pages: [{
        subsectionId: `${id}-mixed`,
        title: "Nothing to everything",
        pdfSettings,
        generationSettings: {
          prompt: "", sampleJson: "",
          ornaments: [...new Set(COMBINED_ORNAMENT_SEGMENTS.flatMap((segment) => segment.ornaments))],
          ornamentSegments: COMBINED_ORNAMENT_SEGMENTS,
          requirePrimaryRhythms: false,
          fullPrimaryGroupShare: 0.5,
          minPlayedNotes: 0,
          maxPlayedNotes: 0,
          playEveryNote: false,
          maxSameHandStickingRun: 2,
          requiredSameHandStickingRuns: [],
          stickingTail: null,
        },
        lines: [],
      }],
    };
  }));
  return { groups: COMBINED_GROUPS.map(({ id, title, rhythmSpan }) => ({ id, title, rhythmSpan })), sections };
}

module.exports = {
  STUDY_TOPICS, STUDY_FAMILIES, TWO_BEAT_ORNAMENT_SEGMENTS, COMBINED_GROUPS,
  SPAN_STUDIES, createStudySections, createSpanStudy, createTwoBeatSections, createThreeEighthsSections,
  createCombinedStudies,
};
