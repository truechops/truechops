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

// Over-two-beat studies put every ornament topic on one page to keep the book short.
const TWO_BEAT_FAMILY_IDS = ["eighth-triplets", "quintuplets", "septuplets", "nine-eight-thirtyseconds"];
const TWO_BEAT_ORNAMENT_SEGMENTS = [
  { ...STUDY_TOPICS[1], count: 4 },
  ...STUDY_TOPICS.slice(2).map((topic) => ({ ...topic, count: 3 })),
].map(({ title, ornaments, count }) => ({ title, ornaments, count }));
const familyTuplets = (...ids) => STUDY_FAMILIES
  .filter((family) => ids.includes(family.id)).flatMap((family) => family.tuplets || []);
// Secondary ornaments only on triplets, sixteenths, and quintuplets; never on
// eighths or on sextuplets and faster.
const ONE_BEAT_SECONDARY_RHYTHMS = {
  subdivisions: ["eighths", "sixteenths", "thirtyseconds"],
  tuplets: STUDY_FAMILIES.flatMap((family) => family.tuplets || []),
  ornaments: ["stickings", "accents", "flams", "diddles", "cheese"],
  ornamentRhythms: { subdivisions: ["sixteenths"], tuplets: familyTuplets("eighth-triplets", "quintuplets") },
};

// The first five printed rows use only triplet and sixteenth secondaries.
const SECONDARY_RHYTHM_INTRO = {
  count: 5, unit: "staffRows", subdivisions: ["sixteenths"], tuplets: familyTuplets("eighth-triplets"),
};

// Over three eighths, only the counts that are new rhythms: 4:3 and 5:3 eighths, 7:6 and 8:6 sixteenths.
const THREE_EIGHTHS_FAMILY_IDS = ["sixteenths", "quintuplets", "septuplets", "thirtyseconds"];

function createTwoBeatSections(groupId, pdfSettings) {
  return createSpanSections(groupId, pdfSettings, TWO_BEAT_FAMILY_IDS, "two beats");
}

function createThreeEighthsSections(groupId, pdfSettings) {
  return createSpanSections(groupId, pdfSettings, THREE_EIGHTHS_FAMILY_IDS, "three eighths");
}

function createSpanSections(groupId, pdfSettings, familyIds, spanLabel) {
  return familyIds.map((familyId) => {
    const family = STUDY_FAMILIES.find((candidate) => candidate.id === familyId);
    const id = `${groupId}-${family.id}`;
    return {
      id, groupId, title: `${family.notesPerQuarter} over ${spanLabel}`,
      studyFamily: family.id, density: "mixed",
      primaryRhythms: normalizeRhythmPool(family, false),
      secondaryRhythms: normalizeRhythmPool(ONE_BEAT_SECONDARY_RHYTHMS),
      pdfSettings,
      pages: [{
        subsectionId: `${id}-all-ornaments`,
        title: "All ornaments",
        pdfSettings,
        generationSettings: {
          prompt: "", sampleJson: "",
          ornaments: [...new Set(TWO_BEAT_ORNAMENT_SEGMENTS.flatMap((segment) => segment.ornaments))],
          ornamentSegments: TWO_BEAT_ORNAMENT_SEGMENTS,
          secondaryRhythmIntro: SECONDARY_RHYTHM_INTRO,
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
  });
}

module.exports = {
  STUDY_TOPICS, STUDY_FAMILIES, TWO_BEAT_ORNAMENT_SEGMENTS,
  createStudySections, createTwoBeatSections, createThreeEighthsSections,
};
