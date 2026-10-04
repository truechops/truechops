const { normalizeRhythmPool, getSpanPrimaryRhythms, rhythmOrnamentKey } = require("./book-structure");

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

// Ornaments for the combination and random-subdivision pages: each exercise
// picks 2-4 at random, never repeating the previous exercise's set.
const RANDOM_ORNAMENTS = { from: ["stickings", "accents", "flams", "diddles", "cheese"], min: 2, max: 4 };

// One-beat rhythms in printed form. The pool is generated over one quarter note,
// so longer groupings are listed as they print and keep their own note values.
const POOL_RHYTHMS = {
  eighths: { name: "eighths", pool: { subdivisions: ["eighths"] } },
  triplets: { name: "triplets", pool: { tuplets: [{ actual: 3, normal: 2, type: 8 }] } },
  sixteenths: { name: "sixteenths", pool: { subdivisions: ["sixteenths"] } },
  sextuplets: { name: "sextuplets", pool: { tuplets: [{ actual: 6, normal: 4, type: 16 }] } },
  thirtyseconds: { name: "32nds", pool: { subdivisions: ["thirtyseconds"] } },
  quintuplets: { name: "quintuplets", pool: { tuplets: [{ actual: 5, normal: 4, type: 16 }] } },
  septuplets: { name: "septuplets", pool: { tuplets: [{ actual: 7, normal: 4, type: 16 }] } },
  nontuplets: { name: "nontuplets", pool: { tuplets: [{ actual: 9, normal: 8, type: 32 }] } },
};
const ONE_BEAT_KEYS = ["triplets", "sixteenths", "sextuplets", "thirtyseconds", "quintuplets", "septuplets", "nontuplets"];

// Every span grouping in the book, in book order, each added to the pool in turn.
const SPAN_POOL_STEPS = SPAN_STUDIES.map((study) => ({
  study,
  rhythms: study.familyIds.map((familyId) => {
    const family = STUDY_FAMILIES.find((candidate) => candidate.id === familyId);
    return {
      name: `${family.notesPerQuarter} over ${study.label}`,
      pool: getSpanPrimaryRhythms(normalizeRhythmPool(family, false), study.rhythmSpan),
    };
  }),
}));

// Groups fit in a quarter note or less with 7-9 notes take only stickings, and
// sextuplets only flams; everything else takes the exercise's ornaments.
function getPoolOrnamentLimits(pool) {
  const notesPerQuarter = { eighths: 2, sixteenths: 4, thirtyseconds: 8 };
  const limits = {};
  for (const id of pool.subdivisions) {
    if (notesPerQuarter[id] >= 7) limits[id] = [];
  }
  for (const tuplet of pool.tuplets) {
    const quarters = tuplet.normal * 4 / tuplet.type;
    if (quarters > 1) continue;
    if (tuplet.actual >= 7 && tuplet.actual <= 9) limits[rhythmOrnamentKey(tuplet)] = [];
    else if (tuplet.actual === 6) limits[rhythmOrnamentKey(tuplet)] = ["flams"];
  }
  return limits;
}

const capitalize = (text) => `${text[0].toUpperCase()}${text.slice(1)}`;

function mergePools(pools) {
  return {
    subdivisions: [...new Set(pools.flatMap((pool) => pool.subdivisions || []))],
    tuplets: pools.flatMap((pool) => pool.tuplets || []),
  };
}

// Tuplet combinations: for each tuplet in the book, two pages where every
// exercise contains that tuplet and the rest of the measure draws from basic
// one-beat subdivisions in a pool that grows down the pages.
const BASIC_SUBDIVISIONS = [
  { key: "triplets", familyId: "eighth-triplets" },
  { key: "sixteenths", familyId: "sixteenths" },
  { key: "sextuplets", familyId: "sextuplets" },
  { key: "thirtyseconds", familyId: "thirtyseconds" },
  { key: "quintuplets", familyId: "quintuplets" },
  { key: "septuplets", familyId: "septuplets" },
  { key: "nontuplets", familyId: "nine-eight-thirtyseconds" },
];
const COMBINATION_PAGES = 2;
const COMBINATION_ROWS = 11 * COMBINATION_PAGES;

