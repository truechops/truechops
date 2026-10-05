// Exercise generator configurations, shared by the website tool, its API, and
// the book's QR pages. A configuration is the subset of a book page's
// generation settings that the tool exposes, plus a name.
const {
  normalizeRhythmPool, normalizeRhythmSpan, rhythmSpanLabel, rhythmOrnamentKey, getSpanPrimaryRhythms, getNestedTupletVariants, nestedTupletLabel,
} = require("./book-structure");
const { STUDY_FAMILIES } = require("./book-curriculum");

const MAX_GENERATED_MEASURES = 16;
const ORNAMENT_IDS = ["stickings", "accents", "flams", "diddles", "cheese"];

// The primary subdivision is a one-beat rhythm; its span stretches it.
const SUBDIVISION_LABELS = {
  sixteenths: "Sixteenths", "eighth-triplets": "Triplets", quintuplets: "Quintuplets", sextuplets: "Sextuplets",
  septuplets: "Septuplets", thirtyseconds: "32nds", "nine-eight-thirtyseconds": "Nontuplets (9s)",
};
const SUBDIVISION_CHOICES = [
  { id: "eighths", label: "Eighths", notesPerQuarter: 2, pool: { subdivisions: ["eighths"], tuplets: [] } },
  ...STUDY_FAMILIES.map((family) => ({
    id: family.id,
    label: SUBDIVISION_LABELS[family.id] || family.title,
    notesPerQuarter: family.notesPerQuarter,
    pool: { subdivisions: family.subdivisions || [], tuplets: family.tuplets || [] },
  })),
].sort((left, right) => left.notesPerQuarter - right.notesPerQuarter);

const SPAN_CHOICES = [
  { count: 1, unit: 4 }, { count: 3, unit: 16 }, { count: 5, unit: 16 }, { count: 3, unit: 8 },
  { count: 7, unit: 16 }, { count: 2, unit: 4 }, { count: 9, unit: 16 }, { count: 5, unit: 8 },
  { count: 11, unit: 16 }, { count: 3, unit: 4 }, { count: 13, unit: 16 }, { count: 7, unit: 8 },
  { count: 15, unit: 16 }, { count: 4, unit: 4 },
].map((span) => ({ ...span, id: `${span.count}/${span.unit}`, label: `Over ${rhythmSpanLabel(span)}` }));

// One-beat rhythms that can fill the space around the primary rhythm.
const SECONDARY_CHOICES = [
  "eighths", "sixteenths", "thirtyseconds",
  ...STUDY_FAMILIES.flatMap((family) => family.tuplets || []),
];

const DEFAULT_RHYTHM_ORNAMENTS = {
  sixteenths: ["accents", "flams", "diddles", "cheese"],
  "3:2:8": ["accents", "flams", "diddles", "cheese"],
  "5:4:16": ["accents", "flams", "diddles", "cheese"],
  "6:4:16": ["flams"],
};

function getSubdivisionChoice(primaryRhythms) {
  const pool = normalizeRhythmPool(primaryRhythms, false);
  const key = JSON.stringify([pool.subdivisions, pool.tuplets]);
  return SUBDIVISION_CHOICES.find((choice) => {
    const candidate = normalizeRhythmPool(choice.pool, false);
    return JSON.stringify([candidate.subdivisions, candidate.tuplets]) === key;
  }) || null;
}

// Nested tuplets the configuration's subdivision can host (none for plain
// notes), each with its label, e.g. "5 over 2 notes (5:4 sixteenths)".
function getConfigNestedVariants(config) {
  const host = getSpanPrimaryRhythms(normalizeRhythmPool(config.primaryRhythms, false), normalizeRhythmSpan(config.rhythmSpan)).tuplets[0];
  return host ? getNestedTupletVariants(host).map((variant) => ({ ...variant, label: nestedTupletLabel(variant, host) })) : [];
}

// "cycle" walks through every variant, one per measure; { actual, hostNotes }
// nests the same variant in every measure; null turns nesting off.
function normalizeNestedSetting(value, config) {
  if (!value) return null;
  const variants = getConfigNestedVariants(config);
  if (!variants.length) return null;
  if (value === "cycle") return "cycle";
  const match = variants.find((variant) => variant.actual === Number(value.actual) && variant.hostNotes === Number(value.hostNotes));
  return match ? { actual: match.actual, hostNotes: match.hostNotes } : null;
}

function clampNumber(value, minimum, maximum, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback;
}

