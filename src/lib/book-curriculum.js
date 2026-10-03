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
    sections: createSpanSections(study.groupId, pdfSettings, study.familyIds, study.label, study)
      .map((section) => ({ ...section, rhythmSpan: study.rhythmSpan })),
  };
}

function createTwoBeatSections(groupId, pdfSettings) {
  return createSpanSections(groupId, pdfSettings, TWO_BEAT_FAMILY_IDS, "two beats");
}

function createThreeEighthsSections(groupId, pdfSettings) {
  return createSpanSections(groupId, pdfSettings, THREE_EIGHTHS_FAMILY_IDS, "three eighths");
}

function createSpanSections(groupId, pdfSettings, familyIds, spanLabel, { chainPrimaryGroups = false } = {}) {
  return familyIds.map((familyId) => {
    const family = STUDY_FAMILIES.find((candidate) => candidate.id === familyId);
    const id = `${groupId}-${family.id}`;
    return {
      id, groupId, title: `${family.notesPerQuarter} over ${spanLabel}`,
      studyFamily: family.id, density: "mixed",
      primaryRhythms: normalizeRhythmPool(family, false),
      secondaryRhythms: normalizeRhythmPool(ONE_BEAT_SECONDARY_RHYTHMS),
      pdfSettings,
      pages: SPAN_DENSITIES.map((density) => ({
        subsectionId: `${id}-${density.id}`,
        title: density.title,
        pdfSettings,
        generationSettings: {
          prompt: "", sampleJson: "",
          ornaments: [...new Set(TWO_BEAT_ORNAMENT_SEGMENTS.flatMap((segment) => segment.ornaments))],
          ornamentSegments: TWO_BEAT_ORNAMENT_SEGMENTS,
          secondaryRhythmRows: SECONDARY_RHYTHM_ROWS,
          ...(chainPrimaryGroups ? { chainPrimaryGroups: true } : {}),
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

module.exports = {
  STUDY_TOPICS, STUDY_FAMILIES, TWO_BEAT_ORNAMENT_SEGMENTS,
  SPAN_STUDIES, createStudySections, createSpanStudy, createTwoBeatSections, createThreeEighthsSections,
};