function createCombinationSection({ groupId, id, title, rhythmSpan, familyId, stages, chainPrimaryGroups }, pdfSettings) {
  const family = STUDY_FAMILIES.find((candidate) => candidate.id === familyId);
  const primaryRhythms = normalizeRhythmPool(family, false);
  // Each stage adds one subdivision to the pool, at evenly spaced rows. A
  // grouping that ends mid-beat needs sixteenths from the start to finish its beat.
  const endsMidBeat = (rhythmSpan.count * 32 / rhythmSpan.unit) % 8 !== 0;
  if (endsMidBeat && stages.includes("sixteenths")) {
    stages = [stages[0], "sixteenths", ...stages.slice(1).filter((key) => key !== "sixteenths")];
  }
  const secondaryRhythmRows = {};
  stages.forEach((key, index) => {
    for (const rhythm of [...(POOL_RHYTHMS[key].pool.subdivisions || []), ...(POOL_RHYTHMS[key].pool.tuplets || [])]) {
      secondaryRhythmRows[rhythmOrnamentKey(rhythm)] = endsMidBeat && key === "sixteenths"
        ? 1
        : Math.floor(index * COMBINATION_ROWS / stages.length) + 1;
    }
  });
  const limits = getPoolOrnamentLimits(getSpanPrimaryRhythms(primaryRhythms, rhythmSpan));
  return {
    id, groupId, title, density: "mixed", rhythmSpan,
    primaryRhythms,
    secondaryRhythms: normalizeRhythmPool({
      ...mergePools(stages.map((key) => POOL_RHYTHMS[key].pool)),
      rhythmOrnaments: ONE_BEAT_SECONDARY_RHYTHMS.rhythmOrnaments,
    }),
    pdfSettings,
    pages: Array.from({ length: COMBINATION_PAGES }, () => ({
      subsectionId: `${id}-combinations`,
      subsectionPageCount: COMBINATION_PAGES,
      title: "Growing subdivision pool",
      pdfSettings,
      generationSettings: {
        prompt: "", sampleJson: "",
        ornaments: RANDOM_ORNAMENTS.from,
        randomOrnaments: RANDOM_ORNAMENTS,
        secondaryRhythmRows,
        // Each exercise includes the most recently added subdivision.
        requireNewestSecondary: true,
        ...(Object.keys(limits).length ? { primaryRhythmOrnaments: limits } : {}),
        ...(chainPrimaryGroups ? { chainPrimaryGroups: true } : {}),
        fullPrimaryGroupShare: 0.5,
        minPlayedNotes: 0,
        maxPlayedNotes: 0,
        playEveryNote: false,
        maxSameHandStickingRun: 2,
        requiredSameHandStickingRuns: [],
        stickingTail: null,
      },
      lines: [],
    })),
  };
}

function createTupletCombinationStudies(pdfSettings) {
  const oneBeat = { id: "combinations-one-quarter", title: "Tuplet combinations over one quarter note", rhythmSpan: { count: 1, unit: 4 } };
  const groups = [oneBeat, ...SPAN_STUDIES.map((study) => ({
    id: `combinations-${study.groupId}`,
    title: `Tuplet combinations ${study.title.toLowerCase()}`,
    rhythmSpan: study.rhythmSpan,
  }))];
  const sections = [
    // Over a quarter note, the section's own subdivision leaves the pool.
    ...BASIC_SUBDIVISIONS.map(({ key, familyId }) => createCombinationSection({
      groupId: oneBeat.id, id: `${oneBeat.id}-${key}`, title: capitalize(POOL_RHYTHMS[key].name),
      rhythmSpan: oneBeat.rhythmSpan, familyId,
      stages: BASIC_SUBDIVISIONS.map((basic) => basic.key).filter((stage) => stage !== key),
    }, pdfSettings)),
    ...SPAN_STUDIES.flatMap((study, studyIndex) => study.familyIds.map((familyId) => {
      const family = STUDY_FAMILIES.find((candidate) => candidate.id === familyId);
      return createCombinationSection({
        groupId: groups[studyIndex + 1].id, id: `${groups[studyIndex + 1].id}-${family.notesPerQuarter}`,
        title: `${family.notesPerQuarter} over ${study.label}`, rhythmSpan: study.rhythmSpan, familyId,
        stages: BASIC_SUBDIVISIONS.map((basic) => basic.key), chainPrimaryGroups: study.chainPrimaryGroups,
      }, pdfSettings);
    })),
  ];
  return { groups, sections };
}