function normalizeExerciseConfig(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const choice = SUBDIVISION_CHOICES.find((candidate) => candidate.id === source.subdivision) ||
    (source.primaryRhythms ? getSubdivisionChoice(source.primaryRhythms) : null) ||
    SUBDIVISION_CHOICES.find((candidate) => candidate.id === "sixteenths");
  const secondary = normalizeRhythmPool({ ...(source.secondaryRhythms || {}), rhythmOrnaments: source.secondaryRhythms?.rhythmOrnaments || DEFAULT_RHYTHM_ORNAMENTS });
  const playEveryNote = Boolean(source.playEveryNote);
  const share = source.fullPrimaryGroupShare;
  const rhythmSpan = normalizeRhythmSpan(source.rhythmSpan);
  const primaryRhythms = normalizeRhythmPool(choice.pool, false);
  return {
    ...(source.id ? { id: String(source.id) } : {}),
    name: String(source.name || "").slice(0, 80) || "Untitled configuration",
    ...(source.sourcePage ? { sourcePage: { page: Number(source.sourcePage.page), title: String(source.sourcePage.title || "") } } : {}),
    subdivision: choice.id,
    rhythmSpan,
    primaryRhythms,
    nestedTuplets: normalizeNestedSetting(source.nestedTuplets, { primaryRhythms, rhythmSpan }),
    secondaryRhythms: secondary,
    ornaments: ORNAMENT_IDS.filter((id) => (source.ornaments || []).includes(id)),
    playEveryNote,
    fullPrimaryGroupShare: playEveryNote || share == null || share === "" ? null : clampNumber(share, 0, 1, null),
    minPlayedNotes: playEveryNote ? 0 : clampNumber(source.minPlayedNotes, 0, 64, 0),
    maxPlayedNotes: playEveryNote ? 0 : clampNumber(source.maxPlayedNotes, 0, 64, 0),
    maxSameHandStickingRun: clampNumber(source.maxSameHandStickingRun, 1, 8, 2),
    chainPrimaryGroups: Boolean(source.chainPrimaryGroups),
    tempo: clampNumber(source.tempo, 30, 300, 80),
  };
}

const DEFAULT_EXERCISE_CONFIG = normalizeExerciseConfig({
  name: "Sixteenths with accents and stickings",
  subdivision: "sixteenths",
  ornaments: ["stickings", "accents"],
});

// The configuration a book page was generated with. The page's ornament topics
// become one set (every topic's ornaments), and its secondary rhythms are the
// ones the page eventually uses.
function exerciseConfigFromBookPage(page, pageRef = {}) {
  const settings = page?.generationSettings || {};
  const segments = Array.isArray(settings.ornamentSegments) ? settings.ornamentSegments : null;
  const rows = settings.secondaryRhythmRows;
  const secondary = normalizeRhythmPool(settings.secondaryRhythms);
  const used = (rhythm) => !rows || rows[rhythmOrnamentKey(rhythm)] != null;
  return normalizeExerciseConfig({
    name: `Page ${pageRef.page || page?.pageNumber}: ${page?.sectionTitle || ""} · ${page?.title || ""}`.trim(),
    sourcePage: { page: pageRef.page || page?.pageNumber, title: `${page?.sectionTitle || ""} · ${page?.title || ""}` },
    primaryRhythms: settings.primaryRhythms,
    rhythmSpan: settings.rhythmSpan,
    secondaryRhythms: {
      ...secondary,
      subdivisions: secondary.subdivisions.filter(used),
      tuplets: secondary.tuplets.filter(used),
    },
    ornaments: segments ? [...new Set(segments.flatMap((segment) => segment.ornaments))] : settings.ornaments,
    playEveryNote: settings.playEveryNote,
    fullPrimaryGroupShare: settings.fullPrimaryGroupShare,
    minPlayedNotes: settings.minPlayedNotes,
    maxPlayedNotes: settings.maxPlayedNotes,
    maxSameHandStickingRun: settings.maxSameHandStickingRun,
    chainPrimaryGroups: settings.chainPrimaryGroups,
    nestedTuplets: Array.isArray(settings.nestedTupletPlan) ? "cycle" : null,
  });
}

// The page's ornament topics, offered as quick picks in the editor.
function getBookPageOrnamentTopics(page) {
  const segments = page?.generationSettings?.ornamentSegments;
  return Array.isArray(segments)
    ? segments.map((segment) => ({ title: segment.title || segment.ornaments.join(", "), ornaments: segment.ornaments }))
    : [];
}

module.exports = {
  MAX_GENERATED_MEASURES, ORNAMENT_IDS, SUBDIVISION_CHOICES, SPAN_CHOICES, SECONDARY_CHOICES,
  DEFAULT_EXERCISE_CONFIG, normalizeExerciseConfig, exerciseConfigFromBookPage, getBookPageOrnamentTopics,
  getConfigNestedVariants,
};