// The book's last section: for each span category, three pages where every
// exercise has at least one grouping from that category (sometimes more, in
// different spots) and the rest is drawn from a pool that adds the other
// categories one at a time down the pages.
const FINAL_CATEGORY_ORDER = [
  "one-quarter", "two-quarters", "three-eighths", "three-quarters", "five-eighths", "four-quarters", "seven-eighths",
  "three-sixteenths", "five-sixteenths", "seven-sixteenths", "nine-sixteenths", "eleven-sixteenths",
  "thirteen-sixteenths", "fifteen-sixteenths",
];
const FINAL_PAGES = 3;
const FINAL_ROWS = 11 * FINAL_PAGES;
const SECONDARY_ORNAMENTS = ["accents", "flams", "diddles", "cheese"];

function getFinalCategories() {
  const categories = [
    { id: "one-quarter", title: "Over one quarter note", pools: ONE_BEAT_KEYS.map((key) => POOL_RHYTHMS[key].pool) },
    ...SPAN_POOL_STEPS.map(({ study, rhythms }) => ({ id: study.groupId, title: study.title, pools: rhythms.map((rhythm) => rhythm.pool) })),
  ];
  return FINAL_CATEGORY_ORDER.map((id) => categories.find((category) => category.id === id));
}

// Secondary ornaments: the one-beat rules, and every ornament on longer
// groupings unless they are fast groups (7-9 notes, or 6, in a quarter or less).
function getSecondaryRhythmOrnaments(pool) {
  const limits = getPoolOrnamentLimits(pool);
  const keys = [...pool.subdivisions, ...pool.tuplets].map(rhythmOrnamentKey);
  return Object.fromEntries(keys.map((key) => [key,
    ONE_BEAT_SECONDARY_RHYTHMS.rhythmOrnaments[key] || limits[key] || (key in limits ? [] : SECONDARY_ORNAMENTS)]));
}

function createFinalStudies(pdfSettings) {
  const group = { id: "random-subdivisions", title: "Random subdivisions and ornaments", rhythmSpan: { count: 1, unit: 4 } };
  const categories = getFinalCategories();
  const sections = categories.map((category) => {
    const id = `${group.id}-${category.id}`;
    const others = categories.filter((other) => other.id !== category.id);
    const primaryRhythms = normalizeRhythmPool(mergePools(category.pools), false);
    const secondaryPool = normalizeRhythmPool(mergePools(others.flatMap((other) => other.pools)));
    const secondaryRhythmRows = {};
    others.forEach((other, index) => {
      for (const pool of other.pools) {
        for (const rhythm of [...(pool.subdivisions || []), ...(pool.tuplets || [])]) {
          secondaryRhythmRows[rhythmOrnamentKey(rhythm)] = Math.floor(index * FINAL_ROWS / others.length) + 1;
        }
      }
    });
    const limits = getPoolOrnamentLimits(primaryRhythms);
    return {
      id, groupId: group.id, title: category.title, density: "mixed", rhythmSpan: group.rhythmSpan,
      primaryRhythms,
      secondaryRhythms: normalizeRhythmPool({ ...secondaryPool, rhythmOrnaments: getSecondaryRhythmOrnaments(secondaryPool) }),
      pdfSettings,
      pages: Array.from({ length: FINAL_PAGES }, () => ({
        subsectionId: `${id}-random`,
        subsectionPageCount: FINAL_PAGES,
        title: "Random subdivisions",
        pdfSettings,
        generationSettings: {
          prompt: "", sampleJson: "",
          ornaments: RANDOM_ORNAMENTS.from,
          randomOrnaments: RANDOM_ORNAMENTS,
          requirePrimaryRhythms: "any",
          secondaryRhythmRows,
          ...(Object.keys(limits).length ? { primaryRhythmOrnaments: limits } : {}),
          fullPrimaryGroupShare: 0.5,
          minPlayedNotes: 0,
          maxPlayedNotes: 0,
          playEveryNote: false,
          maxSameHandStickingRun: 2,
          requiredSameHandStickingRuns: [],
          stickingTail: null,
        },
        lines: [],
      })),
    };
  });
  return { groups: [group], sections };
}

module.exports = {
  STUDY_TOPICS, STUDY_FAMILIES, TWO_BEAT_ORNAMENT_SEGMENTS,
  SPAN_STUDIES, createStudySections, createSpanStudy, createTwoBeatSections, createThreeEighthsSections,
  createTupletCombinationStudies, createFinalStudies,
};
