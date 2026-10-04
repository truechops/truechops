#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const { BOOK_STRUCTURE_VERSION, migrateBookStructure, normalizeRhythmPool, createStructureTableOfContents, normalizeRhythmSpan, normalizeStickingTail, getLineStickingSettings, getSpanPrimaryRhythms, normalizeOrnamentSegments, getLineOrnamentSegment, normalizeSecondaryRhythmRows, getLineSecondaryRhythms, rhythmOrnamentKey, normalizeRandomOrnaments, getLineRandomOrnaments } = require("../src/lib/book-structure");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DEFAULT_CONFIG_PATH = path.join(
  PROJECT_ROOT,
  "data",
  "book-builder",
  "snare-drum-book",
  "book-generation.json"
);
const DEFAULT_BOOK_PATH = path.join(
  PROJECT_ROOT,
  "data",
  "book-builder",
  "snare-drum-book",
  "book.json"
);

const DEFAULT_PDF_SETTINGS = {
  measuresPerLine: 2,
  lineSpacing: 130,
  noteSize: 100,
};
const DEFAULT_GLOBAL_ORNAMENT_DENSITY = 100;
const PDF_PAGE_WIDTH = 612;
const PDF_PAGE_HEIGHT = 792;
const PDF_PAGE_MARGIN = 28;
const PDF_PAGE_FOOTER_HEIGHT = 38;
const SCORE_RENDER_BASE_WIDTH = 1100;
const SCORE_RENDER_ROOT_PADDING = 50;

const NUMBER_WORDS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};
const SUBDIVISION_SETTINGS = [
  { id: "eighths", label: "eighth notes", duration: 8 },
  { id: "sixteenths", label: "sixteenth notes", duration: 16 },
  { id: "thirtyseconds", label: "thirty-second notes", duration: 32 },
];
const TUPLET_TYPE_SETTINGS = [
  { id: "half", label: "half", type: 2 },
  { id: "quarter", label: "quarter", type: 4 },
  { id: "eighth", label: "eighth", type: 8 },
  { id: "sixteenth", label: "sixteenth", type: 16 },
  { id: "thirtysecond", label: "thirty-second", type: 32 },
];
const LEGACY_TUPLET_SETTINGS = [
  { id: "eighth-triplets", actual: 3, normal: 2, type: 8 },
  { id: "sixteenth-triplets", actual: 3, normal: 2, type: 16 },
  { id: "sixteenth-quintuplets", actual: 5, normal: 4, type: 16 },
  { id: "sixteenth-septuplets", actual: 7, normal: 4, type: 16 },
];
const ORNAMENT_SETTINGS = [
  { id: "stickings", label: "stickings", chars: "rl" },
  { id: "accents", label: "accents", chars: "a" },
  { id: "flams", label: "flams", chars: "f" },
  { id: "diddles", label: "diddles", chars: "d" },
  { id: "cheese", label: "cheese", chars: "c" },
];
const DEFAULT_MAX_SAME_HAND_STICKING_RUN = 4;
const MAX_UNIQUE_LINE_ATTEMPTS = 250;
const LATE_RETRY_ATTEMPT = 100;
const PRIMARY_CHAIN_PROBABILITY = 0.15;
const BALANCE_RETRY_ATTEMPT = 50;

const args = process.argv.slice(2);

function getArg(name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] || fallback : fallback;
}

function getFlag(name) {
  return args.includes(name);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function getPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getNonNegativeInteger(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeGlobalOrnamentDensity(value, fallback = DEFAULT_GLOBAL_ORNAMENT_DENSITY) {
  return getBoundedNumber(value, fallback, 25, 200, true);
}

function getBoundedNumber(value, fallback, minimum, maximum, integer = false) {
  const parser = integer ? Number.parseInt : Number.parseFloat;
  const parsed = parser(value, 10);
  const safeValue = Number.isFinite(parsed) ? parsed : fallback;
  return Math.min(maximum, Math.max(minimum, safeValue));
}

function normalizePdfSettings(pdfSettings = {}) {
  return {
    measuresPerLine: getBoundedNumber(
      pdfSettings.measuresPerLine,
      DEFAULT_PDF_SETTINGS.measuresPerLine,
      1,
      8,
      true
    ),
    lineSpacing: getBoundedNumber(
      pdfSettings.lineSpacing,
      DEFAULT_PDF_SETTINGS.lineSpacing,
      90,
      240
    ),
    noteSize: getBoundedNumber(
      pdfSettings.noteSize,
      DEFAULT_PDF_SETTINGS.noteSize,
      60,
      160
    ),
  };
}

function getScoreRenderWidth(pdfSettings) {
  const noteScale = normalizePdfSettings(pdfSettings).noteSize / DEFAULT_PDF_SETTINGS.noteSize;
  return ((SCORE_RENDER_BASE_WIDTH + SCORE_RENDER_ROOT_PADDING) / noteScale) - SCORE_RENDER_ROOT_PADDING;
}

function getLinesPerPage(pdfSettings) {
  const normalized = normalizePdfSettings(pdfSettings);
  const scoreRenderWidth = getScoreRenderWidth(normalized);
  const renderedSvgWidth = scoreRenderWidth + SCORE_RENDER_ROOT_PADDING;
  const contentWidth = PDF_PAGE_WIDTH - PDF_PAGE_MARGIN * 2;
  const contentHeight = PDF_PAGE_HEIGHT - PDF_PAGE_MARGIN * 2 - PDF_PAGE_FOOTER_HEIGHT;
  const pdfScale = contentWidth / renderedSvgWidth;
  const systemsPerPage = Math.max(
    1,
    Math.floor(contentHeight / (normalized.lineSpacing * pdfScale))
  );

  return normalized.measuresPerLine * systemsPerPage;
}

function createBlankLine(pageNumber, lineNumber) {
  return {
    pageNumber,
    lineNumber,
    title: "",
    notes: "",
    tempo: 90,
    score: null,
    exerciseShortForm: "",
    updatedAt: null,
  };
}

function createBlankPage(pageNumber, pdfSettings, generationSettings = {}) {
  const normalizedSettings = normalizePdfSettings(pdfSettings);
  const linesPerPage = getLinesPerPage(normalizedSettings);

  return {
    pageNumber,
    title: `Page ${pageNumber}`,
    pdfSettings: normalizedSettings,
    generationSettings,
    lines: Array.from({ length: linesPerPage }, (_, index) =>
      createBlankLine(pageNumber, index + 1)
    ),
  };
}

function createBlankLineScore() {
  return {
    parts: {
      snare: {
        enabled: true,
      },
    },
    measures: [{
      timeSig: {
        num: 4,
        type: 4,
      },
      parts: [{
        instrument: "snare",
        voices: [{
          notes: [
            { notes: [], duration: 4, dots: 0, velocity: 0.5 },
            { notes: [], duration: 4, dots: 0, velocity: 0.5 },
            { notes: [], duration: 4, dots: 0, velocity: 0.5 },
            { notes: [], duration: 4, dots: 0, velocity: 0.5 },
          ],
          tuplets: [],
        }],
      }],
    }],
  };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseJsonLoose(value) {
  if (!value) return null;
  if (typeof value === "object") return value;

  const text = String(value)
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(text);
  } catch {
    const objectStart = text.indexOf("{");
    const objectEnd = text.lastIndexOf("}");
    const arrayStart = text.indexOf("[");
    const arrayEnd = text.lastIndexOf("]");
    const hasObject = objectStart >= 0 && objectEnd > objectStart;
    const hasArray = arrayStart >= 0 && arrayEnd > arrayStart;

    if (!hasObject && !hasArray) return null;

    const jsonText = hasArray && (!hasObject || arrayStart < objectStart)
      ? text.slice(arrayStart, arrayEnd + 1)
      : text.slice(objectStart, objectEnd + 1);

    try {
      return JSON.parse(jsonText);
    } catch {
      return null;
    }
  }
}

function getSamplePayload(section) {
  return parseJsonLoose(section.sampleJson) || {};
}

function normalizeGlobalAiRules(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join("\n");
  }

  return typeof value === "string" ? value.trim() : "";
}

function normalizeInstructionList(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).map(String);
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  return [];
}

function getSampleScore(samplePayload) {
  if (samplePayload && samplePayload.score && samplePayload.score.measures) {
    return samplePayload.score;
  }

  if (samplePayload && samplePayload.measures) {
    return samplePayload;
  }

  return createBlankLineScore();
}

function getSampleNotes(samplePayload) {
  const score = getSampleScore(samplePayload);
  const measure = score.measures && score.measures[0];
  const part = measure && Array.isArray(measure.parts)
    ? measure.parts.find((candidate) => candidate.instrument === "snare") || measure.parts[0]
    : null;
  const voice = part && part.voices && part.voices[0];
  return Array.isArray(voice && voice.notes) ? voice.notes : [];
}

function getSampleTuplets(samplePayload) {
  if (Array.isArray(samplePayload && samplePayload.tuplets)) {
    return samplePayload.tuplets;
  }

  const score = getSampleScore(samplePayload);
  const measure = score.measures && score.measures[0];
  const part = measure && Array.isArray(measure.parts)
    ? measure.parts.find((candidate) => candidate.instrument === "snare") || measure.parts[0]
    : null;
  const voice = part && part.voices && part.voices[0];
  return Array.isArray(voice && voice.tuplets) ? voice.tuplets : [];
}

function normalizeOptionIds(value, settings) {
  const validIds = new Set(settings.map((setting) => setting.id));
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[, ]+/)
      : [];
  const normalized = [];

  for (const item of values) {
    const id = String(item || "").trim().toLowerCase();

    if (validIds.has(id) && !normalized.includes(id)) {
      normalized.push(id);
    }
  }

  return normalized;
}

function getTupletTypeSetting(value) {
  const type = Number(value && value.type);

  return TUPLET_TYPE_SETTINGS.find((setting) => Number(setting.type) === type);
}

function normalizeTupletConfig(value) {
  if (!value || value === "none" || value === false) {
    return null;
  }

  if (typeof value === "string") {
    const setting = LEGACY_TUPLET_SETTINGS.find((candidate) => candidate.id === value);
    return setting
      ? {
          actual: setting.actual,
          normal: setting.normal,
          type: setting.type,
        }
      : null;
  }

  const actual = Number.parseInt(value.actual, 10);
  const normal = Number.parseInt(value.normal, 10);
  const type = Number.parseInt(value.type, 10);

  if (
    !Number.isInteger(actual) ||
    !Number.isInteger(normal) ||
    !Number.isInteger(type) ||
    actual < 2 ||
    actual > 16 ||
    normal < 1 ||
    normal > 16 ||
    normal > type ||
    !TUPLET_TYPE_SETTINGS.some((setting) => setting.type === type)
  ) {
    return null;
  }

  return {
    actual,
    normal,
    type,
  };
}

function getSectionLegacyText(section) {
  return `${section.title || ""}\n${section.instructions || section.prompt || ""}`.toLowerCase();
}

function inferGenerationSubdivisions(section, samplePayload) {
  const text = getSectionLegacyText(section);
  const sampleDurations = new Set(getSampleNotes(samplePayload).map((note) => Number(note.duration)));
  const allowedDurations = Array.isArray(samplePayload && samplePayload.allowedDurations)
    ? samplePayload.allowedDurations.map(Number)
    : [];
  const subdivisions = [];

  if (text.includes("thirtysecond") || text.includes("thirty-second") || sampleDurations.has(32) || allowedDurations.includes(32)) {
    subdivisions.push("thirtyseconds");
  }

  if (text.includes("sixteenth") || sampleDurations.has(16) || allowedDurations.includes(16)) {
    subdivisions.push("sixteenths");
  }

  if (text.includes("eighth") || sampleDurations.has(8) || allowedDurations.includes(8)) {
    subdivisions.push("eighths");
  }

  return subdivisions.length ? subdivisions : ["eighths"];
}

function getGenerationSubdivisions(section, samplePayload = getSamplePayload(section)) {
  if (section?.primaryRhythms) {
    return [...new Set([...section.primaryRhythms.subdivisions, ...normalizeRhythmPool(section.secondaryRhythms).subdivisions])];
  }
  const explicit = normalizeOptionIds(section && section.subdivisions, SUBDIVISION_SETTINGS);

  if (
    section &&
    Object.prototype.hasOwnProperty.call(section, "subdivisions") &&
    (explicit.length || getGenerationTuplets(section, samplePayload).length)
  ) {
    return explicit;
  }

  return explicit.length ? explicit : inferGenerationSubdivisions(section || {}, samplePayload);
}

function normalizeTupletConfigs(value) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const normalized = values.map(normalizeTupletConfig).filter(Boolean);

  return normalized.filter((tuplet, index) =>
    normalized.findIndex((candidate) =>
      candidate.actual === tuplet.actual &&
      candidate.normal === tuplet.normal &&
      candidate.type === tuplet.type
    ) === index
  );
}

function inferGenerationTuplets(section, samplePayload) {
  const explicitSampleTuplets = normalizeTupletConfigs([
    ...(Array.isArray(samplePayload && samplePayload.tuplets) ? samplePayload.tuplets : []),
    ...(samplePayload && samplePayload.tuplet ? [samplePayload.tuplet] : []),
  ]);

  if (explicitSampleTuplets.length) {
    return explicitSampleTuplets;
  }

  const notes = getSampleNotes(samplePayload);

  return normalizeTupletConfigs(getSampleTuplets(samplePayload).map((tuplet) => ({
    actual: tuplet.actual,
    normal: tuplet.normal,
    type: notes[Number(tuplet.start) || 0]?.duration || section?.tupletType || 8,
  })));
}

function getGenerationTuplets(section, samplePayload = getSamplePayload(section)) {
  if (section?.primaryRhythms) {
    return normalizeTupletConfigs([...section.primaryRhythms.tuplets, ...normalizeRhythmPool(section.secondaryRhythms).tuplets]);
  }
  if (section && Object.prototype.hasOwnProperty.call(section, "tuplets")) {
    return normalizeTupletConfigs(section.tuplets);
  }

  if (section && Object.prototype.hasOwnProperty.call(section, "tuplet")) {
    return normalizeTupletConfigs(section.tuplet);
  }

  return inferGenerationTuplets(section || {}, samplePayload);
}

function inferGenerationOrnaments(section, samplePayload) {
  const text = getSectionLegacyText(section);
  const sampleOrnaments = getSampleNotes(samplePayload)
    .map((note) => String(note.ornaments || ""))
    .join("");
  const noOrnaments = /no\s+ornaments?/.test(text) || /notes?\s+only/.test(text);
  const ornaments = [];

  if (noOrnaments) {
    return ornaments;
  }

  if (text.includes("sticking") || /[rl]/.test(sampleOrnaments)) ornaments.push("stickings");
  if ((text.includes("accent") || samplePayload?.accents === true || sampleOrnaments.includes("a")) && !/no\s+accents?/.test(text)) ornaments.push("accents");
  if ((text.includes("flam") || sampleOrnaments.includes("f")) && !/no\s+(?:accents?\s+or\s+)?flams?/.test(text) && !/without\s+flams?/.test(text)) ornaments.push("flams");
  if (text.includes("diddle") || sampleOrnaments.includes("d")) ornaments.push("diddles");
  if (text.includes("cheese") || sampleOrnaments.includes("c")) ornaments.push("cheese");

  return ornaments;
}

function getGenerationOrnaments(section, samplePayload = getSamplePayload(section)) {
  if (section?.primaryRhythms) {
    // Stickings come only from the exercise's own topic and then cover every note.
    return [...new Set([
      ...(section.ornaments || []),
      ...normalizeRhythmPool(section.secondaryRhythms).ornaments.filter((id) => id !== "stickings"),
      ...(getSectionRequiredSameHandStickingRuns(section).length ? ["stickings"] : []),
    ])];
  }
  if (section && Array.isArray(section.ornaments)) {
    const ornaments = normalizeOptionIds(section.ornaments, ORNAMENT_SETTINGS);

    if (getSectionRequiredSameHandStickingRuns(section).length && !ornaments.includes("stickings")) {
      ornaments.unshift("stickings");
    }

    return ornaments;
  }

  const explicit = normalizeOptionIds(section && section.ornaments, ORNAMENT_SETTINGS);
  return explicit.length ? explicit : inferGenerationOrnaments(section || {}, samplePayload);
}

function getMaxSubdivisionDuration(subdivisions) {
  return Math.max(
    ...SUBDIVISION_SETTINGS
      .filter((setting) => subdivisions.includes(setting.id))
      .map((setting) => setting.duration),
    8
  );
}

function getOptionLabels(settings, selectedIds, emptyLabel) {
  const labels = settings
    .filter((setting) => selectedIds.includes(setting.id))
    .map((setting) => setting.label);

  return labels.length ? labels.join(", ") : emptyLabel;
}

function getTupletLabel(tuplet) {
  if (!tuplet) {
    return "no tuplets";
  }

  const setting = getTupletTypeSetting(tuplet);
  const typeLabel = setting?.label || `${tuplet.type}`;
  return `${tuplet.actual}:${tuplet.normal} ${typeLabel} tuplets`;
}

function createStructuredSectionInstructions(section, samplePayload) {
  const subdivisions = getGenerationSubdivisions(section, samplePayload);
  const ornaments = getGenerationOrnaments(section, samplePayload);
  const tuplets = getGenerationTuplets(section, samplePayload);

  return [
    subdivisions.length
      ? `Use these regular subdivisions only: ${getOptionLabels(SUBDIVISION_SETTINGS, subdivisions, "none")}.`
      : "Use no regular note subdivisions.",
    tuplets.length
      ? `${subdivisions.length ? "Randomly mix" : "Use"} complete groups of these tuplet types${subdivisions.length ? " with the selected regular subdivisions" : ""}: ${tuplets.map(getTupletLabel).join(", ")}.`
      : "Use no tuplets.",
    ornaments.length
      ? `Use these ornaments only when musically appropriate: ${getOptionLabels(ORNAMENT_SETTINGS, ornaments, "none")}.`
      : "Use no ornaments.",
    ornaments.some((ornament) => ornament !== "stickings")
      ? `Use the global ornament density setting of ${normalizeGlobalOrnamentDensity(section.globalOrnamentDensity)}%, where 100% is the normal frequency.`
      : "",
    getSectionPlayEveryNote(section)
      ? "Use no rests; play every rhythmic position."
      : "Rests are allowed.",
    "Never create a tuplet group made entirely of rests. Replace its full duration with the simplest equivalent ordinary rest or rests outside a tuplet.",
    ornaments.some((ornament) => ornament === "diddles" || ornament === "cheese")
      ? "Diddles and cheese may only be used on sixteenth notes or faster, except that eighth notes inside a tuplet may use them; never put them on regular eighth notes, dotted eighth notes, or quarter notes."
      : "",
    ornaments.includes("diddles")
      ? "Distribute diddles across the measure by default. Occasional adjacent diddles are allowed for variety, but avoid clustering most or all diddles together."
      : "",
  ].join("\n");
}

function normalizePitch(value) {
  const pitch = String(value || "C5").replace("/", "").toUpperCase();
  return /^[A-G][0-9]$/.test(pitch) ? pitch : "C5";
}

function getNoteQuarterUnits(note) {
  const duration = Number(note.duration || 4);
  const dotMultiplier = note.dots ? 1.5 : 1;
  return (4 / duration) * dotMultiplier;
}

function getNotesQuarterUnits(notes) {
  return notes.reduce((total, note) => total + getNoteQuarterUnits(note), 0);
}

function getTupletForNote(tuplets, noteIndex) {
  return (tuplets || []).find((tuplet) =>
    noteIndex >= Number(tuplet.start) && noteIndex < Number(tuplet.end)
  );
}

function getVoiceQuarterUnits(voice) {
  const notes = voice && Array.isArray(voice.notes) ? voice.notes : [];
  const tuplets = voice && Array.isArray(voice.tuplets) ? voice.tuplets : [];

  return notes.reduce((total, note, noteIndex) => {
    const tuplet = getTupletForNote(tuplets, noteIndex);
    const tupletRatio = tuplet ? Number(tuplet.normal) / Number(tuplet.actual) : 1;
    return total + getNoteQuarterUnits(note) * tupletRatio;
  }, 0);
}

function isRest(note) {
  return !Array.isArray(note && note.notes) || note.notes.length === 0;
}

function hashString(value) {
  let hash = 2166136261;
  const text = String(value || "");

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createSeededRandom(seedValue) {
  let seed = hashString(seedValue);

  return () => {
    seed += 0x6D2B79F5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInteger(random, min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function shuffledIndexes(length, random) {
  const indexes = Array.from({ length }, (_, index) => index);

  for (let index = indexes.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInteger(random, 0, index);
    [indexes[index], indexes[swapIndex]] = [indexes[swapIndex], indexes[index]];
  }

  return indexes;
}

const THIRTY_SECOND_QUARTER_UNITS = 4 / 32;
const NOTATION_VALUE_BY_SLOT_COUNT = new Map([
  [1, { duration: 32, dots: 0 }],
  [2, { duration: 16, dots: 0 }],
  [3, { duration: 16, dots: 1 }],
  [4, { duration: 8, dots: 0 }],
  [6, { duration: 8, dots: 1 }],
  [8, { duration: 4, dots: 0 }],
  [12, { duration: 4, dots: 1 }],
  [16, { duration: 2, dots: 0 }],
  [24, { duration: 2, dots: 1 }],
  [32, { duration: 1, dots: 0 }],
]);
const SLOTS_PER_BEAT = 8;
const NOTATION_SLOT_COUNTS_DESCENDING = Array.from(NOTATION_VALUE_BY_SLOT_COUNT.keys())
  .sort((left, right) => right - left);

function getNoteSlotCount(note) {
  const slots = Math.round(getNoteQuarterUnits(note) / THIRTY_SECOND_QUARTER_UNITS);
  return Number.isFinite(slots) && slots > 0 ? slots : 0;
}

function getLargestNotationSlotCount(maxSlots) {
  return NOTATION_SLOT_COUNTS_DESCENDING.find((slotCount) => slotCount <= maxSlots) || 1;
}

function getNotationValueBySlots(slotCount) {
  return NOTATION_VALUE_BY_SLOT_COUNT.get(slotCount) || { duration: 32, dots: 0 };
}

function createRestFromSlots(slotCount, sourceNote) {
  return {
    notes: [],
    ...getNotationValueBySlots(slotCount),
    velocity: Number((sourceNote && sourceNote.velocity) || 0.5),
  };
}

function createPlayedNoteFromSlots(note, slotCount) {
  return {
    ...note,
    ...getNotationValueBySlots(slotCount),
  };
}

function pushCompressedRests(target, slotCount, sourceNote) {
  let remainingSlots = slotCount;

  while (remainingSlots > 0) {
    const restSlots = getLargestNotationSlotCount(remainingSlots);
    target.push(createRestFromSlots(restSlots, sourceNote));
    remainingSlots -= restSlots;
  }
}

function getPreferLongerValueOptions() {
  return {
    groupSlots: 8,
  };
}

function splitIntoSlotGroups(notes, groupSlots, startSlot = 0) {
  if (!groupSlots) {
    return [notes || []];
  }

  const groups = [];
  let group = [];
  // Groups follow the measure's beats even when the notes start mid-beat.
  let groupUsedSlots = startSlot % groupSlots;

  for (const note of notes || []) {
    const noteSlots = getNoteSlotCount(note);

    if (noteSlots && groupUsedSlots > 0 && groupUsedSlots + noteSlots > groupSlots) {
      groups.push(group);
      group = [];
      groupUsedSlots = 0;
    }

    group.push(note);
    groupUsedSlots += noteSlots;

    if (groupUsedSlots >= groupSlots) {
      groups.push(group);
      group = [];
      groupUsedSlots = 0;
    }
  }

  if (group.length) {
    groups.push(group);
  }

  return groups;
}

function groupHasPlayedNotes(notes) {
  return (notes || []).some((note) => !isRest(note));
}

function preferLongerValuesInGroup(notes) {
  const simplified = [];
  let index = 0;

  while (index < notes.length) {
    const note = notes[index];
    const noteSlots = getNoteSlotCount(note);

    if (!noteSlots) {
      simplified.push(note);
      index += 1;
      continue;
    }

    if (isRest(note)) {
      let restSlots = 0;
      const firstRest = note;

      while (index < notes.length && isRest(notes[index])) {
        restSlots += getNoteSlotCount(notes[index]);
        index += 1;
      }

      pushCompressedRests(simplified, restSlots, firstRest);
      continue;
    }

    let restSlots = 0;
    let nextPlayedIndex = index + 1;
    const firstRest = notes[nextPlayedIndex];

    while (nextPlayedIndex < notes.length && isRest(notes[nextPlayedIndex])) {
      restSlots += getNoteSlotCount(notes[nextPlayedIndex]);
      nextPlayedIndex += 1;
    }

    const totalAvailableSlots = noteSlots + restSlots;
    const preferredNoteSlots = restSlots
      ? Math.max(noteSlots, getLargestNotationSlotCount(totalAvailableSlots))
      : noteSlots;
    const remainingRestSlots = totalAvailableSlots - preferredNoteSlots;

    simplified.push(createPlayedNoteFromSlots(note, preferredNoteSlots));

    if (remainingRestSlots > 0) {
      pushCompressedRests(simplified, remainingRestSlots, firstRest || note);
    }

    index = nextPlayedIndex;
  }

  return simplified;
}

// In 32nd-note tuplets, a 32nd note followed by a 32nd rest reads as one sixteenth.
function mergeThirtySecondNoteRests(notes) {
  const merged = [];
  for (let index = 0; index < notes.length; index += 1) {
    const note = notes[index];
    const next = notes[index + 1];
    const plainThirtySecond = (candidate) => Number(candidate?.duration) === 32 && !Number(candidate?.dots || 0);
    if (!isRest(note) && plainThirtySecond(note) && next && isRest(next) && plainThirtySecond(next)) {
      merged.push({ ...note, duration: 16 });
      index += 1;
      continue;
    }
    merged.push({ ...note });
  }
  return merged;
}

function mergeRestRuns(notes) {
  const merged = [];
  let index = 0;
  while (index < notes.length) {
    if (!isRest(notes[index])) {
      merged.push(notes[index]);
      index += 1;
      continue;
    }
    const firstRest = notes[index];
    let restSlots = 0;
    while (index < notes.length && isRest(notes[index])) {
      restSlots += getNoteSlotCount(notes[index]);
      index += 1;
    }
    pushCompressedRests(merged, restSlots, firstRest);
  }
  return merged;
}

// Two quarter rests that start on beat one or three read as one half rest.
function mergeBeatRests(notes, startSlot = 0) {
  const merged = [];
  let slot = startSlot;
  for (let index = 0; index < notes.length; index += 1) {
    const note = notes[index];
    const next = notes[index + 1];
    const quarterRest = (candidate) => candidate && isRest(candidate) && getNoteSlotCount(candidate) === SLOTS_PER_BEAT;
    if (quarterRest(note) && quarterRest(next) && slot % (SLOTS_PER_BEAT * 2) === 0) {
      merged.push(createRestFromSlots(SLOTS_PER_BEAT * 2, note));
      slot += SLOTS_PER_BEAT * 2;
      index += 1;
      continue;
    }
    merged.push(note);
    slot += getNoteSlotCount(note);
  }
  return merged;
}

function preferLongerValues(notes, options = {}) {
  const {
    groupSlots = 0,
    startSlot = 0,
  } = options;

  const simplified = splitIntoSlotGroups(notes, groupSlots, startSlot).flatMap((group) => {
    if (!groupHasPlayedNotes(group)) {
      const restSlots = group.reduce((total, note) => total + getNoteSlotCount(note), 0);
      const firstRest = group.find((note) => isRest(note)) || group[0];
      const compressedRests = [];
      pushCompressedRests(compressedRests, restSlots, firstRest);
      return compressedRests;
    }

    return preferLongerValuesInGroup(group);
  });
  return groupSlots ? mergeBeatRests(simplified, startSlot) : simplified;
}

function preferLongerValuesInTupletVoice(voice, configuredTuplets = []) {
  const notes = Array.isArray(voice && voice.notes) ? voice.notes : [];
  const tuplets = normalizeVoiceTuplets(voice && voice.tuplets, notes)
    .sort((left, right) => left.start - right.start);
  const normalizedConfiguredTuplets = normalizeTupletConfigs(configuredTuplets);

  if (!tuplets.length) {
    return {
      notes: preferLongerValues(notes, getPreferLongerValueOptions()),
      tuplets: [],
    };
  }

  const nextNotes = [];
  const nextTuplets = [];
  let cursor = 0;
  let slot = 0;
  const sliceSlots = (slice) => slice.reduce((total, note) => total + getNoteSlotCount(note), 0);

  for (const tuplet of tuplets) {
    if (tuplet.start < cursor) {
      continue;
    }

    if (tuplet.start > cursor) {
      const slice = notes.slice(cursor, tuplet.start);
      nextNotes.push(
        ...preferLongerValues(slice, { ...getPreferLongerValueOptions(), startSlot: slot })
      );
      slot += sliceSlots(slice);
    }

    const tupletNotes = notes.slice(tuplet.start, tuplet.end);
    slot += Math.round(sliceSlots(tupletNotes) * Number(tuplet.normal) / Number(tuplet.actual));
    if (!groupHasPlayedNotes(tupletNotes)) {
      const rawRestSlots = tupletNotes.reduce(
        (total, note) => total + getNoteSlotCount(note),
        0
      );
      const effectiveRestSlots = Math.max(
        1,
        Math.round(rawRestSlots * Number(tuplet.normal) / Number(tuplet.actual))
      );
      const firstRest = tupletNotes[0];

      pushCompressedRests(nextNotes, effectiveRestSlots, firstRest);
      cursor = tuplet.end;
      continue;
    }

    const tupletStart = nextNotes.length;
    const configuredTuplet = normalizedConfiguredTuplets.find((candidate) =>
      Number(candidate.actual) === Number(tuplet.actual) &&
      Number(candidate.normal) === Number(tuplet.normal) &&
      Math.abs(candidate.type - getVoiceTupletType(voice, tuplet)) < 0.001
    );
    const preserveConfiguredSubdivision = Number(configuredTuplet?.type) >= 16;

    // Eighth-note tuplets may use longer equivalent values for readability,
    // but sixteenth-note and faster tuplets keep their configured note type on
    // played notes so an unselected regular subdivision never appears in the
    // group. Their consecutive rests still merge into the largest rest.
    nextNotes.push(
      ...(preserveConfiguredSubdivision
        ? mergeRestRuns(Number(configuredTuplet?.type) === 32
          ? mergeThirtySecondNoteRests(tupletNotes)
          : tupletNotes.map((note) => ({ ...note })))
        : preferLongerValues(tupletNotes))
    );
    const tupletEnd = nextNotes.length;

    if (tupletEnd > tupletStart) {
      nextTuplets.push({
        ...tuplet,
        start: tupletStart,
        end: tupletEnd,
      });
    }

    cursor = tuplet.end;
  }

  if (cursor < notes.length) {
    nextNotes.push(
      ...preferLongerValues(notes.slice(cursor), { ...getPreferLongerValueOptions(), startSlot: slot })
    );
  }

  return {
    notes: nextNotes,
    tuplets: nextTuplets,
  };
}

function getTupletPositionByNoteIndex(notes, tuplets, configuredTuplets = []) {
  const positions = new Map();
  const normalizedConfiguredTuplets = normalizeTupletConfigs(configuredTuplets);

  for (const tuplet of normalizeVoiceTuplets(tuplets, notes)) {
    const configuredTuplet = normalizedConfiguredTuplets.find((candidate) =>
      Number(candidate.actual) === Number(tuplet.actual) &&
      Number(candidate.normal) === Number(tuplet.normal) &&
      Math.abs(candidate.type - getVoiceTupletType({ notes }, tuplet)) < 0.001
    );
    const configuredType = Number(configuredTuplet?.type);

    if (!configuredType) {
      continue;
    }

    const configuredUnit = 4 / configuredType;
    let position = 0;

    for (let noteIndex = tuplet.start; noteIndex < tuplet.end; noteIndex += 1) {
      positions.set(noteIndex, {
        actual: Number(tuplet.actual),
        position: Math.round(position) % Number(tuplet.actual),
        type: configuredType,
      });
      position += getNoteQuarterUnits(notes[noteIndex]) / configuredUnit;
    }
  }

  return positions;
}

function normalizeGeneratedNote(note, fallbackNote = {}) {
  const fallbackDuration = [1, 2, 4, 8, 16, 32].includes(Number(fallbackNote.duration))
    ? Number(fallbackNote.duration)
    : 8;
  const duration = [1, 2, 4, 8, 16, 32].includes(Number(note && note.duration))
    ? Number(note.duration)
    : fallbackDuration;
  const notes = Array.isArray(note && note.notes)
    ? note.notes.map(normalizePitch)
    : Array.isArray(fallbackNote.notes)
      ? fallbackNote.notes.map(normalizePitch)
      : ["C5"];

  return {
    notes,
    duration,
    dots: Number((note && note.dots) || 0),
    velocity: Number((note && note.velocity) || fallbackNote.velocity || 0.5),
    ...((note && note.ornaments != null) || fallbackNote.ornaments != null
      ? { ornaments: String((note && note.ornaments) != null ? note.ornaments : fallbackNote.ornaments || "") }
      : {}),
  };
}

function normalizeVoiceTuplets(tuplets, notes) {
  if (!Array.isArray(tuplets)) {
    return [];
  }

  return tuplets
    .map((tuplet) => ({
      start: Number.parseInt(tuplet && tuplet.start, 10),
      end: Number.parseInt(tuplet && tuplet.end, 10),
      actual: Number.parseInt(tuplet && tuplet.actual, 10),
      normal: Number.parseInt(tuplet && tuplet.normal, 10),
    }))
    .filter((tuplet) =>
      Number.isInteger(tuplet.start) &&
      Number.isInteger(tuplet.end) &&
      Number.isInteger(tuplet.actual) &&
      Number.isInteger(tuplet.normal) &&
      tuplet.start >= 0 &&
      tuplet.end > tuplet.start &&
      tuplet.end <= notes.length &&
      tuplet.actual > 1 &&
      tuplet.normal > 0
    );
}

function normalizeGeneratedScore(value, fallbackScore = createBlankLineScore()) {
  const source = value && value.score && value.score.measures ? value.score : value;
  const fallbackMeasure = fallbackScore.measures && fallbackScore.measures[0]
    ? fallbackScore.measures[0]
    : createBlankLineScore().measures[0];
  const fallbackParts = Array.isArray(fallbackMeasure.parts)
    ? fallbackMeasure.parts
    : createBlankLineScore().measures[0].parts;
  const fallbackPart = fallbackParts.find((candidate) => candidate.instrument === "snare") ||
    fallbackParts[0];
  const fallbackVoice = fallbackPart && fallbackPart.voices && fallbackPart.voices[0]
    ? fallbackPart.voices[0]
    : { notes: [], tuplets: [] };
  const measure = source && source.measures && source.measures[0];
  const part = measure && Array.isArray(measure.parts)
    ? measure.parts.find((candidate) => candidate.instrument === "snare") || measure.parts[0]
    : null;
  const voice = part && part.voices && part.voices[0];
  const rawNotes = Array.isArray(voice && voice.notes) ? voice.notes : [];

  if (!rawNotes.length) {
    return cloneJson(fallbackScore);
  }

  const notes = rawNotes.map((note, index) =>
    normalizeGeneratedNote(note, (fallbackVoice.notes || [])[index] || (fallbackVoice.notes || [])[0])
  );
  const tuplets = normalizeVoiceTuplets(voice && voice.tuplets, notes);
  const totalUnits = getVoiceQuarterUnits({ notes, tuplets });

  if (Math.abs(totalUnits - 4) > 0.001) {
    return cloneJson(fallbackScore);
  }

  return {
    parts: { snare: { enabled: true } },
    measures: [{
      timeSig: {
        num: Number((measure && measure.timeSig && measure.timeSig.num) || fallbackMeasure.timeSig.num || 4),
        type: Number((measure && measure.timeSig && measure.timeSig.type) || fallbackMeasure.timeSig.type || 4),
      },
      parts: [{
        instrument: "snare",
        voices: [{
          notes,
          tuplets,
        }],
      }],
    }],
  };
}

function normalizeOrnamentText(value) {
  const ornamentOrder = "rlafdc";
  const ornaments = String(value || "")
    .split("")
    .filter((char, index, chars) => ornamentOrder.includes(char) && chars.indexOf(char) === index)
    .sort((left, right) => ornamentOrder.indexOf(left) - ornamentOrder.indexOf(right))
    .join("");

  return ornaments ? `:${ornaments}` : "";
}

function getExerciseShortForm(score) {
  const measure = score && score.measures && score.measures[0];
  const part = measure && Array.isArray(measure.parts)
    ? measure.parts.find((candidate) => candidate.instrument === "snare") || measure.parts[0]
    : null;
  const voice = part && part.voices && part.voices[0];
  const notes = Array.isArray(voice && voice.notes) ? voice.notes : [];
  const tuplets = Array.isArray(voice && voice.tuplets) ? voice.tuplets : [];
  const notesShortForm = notes.map((note) => {
    const type = isRest(note) ? "r" : "n";
    const dots = Number(note.dots || 0);
    const duration = `${Number(note.duration || 4)}${dots ? ".".repeat(dots) : ""}`;
    return `${type}${duration}${type === "n" ? normalizeOrnamentText(note.ornaments) : ""}`;
  }).join(" ");
  const tupletShortForm = tuplets
    .map((tuplet) => `${tuplet.start}-${tuplet.end}:${tuplet.actual}:${tuplet.normal}`)
    .join(",");

  return tupletShortForm ? `${notesShortForm} |t${tupletShortForm}` : notesShortForm;
}

function extractGeneratedLineInputs(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;

  if (Array.isArray(payload.sections)) {
    return payload.sections.flatMap(extractGeneratedLineInputs);
  }

  if (Array.isArray(payload.pages)) {
    return payload.pages.flatMap((page) =>
      page.lines || page.examples || page.rhythms || []
    );
  }

  return payload.lines || payload.examples || payload.rhythms || payload.exercises || [];
}

function scoreHasTuplets(score) {
  return Boolean(
    score &&
    score.measures &&
    score.measures.some((measure) =>
      (measure.parts || []).some((part) =>
        (part.voices || []).some((voice) =>
          Array.isArray(voice.tuplets) && voice.tuplets.length > 0
        )
      )
    )
  );
}

function getAllowedOrnamentChars(section) {
  const ornaments = getGenerationOrnaments(section);
  return ORNAMENT_SETTINGS
    .filter((setting) => ornaments.includes(setting.id))
    .map((setting) => setting.chars)
    .join("");
}

function sectionUsesStickings(section) {
  return getGenerationOrnaments(section).includes("stickings");
}

function sectionUsesDiddlesOrCheese(section) {
  const ornaments = getGenerationOrnaments(section);
  return ornaments.includes("diddles") || ornaments.includes("cheese");
}

function getRequiredSectionOrnamentChars(section) {
  let ornaments = section.primaryRhythms ? section.ornaments || [] : getGenerationOrnaments(section);
  // Only ornaments some primary rhythm may carry are required on the primary rhythms;
  // the rest of the exercise's ornaments can still appear on secondary notes.
  const limits = section.primaryRhythms && section.primaryRhythmOrnaments;
  if (limits) {
    const pool = normalizeRhythmPool(section.primaryRhythms);
    const keys = [...pool.subdivisions, ...pool.tuplets].map(rhythmOrnamentKey);
    ornaments = ornaments.filter((id) => keys.some((key) => !Array.isArray(limits[key]) || limits[key].includes(id)));
  }

  return ORNAMENT_SETTINGS
    .filter((setting) => setting.id !== "stickings" && ornaments.includes(setting.id))
    .flatMap((setting) => [...setting.chars]);
}

function getVoiceTupletType(voice, tuplet) {
  const units = getNotesQuarterUnits(voice.notes.slice(tuplet.start, tuplet.end));
  return Number(tuplet.actual) * 4 / units;
}

function noteMatchesRhythmPool(pool, voice, noteIndex) {
  const tuplet = getTupletForNote(voice.tuplets, noteIndex);
  if (tuplet) {
    return (pool.tuplets || []).some((candidate) =>
      candidate.actual === Number(tuplet.actual) && candidate.normal === Number(tuplet.normal) &&
      Math.abs(candidate.type - getVoiceTupletType(voice, tuplet)) < 0.001
    );
  }
  return SUBDIVISION_SETTINGS.some((setting) =>
    pool.subdivisions.includes(setting.id) && Number(voice.notes[noteIndex].duration) === setting.duration
  );
}

function getPrimaryNoteIndexes(section, voice) {
  return new Set(voice.notes.flatMap((note, index) =>
    noteMatchesRhythmPool(section.primaryRhythms, voice, index) ? [index] : []
  ));
}

// Ornaments a secondary note may carry: its rhythm's row in rhythmOrnaments, or
// the whole pool's ornaments when no per-rhythm table is set.
// The pool rhythm a note belongs to, as a rhythmOrnaments key.
function getPoolNoteRhythmKey(pool, voice, index) {
  const rhythm = [...pool.subdivisions, ...pool.tuplets].find((candidate) =>
    noteMatchesRhythmPool(typeof candidate === "string"
      ? { subdivisions: [candidate], tuplets: [] }
      : { subdivisions: [], tuplets: [candidate] }, voice, index));
  return rhythm ? rhythmOrnamentKey(rhythm) : null;
}

function getSecondaryNoteOrnaments(secondary, voice, index) {
  if (!noteMatchesRhythmPool(secondary, voice, index)) return [];
  if (!secondary.rhythmOrnaments) return secondary.ornaments;
  const key = getPoolNoteRhythmKey(secondary, voice, index);
  return key ? secondary.rhythmOrnaments[key] || [] : [];
}

// primaryRhythmOrnaments caps which of the exercise's ornaments a primary rhythm
// may carry (e.g. { "7:4:16": [], "6:4:16": ["flams"] }); stickings are never capped.
// Returns note index -> allowed ornament ids, for capped primary notes only.
function getPrimaryNoteOrnamentLimits(section, voice) {
  const limits = new Map();
  if (!section.primaryRhythms || !section.primaryRhythmOrnaments) return limits;
  voice.notes.forEach((note, index) => {
    const key = noteMatchesRhythmPool(section.primaryRhythms, voice, index)
      ? getPoolNoteRhythmKey(section.primaryRhythms, voice, index) : null;
    if (key && Array.isArray(section.primaryRhythmOrnaments[key])) limits.set(index, section.primaryRhythmOrnaments[key]);
  });
  return limits;
}

function applyRhythmPoolOrnaments(section, voice) {
  if (!section.primaryRhythms) return voice;
  const secondary = normalizeRhythmPool(section.secondaryRhythms);
  const limits = getPrimaryNoteOrnamentLimits(section, voice);
  return {
    ...voice,
    notes: voice.notes.map((note, index) => {
      const primary = noteMatchesRhythmPool(section.primaryRhythms, voice, index);
      const limit = primary ? limits.get(index) : null;
      // With randomOrnaments, secondary notes draw from the exercise's own set too.
      const selected = primary
        ? (section.ornaments || []).filter((id) => !limit || limit.includes(id))
        : getSecondaryNoteOrnaments(secondary, voice, index)
          .filter((id) => !section.randomOrnaments || (section.ornaments || []).includes(id));
      const allowed = ORNAMENT_SETTINGS.filter((item) => item.id === "stickings"
        ? sectionUsesStickings(section)
        : selected.includes(item.id))
        .map((item) => item.chars).join("");
      const ornaments = isRest(note) ? "" : [...String(note.ornaments || "")].filter((char) => allowed.includes(char)).join("");
      const { ornaments: previous, ...plain } = note;
      return { ...plain, velocity: ornaments.includes("a") ? 1 : 0.5, ...(ornaments ? { ornaments } : {}) };
    }),
  };
}

function validatePrimaryRequirements(section, score) {
  if (!section.primaryRhythms) return;
  const timeSig = score.measures[0].timeSig;
  if (Number(timeSig.num) !== 4 || Number(timeSig.type) !== 4) {
    throw new Error("Every exercise must use 4/4 time.");
  }
  const voice = score.measures[0].parts[0].voices[0];
  if (Math.abs(getVoiceQuarterUnits(voice) - 4) > 0.001) throw new Error("Exercise must fill exactly one measure of 4/4.");
  const primary = section.primaryRhythms;
  const requiredPools = [
    ...primary.subdivisions.map((id) => ({ subdivisions: [id], tuplets: [] })),
    ...primary.tuplets.map((tuplet) => ({ subdivisions: [], tuplets: [tuplet] })),
  ];
  for (const pool of section.requirePrimaryRhythms === false ? [] : requiredPools) {
    if (!voice.notes.some((note, index) => !isRest(note) && noteMatchesRhythmPool(pool, voice, index))) {
      throw new Error("Every exercise must contain each selected primary rhythm as played notes.");
    }
  }
  const primaryNotes = voice.notes.filter((note, index) => !isRest(note) && noteMatchesRhythmPool(primary, voice, index));
  const secondary = normalizeRhythmPool(section.secondaryRhythms);
  const subdivisions = getGenerationSubdivisions(section);
  for (const [index, note] of voice.notes.entries()) {
    if (isRest(note)) continue;
    const inTuplet = getTupletForNote(voice.tuplets, index);
    if (inTuplet ? !noteMatchesRhythmPool(primary, voice, index) && !noteMatchesRhythmPool(secondary, voice, index)
      : !subdivisions.length || Number(note.duration) > getMaxSubdivisionDuration(subdivisions)) {
      throw new Error("Exercise contains a rhythm outside the selected pools.");
    }
  }
  for (const char of getRequiredSectionOrnamentChars(section)) {
    if (!primaryNotes.some((note) => String(note.ornaments || "").includes(char))) {
      throw new Error(`Cannot place required primary ornament "${char}" on a primary rhythm.`);
    }
  }
  const played = countPlayedNotes(voice.notes);
  if (played < getSectionMinPlayedNotes(section) ||
      (getEffectiveSectionMaxPlayedNotes(section) && played > getEffectiveSectionMaxPlayedNotes(section))) {
    throw new Error("Exercise cannot satisfy the configured played-note limits.");
  }
  if (getSectionPlayEveryNote(section) && voice.notes.some(isRest)) throw new Error("No-rest subsection contains rests.");
}

function applySectionOrnamentPolicy(section, score) {
  const allowedChars = getAllowedOrnamentChars(section);
  const allowedPattern = allowedChars ? new RegExp(`[^${allowedChars}]`, "g") : /[a-z]/g;

  return {
    ...score,
    measures: (score.measures || []).map((measure) => ({
      ...measure,
      parts: (measure.parts || []).map((part) => ({
        ...part,
        voices: (part.voices || []).map((voice) => {
          const tupletNoteIndexes = new Set(
            (voice.tuplets || []).flatMap((tuplet) =>
              Array.from(
                { length: Math.max(0, Number(tuplet.end) - Number(tuplet.start)) },
                (_, offset) => Number(tuplet.start) + offset
              )
            )
          );

          return {
            ...voice,
            notes: (voice.notes || []).map((note, noteIndex) => {
              if (note.ornaments == null) {
                return note;
              }

              if (isRest(note)) {
                const { ornaments: _ornaments, ...rest } = note;
                return rest;
              }

              const ornaments = cleanDurationRestrictedOrnaments(
                note,
                String(note.ornaments).replace(allowedPattern, ""),
                { allowDiddlesOnEighths: tupletNoteIndexes.has(noteIndex) }
              );

              if (!ornaments) {
                const { ornaments: _ornaments, ...rest } = note;
                return rest;
              }

              return {
                ...note,
                ornaments,
              };
            }),
          };
        }),
      })),
    })),
  };
}

function getSectionMinPlayedNotes(section) {
  return getNonNegativeInteger(section && section.minPlayedNotes, 0);
}

function getSectionMaxPlayedNotes(section) {
  return getNonNegativeInteger(section && section.maxPlayedNotes, 0);
}

function getSectionPlayEveryNote(section) {
  if (!section) return false;
  if (typeof section.playEveryNote === "boolean") return section.playEveryNote;
  return section.playEveryNote === "true";
}

function getSectionMaxSameHandStickingRun(section) {
  return getPositiveInteger(
    section && section.maxSameHandStickingRun,
    DEFAULT_MAX_SAME_HAND_STICKING_RUN
  );
}

function getSectionRequiredSameHandStickingRuns(section) {
  const maximum = getSectionMaxSameHandStickingRun(section);

  if (section && Object.prototype.hasOwnProperty.call(section, "requiredSameHandStickingRuns")) {
    const values = Array.isArray(section.requiredSameHandStickingRuns)
      ? section.requiredSameHandStickingRuns
      : String(section.requiredSameHandStickingRuns || "").split(/[^0-9]+/);

    return [...new Set(values
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isInteger(value) && value > 0 && value <= maximum)
    )].sort((left, right) => left - right);
  }

  const legacyRequired = section && (
    section.requireMaxSameHandStickingRun === true ||
    section.requireMaxSameHandStickingRun === "true"
  );
  return legacyRequired ? [maximum] : [];
}

function getRequiredSameHandStickingRunForLine(section, lineIndex = 0) {
  const requiredRuns = getSectionRequiredSameHandStickingRuns(section);

  if (!requiredRuns.length) return 0;

  return requiredRuns[
    (lineIndex + hashString(section.id || section.title || "section")) % requiredRuns.length
  ];
}

function countPlayedNotes(notes) {
  return (notes || []).filter((note) => !isRest(note)).length;
}

function getEffectiveSectionMaxPlayedNotes(section) {
  if (getSectionPlayEveryNote(section)) {
    return 0;
  }

  const maximum = getSectionMaxPlayedNotes(section);

  if (!maximum) {
    return 0;
  }

  const minimum = getSectionMinPlayedNotes(section);
  const requiredSameHandRun = sectionUsesStickings(section)
    ? Math.max(0, ...getSectionRequiredSameHandStickingRuns(section))
    : 0;

  return Math.max(maximum, minimum, requiredSameHandRun);
}

function getShortestAllowedDuration(section, notes) {
  const subdivisions = getGenerationSubdivisions(section);
  const durations = (notes || [])
    .map((note) => Number(note && note.duration))
    .filter((duration) => [1, 2, 4, 8, 16, 32].includes(duration));

  return Math.max(getMaxSubdivisionDuration(subdivisions), ...durations, 8);
}

function createPlayedNoteFrom(note, overrides = {}) {
  return {
    ...note,
    notes: ["C5"],
    velocity: Number((note && note.velocity) || 0.5),
    ...overrides,
  };
}

function createRestFrom(note) {
  return {
    notes: [],
    duration: Number(note && note.duration) || 4,
    dots: Number((note && note.dots) || 0),
    velocity: Number((note && note.velocity) || 0.5),
  };
}

function splitIntoPlayedNotes(note, targetDuration) {
  const targetUnits = 4 / targetDuration;
  const totalUnits = getNoteQuarterUnits(note);
  const pieces = Math.round(totalUnits / targetUnits);

  if (pieces <= 1 || Math.abs(pieces * targetUnits - totalUnits) > 0.001) {
    return null;
  }

  const ornaments = !isRest(note) && note && note.ornaments != null
    ? String(note.ornaments)
    : "";

  return Array.from({ length: pieces }, (_, index) => ({
    notes: ["C5"],
    duration: targetDuration,
    dots: 0,
    velocity: Number((note && note.velocity) || 0.5),
    ...(ornaments && index === 0 ? { ornaments } : {}),
  }));
}

function enforceMinimumPlayedNotesInNotes(section, notes, lineIndex = 0) {
  const minimum = getSectionMinPlayedNotes(section);

  if (!minimum || countPlayedNotes(notes) >= minimum) {
    return notes;
  }

  const random = createSeededRandom(
    `${section.id || section.title || "section"}:minimum:${lineIndex}:${JSON.stringify(notes)}`
  );
  let nextNotes = (notes || []).map((note) => ({ ...note }));
  let playedCount = countPlayedNotes(nextNotes);
  const targetDuration = getShortestAllowedDuration(section, nextNotes);

  const splitNotes = (shouldSplit) => {
    let changed = false;

    for (const noteIndex of shuffledIndexes(nextNotes.length, random)) {
      if (playedCount >= minimum) {
        break;
      }

      const note = nextNotes[noteIndex];

      if (!shouldSplit(note)) {
        continue;
      }

      const pieces = splitIntoPlayedNotes(note, targetDuration);

      if (!pieces) {
        continue;
      }

      playedCount += pieces.length - (isRest(note) ? 0 : 1);
      nextNotes.splice(noteIndex, 1, ...pieces);
      changed = true;
    }

    return changed;
  };

  while (playedCount < minimum && splitNotes((note) => !isRest(note))) {
    // Keep splitting played values before stealing rest positions.
  }

  for (const noteIndex of shuffledIndexes(nextNotes.length, random)) {
    if (playedCount >= minimum) {
      break;
    }

    if (!isRest(nextNotes[noteIndex])) {
      continue;
    }

    playedCount += 1;
    nextNotes[noteIndex] = createPlayedNoteFrom(nextNotes[noteIndex]);
  }

  while (playedCount < minimum && splitNotes(() => true)) {
    // Converted rests can still be split if the requested minimum is very high.
  }

  return nextNotes;
}

function enforceMinimumPlayedNotesInFixedNoteSlots(section, notes, lineIndex = 0) {
  const minimum = getSectionMinPlayedNotes(section);

  if (!minimum || countPlayedNotes(notes) >= minimum) {
    return notes;
  }

  const random = createSeededRandom(
    `${section.id || section.title || "section"}:minimum-fixed:${lineIndex}:${JSON.stringify(notes)}`
  );
  const nextNotes = (notes || []).map((note) => ({ ...note }));
  let playedCount = countPlayedNotes(nextNotes);

  for (const noteIndex of shuffledIndexes(nextNotes.length, random)) {
    if (playedCount >= minimum) {
      break;
    }

    if (!isRest(nextNotes[noteIndex])) {
      continue;
    }

    playedCount += 1;
    nextNotes[noteIndex] = createPlayedNoteFrom(nextNotes[noteIndex]);
  }

  return nextNotes;
}

function enforceMinimumPlayedNotes(section, score, lineIndex = 0) {
  const minimum = getSectionMinPlayedNotes(section);

  if (!minimum) {
    return score;
  }

  return {
    ...score,
    measures: (score.measures || []).map((measure) => ({
      ...measure,
      parts: (measure.parts || []).map((part) => ({
        ...part,
        voices: (part.voices || []).map((voice) => ({
          ...voice,
          notes: Array.isArray(voice.tuplets) && voice.tuplets.length
            ? enforceMinimumPlayedNotesInFixedNoteSlots(section, voice.notes || [], lineIndex)
            : enforceMinimumPlayedNotesInNotes(section, voice.notes || [], lineIndex),
        })),
      })),
    })),
  };
}

function enforcePlayEveryNote(section, score) {
  if (!getSectionPlayEveryNote(section)) {
    return score;
  }

  return {
    ...score,
    measures: (score.measures || []).map((measure) => ({
      ...measure,
      parts: (measure.parts || []).map((part) => ({
        ...part,
        voices: (part.voices || []).map((voice) => ({
          ...voice,
          notes: (voice.notes || []).map((note) =>
            isRest(note) ? { ...note, notes: ["C5"] } : note
          ),
        })),
      })),
    })),
  };
}

function getProtectedPlayedIndexesForMaximum(section, notes) {
  if (
    !sectionUsesStickings(section) ||
    !getSectionRequiredSameHandStickingRuns(section).length
  ) {
    return new Set();
  }

  const targetRun = findRequiredMaxSameHandRun(
    notes,
    Math.max(...getSectionRequiredSameHandStickingRuns(section))
  );
  const protectedIndexes = new Set();

  if (!targetRun) {
    return protectedIndexes;
  }

  for (let index = targetRun.start; index <= targetRun.end; index += 1) {
    protectedIndexes.add(index);
  }

  return protectedIndexes;
}

function enforceMaximumPlayedNotesInNotes(section, notes, lineIndex = 0) {
  const maximum = getEffectiveSectionMaxPlayedNotes(section);
  const playedCount = countPlayedNotes(notes);

  if (!maximum || playedCount <= maximum) {
    return notes;
  }

  const protectedIndexes = getProtectedPlayedIndexesForMaximum(section, notes);
  const playedIndexes = (notes || []).reduce((indexes, note, index) => {
    if (!isRest(note)) {
      indexes.push(index);
    }

    return indexes;
  }, []);
  const removableIndexes = playedIndexes.filter((index) => !protectedIndexes.has(index));
  const overflow = playedCount - maximum;
  const random = createSeededRandom(
    `${section.id || section.title || "section"}:maximum:${lineIndex}:${JSON.stringify(notes)}`
  );
  const indexesToRemove = new Set(
    shuffledIndexes(removableIndexes.length, random)
      .slice(0, overflow)
      .map((shuffleIndex) => removableIndexes[shuffleIndex])
  );
  let stillOverflowing = overflow - indexesToRemove.size;

  if (stillOverflowing > 0) {
    for (const index of shuffledIndexes(playedIndexes.length, random)) {
      if (!stillOverflowing) {
        break;
      }

      const noteIndex = playedIndexes[index];

      if (indexesToRemove.has(noteIndex)) {
        continue;
      }

      indexesToRemove.add(noteIndex);
      stillOverflowing -= 1;
    }
  }

  return (notes || []).map((note, index) =>
    indexesToRemove.has(index) ? createRestFrom(note) : note
  );
}

function enforceMaximumPlayedNotes(section, score, lineIndex = 0) {
  const maximum = getEffectiveSectionMaxPlayedNotes(section);

  if (!maximum) {
    return score;
  }

  return {
    ...score,
    measures: (score.measures || []).map((measure) => ({
      ...measure,
      parts: (measure.parts || []).map((part) => ({
        ...part,
        voices: (part.voices || []).map((voice) => ({
          ...voice,
          notes: enforceMaximumPlayedNotesInNotes(section, voice.notes || [], lineIndex),
        })),
      })),
    })),
  };
}

function getNoteSticking(note) {
  const match = String((note && note.ornaments) || "").match(/[rl]/);
  return match ? match[0] : "";
}

function withPrependedSticking(note, sticking) {
  const ornaments = String((note && note.ornaments) || "").replace(/[rl]/g, "");

  return {
    ...note,
    ornaments: `${sticking}${ornaments}`,
  };
}

function getOppositeSticking(sticking) {
  return sticking === "r" ? "l" : "r";
}

function withSticking(note, sticking) {
  return withPrependedSticking(note, sticking);
}

// Thirty-second notes follow the same sequencing rules as sixteenths.
function areConsecutiveSixteenthNotes(left, right) {
  return left &&
    right &&
    !isRest(left) &&
    !isRest(right) &&
    Number(left.duration) >= 16 &&
    Number(right.duration) >= 16 &&
    Number(left.dots || 0) === 0 &&
    Number(right.dots || 0) === 0;
}

function areConsecutiveOrnamentRuleNotes(notes, leftIndex, rightIndex, options = {}) {
  const left = notes[leftIndex];
  const right = notes[rightIndex];

  if (!left || !right || isRest(left) || isRest(right)) {
    return false;
  }

  if (areConsecutiveSixteenthNotes(left, right)) {
    return true;
  }

  const tupletNoteIndexes = options.tupletNoteIndexes;
  return Number(left.duration) === 8 &&
    Number(right.duration) === 8 &&
    Boolean(tupletNoteIndexes?.has(leftIndex) || tupletNoteIndexes?.has(rightIndex));
}

function removeOrnamentChars(note, chars) {
  if (note.ornaments == null) {
    return note;
  }

  const ornaments = String(note.ornaments).replace(new RegExp(`[${chars}]`, "g"), "");

  if (!ornaments) {
    const { ornaments: _ornaments, ...rest } = note;
    return rest;
  }

  return {
    ...note,
    ornaments,
  };
}

// Diddles and cheese need sixteenths or faster, or eighths inside a tuplet.
function durationAllowsDiddles(value, allowDiddlesOnEighths) {
  const duration = Number(value);
  return duration > 8 || (duration === 8 && allowDiddlesOnEighths);
}

function cleanDurationRestrictedOrnaments(
  note,
  ornaments = note?.ornaments || "",
  { allowDiddlesOnEighths = false } = {}
) {
  const durationDisallowsDiddles = !durationAllowsDiddles(note?.duration, allowDiddlesOnEighths);
  const cleanedOrnaments = durationDisallowsDiddles
    ? String(ornaments).replace(/[dc]/g, "")
    : String(ornaments);

  return cleanedOrnaments;
}

function enforceDurationOrnamentRules(notes, options = {}) {
  return (notes || []).map((note, noteIndex) => {
    if (isRest(note) || note.ornaments == null) {
      return note;
    }

    const ornaments = cleanDurationRestrictedOrnaments(note, note.ornaments, {
      ...options,
      allowDiddlesOnEighths: options.allowDiddlesOnEighths ||
        options.tupletNoteIndexes?.has(noteIndex),
    });

    if (!ornaments) {
      const { ornaments: _ornaments, ...rest } = note;
      return rest;
    }

    return ornaments === note.ornaments
      ? note
      : {
          ...note,
          ornaments,
        };
  });
}

// Successive played notes (no rest between, any note values, across the repeat).
function areSuccessivePlayedNotes(notes, leftIndex, rightIndex) {
  return Boolean(notes[leftIndex] && notes[rightIndex] &&
    !isRest(notes[leftIndex]) && !isRest(notes[rightIndex]));
}

// No diddle directly before or after a cheese on successive notes.
function removeDiddleBeforeConsecutiveCheese(notes) {
  const cleaned = (notes || []).map((note) => ({ ...note }));

  for (let index = 0; cleaned.length > 1 && index < cleaned.length; index += 1) {
    const nextIndex = (index + 1) % cleaned.length;
    if (!areSuccessivePlayedNotes(cleaned, index, nextIndex)) continue;
    const ornaments = String(cleaned[index].ornaments || "");
    const nextOrnaments = String(cleaned[nextIndex].ornaments || "");

    if (/d/.test(ornaments) && /c/.test(nextOrnaments)) {
      cleaned[nextIndex] = removeOrnamentChars(cleaned[nextIndex], "c");
    } else if (/c/.test(ornaments) && /d/.test(nextOrnaments)) {
      cleaned[nextIndex] = removeOrnamentChars(cleaned[nextIndex], "d");
    }
  }

  return cleaned;
}

function noteCanShareStickingWithPrevious(notes, leftIndex, rightIndex, options = {}) {
  return !(
    areConsecutiveOrnamentRuleNotes(notes, leftIndex, rightIndex, options) &&
    /[dc]/.test(String(notes[leftIndex]?.ornaments || ""))
  );
}

function findRequiredMaxSameHandRun(
  notes,
  runLength,
  { allowCleanup = false, ruleOptions = {} } = {}
) {
  if (runLength <= 0) {
    return null;
  }

  const candidates = [];

  for (let start = 0; start <= notes.length - runLength; start += 1) {
    let valid = true;

    for (let offset = 0; offset < runLength; offset += 1) {
      const note = notes[start + offset];

      if (!note || isRest(note)) {
        valid = false;
        break;
      }

      if (
        offset > 0 &&
        !allowCleanup &&
        !noteCanShareStickingWithPrevious(
          notes,
          start + offset - 1,
          start + offset,
          ruleOptions
        )
      ) {
        valid = false;
        break;
      }
    }

    if (valid) {
      candidates.push({
        cleanupInternalOrnaments: allowCleanup,
        end: start + runLength - 1,
        start,
      });
    }
  }

  if (!candidates.length) {
    return null;
  }

  const interiorCandidates = candidates.filter((candidate) =>
    candidate.start > 0 && candidate.end < notes.length - 1
  );
  const candidatePool = interiorCandidates.length ? interiorCandidates : candidates;

  return candidatePool[
    hashString(JSON.stringify(notes)) % candidatePool.length
  ];
}

function removeInternalRequiredRunConflicts(notes, targetRun, options = {}) {
  if (!targetRun || !targetRun.cleanupInternalOrnaments) {
    return notes;
  }

  const nextNotes = notes.map((note) => ({ ...note }));

  for (let index = targetRun.start; index < targetRun.end; index += 1) {
    if (!noteCanShareStickingWithPrevious(nextNotes, index, index + 1, options)) {
      nextNotes[index] = removeOrnamentChars(nextNotes[index], "dc");
    }
  }

  return nextNotes;
}

function createRequiredRunPlayedNote(section, sourceNote) {
  const targetDuration = getMaxSubdivisionDuration(getGenerationSubdivisions(section));
  const ornaments = String((sourceNote && sourceNote.ornaments) || "").replace(/[rl]/g, "");

  return {
    ...sourceNote,
    notes: ["C5"],
    duration: targetDuration,
    dots: 0,
    velocity: Number((sourceNote && sourceNote.velocity) || 0.5),
    ...(ornaments ? { ornaments } : {}),
  };
}

function ensureRequiredMaxSameHandRunWindow(section, notes, runLength, options = {}) {
  if (findRequiredMaxSameHandRun(notes, runLength, { ruleOptions: options })) {
    return notes;
  }

  if (findRequiredMaxSameHandRun(notes, runLength, { allowCleanup: true, ruleOptions: options })) {
    return notes;
  }

  const targetDuration = getMaxSubdivisionDuration(getGenerationSubdivisions(section));
  const targetSlots = Math.round((4 / targetDuration) / THIRTY_SECOND_QUARTER_UNITS);
  const requiredSlots = targetSlots * runLength;

  for (let index = 0; index < notes.length; index += 1) {
    const noteSlots = getNoteSlotCount(notes[index]);

    if (noteSlots < requiredSlots) {
      continue;
    }

    const requiredNotes = Array.from({ length: runLength }, () =>
      createRequiredRunPlayedNote(section, notes[index])
    );
    const remainderSlots = noteSlots - requiredSlots;
    const replacements = [...requiredNotes];

    if (remainderSlots > 0) {
      if (isRest(notes[index])) {
        pushCompressedRests(replacements, remainderSlots, notes[index]);
      } else {
        replacements.push(createPlayedNoteFromSlots(notes[index], remainderSlots));
      }
    }

    const nextNotes = notes.map((note) => ({ ...note }));
    nextNotes.splice(index, 1, ...replacements);
    return nextNotes;
  }

  return notes;
}

function ensureRequiredMaxSameHandRunWindowFixed(section, notes, runLength, options = {}) {
  if (findRequiredMaxSameHandRun(notes, runLength, { ruleOptions: options })) {
    return notes;
  }

  if (!runLength || notes.length < runLength) {
    return notes;
  }

  const candidates = [];

  for (let start = 0; start <= notes.length - runLength; start += 1) {
    candidates.push({ start, end: start + runLength - 1 });
  }

  const interiorCandidates = candidates.filter((candidate) =>
    candidate.start > 0 && candidate.end < notes.length - 1
  );
  const candidatePool = interiorCandidates.length ? interiorCandidates : candidates;

  const targetRun = candidatePool[
    hashString(`${section.id || section.title || "section"}:${JSON.stringify(notes)}`) % candidatePool.length
  ];
  const nextNotes = notes.map((note) => ({ ...note }));

  for (let index = targetRun.start; index <= targetRun.end; index += 1) {
    const note = nextNotes[index] || {};
    const ornaments = String(note.ornaments || "").replace(/[rl]/g, "");

    nextNotes[index] = {
      ...note,
      notes: ["C5"],
      duration: Number(note.duration || getMaxSubdivisionDuration(getGenerationSubdivisions(section))),
      dots: Number(note.dots || 0),
      velocity: Number(note.velocity || 0.5),
      ...(ornaments ? { ornaments } : {}),
    };
  }

  return nextNotes;
}

function enforceStickingSequenceRules(section, notes, options = {}) {
  const { preserveNoteCount = false } = options;
  let cleaned = removeDiddleBeforeConsecutiveCheese(notes, options);

  if (!sectionUsesStickings(section)) {
    return cleaned;
  }

  const maxSameHandRun = getSectionMaxSameHandStickingRun(section);
  const requiredRunLength = Number(options.requiredSameHandRunLength) || 0;
  const exclusiveRequiredAlternatives = getSectionRequiredSameHandStickingRuns(section).length > 1;

  if (requiredRunLength) {
    cleaned = preserveNoteCount
      ? ensureRequiredMaxSameHandRunWindowFixed(section, cleaned, requiredRunLength, options)
      : ensureRequiredMaxSameHandRunWindow(section, cleaned, requiredRunLength, options);
  }

  let targetRun = requiredRunLength
    ? findRequiredMaxSameHandRun(cleaned, requiredRunLength, { ruleOptions: options })
    : null;

  if (!targetRun && requiredRunLength) {
    targetRun = findRequiredMaxSameHandRun(cleaned, requiredRunLength, {
      allowCleanup: true,
      ruleOptions: options,
    });
    cleaned = removeInternalRequiredRunConflicts(cleaned, targetRun, options);
  }

  const nextNotes = cleaned.map((note) => ({ ...note }));
  const stickingRandom = exclusiveRequiredAlternatives
    ? createSeededRandom(
        `${section.id || section.title || "section"}:required-alternatives:` +
        `${options.stickingAttempt || 0}:${JSON.stringify(cleaned)}`
      )
    : null;
  let previousNote = null;
  let previousIndex = -1;
  let previousSticking = "";
  let sameHandRun = 0;

  for (let index = 0; index < nextNotes.length; index += 1) {
    const note = nextNotes[index];

    if (isRest(note)) {
      previousNote = null;
      previousIndex = -1;
      previousSticking = "";
      sameHandRun = 0;
      continue;
    }

    if (targetRun && index === targetRun.start) {
      const targetSticking = previousSticking
        ? getOppositeSticking(previousSticking)
        : getNoteSticking(note) || (hashString(JSON.stringify(targetRun)) % 2 ? "l" : "r");

      for (let runIndex = targetRun.start; runIndex <= targetRun.end; runIndex += 1) {
        nextNotes[runIndex] = withSticking(nextNotes[runIndex], targetSticking);
      }

      previousNote = nextNotes[targetRun.end];
      previousIndex = targetRun.end;
      previousSticking = targetSticking;
      sameHandRun = targetRun.end - targetRun.start + 1;
      index = targetRun.end;
      continue;
    }

    const currentSticking = exclusiveRequiredAlternatives
      ? previousSticking
        ? stickingRandom() < 0.48
          ? previousSticking
          : getOppositeSticking(previousSticking)
        : getNoteSticking(note) || (stickingRandom() < 0.5 ? "r" : "l")
      : getNoteSticking(note) || (previousSticking === "r" ? "l" : "r");
    const previousRequiresOpposite = previousNote &&
      areConsecutiveOrnamentRuleNotes(nextNotes, previousIndex, index, options) &&
      /[dc]/.test(String(previousNote.ornaments || "")) &&
      getNoteSticking(previousNote);
    let nextSticking = currentSticking;

    if (targetRun && previousIndex === targetRun.end) {
      nextSticking = getOppositeSticking(previousSticking);
    } else if (previousRequiresOpposite) {
      nextSticking = getOppositeSticking(getNoteSticking(previousNote));
    } else if (
      maxSameHandRun > 0 &&
      previousSticking &&
      currentSticking === previousSticking &&
      sameHandRun + 1 > maxSameHandRun
    ) {
      nextSticking = getOppositeSticking(previousSticking);
    }

    if (getNoteSticking(note) !== nextSticking) {
      nextNotes[index] = withSticking(note, nextSticking);
    }

    if (nextSticking === previousSticking) {
      sameHandRun += 1;
    } else {
      sameHandRun = 1;
    }

    previousNote = nextNotes[index];
    previousIndex = index;
    previousSticking = nextSticking;
  }

  return nextNotes;
}

function enforceDiddleFollowedByOppositeSticking(section, notes, options = {}) {
  if (!sectionUsesStickings(section)) {
    return notes;
  }

  const nextNotes = (notes || []).map((note) => ({ ...note }));
  const maximumPasses = Math.max(1, nextNotes.length * 2);

  for (let pass = 0; pass < maximumPasses; pass += 1) {
    let changed = false;

    for (let index = 0; nextNotes.length > 1 && index < nextNotes.length; index += 1) {
      const note = nextNotes[index];
      const nextIndex = (index + 1) % nextNotes.length;
      const next = nextNotes[nextIndex];
      const adjacentDiddlesOnSameHand =
        !isRest(note) &&
        !isRest(next) &&
        /d/.test(String(note.ornaments || "")) &&
        /d/.test(String(next.ornaments || "")) &&
        getNoteSticking(note) &&
        getNoteSticking(note) === getNoteSticking(next);

      if (
        !adjacentDiddlesOnSameHand && (
          !areConsecutiveOrnamentRuleNotes(nextNotes, index, nextIndex, options) ||
          !/[dc]/.test(String(note.ornaments || ""))
        )
      ) {
        continue;
      }

      const sticking = getNoteSticking(note);
      const requiredSticking = sticking ? getOppositeSticking(sticking) : "";

      if (!requiredSticking || getNoteSticking(next) === requiredSticking) {
        continue;
      }

      nextNotes[nextIndex] = withSticking(next, requiredSticking);
      changed = true;
    }

    if (!changed) {
      break;
    }
  }

  return nextNotes;
}

function getBoundaryStickingRunLength(notes, fromStart, sticking) {
  let runLength = 0;

  for (
    let offset = 0;
    offset < notes.length;
    offset += 1
  ) {
    const index = fromStart ? offset : notes.length - 1 - offset;
    const note = notes[index];

    if (isRest(note) || getNoteSticking(note) !== sticking) {
      break;
    }

    runLength += 1;
  }

  return runLength;
}

function repeatingBoundaryViolatesStickingRules(section, notes, options = {}) {
  if (!sectionUsesStickings(section) || !Array.isArray(notes) || notes.length < 2) {
    return false;
  }

  const first = notes[0];
  const last = notes[notes.length - 1];

  if (isRest(first) || isRest(last)) {
    return false;
  }

  const firstSticking = getNoteSticking(first);
  const lastSticking = getNoteSticking(last);

  if (
    (
      areConsecutiveOrnamentRuleNotes(notes, notes.length - 1, 0, options) &&
      /[dc]/.test(String(last.ornaments || "")) ||
      /d/.test(String(last.ornaments || "")) && /d/.test(String(first.ornaments || ""))
    ) &&
    firstSticking === lastSticking
  ) {
    return true;
  }

  if (firstSticking !== lastSticking) {
    return false;
  }

  const boundaryRunLength = Math.min(
    notes.length,
    getBoundaryStickingRunLength(notes, true, firstSticking) +
      getBoundaryStickingRunLength(notes, false, lastSticking)
  );

  return boundaryRunLength > getSectionMaxSameHandStickingRun(section);
}

function repeatingMeasureViolatesStickingRules(section, notes, options = {}) {
  if (!sectionUsesStickings(section) || !Array.isArray(notes) || notes.length < 2) {
    return false;
  }

  const maximumRun = getSectionMaxSameHandStickingRun(section);

  for (let index = 0; index < notes.length; index += 1) {
    const note = notes[index];
    const next = notes[(index + 1) % notes.length];

    if (
      (
        areConsecutiveOrnamentRuleNotes(notes, index, (index + 1) % notes.length, options) &&
        /[dc]/.test(String(note.ornaments || "")) ||
        /d/.test(String(note.ornaments || "")) && /d/.test(String(next.ornaments || ""))
      ) &&
      getNoteSticking(note) === getNoteSticking(next)
    ) {
      return true;
    }

    if (isRest(note) || !getNoteSticking(note)) {
      continue;
    }

    let runLength = 1;

    while (runLength < notes.length) {
      const candidate = notes[(index + runLength) % notes.length];

      if (isRest(candidate) || getNoteSticking(candidate) !== getNoteSticking(note)) {
        break;
      }

      runLength += 1;
    }

    if (maximumRun > 0 && runLength > maximumRun) {
      return true;
    }
  }

  const requiredRunLength = Number(options.requiredSameHandRunLength) || 0;
  if (requiredRunLength) {
    let previousSticking = "";
    let runLength = 0;
    const completedRunLengths = [];

    for (const note of notes) {
      const sticking = isRest(note) ? "" : getNoteSticking(note);

      if (sticking !== previousSticking && runLength > 0) {
        completedRunLengths.push(runLength);
      }

      runLength = sticking && sticking === previousSticking
        ? runLength + 1
        : sticking
          ? 1
          : 0;
      previousSticking = sticking;
    }

    if (runLength > 0) completedRunLengths.push(runLength);

    if (!completedRunLengths.includes(requiredRunLength)) return true;

  }

  return false;
}

function enforceRepeatingMeasureStickingRules(section, notes, options = {}) {
  if (!sectionUsesStickings(section)) {
    return notes;
  }

  let nextNotes = (notes || []).map((note) => ({ ...note }));
  const maximumAttempts = Math.max(4, nextNotes.length * 2);

  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    const attemptOptions = { ...options, stickingAttempt: attempt };
    nextNotes = enforceStickingSequenceRules(section, nextNotes, attemptOptions);
    nextNotes = enforceDiddleFollowedByOppositeSticking(section, nextNotes, attemptOptions);

    if (!repeatingMeasureViolatesStickingRules(section, nextNotes, attemptOptions)) {
      return nextNotes;
    }

    const boundaryViolation = repeatingBoundaryViolatesStickingRules(section, nextNotes, attemptOptions);
    const lastSticking = getNoteSticking(nextNotes[nextNotes.length - 1]);

    if (boundaryViolation && lastSticking && !isRest(nextNotes[0])) {
      nextNotes[0] = withSticking(nextNotes[0], getOppositeSticking(lastSticking));
    }
  }

  throw new Error(
    `${section.title || section.id || "Section"}: could not satisfy sticking rules across the repeat boundary.`
  );
}

function cleanSequentialOrnaments(notes, options = {}) {
  const cleaned = (notes || []).map((note) => ({ ...note }));

  for (let index = 0; cleaned.length > 1 && index < cleaned.length; index += 1) {
    const note = cleaned[index];
    const nextIndex = (index + 1) % cleaned.length;
    const next = cleaned[nextIndex];
    const isSequentialRulePosition = areConsecutiveOrnamentRuleNotes(
      cleaned,
      index,
      nextIndex,
      options
    );

    if (
      !isRest(note) &&
      !isRest(next) &&
      /[dc]/.test(String(note.ornaments || "")) &&
      /f/.test(String(next.ornaments || ""))
    ) {
      cleaned[nextIndex] = removeOrnamentChars(next, "f");
    }

    if (isSequentialRulePosition && /c/.test(String(note.ornaments || "")) && /c/.test(String(cleaned[nextIndex].ornaments || ""))) {
      cleaned[nextIndex] = removeOrnamentChars(cleaned[nextIndex], "c");
    }
  }

  return removeDiddleBeforeConsecutiveCheese(cleaned);
}

function stripStickingsFromNotes(notes) {
  return (notes || []).map((note) => removeOrnamentChars(note, "rl"));
}

function assignInitialStickings(section, notes, lineIndex = 0, generationSalt = "") {
  if (!sectionUsesStickings(section)) {
    return notes;
  }

  const random = createSeededRandom(
    `${section.id || section.title || "section"}:stickings:${lineIndex}:${generationSalt}:${JSON.stringify(notes)}`
  );

  return (notes || []).map((note) =>
    isRest(note) ? note : withSticking(note, random() < 0.5 ? "r" : "l")
  );
}

function areAdjacentOrnamentRuleNotes(notes, leftIndex, rightIndex, options = {}) {
  const distance = Math.abs(leftIndex - rightIndex);
  if (notes.length <= 1 || (distance !== 1 && distance !== notes.length - 1)) {
    return false;
  }

  return areConsecutiveOrnamentRuleNotes(notes, leftIndex, rightIndex, options) ||
    areConsecutiveOrnamentRuleNotes(notes, rightIndex, leftIndex, options);
}

function canAddRequiredOrnament(notes, noteIndex, ornament, options = {}) {
  if (options.primaryNoteIndexes && !options.primaryNoteIndexes.has(noteIndex)) return false;
  const limit = options.noteOrnamentLimits?.get(noteIndex);
  if (limit && !limit.includes(ORNAMENT_SETTINGS.find((setting) => setting.chars.includes(ornament))?.id)) return false;
  const note = notes[noteIndex];

  if (!note || isRest(note)) {
    return false;
  }

  const current = String(note.ornaments || "");
  const allowDiddlesOnEighths = options.allowDiddlesOnEighths ||
    options.tupletNoteIndexes?.has(noteIndex);

  if (ornament === "d" || ornament === "c") {
    if (!durationAllowsDiddles(note.duration, allowDiddlesOnEighths) ||
      /f/.test(current)) {
      return false;
    }
  }

  if (ornament === "f" && /[dc]/.test(current)) {
    return false;
  }

  if (ornament === "f") {
    const previousIndex = (noteIndex - 1 + notes.length) % notes.length;
    const previous = notes[previousIndex];

    if (
      previous &&
      !isRest(previous) &&
      /[dc]/.test(String(previous.ornaments || ""))
    ) {
      return false;
    }
  }

  if (ornament === "c" || ornament === "d") {
    const previousIndex = (noteIndex - 1 + notes.length) % notes.length;
    const nextIndex = (noteIndex + 1) % notes.length;
    const previous = String(notes[previousIndex]?.ornaments || "");
    const next = String(notes[nextIndex]?.ornaments || "");
    const previousSuccessive = areSuccessivePlayedNotes(notes, previousIndex, noteIndex);
    const nextSuccessive = areSuccessivePlayedNotes(notes, noteIndex, nextIndex);

    // Diddles and cheese never touch each other on successive notes, and no flam follows either.
    if (previousSuccessive && (ornament === "d" ? /c/ : /[dc]/).test(previous)) {
      return false;
    }
    if (nextSuccessive && (/f/.test(next) || (ornament === "d" ? /c/ : /[dc]/).test(next))) {
      return false;
    }
  }

  return true;
}

function addOrnamentToNote(note, ornament) {
  const ornaments = String(note.ornaments || "");

  return {
    ...note,
    ornaments: ornaments.includes(ornament) ? ornaments : `${ornaments}${ornament}`,
    ...(ornament === "a" ? { velocity: 1 } : {}),
  };
}

function getNearestOrnamentDistance(notes, noteIndex, ornament) {
  const ornamentIndexes = (notes || []).flatMap((note, index) =>
    String(note.ornaments || "").includes(ornament) ? [index] : []
  );

  if (!ornamentIndexes.length) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.min(...ornamentIndexes.map((ornamentIndex) => {
    const directDistance = Math.abs(noteIndex - ornamentIndex);
    return Math.min(directDistance, notes.length - directDistance);
  }));
}

function getOrnamentPlacementRandomValue(section, lineIndex, ornament, placedCount, noteIndex) {
  return createSeededRandom(
    `${section.id || section.title || "section"}:${lineIndex}:${ornament}:${placedCount}:${noteIndex}:placement`
  )();
}

function getDiddleTupletPositionRank(
  section,
  notes,
  noteIndex,
  lineIndex,
  placedCount,
  options = {}
) {
  const positionInfo = options.tupletPositionByNoteIndex?.get(noteIndex);

  if (
    Number(positionInfo?.actual) !== 3 ||
    Number(positionInfo?.type) !== 8
  ) {
    return 0;
  }

  const usageCounts = [0, 0, 0];

  for (let index = 0; index < notes.length; index += 1) {
    if (!String(notes[index]?.ornaments || "").includes("d")) {
      continue;
    }

    const existingPosition = options.tupletPositionByNoteIndex?.get(index);

    if (
      Number(existingPosition?.actual) === 3 &&
      Number(existingPosition?.type) === 8
    ) {
      usageCounts[existingPosition.position] += 1;
    }
  }

  const preferredPosition = Math.floor(
    createSeededRandom(
      `${section.id || section.title || "section"}:${lineIndex}:${placedCount}:diddle-triplet-position`
    )() * 3
  );
  const positionDistance = Math.min(
    Math.abs(positionInfo.position - preferredPosition),
    3 - Math.abs(positionInfo.position - preferredPosition)
  );

  return usageCounts[positionInfo.position] * 3 + positionDistance;
}

function getScaledOrnamentTarget(section, baseTarget, maximumTarget, lineIndex, ornament) {
  const density = normalizeGlobalOrnamentDensity(section.globalOrnamentDensity);
  const exactTarget = baseTarget * density / 100;
  const lowerTarget = Math.floor(exactTarget);
  const fractionalTarget = exactTarget - lowerTarget;
  const random = createSeededRandom(
    `${section.id || section.title || "section"}:${lineIndex}:${ornament}:${density}:density`
  );
  const scaledTarget = lowerTarget + (random() < fractionalTarget ? 1 : 0);

  return Math.max(1, Math.min(maximumTarget, scaledTarget));
}

function getOrnamentFrequencyProfile(section, notes, lineIndex, options = {}) {
  const requiredOrnaments = getRequiredSectionOrnamentChars(section);
  const varietyOrnaments = requiredOrnaments.filter((ornament) => ornament !== "a");
  const targets = new Map(requiredOrnaments.map((ornament) => [ornament, 1]));

  if (requiredOrnaments.length < 2) {
    return { featuredOrnament: "", targets, varietyOrnaments };
  }

  if (requiredOrnaments.includes("a")) {
    const playedCount = countPlayedNotes(notes);
    const accentDensity = 2 + (
      lineIndex + hashString(`${section.id || section.title || "section"}:accents`)
    ) % 3;
    targets.set(
      "a",
      getScaledOrnamentTarget(section, accentDensity, playedCount, lineIndex, "a")
    );
  }

  if (!varietyOrnaments.length) {
    return { featuredOrnament: "", targets, varietyOrnaments };
  }

  const featuredIndex = (
    lineIndex + hashString(section.id || section.title || "section")
  ) % varietyOrnaments.length;
  const featuredOrnament = varietyOrnaments[featuredIndex];
  const densityStep = Math.floor(lineIndex / varietyOrnaments.length) % 3;

  for (const ornament of varietyOrnaments) {
    const eligibleCount = (notes || []).filter((note, noteIndex) =>
      canAddRequiredOrnament(notes, noteIndex, ornament, options)
    ).length;
    const musicalMaximum = ornament === "c"
      ? Math.ceil(eligibleCount / 2)
      : eligibleCount;
    const baseTarget = ornament === featuredOrnament
      ? 3 + (densityStep % 2)
      : 1;

    targets.set(ornament, getScaledOrnamentTarget(
      section,
      baseTarget,
      musicalMaximum,
      lineIndex,
      ornament
    ));
  }

  return { featuredOrnament, targets, varietyOrnaments };
}

function resetProfiledOrnaments(notes, requiredOrnaments, options = {}) {
  const pattern = requiredOrnaments.join("");

  return (notes || []).map((note, index) => {
    if (options.primaryNoteIndexes && !options.primaryNoteIndexes.has(index)) return note;
    const hadAccent = String(note.ornaments || "").includes("a");
    const cleaned = removeOrnamentChars(note, pattern);

    return hadAccent ? { ...cleaned, velocity: 0.5 } : cleaned;
  });
}

function ensureRequiredOrnamentsOnNotes(section, notes, lineIndex = 0, options = {}) {
  // Late retries vary placement too, so small pages don't repeat one failing choice.
  const placementLine = options.placementSalt ? `${lineIndex}:${options.placementSalt}` : lineIndex;
  const requiredOrnaments = getRequiredSectionOrnamentChars(section);
  const shouldApplyFrequencyProfile = requiredOrnaments.length > 1;
  const nextNotes = shouldApplyFrequencyProfile
    ? resetProfiledOrnaments(notes, requiredOrnaments, options)
    : (notes || []).map((note) => ({ ...note }));
  const { featuredOrnament, targets, varietyOrnaments } = getOrnamentFrequencyProfile(
    section,
    nextNotes,
    lineIndex,
    options
  );
  const assignedIndexes = new Set();
  const placementOrder = [
    ...varietyOrnaments.filter((ornament) => ornament !== featuredOrnament),
    ...(featuredOrnament ? [featuredOrnament] : []),
    ...(requiredOrnaments.includes("a") ? ["a"] : []),
  ];

  for (const ornament of placementOrder) {
    const targetCount = targets.get(ornament) || 1;

    while (nextNotes.filter((note, index) =>
      (!options.primaryNoteIndexes || options.primaryNoteIndexes.has(index)) && !isRest(note) && String(note.ornaments || "").includes(ornament)
    ).length < targetCount) {
      const placedOrnamentCount = nextNotes.filter((note, index) =>
        (!options.primaryNoteIndexes || options.primaryNoteIndexes.has(index)) && !isRest(note) && String(note.ornaments || "").includes(ornament)
      ).length;
      const allowAdjacentDiddle = ornament === "d" &&
        placedOrnamentCount === 1 &&
        hashString(`${section.id || section.title || "section"}:${lineIndex}:adjacent-diddles`) % 5 === 0;
      const candidates = nextNotes
        .map((note, index) => ({ index, note }))
        .filter(({ index, note }) =>
          !String(note.ornaments || "").includes(ornament) &&
          canAddRequiredOrnament(nextNotes, index, ornament, options)
        )
        .sort((left, right) => {
          const leftUsed = assignedIndexes.has(left.index) ? 1 : 0;
          const rightUsed = assignedIndexes.has(right.index) ? 1 : 0;
          const leftUseRank = ornament === "a" ? 1 - leftUsed : leftUsed;
          const rightUseRank = ornament === "a" ? 1 - rightUsed : rightUsed;
          const leftCount = String(left.note.ornaments || "").length;
          const rightCount = String(right.note.ornaments || "").length;
          const leftDiddleDistance = ornament === "d"
            ? getNearestOrnamentDistance(nextNotes, left.index, ornament)
            : 0;
          const rightDiddleDistance = ornament === "d"
            ? getNearestOrnamentDistance(nextNotes, right.index, ornament)
            : 0;
          const leftAdjacentDiddle = ornament === "d" && nextNotes.some((note, index) =>
            /d/.test(String(note.ornaments || "")) &&
            areAdjacentOrnamentRuleNotes(nextNotes, left.index, index, options)
          );
          const rightAdjacentDiddle = ornament === "d" && nextNotes.some((note, index) =>
            /d/.test(String(note.ornaments || "")) &&
            areAdjacentOrnamentRuleNotes(nextNotes, right.index, index, options)
          );
          const leftDiddleAdjacencyRank = ornament !== "d"
            ? 0
            : allowAdjacentDiddle
              ? Number(!leftAdjacentDiddle)
              : Number(leftAdjacentDiddle);
          const rightDiddleAdjacencyRank = ornament !== "d"
            ? 0
            : allowAdjacentDiddle
              ? Number(!rightAdjacentDiddle)
              : Number(rightAdjacentDiddle);
          const leftDiddleTupletPositionRank = ornament === "d"
            ? getDiddleTupletPositionRank(
                section,
                nextNotes,
                left.index,
                lineIndex,
                placedOrnamentCount,
                options
              )
            : 0;
          const rightDiddleTupletPositionRank = ornament === "d"
            ? getDiddleTupletPositionRank(
                section,
                nextNotes,
                right.index,
                lineIndex,
                placedOrnamentCount,
                options
              )
            : 0;
          const leftDiddleSpacingRank = ornament !== "d"
            ? 0
            : leftDiddleDistance >= 3 ? 0 : leftDiddleDistance === 2 ? 1 : 2;
          const rightDiddleSpacingRank = ornament !== "d"
            ? 0
            : rightDiddleDistance >= 3 ? 0 : rightDiddleDistance === 2 ? 1 : 2;
          const leftRandomValue = getOrnamentPlacementRandomValue(
            section,
            placementLine,
            ornament,
            placedOrnamentCount,
            left.index
          );
          const rightRandomValue = getOrnamentPlacementRandomValue(
            section,
            placementLine,
            ornament,
            placedOrnamentCount,
            right.index
          );

          return leftUseRank - rightUseRank ||
            leftDiddleAdjacencyRank - rightDiddleAdjacencyRank ||
            leftDiddleTupletPositionRank - rightDiddleTupletPositionRank ||
            leftDiddleSpacingRank - rightDiddleSpacingRank ||
            leftCount - rightCount ||
            leftRandomValue - rightRandomValue;
        });

      if (!candidates.length) {
        let repairedTupletTarget = false;

        if ((ornament === "d" || ornament === "c") && options.tupletNoteIndexes?.size) {
          for (const noteIndex of options.tupletNoteIndexes) {
            if (String(nextNotes[noteIndex]?.ornaments || "").includes(ornament)) {
              continue;
            }

            const repairedNote = removeOrnamentChars(
              createPlayedNoteFrom(nextNotes[noteIndex]),
              "f"
            );
            const repairedNotes = nextNotes.map((note, index) =>
              index === noteIndex ? repairedNote : note
            );

            if (canAddRequiredOrnament(repairedNotes, noteIndex, ornament, options)) {
              nextNotes[noteIndex] = repairedNote;
              repairedTupletTarget = true;
              break;
            }
          }
        }

        if (repairedTupletTarget) {
          continue;
        }

        const placedCount = nextNotes.filter((note, index) =>
          (!options.primaryNoteIndexes || options.primaryNoteIndexes.has(index)) && !isRest(note) && String(note.ornaments || "").includes(ornament)
        ).length;

        if (!placedCount) {
          throw new Error(
            `${section.title || section.id || "Section"} line ${lineIndex + 1}: ` +
            `cannot place required ornament "${ornament}" on an eligible played note.`
          );
        }

        break;
      }

      const selected = candidates[0];
      nextNotes[selected.index] = addOrnamentToNote(nextNotes[selected.index], ornament);
      if (ornament !== "a") {
        assignedIndexes.add(selected.index);
      }
    }
  }

  return nextNotes;
}

function finalizeGeneratedScore(section, score, lineIndex = 0, generationSalt = "") {
  const policyScore = applySectionOrnamentPolicy(section, score);
  const everyNoteScore = enforcePlayEveryNote(section, policyScore);
  const minimumScore = enforceMinimumPlayedNotes(section, everyNoteScore, lineIndex);
  const boundedScore = enforceMaximumPlayedNotes(section, minimumScore, lineIndex);
  const configuredTuplets = getGenerationTuplets(section);

  return {
    ...boundedScore,
    measures: (boundedScore.measures || []).map((measure) => ({
      ...measure,
      parts: (measure.parts || []).map((part) => ({
        ...part,
        voices: (part.voices || []).map((voice) => {
          const hasTuplets = Array.isArray(voice.tuplets) && voice.tuplets.length > 0;
          const sourceTupletNoteIndexes = new Set(
            (voice.tuplets || []).flatMap((tuplet) =>
              Array.from(
                { length: Math.max(0, Number(tuplet.end) - Number(tuplet.start)) },
                (_, offset) => Number(tuplet.start) + offset
              )
            )
          );
          const cleanedNotes = cleanSequentialOrnaments(
            stripStickingsFromNotes(voice.notes || []),
            { tupletNoteIndexes: sourceTupletNoteIndexes }
          );
          const notationVoice = hasTuplets
            ? preferLongerValuesInTupletVoice({
                ...voice,
                notes: cleanedNotes,
              }, configuredTuplets)
            : {
                notes: preferLongerValues(cleanedNotes, getPreferLongerValueOptions()),
                tuplets: [],
              };
          const preliminaryTupletNoteIndexes = new Set(
            notationVoice.tuplets.flatMap((tuplet) =>
              Array.from(
                { length: Math.max(0, Number(tuplet.end) - Number(tuplet.start)) },
                (_, offset) => Number(tuplet.start) + offset
              )
            )
          );
          const requiredSameHandRunLength = getRequiredSameHandStickingRunForLine(
            section,
            Number.parseInt(lineIndex, 10) || 0
          );
          const preliminaryDurationOrnamentOptions = {
            tupletNoteIndexes: preliminaryTupletNoteIndexes,
            tupletPositionByNoteIndex: getTupletPositionByNoteIndex(
              notationVoice.notes,
              notationVoice.tuplets,
              configuredTuplets
            ),
            requiredSameHandRunLength,
          };
          const cappedNotes = enforceMaximumPlayedNotesInNotes(
            section,
            enforceDurationOrnamentRules(
              notationVoice.notes,
              preliminaryDurationOrnamentOptions
            ),
            `${lineIndex}:final`
          );
          const finalNotationVoice = hasTuplets
            ? preferLongerValuesInTupletVoice({
                ...notationVoice,
                notes: cappedNotes,
              }, configuredTuplets)
            : {
                notes: preferLongerValues(cappedNotes, getPreferLongerValueOptions()),
                tuplets: [],
              };
          const finalTupletNoteIndexes = new Set(
            finalNotationVoice.tuplets.flatMap((tuplet) =>
              Array.from(
                { length: Math.max(0, Number(tuplet.end) - Number(tuplet.start)) },
                (_, offset) => Number(tuplet.start) + offset
              )
            )
          );
          const retryAttempt = Number(String(generationSalt).split(":")[1]) || 0;
          const durationOrnamentOptions = {
            ...(retryAttempt >= LATE_RETRY_ATTEMPT ? { placementSalt: generationSalt } : {}),
            ...(section.primaryRhythms ? { primaryNoteIndexes: getPrimaryNoteIndexes(section, finalNotationVoice) } : {}),
            noteOrnamentLimits: getPrimaryNoteOrnamentLimits(section, finalNotationVoice),
            tupletNoteIndexes: finalTupletNoteIndexes,
            tupletPositionByNoteIndex: getTupletPositionByNoteIndex(
              finalNotationVoice.notes,
              finalNotationVoice.tuplets,
              configuredTuplets
            ),
            requiredSameHandRunLength,
          };
          const notationNotes = applyRhythmPoolOrnaments(section, finalNotationVoice).notes;
          const ornamentedNotes = ensureRequiredOrnamentsOnNotes(
            section,
            removeDiddleBeforeConsecutiveCheese(
              cleanSequentialOrnaments(
                enforceDurationOrnamentRules(notationNotes, durationOrnamentOptions),
                durationOrnamentOptions
              ),
              durationOrnamentOptions
            ),
            lineIndex,
            durationOrnamentOptions
          );
          const finalOrnamentNotes = cleanSequentialOrnaments(
            ornamentedNotes,
            durationOrnamentOptions
          );
          const stickingNotes = enforceRepeatingMeasureStickingRules(
            section,
            assignInitialStickings(section, finalOrnamentNotes, lineIndex, generationSalt),
            {
              ...durationOrnamentOptions,
              preserveNoteCount: hasTuplets,
            }
          );

          return applyRhythmPoolOrnaments(section, {
            ...voice,
            tuplets: finalNotationVoice.tuplets,
            notes: stickingNotes,
          });
        }),
      })),
    })),
  };
}

function getFallbackGenerationOptions(section, samplePayload) {
  const subdivisions = getGenerationSubdivisions(section, samplePayload);
  const ornaments = getGenerationOrnaments(section, samplePayload);
  const tuplets = getGenerationTuplets(section, samplePayload);
  const maxSubdivisionDuration = getMaxSubdivisionDuration(subdivisions);

  return {
    allowAccents: ornaments.includes("accents"),
    allowCheese: ornaments.includes("cheese"),
    allowDiddles: ornaments.includes("diddles"),
    allowFlams: ornaments.includes("flams"),
    allowQuarter: true,
    allowSixteenth: maxSubdivisionDuration >= 16,
    allowSticking: ornaments.includes("stickings"),
    allowThirtySecond: maxSubdivisionDuration >= 32,
    maxSubdivisionDuration,
    ornamentDensityFactor: normalizeGlobalOrnamentDensity(
      section.globalOrnamentDensity
    ) / 100,
    subdivisions,
    tuplets,
  };
}

function getDurationBySlots(slots, baseDuration) {
  const quarterUnits = slots * (4 / baseDuration);
  const rounded = Math.round(quarterUnits * 1000) / 1000;
  const durationMap = {
    0.125: { duration: 32, dots: 0 },
    0.25: { duration: 16, dots: 0 },
    0.375: { duration: 16, dots: 1 },
    0.5: { duration: 8, dots: 0 },
    0.75: { duration: 8, dots: 1 },
    1: { duration: 4, dots: 0 },
    1.5: { duration: 4, dots: 1 },
  };

  return durationMap[rounded] || { duration: baseDuration, dots: 0 };
}

function createFallbackOrnaments(options, random, playedIndex, previousOrnaments) {
  let ornaments = "";
  const densityFactor = options.ornamentDensityFactor || 1;

  if (options.allowFlams && random() < Math.min(0.95, 0.18 * densityFactor)) {
    ornaments += "f";
  }

  if (options.allowAccents && random() < Math.min(0.95, 0.32 * densityFactor)) {
    ornaments += "a";
  }

  const adjacentDiddleChance = (
    String(previousOrnaments || "").includes("d") ? 0.03 : 0.15
  ) * densityFactor;
  if (options.allowDiddles && !ornaments.includes("f") && random() < adjacentDiddleChance) {
    ornaments += "d";
  }

  if (
    options.allowCheese &&
    !ornaments.includes("f") &&
    !String(previousOrnaments || "").includes("c") &&
    random() < Math.min(0.95, 0.12 * densityFactor)
  ) {
    ornaments += "c";
  }

  return ornaments;
}

function createRandomPlayedSlots(slotCount, minimumPlayedNotes, maximumPlayedNotes, random) {
  const naturalMinimum = Math.ceil(slotCount * (slotCount >= 16 ? 0.45 : 0.35));
  const upperBound = maximumPlayedNotes
    ? Math.min(slotCount, Math.max(maximumPlayedNotes, minimumPlayedNotes))
    : slotCount;
  const lowerBound = Math.min(upperBound, Math.max(minimumPlayedNotes, naturalMinimum));
  const playedSlotCount = randomInteger(random, lowerBound, upperBound);
  const playedIndexes = new Set(shuffledIndexes(slotCount, random).slice(0, playedSlotCount));

  return Array.from({ length: slotCount }, (_, index) => playedIndexes.has(index));
}

function createPlayedSlotsInShareRange(slotCount, [minShare, maxShare], random) {
  const lower = Math.max(1, Math.ceil(slotCount * minShare - 1e-9));
  const upper = Math.max(lower, Math.min(slotCount, Math.round(slotCount * maxShare)));
  const playedIndexes = new Set(shuffledIndexes(slotCount, random).slice(0, randomInteger(random, lower, upper)));
  return Array.from({ length: slotCount }, (_, index) => playedIndexes.has(index));
}

function createNotesFromPlayedSlots(slots, unitPerSlot, options, random) {
  const notes = [];
  let slotIndex = 0;
  let playedIndex = 0;
  const baseDuration = options.maxSubdivisionDuration;

  while (slotIndex < slots.length) {
    const isPlayedRun = slots[slotIndex];
    let runSlotCount = 1;

    while (slots[slotIndex + runSlotCount] === isPlayedRun) {
      runSlotCount += 1;
    }

    let remainingUnits = runSlotCount * unitPerSlot;

    while (remainingUnits > 0) {
      const chunkUnits = unitPerSlot;
      const durationByUnits = getDurationBySlots(chunkUnits, baseDuration);
      const previousOrnaments = notes[notes.length - 1]?.ornaments || "";
      const ornaments = isPlayedRun
        ? createFallbackOrnaments(options, random, playedIndex, previousOrnaments)
        : "";

      notes.push({
        notes: isPlayedRun ? ["C5"] : [],
        ...durationByUnits,
        velocity: ornaments.includes("a") ? 1 : 0.5,
        ...(ornaments ? { ornaments } : {}),
      });

      playedIndex += isPlayedRun ? 1 : 0;
      remainingUnits -= chunkUnits;
    }

    slotIndex += runSlotCount;
  }

  return notes;
}

function canFillMixedTupletSlots(remainingSlots, slotCounts, memo = new Map()) {
  if (remainingSlots === 0) return true;
  if (remainingSlots < 0) return false;
  if (memo.has(remainingSlots)) return memo.get(remainingSlots);

  const canFill = slotCounts.some((slotCount) =>
    canFillMixedTupletSlots(remainingSlots - slotCount, slotCounts, memo)
  );
  memo.set(remainingSlots, canFill);
  return canFill;
}

function getMaximumMixedEventCount(
  remainingSlots,
  blocks,
  requireRegular,
  usedRegular = false,
  usedTuplet = false,
  memo = new Map()
) {
  if (remainingSlots === 0) {
    return usedTuplet && (!requireRegular || usedRegular)
      ? 0
      : Number.NEGATIVE_INFINITY;
  }
  if (remainingSlots < 0) return Number.NEGATIVE_INFINITY;

  const key = `${remainingSlots}:${requireRegular}:${usedRegular}:${usedTuplet}`;
  if (memo.has(key)) return memo.get(key);

  const maximum = Math.max(...blocks.map((block) => {
    const remainderMaximum = getMaximumMixedEventCount(
      remainingSlots - block.slotCount,
      blocks,
      requireRegular,
      usedRegular || block.kind === "regular",
      usedTuplet || block.kind === "tuplet",
      memo
    );
    const eventCount = block.kind === "tuplet"
      ? block.tuplet.actual
      : block.kind === "regular"
        ? 1
        : 0;
    return Number.isFinite(remainderMaximum)
      ? eventCount + remainderMaximum
      : Number.NEGATIVE_INFINITY;
  }));
  memo.set(key, maximum);
  return maximum;
}


// Sections with a secondary pool are built beat by beat: each beat holds one
// tuplet or one regular value throughout (a full beat of sixteenths, never a
// partial one). Groups that end mid-beat, such as tuplets over three eighths,
// are paired with a filler that completes the beat, such as one eighth or two
// sixteenths; thirty-seconds fill only when nothing longer fits.
// With chainPrimaryGroups, a primary group may occasionally repeat back to back
// before the filler that completes its beat.
function createBeatStructuredLayout(requiredBlocks, availableBlocks, random, { chainPrimaryGroups = false } = {}) {
  const regular = availableBlocks.filter((block) => block.kind === "regular" && SLOTS_PER_BEAT % block.slotCount === 0);
  const slotsOf = (unit) => unit.reduce((sum, block) => sum + block.slotCount, 0);
  const groupUnit = (block, count) => {
    const groups = Array(count).fill(block);
    const fillerSlots = (SLOTS_PER_BEAT - (block.slotCount * count) % SLOTS_PER_BEAT) % SLOTS_PER_BEAT;
    if (!fillerSlots) return groups;
    const fitting = regular.filter((candidate) => fillerSlots % candidate.slotCount === 0);
    const values = fitting.some((candidate) => candidate.slotCount > 1)
      ? fitting.filter((candidate) => candidate.slotCount > 1) : fitting;
    if (!values.length) return null;
    const value = values[randomInteger(random, 0, values.length - 1)];
    const filler = Array(fillerSlots / value.slotCount).fill(value);
    return random() < 0.5 ? [...filler, ...groups] : [...groups, ...filler];
  };
  const tupletUnit = (block, maxSlots = 32) => {
    if (!chainPrimaryGroups || !requiredBlocks.includes(block)) return groupUnit(block, 1);
    // Usually one group; each extra group in a row is an occasional surprise.
    let count = 1;
    while (random() < PRIMARY_CHAIN_PROBABILITY && (count + 1) * block.slotCount <= maxSlots) count += 1;
    for (; count >= 1; count -= 1) {
      const unit = groupUnit(block, count);
      if (unit && slotsOf(unit) <= maxSlots) return unit;
    }
    return null;
  };
  const units = [];
  for (const block of requiredBlocks) {
    const used = units.reduce((sum, unit) => sum + slotsOf(unit), 0);
    const unit = block.kind === "tuplet" ? tupletUnit(block, 32 - used) : Array(SLOTS_PER_BEAT / block.slotCount).fill(block);
    if (!unit) return null;
    units.push(unit);
  }
  let remaining = 32 - units.reduce((sum, unit) => sum + slotsOf(unit), 0);
  const optional = [
    ...regular.map((block) => ({ weight: 0.42, make: () => Array(SLOTS_PER_BEAT / block.slotCount).fill(block) })),
    ...availableBlocks.filter((block) => block.kind === "tuplet")
      .map((block) => ({ weight: 0.68, make: () => tupletUnit(block, remaining) })),
  ];
  while (remaining > 0) {
    const candidates = optional.map((option) => option.make())
      .filter((unit) => unit && slotsOf(unit) <= remaining);
    if (!candidates.length) return null;
    const preferred = candidates.filter((unit) => random() < (unit.some((block) => block.kind === "tuplet") ? 0.68 : 0.42));
    const pool = preferred.length ? preferred : candidates;
    const unit = pool[randomInteger(random, 0, pool.length - 1)];
    units.push(unit);
    remaining -= slotsOf(unit);
  }
  if (remaining !== 0) return null;
  const ordered = shuffledIndexes(units.length, random).map((index) => units[index]);
  if (chainPrimaryGroups) separatePrimaryUnits(ordered, requiredBlocks);
  return ordered.flat();
}

// Separate placements of the primary group shouldn't run together by accident:
// move a filler between them so groups touch only when a chain chose it.
function separatePrimaryUnits(units, primaryBlocks) {
  const isPrimary = (block) => primaryBlocks.includes(block);
  const rotate = (unit, fillerFirst) => {
    const groups = unit.filter(isPrimary);
    const filler = unit.filter((block) => !isPrimary(block));
    return fillerFirst ? [...filler, ...groups] : [...groups, ...filler];
  };
  for (let index = 1; index < units.length; index += 1) {
    const left = units[index - 1];
    const right = units[index];
    if (!isPrimary(left[left.length - 1]) || !isPrimary(right[0])) continue;
    if (right.some((block) => !isPrimary(block))) units[index] = rotate(right, true);
    else if (left.some((block) => !isPrimary(block))) units[index - 1] = rotate(left, false);
  }
}

function getBlockEvents(block, random) {
  if (block.kind === "regular") return [{ duration: block.duration, dots: 0, tuplet: null }];
  if (block.kind === "rest") return [{ ...getNotationValueBySlots(block.slotCount), forceRest: true, tuplet: null }];
  // Half- and quarter-note tuplets may split a note into two of the next shorter
  // value (down to eighths), which can carry diddles.
  const split = (duration) => duration < 8 && block.splitQuarters && random() < 0.5
    ? [...split(duration * 2), ...split(duration * 2)] : [duration];
  return Array.from({ length: block.tuplet.actual }, () => split(Number(block.tuplet.type)))
    .flat().map((duration) => ({ duration, dots: 0, tuplet: block.tuplet }));
}

// With fullPrimaryGroupShare, each primary group is either fully played or keeps
// at least one visible rest. Choices run evenly through the page (a running
// share, offset by exercise), so every page lands near the requested balance.
// Eighth-note and slower tuplets put the rest first, since a rest after a note
// there reads as a longer note.
function balancePrimaryGroupRests(layout, blockEvents, playedSlots, primaryBlocks, section, random, lineIndex = 0, attempt = 0) {
  if (section.fullPrimaryGroupShare == null || getSectionPlayEveryNote(section)) return;
  const share = Math.max(0, Math.min(1, Number(section.fullPrimaryGroupShare) || 0));
  let start = 0;
  let group = 0;
  layout.forEach((block, blockIndex) => {
    const count = blockEvents[blockIndex].length;
    if (primaryBlocks.includes(block) && count > 1) {
      const indexes = Array.from({ length: count }, (_, offset) => start + offset);
      const position = lineIndex + group;
      group += 1;
      // Late retries choose at random so an exercise that can't work one way can resolve.
      const fullyPlayed = attempt >= BALANCE_RETRY_ATTEMPT
        ? random() < share
        : Math.floor((position + 1) * share) > Math.floor(position * share);
      if (fullyPlayed) {
        indexes.forEach((index) => { playedSlots[index] = true; });
      } else {
        const restIndex = Number(block.tuplet.type) >= 16 ? indexes[randomInteger(random, 0, count - 1)] : indexes[0];
        playedSlots[restIndex] = false;
        if (indexes.every((index) => !playedSlots[index])) {
          playedSlots[indexes.find((index) => index !== restIndex)] = true;
        }
      }
    }
    start += count;
  });
}

function rhythmPoolHasRhythms(pool) {
  return pool.subdivisions.length > 0 || pool.tuplets.length > 0;
}

function createMixedTupletFallbackGeneratedScore(section, options, random, lineIndex = 0, attempt = 0) {
  const tupletBlocks = options.tuplets
    .map((tuplet) => ({
      kind: "tuplet",
      slotCount: Number(tuplet.normal) * (32 / Number(tuplet.type)),
      tuplet,
    }))
    .filter((block) => Number.isInteger(block.slotCount) && block.slotCount > 0 && block.slotCount <= 32);
  const regularBlocks = SUBDIVISION_SETTINGS.filter((setting) => options.subdivisions.includes(setting.id))
    .map((setting) => ({ kind: "regular", slotCount: 32 / setting.duration, duration: setting.duration, id: setting.id }));
  const tupletSlotCounts = [...new Set(tupletBlocks.map((block) => block.slotCount))];
  const tupletsCanFillMeasure = canFillMixedTupletSlots(32, tupletSlotCounts);
  const restBlocks = options.subdivisions.length || tupletsCanFillMeasure
    ? []
    : NOTATION_SLOT_COUNTS_DESCENDING.map((slotCount) => ({
        kind: "rest",
        slotCount,
      }));
  let availableBlocks = [...regularBlocks, ...tupletBlocks, ...restBlocks];
  const primary = section.primaryRhythms;
  // requirePrimaryRhythms: false draws everything at random from the pool.
  const requiredBlocks = primary && section.requirePrimaryRhythms !== false ? availableBlocks.filter((block) =>
    block.kind === "regular" ? primary.subdivisions.includes(block.id)
      : block.kind === "tuplet" && primary.tuplets.some((tuplet) =>
        tuplet.actual === block.tuplet.actual && tuplet.normal === block.tuplet.normal && tuplet.type === block.tuplet.type)
  ) : [];
  const requiredSlots = requiredBlocks.reduce((sum, block) => sum + block.slotCount, 0);
  if (requiredSlots > 32) throw new Error("The selected primary rhythms cannot all fit in one 4/4 measure. Select fewer primary rhythms.");
  if (primary) {
    // Draw a fresh subset of optional families for each exercise, including none.
    availableBlocks = availableBlocks.filter((block) =>
      requiredBlocks.includes(block) || block.kind === "rest" || random() < 0.75
    );
  }
  if (getSectionPlayEveryNote(section) && !canFillMixedTupletSlots(32,
    availableBlocks.filter((block) => block.kind !== "rest").map((block) => block.slotCount))) {
    throw new Error("This span cannot fill 4/4 without rests. Select secondary rhythms to fill the remaining space, or allow rests.");
  }
  const slotCounts = [...new Set(availableBlocks.map((block) => block.slotCount))];
  const minimumPlayedNotes = getSectionMinPlayedNotes(section);
  const beatStructured = Boolean(primary && rhythmPoolHasRhythms(normalizeRhythmPool(section.secondaryRhythms)));
  const requireRegularSubdivision = options.subdivisions.length > 0 &&
    getMaximumMixedEventCount(32, availableBlocks, true) >= minimumPlayedNotes;
  let layout = null;

  for (let attempt = 0; beatStructured && attempt < 200 && !layout; attempt += 1) {
    const candidate = createBeatStructuredLayout(requiredBlocks, availableBlocks, random, {
      chainPrimaryGroups: Boolean(section.chainPrimaryGroups),
    });
    const eventCount = (candidate || []).reduce((count, block) =>
      count + (block.kind === "tuplet" ? block.tuplet.actual : block.kind === "regular" ? 1 : 0), 0);
    if (candidate && eventCount >= minimumPlayedNotes) layout = candidate;
  }

  for (let attempt = 0; !beatStructured && attempt < 200 && !layout; attempt += 1) {
    const candidate = [...requiredBlocks];
    let remainingSlots = 32 - requiredSlots;

    while (remainingSlots > 0) {
      const eligible = availableBlocks.filter((block) =>
        block.slotCount <= remainingSlots &&
        canFillMixedTupletSlots(remainingSlots - block.slotCount, slotCounts)
      );

      if (!eligible.length) break;

      const preferred = eligible.filter((block) =>
        random() < (block.kind === "tuplet" ? 0.68 : block.kind === "regular" ? 0.42 : 0.18)
      );
      const pool = preferred.length ? preferred : eligible;
      const selected = pool[randomInteger(random, 0, pool.length - 1)];
      candidate.push(selected);
      remainingSlots -= selected.slotCount;
    }

    const hasTuplet = !options.tuplets.length || candidate.some((block) => block.kind === "tuplet");
    const hasRegularSubdivision = candidate.some((block) => block.kind === "regular");
    const eventCount = candidate.reduce(
      (count, block) => count + (
        block.kind === "tuplet" ? block.tuplet.actual : block.kind === "regular" ? 1 : 0
      ),
      0
    );

    if (
      remainingSlots === 0 &&
      (primary || hasTuplet) &&
      eventCount >= minimumPlayedNotes &&
      (primary || !requireRegularSubdivision || hasRegularSubdivision)
    ) {
      layout = shuffledIndexes(candidate.length, random).map((index) => candidate[index]);
    }
  }

  if (!layout) return null;

  const blockEvents = layout.map((block) => getBlockEvents(
    beatStructured && block.kind === "tuplet" ? { ...block, splitQuarters: true } : block,
    random
  ));
  const events = blockEvents.flat();
  const playableEventIndexes = events
    .map((event, index) => event.forceRest ? -1 : index)
    .filter((index) => index >= 0);
  // maxPlayedShare caps the share of notes played before full groups are filled in.
  const shareLimit = Number(section.maxPlayedShare) > 0
    ? Math.max(1, Math.round(playableEventIndexes.length * Math.min(1, Number(section.maxPlayedShare))))
    : 0;
  const countLimit = getEffectiveSectionMaxPlayedNotes(section);
  const playableSlots = section.playedShareRange
    ? createPlayedSlotsInShareRange(playableEventIndexes.length, section.playedShareRange, random)
    : createRandomPlayedSlots(
      playableEventIndexes.length,
      getSectionMinPlayedNotes(section),
      shareLimit && countLimit ? Math.min(shareLimit, countLimit) : shareLimit || countLimit,
      random
    );
  const playedSlots = Array.from({ length: events.length }, () => false);
  playableEventIndexes.forEach((eventIndex, playableIndex) => {
    playedSlots[eventIndex] = playableSlots[playableIndex];
  });
  const requiresTupletOrnamentTarget =
    options.maxSubdivisionDuration <= 8 &&
    (options.allowDiddles || options.allowCheese);

  if (requiresTupletOrnamentTarget) {
    const tupletEventIndexes = events
      .map((event, index) => event.tuplet ? index : -1)
      .filter((index) => index >= 0);
    const requiredPlayedTargets = Math.min(
      tupletEventIndexes.length,
      options.allowDiddles && options.allowCheese ? 2 : 1
    );

    shuffledIndexes(tupletEventIndexes.length, random)
      .slice(0, requiredPlayedTargets)
      .forEach((index) => {
        playedSlots[tupletEventIndexes[index]] = true;
      });
  }
  balancePrimaryGroupRests(layout, blockEvents, playedSlots,
    section.requirePrimaryRhythms === false ? layout.filter((block) => block.kind === "tuplet") : requiredBlocks,
    section, random, lineIndex, attempt);
  const notes = [];
  const tuplets = [];
  let eventIndex = 0;

  for (const [blockIndex, block] of layout.entries()) {
    const start = notes.length;
    const blockEventCount = blockEvents[blockIndex].length;

    for (let offset = 0; offset < blockEventCount; offset += 1) {
      const isPlayed = playedSlots[eventIndex];
      const previousOrnaments = notes[notes.length - 1]?.ornaments || "";
      const ornaments = isPlayed
        ? createFallbackOrnaments(options, random, eventIndex, previousOrnaments)
        : "";

      notes.push({
        notes: isPlayed ? ["C5"] : [],
        duration: events[eventIndex].duration,
        dots: events[eventIndex].dots || 0,
        velocity: ornaments.includes("a") ? 1 : 0.5,
        ...(ornaments ? { ornaments } : {}),
      });
      eventIndex += 1;
    }

    if (block.kind === "tuplet") {
      tuplets.push({
        start,
        end: notes.length,
        actual: block.tuplet.actual,
        normal: block.tuplet.normal,
      });
    }
  }

  return {
    parts: { snare: { enabled: true } },
    measures: [{
      timeSig: { num: 4, type: 4 },
      parts: [{
        instrument: "snare",
        voices: [{ notes, tuplets }],
      }],
    }],
  };
}

function createFallbackGeneratedScore(section, samplePayload, lineIndex, attempt = 0) {
  const options = getFallbackGenerationOptions(section, samplePayload);
  const retrySeed = attempt ? `:retry:${attempt}` : "";
  const random = createSeededRandom(
    `${section.id || section.title || "section"}:fallback:${lineIndex}${retrySeed}:${section.instructions || ""}`
  );

  if (options.tuplets.length || section.primaryRhythms) {
    const tupletScore = createMixedTupletFallbackGeneratedScore(section, options, random, lineIndex, attempt);

    if (tupletScore) {
      return tupletScore;
    }
    if (section.primaryRhythms) throw new Error("The selected rhythms cannot fill this measure with the configured note limits.");
  }

  const slotCount = options.maxSubdivisionDuration;
  const unitPerSlot = 1;
  const playedSlots = createRandomPlayedSlots(
    slotCount,
    getSectionMinPlayedNotes(section),
    getEffectiveSectionMaxPlayedNotes(section),
    random
  );
  const notes = createNotesFromPlayedSlots(playedSlots, unitPerSlot, options, random);

  return {
    parts: { snare: { enabled: true } },
    measures: [{
      timeSig: { num: 4, type: 4 },
      parts: [{
        instrument: "snare",
        voices: [{ notes, tuplets: [] }],
      }],
    }],
  };
}

function createFallbackGeneratedLine(section, samplePayload, index, attempt = 0) {
  return {
    title: `${section.title || "Section"} ${index + 1}`,
    notes: "Generated from section instructions and sample JSON.",
    tempo: getPositiveInteger(samplePayload.tempo, 90),
    score: createFallbackGeneratedScore(section, samplePayload, index, attempt),
  };
}

function normalizeGeneratedLine(input, section, samplePayload, index, attempt = 0) {
  const fallbackLine = createFallbackGeneratedLine(section, samplePayload, index, attempt);
  const fallbackScore = getSampleScore(samplePayload);
  const scoreSource = input && (input.score || input.measures ? input.score || input : null);
  const normalizedScore = scoreSource
    ? normalizeGeneratedScore(scoreSource, fallbackScore)
    : fallbackLine.score;
  const allowedTuplets = getGenerationTuplets(section, samplePayload);
  const score = allowedTuplets.length || !scoreHasTuplets(normalizedScore)
    ? normalizedScore
    : fallbackLine.score;
  const finalizedScore = finalizeGeneratedScore(section, score, index, `attempt:${attempt}`);
  validatePrimaryRequirements(section, finalizedScore);

  return {
    title: (input && input.title) || fallbackLine.title,
    notes: (input && input.notes) || "",
    tempo: getPositiveInteger(input && input.tempo, fallbackLine.tempo),
    score: finalizedScore,
    exerciseShortForm: getExerciseShortForm(finalizedScore),
  };
}

// Approximate printed width of one exercise, in score units, calibrated against
// the renderer: each played note, rest, grace note (flam or cheese), dot, and
// tuplet bracket takes roughly this much room.
const EXERCISE_WIDTH_UNITS = { played: 15.3, rest: 10.9, grace: 21.4, dot: 12.1, tuplet: 4.7 };
// The estimate can run this much under the rendered width.
const EXERCISE_WIDTH_SAFETY = 52;
// Stave padding, time-signature room, and the right-edge guard around the notes.
const MEASURE_PADDING_UNITS = 44;

function estimateExerciseWidth(score) {
  const notes = score?.measures?.[0]?.parts?.[0]?.voices?.[0]?.notes || [];
  const tuplets = score?.measures?.[0]?.parts?.[0]?.voices?.[0]?.tuplets || [];
  return notes.reduce((width, note) => width +
    (isRest(note) ? EXERCISE_WIDTH_UNITS.rest : EXERCISE_WIDTH_UNITS.played) +
    (!isRest(note) && /[fc]/.test(String(note.ornaments || "")) ? EXERCISE_WIDTH_UNITS.grace : 0) +
    (note.dots ? EXERCISE_WIDTH_UNITS.dot : 0), tuplets.length * EXERCISE_WIDTH_UNITS.tuplet);
}

function getMeasureWidthLimit(pdfSettings) {
  const settings = normalizePdfSettings(pdfSettings);
  return getScoreRenderWidth(settings) / settings.measuresPerLine - MEASURE_PADDING_UNITS - EXERCISE_WIDTH_SAFETY;
}

// playedShareRamp moves the share of notes played from `start` to `end` (each
// [min, max]) across the subsection's exercises, e.g. every note at first and
// 40-50% by the last exercise.
function getPlayedShareRange(ramp, index, count) {
  const progress = count > 1 ? Math.min(1, index / (count - 1)) : 0;
  const lerp = (from, to) => from + (to - from) * progress;
  return [lerp(ramp.start[0], ramp.end[0]), lerp(ramp.start[1], ramp.end[1])];
}

function createUniqueGeneratedLine(input, section, samplePayload, index, usedExerciseShortForms) {
  const pdfSettings = normalizePdfSettings(section.pdfSettings);
  if (section.finalSubsectionPage !== false) {
    section = getLineStickingSettings(section, index, getLinesPerPage(pdfSettings), pdfSettings.measuresPerLine);
  }
  if (section.primaryRhythms) section = { ...section, primaryRhythms: getSpanPrimaryRhythms(section.primaryRhythms, section.rhythmSpan) };
  // Topic plans and secondary rows count across every page of a subsection.
  const subsectionIndex = index + (section.subsectionLineOffset || 0);
  const ornamentSegment = getLineOrnamentSegment(section, subsectionIndex);
  if (ornamentSegment) section = { ...section, ornaments: ornamentSegment.ornaments };
  const randomOrnaments = getLineRandomOrnaments(section, subsectionIndex, section.subsectionId || section.id);
  if (randomOrnaments) section = { ...section, ornaments: randomOrnaments };
  if (section.secondaryRhythmRows) {
    section = { ...section, secondaryRhythms: getLineSecondaryRhythms(section, subsectionIndex, pdfSettings.measuresPerLine) };
  }
  if (section.playedShareRamp) {
    section = { ...section, playedShareRange: getPlayedShareRange(section.playedShareRamp, subsectionIndex, section.subsectionLineCount) };
  }
  let lastError = null;
  // Pages with secondary rhythms have the variety to stay inside their measure.
  const widthLimit = section.primaryRhythms && rhythmPoolHasRhythms(normalizeRhythmPool(section.secondaryRhythms))
    ? getMeasureWidthLimit(pdfSettings) : 0;

  for (let attempt = 0; attempt < MAX_UNIQUE_LINE_ATTEMPTS; attempt += 1) {
    const candidateInput = attempt === 0 ? input : null;
    let line;

    try {
      line = normalizeGeneratedLine(candidateInput, section, samplePayload, index, attempt);
      if (widthLimit && estimateExerciseWidth(line.score) > widthLimit) {
        throw new Error("Exercise is too wide for its share of the printed row.");
      }
    } catch (error) {
      lastError = error;
      continue;
    }

    if (!line.exerciseShortForm || !usedExerciseShortForms.has(line.exerciseShortForm)) {
      if (line.exerciseShortForm) {
        usedExerciseShortForms.add(line.exerciseShortForm);
      }

      return line;
    }
  }

  throw new Error(
    `${section.title || "Section"} line ${index + 1}: could not create a valid unique exercise after ${MAX_UNIQUE_LINE_ATTEMPTS} attempts.` +
    (lastError ? ` Last error: ${lastError.message}` : "")
  );
}

function inferPageCount(section) {
  if (section.pageCount) {
    return getPositiveInteger(section.pageCount, 1);
  }

  const prompt = `${section.instructions || ""}`.toLowerCase();
  const numericMatch = prompt.match(/(\d+)\s+pages?/);
  const wordMatch = prompt.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+pages?\b/
  );

  if (numericMatch) return Number(numericMatch[1]);
  if (wordMatch) return NUMBER_WORDS[wordMatch[1]];
  return Array.isArray(section.pages) && section.pages.length
    ? section.pages.length
    : 1;
}

function getSectionSampleJson(section) {
  if (section.sampleJson && typeof section.sampleJson === "object") {
    return section.sampleJson;
  }

  return parseJsonLoose(section.sampleJson) || {};
}

function collapseLegacyContinuationPages(section, pages) {
  if (pages.length <= 1) {
    return pages;
  }

  const firstTitle = String(pages[0].title || "").trim();
  const allPagesShareTitle = firstTitle && pages.every(
    (page) => String(page.title || "").trim() === firstTitle
  );
  const legacyGeneratedTitle = `${section.title || "Section"} 1`;

  if (!allPagesShareTitle || firstTitle !== legacyGeneratedTitle) {
    return pages;
  }

  // The previous line-oriented model duplicated a source page when its saved
  // rhythm count exceeded a newly selected page capacity. These duplicates all
  // retained the original "Section 1" title. A page is now an explicit recipe,
  // so keep the latest copy rather than generating each continuation again.
  return [pages[pages.length - 1]];
}

// Exercises on the subsection's earlier pages, so its later pages continue its plan.
function getSubsectionLineOffset(pages, pageIndex, sectionPdfSettings) {
  let offset = 0;
  for (let index = pageIndex - 1; index >= 0 && pages[pageIndex].subsectionId &&
    pages[index].subsectionId === pages[pageIndex].subsectionId; index -= 1) {
    offset += getLinesPerPage(normalizePdfSettings({ ...sectionPdfSettings, ...(pages[index].pdfSettings || {}) }));
  }
  return offset;
}

// Exercises across every page of the subsection this page belongs to.
function getSubsectionLineCount(pages, pageIndex, sectionPdfSettings) {
  const subsectionId = pages[pageIndex].subsectionId;
  return pages
    .filter((page, index) => index === pageIndex || (subsectionId && page.subsectionId === subsectionId))
    .reduce((sum, page) => sum + getLinesPerPage(normalizePdfSettings({ ...sectionPdfSettings, ...(page.pdfSettings || {}) })), 0);
}

function createGenerationSectionsFromBook(book, globalRules = "") {
  const bookPdfSettings = normalizePdfSettings(book.pdfSettings);
  const globalOrnamentDensity = normalizeGlobalOrnamentDensity(
    book.globalOrnamentDensity
  );

  return (book.sections || []).map((section, sectionIndex) => {
    const sectionPdfSettings = normalizePdfSettings({
      ...bookPdfSettings,
      ...(section.pdfSettings || {}),
    });
    const savedPages = Array.isArray(section.pages) && section.pages.length
      ? section.pages
      : [{}];
    const sourcePages = book.structureVersion >= BOOK_STRUCTURE_VERSION
      ? savedPages : collapseLegacyContinuationPages(section, savedPages);
    const pages = sourcePages.map((page, pageIndex) => {
      const pageSource = {
        ...section,
        ...(page.generationSettings || {}),
        primaryRhythms: section.primaryRhythms,
        secondaryRhythms: section.secondaryRhythms,
        rhythmSpan: section.rhythmSpan,
      };
      const sampleJson = getSectionSampleJson(pageSource);
      const subdivisions = getGenerationSubdivisions(pageSource, sampleJson);
      const ornaments = pageSource.primaryRhythms ? pageSource.ornaments || [] : getGenerationOrnaments(pageSource, sampleJson);
      const tuplets = getGenerationTuplets(pageSource, sampleJson);
      const structuredPage = {
        ...pageSource,
        subdivisions,
        ornaments,
        tuplets,
        globalOrnamentDensity,
        sampleJson,
      };

      return {
        id: `${section.id || `section-${sectionIndex + 1}`}-page-${pageIndex + 1}`,
        subsectionId: page.subsectionId,
        primaryRhythms: pageSource.primaryRhythms,
        secondaryRhythms: pageSource.secondaryRhythms,
        rhythmSpan: normalizeRhythmSpan(section.rhythmSpan),
        stickingTail: normalizeStickingTail(pageSource.stickingTail),
        ornamentSegments: normalizeOrnamentSegments(pageSource.ornamentSegments),
        randomOrnaments: normalizeRandomOrnaments(pageSource.randomOrnaments),
        secondaryRhythmRows: normalizeSecondaryRhythmRows(pageSource.secondaryRhythmRows),
        chainPrimaryGroups: Boolean(pageSource.chainPrimaryGroups),
        fullPrimaryGroupShare: pageSource.fullPrimaryGroupShare ?? null,
        requirePrimaryRhythms: pageSource.requirePrimaryRhythms !== false,
        primaryRhythmOrnaments: pageSource.primaryRhythmOrnaments || null,
        maxPlayedShare: pageSource.maxPlayedShare ?? null,
        // The sticking tail closes a multi-page subsection, so only its last page uses it.
        finalSubsectionPage: !page.subsectionId || sourcePages[pageIndex + 1]?.subsectionId !== page.subsectionId,
        subsectionLineOffset: getSubsectionLineOffset(sourcePages, pageIndex, sectionPdfSettings),
        subsectionLineCount: getSubsectionLineCount(sourcePages, pageIndex, sectionPdfSettings),
        playedShareRamp: pageSource.playedShareRamp || null,
        title: page.title || `${section.title || `Section ${sectionIndex + 1}`} ${pageIndex + 1}`,
        sectionTitle: section.title || `Section ${sectionIndex + 1}`,
        pageCount: 1,
        minPlayedNotes: getSectionMinPlayedNotes(pageSource),
        maxPlayedNotes: getSectionMaxPlayedNotes(pageSource),
        playEveryNote: getSectionPlayEveryNote(pageSource),
        maxSameHandStickingRun: getSectionMaxSameHandStickingRun(pageSource),
        requiredSameHandStickingRuns: getSectionRequiredSameHandStickingRuns(pageSource),
        globalRules,
        globalOrnamentDensity,
        instructions: createStructuredSectionInstructions(structuredPage, sampleJson),
        prompt: pageSource.prompt || pageSource.instructions || "",
        subdivisions,
        ornaments,
        tuplets,
        sampleJson,
        pdfSettings: normalizePdfSettings({
          ...sectionPdfSettings,
          ...(page.pdfSettings || {}),
        }),
      };
    });

    return {
      ...section,
      id: section.id || `section-${sectionIndex + 1}`,
      title: section.title || `Section ${sectionIndex + 1}`,
      pdfSettings: sectionPdfSettings,
      pages,
    };
  });
}

function createGenerationConfig(config, sourceBook) {
  sourceBook = migrateBookStructure(sourceBook);
  const configGeneration = config.generation || {};
  const bookGlobalRules = normalizeGlobalAiRules(sourceBook.globalAiRules);
  const globalOrnamentDensity = normalizeGlobalOrnamentDensity(
    sourceBook.globalOrnamentDensity ?? config.book?.globalOrnamentDensity
  );

  return {
    ...config,
    generation: {
      ...configGeneration,
      globalInstructions: normalizeInstructionList(configGeneration.globalInstructions),
      bookGlobalRules,
    },
    book: {
      ...(config.book || {}),
      groups: sourceBook.groups,
      book: sourceBook.book || (config.book && config.book.book) || "true-chops",
      slug: sourceBook.slug || (config.book && config.book.slug) || "snare-drum-book",
      title: sourceBook.title || (config.book && config.book.title) || "Snare Drum Book",
      edition: Number(sourceBook.edition || (config.book && config.book.edition) || 1),
      contentVersion: Number(sourceBook.contentVersion || (config.book && config.book.contentVersion) || 1),
      globalOrnamentDensity,
      pdfSettings: normalizePdfSettings({
        ...((config.book && config.book.pdfSettings) || {}),
        ...(sourceBook.pdfSettings || {}),
      }),
    },
    sections: createGenerationSectionsFromBook(
      { ...sourceBook, globalOrnamentDensity },
      bookGlobalRules
    ),
  };
}

function describeOrnamentSegments(segments) {
  let start = 1;
  return segments.map((segment) => {
    const range = segment.count > 1 ? `${start}-${start + segment.count - 1}` : String(start);
    start += segment.count;
    return `exercises ${range}: ${segment.ornaments.join(", ") || "none"}`;
  }).join("; ");
}

function createAiPrompt(config, section, samplePayload, count, offset, linesPerPage) {
  if (section.primaryRhythms) {
    section = { ...section, primaryRhythms: getSpanPrimaryRhythms(section.primaryRhythms, section.rhythmSpan) };
    section.instructions = createStructuredSectionInstructions(section, samplePayload);
  }
  const globalInstructions = normalizeInstructionList(
    config.generation && config.generation.globalInstructions
  );
  const bookGlobalRules = normalizeGlobalAiRules(
    (config.generation && config.generation.bookGlobalRules) || section.globalRules
  );
  const tuplets = getGenerationTuplets(section, samplePayload);
  const subdivisions = getGenerationSubdivisions(section, samplePayload);

  return [
    ...globalInstructions,
    bookGlobalRules ? `Book-wide UI rules:\n${bookGlobalRules}` : "",
    "",
    `Section title: ${section.title || "Untitled section"}`,
    `Section instructions: ${section.instructions || ""}`,
    section.stickingTail && section.finalSubsectionPage !== false
      ? `The final ${section.stickingTail.count} printed staff rows (${section.stickingTail.count * normalizePdfSettings(section.pdfSettings).measuresPerLine} exercises, starting at exercise ${Math.max(1, linesPerPage - section.stickingTail.count * normalizePdfSettings(section.pdfSettings).measuresPerLine + 1)}) use a maximum same-hand run of ${section.stickingTail.maxSameHandStickingRun} and require one run length from ${section.stickingTail.requiredSameHandStickingRuns.join(" or ")}. Earlier exercises use the regular sticking settings.`
      : "",
    ...(section.primaryRhythms ? [
      `Every measure MUST contain played notes from EACH primary subdivision (${section.primaryRhythms.subdivisions.join(", ") || "none"}) and at least one complete group of EACH primary tuplet (${section.primaryRhythms.tuplets.map(getTupletLabel).join(", ") || "none"}).`,
      section.ornamentSegments
        ? `Required ornaments on primary rhythms change by exercise number on this page: ${describeOrnamentSegments(section.ornamentSegments)}.`
        : `Required ornaments on primary rhythms: ${(section.ornaments || []).join(", ") || "none"}.`,
      `Secondary rhythms are OPTIONAL random fillers: ${JSON.stringify(section.secondaryRhythms)}. Their ornaments belong only on secondary rhythms and are never required. Primary choices take precedence when the same rhythm belongs to both pools.`,
      section.secondaryRhythmRows
        ? `Each secondary rhythm joins the pool at a printed staff row (${normalizePdfSettings(section.pdfSettings).measuresPerLine} exercises per row) and stays from then on: ${JSON.stringify(section.secondaryRhythmRows)}. Rhythms not listed are not used.`
        : "",
    ] : []),
    subdivisions.length
      ? `Allowed regular subdivisions: ${getOptionLabels(SUBDIVISION_SETTINGS, subdivisions, "none")}.`
      : "Use no regular played-note subdivisions. Ordinary rests may still be used to complete the measure.",
    tuplets.length
      ? `Allowed tuplet types: ${tuplets.map(getTupletLabel).join(", ")}. Randomly combine complete groups of allowed types in the same 4/4 measure, including all required primary types. Tuplet entries use inclusive start and exclusive end indexes into voice.notes.`
      : "Do not use tuplets. Each generated voice should have an empty tuplets array.",
    "Never create a tuplet group whose notes are all rests. Replace the entire group with the simplest duration-equivalent ordinary rest or rests and omit that tuplet entry.",
    getSectionPlayEveryNote(section)
      ? "Use no rests. Play every rhythmic position in the measure, including every note inside tuplets."
      : "Randomize played notes and rests across the whole measure. Do not favor beat four or any other beat.",
    getSectionPlayEveryNote(section)
      ? ""
      : subdivisions.length
        ? "Rests may occur on any selected subdivision position, including offbeat sixteenth-note and thirty-second-note positions when those subdivisions are selected."
        : "Rests may separate tuplet groups or complete the measure, but must use ordinary non-tuplet rest notation.",
    sectionUsesStickings(section)
      ? "First choose and place all non-sticking ornaments. Only afterward assign every played note a sticking ornament (\"r\" or \"l\") while applying the sticking rules below. Rests must not have stickings."
      : "",
    getRequiredSectionOrnamentChars(section).length
      ? `Every measure must contain at least one of each selected non-sticking ornament: ${getRequiredSectionOrnamentChars(section).join(", ")}.`
      : "",
    getRequiredSectionOrnamentChars(section).length
      ? `Use the global ornament density setting of ${normalizeGlobalOrnamentDensity(section.globalOrnamentDensity)}%, where 100% is the normal frequency.`
      : "",
    getRequiredSectionOrnamentChars(section).length > 1
      ? "Treat accents independently: they may share notes with any other ornament and must not consume space in the ornament-variety pattern. Rotate variety only among flams, diddles, and cheese, while every selected ornament remains represented. Never place a flam immediately after a diddle or cheese."
      : "",
    section.minPlayedNotes
      ? `Each generated rhythm in this section must have at least ${section.minPlayedNotes} played note events. Rests do not count as played notes.`
      : "",
    section.maxPlayedNotes && !getSectionPlayEveryNote(section)
      ? `Each generated rhythm in this section must have no more than ${getEffectiveSectionMaxPlayedNotes(section)} played note events. Rests do not count as played notes.`
      : "",
    sectionUsesStickings(section)
      ? `Do not use more than ${getSectionMaxSameHandStickingRun(section)} consecutive played notes with the same sticking. Rests reset this count.`
      : "",
    sectionUsesStickings(section) && getSectionRequiredSameHandStickingRuns(section).length
      ? `For each generated rhythm, choose one target same-hand sticking run length from: ${getSectionRequiredSameHandStickingRuns(section).join(", ")}. Require that exact run length for the rhythm; these choices are OR alternatives, not cumulative AND requirements. Other selected and unselected run lengths remain allowed and should occur randomly.`
      : "",
    sectionUsesStickings(section)
      ? "Never allow two adjacent diddles on the same hand, including across the repeat boundary. When a diddle or cheese is followed immediately by the next sixteenth note, that following note must use the opposite sticking. A diddle must not directly precede a cheese on consecutive sixteenth notes."
      : "",
    "Every measure repeats. Apply every ornament-sequencing and sticking rule across the repeat boundary, treating the first note as immediately following the last note.",
    sectionUsesDiddlesOrCheese(section)
      ? "Diddles and cheese may only be used on sixteenth notes or faster, except that eighth notes inside a tuplet may use them; never put them on regular eighth notes, dotted eighth notes, or quarter notes."
      : "",
    getGenerationOrnaments(section).includes("diddles")
      ? "Distribute diddles across the measure by default. Occasional adjacent diddles are allowed for variety, but avoid clustering most or all diddles together."
      : "",
    `Return exactly ${count} lines. These begin at section line ${offset + 1}.`,
    `The section has ${linesPerPage} lines per PDF page.`,
    "",
    "Sample JSON:",
    JSON.stringify(samplePayload, null, 2),
  ].join("\n");
}

function postJson(urlString, payload, timeoutMs) {
  const url = new URL(urlString);
  const body = JSON.stringify(payload);
  const client = url.protocol === "https:" ? https : http;
  const requestOptions = {
    method: "POST",
    hostname: url.hostname,
    port: url.port || (url.protocol === "https:" ? 443 : 80),
    path: `${url.pathname}${url.search}`,
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    },
  };

  return new Promise((resolve, reject) => {
    const request = client.request(requestOptions, (response) => {
      const chunks = [];

      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");

        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`AI endpoint returned HTTP ${response.statusCode}: ${text}`));
          return;
        }

        try {
          resolve(JSON.parse(text));
        } catch (error) {
          reject(new Error(`AI endpoint returned invalid JSON: ${error.message}`));
        }
      });
    });

    request.on("error", reject);
    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`AI request timed out after ${timeoutMs}ms`));
    });
    request.write(body);
    request.end();
  });
}

async function requestAiGeneratedLines(config, section, samplePayload, count, offset, linesPerPage) {
  if (process.env.BOOK_AI_DISABLE === "1") {
    return [];
  }

  const localAi = (config.generation && config.generation.localAi) || {};
  const endpoint = process.env.BOOK_AI_ENDPOINT ||
    process.env.OLLAMA_ENDPOINT ||
    localAi.endpoint ||
    "http://127.0.0.1:11434/api/generate";
  const model = process.env.BOOK_AI_MODEL ||
    process.env.OLLAMA_MODEL ||
    localAi.model ||
    "llama3.1";
  const timeoutMs = getPositiveInteger(
    process.env.BOOK_AI_REQUEST_TIMEOUT_MS || localAi.requestTimeoutMs,
    180000
  );
  const temperature = Number(process.env.BOOK_AI_TEMPERATURE || localAi.temperature || 0.8);
  const prompt = createAiPrompt(config, section, samplePayload, count, offset, linesPerPage);
  const payload = endpoint.includes("/api/chat")
    ? {
        model,
        messages: [{ role: "user", content: prompt }],
        stream: false,
        format: "json",
        options: { temperature },
      }
    : {
        model,
        prompt,
        stream: false,
        format: "json",
        options: { temperature },
      };
  const result = await postJson(endpoint, payload, timeoutMs);
  const resultText = result.response ||
    (result.message && result.message.content) ||
    (result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content) ||
    JSON.stringify(result);

  return extractGeneratedLineInputs(parseJsonLoose(resultText));
}

async function generateSectionLines(config, section, sectionIndex, options) {
  const samplePayload = getSamplePayload(section);
  const pdfSettings = normalizePdfSettings({
    ...(config.book && config.book.pdfSettings),
    ...(section.pdfSettings || {}),
  });
  const linesPerPage = getLinesPerPage(pdfSettings);
  const pageCount = inferPageCount(section);
  const lineCount = pageCount * linesPerPage;
  const localAi = (config.generation && config.generation.localAi) || {};
  const batchSize = getPositiveInteger(
    process.env.BOOK_AI_LINE_BATCH_SIZE || localAi.batchSize,
    12
  );
  const lines = [];
  const usedExerciseShortForms = options.usedExerciseShortForms || new Set();

  console.log(
    `[${sectionIndex + 1}/${options.totalPageCount || config.sections.length}] ${section.sectionTitle || section.title} · ${section.title}: generate ${lineCount} rhythms`
  );

  for (let offset = 0; offset < lineCount; offset += batchSize) {
    const count = Math.min(batchSize, lineCount - offset);
    let aiLines = [];

    try {
      aiLines = await requestAiGeneratedLines(config, section, samplePayload, count, offset, linesPerPage);
    } catch (error) {
      if (!options.allowFallback) {
        throw new Error(`${section.title}: ${error.message}`);
      }

      console.warn(`  AI unavailable for lines ${offset + 1}-${offset + count}; using fallback.`);
    }

    if (!options.allowFallback && aiLines.length < count) {
      throw new Error(`${section.title}: AI returned ${aiLines.length} of ${count} requested lines.`);
    }

    for (let batchIndex = 0; batchIndex < count; batchIndex += 1) {
      const index = offset + batchIndex;
      const input = aiLines[batchIndex] || null;
      lines.push(createUniqueGeneratedLine(
        input,
        section,
        samplePayload,
        index,
        usedExerciseShortForms
      ));
    }

    process.stdout.write(`  ${Math.min(offset + count, lineCount)} / ${lineCount}\r`);
  }

  process.stdout.write("\n");

  return {
    pageCount,
    pdfSettings,
    lines,
  };
}

function createStoredPageGenerationSettings(pageConfig) {
  return {
    rhythmSpan: pageConfig.rhythmSpan,
    stickingTail: pageConfig.stickingTail,
    ...(pageConfig.ornamentSegments ? { ornamentSegments: pageConfig.ornamentSegments } : {}),
    ...(pageConfig.randomOrnaments ? { randomOrnaments: pageConfig.randomOrnaments } : {}),
    ...(pageConfig.secondaryRhythmRows ? { secondaryRhythmRows: pageConfig.secondaryRhythmRows } : {}),
    ...(pageConfig.chainPrimaryGroups ? { chainPrimaryGroups: true } : {}),
    ...(pageConfig.fullPrimaryGroupShare != null ? { fullPrimaryGroupShare: pageConfig.fullPrimaryGroupShare } : {}),
    ...(pageConfig.requirePrimaryRhythms === false ? { requirePrimaryRhythms: false } : {}),
    ...(pageConfig.primaryRhythmOrnaments ? { primaryRhythmOrnaments: pageConfig.primaryRhythmOrnaments } : {}),
    ...(pageConfig.maxPlayedShare != null ? { maxPlayedShare: pageConfig.maxPlayedShare } : {}),
    ...(pageConfig.playedShareRamp ? { playedShareRamp: pageConfig.playedShareRamp } : {}),
    primaryRhythms: pageConfig.primaryRhythms,
    secondaryRhythms: pageConfig.secondaryRhythms,
    prompt: pageConfig.prompt || "",
    sampleJson: JSON.stringify(pageConfig.sampleJson || {}, null, 2),
    subdivisions: pageConfig.primaryRhythms?.subdivisions || pageConfig.subdivisions,
    ornaments: pageConfig.ornaments,
    tuplets: pageConfig.primaryRhythms?.tuplets || pageConfig.tuplets,
    minPlayedNotes: pageConfig.minPlayedNotes,
    maxPlayedNotes: pageConfig.maxPlayedNotes,
    playEveryNote: pageConfig.playEveryNote,
    maxSameHandStickingRun: pageConfig.maxSameHandStickingRun,
    requiredSameHandStickingRuns: pageConfig.requiredSameHandStickingRuns,
  };
}

function createGeneratedPages(section, generated, now) {
  return Array.from({ length: generated.pageCount }, (_, pageIndex) => {
    const page = createBlankPage(
      pageIndex + 1,
      generated.pdfSettings,
      createStoredPageGenerationSettings(section)
    );

    return {
      ...page,
      title: `${section.title} ${pageIndex + 1}`,
      lines: page.lines.map((line, lineIndex) => {
        const generatedLine = generated.lines[pageIndex * page.lines.length + lineIndex];
        return generatedLine
          ? {
              ...line,
              title: generatedLine.title,
              notes: generatedLine.notes || "",
              tempo: generatedLine.tempo,
              score: generatedLine.score,
              exerciseShortForm: generatedLine.exerciseShortForm,
              updatedAt: now,
            }
          : line;
      }),
    };
  });
}

function buildBook(config, generatedSections) {
  const now = new Date().toISOString();
  const bookSettings = normalizePdfSettings(config.book && config.book.pdfSettings);
  let globalPageNumber = 1;

  const sections = config.sections.map((section, sectionIndex) => {
    const generatedPages = generatedSections[sectionIndex];
    const pages = section.pages.map((pageConfig, sectionPageIndex) => {
      const generated = generatedPages[sectionPageIndex];
      const page = createGeneratedPages(pageConfig, generated, now)[0];
      const pageNumber = globalPageNumber;
      globalPageNumber += 1;

      return {
        ...page,
        subsectionId: pageConfig.subsectionId,
        title: pageConfig.title || `${section.title} ${sectionPageIndex + 1}`,
        pageNumber,
        sectionId: section.id,
        sectionTitle: section.title,
        sectionPageNumber: sectionPageIndex + 1,
        lines: page.lines.map((line, lineIndex) => ({
          ...line,
          pageNumber,
          lineNumber: lineIndex + 1,
          sectionId: section.id,
          sectionPageNumber: sectionPageIndex + 1,
        })),
      };
    });
    const firstPageConfig = section.pages[0] || {};

    return {
      id: section.id,
      groupId: section.groupId,
      rhythmSpan: section.rhythmSpan,
      studyFamily: section.studyFamily,
      density: section.density,
      primaryRhythms: section.primaryRhythms,
      secondaryRhythms: section.secondaryRhythms,
      title: section.title,
      prompt: firstPageConfig.prompt ?? section.prompt ?? "",
      sampleJson: section.sampleJson || JSON.stringify(firstPageConfig.sampleJson || {}, null, 2),
      subdivisions: firstPageConfig.subdivisions ?? section.subdivisions,
      ornaments: firstPageConfig.ornaments ?? section.ornaments,
      tuplets: firstPageConfig.tuplets ?? section.tuplets,
      pageCount: pages.length,
      minPlayedNotes: firstPageConfig.minPlayedNotes ?? section.minPlayedNotes,
      maxPlayedNotes: firstPageConfig.maxPlayedNotes ?? section.maxPlayedNotes,
      playEveryNote: firstPageConfig.playEveryNote ?? section.playEveryNote,
      maxSameHandStickingRun: firstPageConfig.maxSameHandStickingRun ?? section.maxSameHandStickingRun,
      requiredSameHandStickingRuns:
        firstPageConfig.requiredSameHandStickingRuns ?? section.requiredSameHandStickingRuns,
      pdfSettings: section.pdfSettings,
      pages,
    };
  });

  const pages = sections.flatMap((section) => section.pages);

  return {
    book: (config.book && config.book.book) || "true-chops",
    structureVersion: BOOK_STRUCTURE_VERSION,
    groups: config.book.groups,
    slug: (config.book && config.book.slug) || "snare-drum-book",
    title: (config.book && config.book.title) || "Snare Drum Book",
    edition: Number((config.book && config.book.edition) || 1),
    contentVersion: Number((config.book && config.book.contentVersion) || 1),
    globalOrnamentDensity: normalizeGlobalOrnamentDensity(
      config.book && config.book.globalOrnamentDensity
    ),
    updatedAt: now,
    globalAiRules: (config.generation && config.generation.bookGlobalRules) || "",
    pdfSettings: bookSettings,
    sections,
    pages,
  };
}

function createManifest(book) {
  const createLineManifest = (line) => ({
    pageNumber: line.pageNumber,
    lineNumber: line.lineNumber,
    sectionId: line.sectionId,
    sectionPageNumber: line.sectionPageNumber,
    title: line.title,
    notes: line.notes,
    tempo: line.tempo,
    exerciseShortForm: line.exerciseShortForm,
    hasScore: Boolean(line.score),
    updatedAt: line.updatedAt,
  });
  const createPageManifest = (page) => ({
    subsectionId: page.subsectionId,
    pageNumber: page.pageNumber,
    sectionId: page.sectionId,
    sectionTitle: page.sectionTitle,
    sectionPageNumber: page.sectionPageNumber,
    title: page.title,
    pdfSettings: page.pdfSettings,
    generationSettings: page.generationSettings,
    lines: page.lines.map(createLineManifest),
  });
  const tableOfContents = createStructureTableOfContents(book.sections, book.groups);

  return {
    book: book.book,
    structureVersion: book.structureVersion,
    groups: book.groups,
    slug: book.slug,
    title: book.title,
    edition: book.edition,
    contentVersion: book.contentVersion,
    updatedAt: book.updatedAt,
    globalAiRules: book.globalAiRules,
    globalOrnamentDensity: book.globalOrnamentDensity,
    pdfSettings: book.pdfSettings,
    sections: book.sections.map((section) => ({
      id: section.id,
      groupId: section.groupId,
      rhythmSpan: section.rhythmSpan,
      studyFamily: section.studyFamily,
      density: section.density,
      primaryRhythms: section.primaryRhythms,
      secondaryRhythms: section.secondaryRhythms,
      title: section.title,
      prompt: section.prompt,
      sampleJson: section.sampleJson,
      subdivisions: section.subdivisions,
      ornaments: section.ornaments,
      tuplets: section.tuplets,
      pageCount: section.pageCount,
      minPlayedNotes: section.minPlayedNotes,
      maxPlayedNotes: section.maxPlayedNotes,
      playEveryNote: section.playEveryNote,
      maxSameHandStickingRun: section.maxSameHandStickingRun,
      requiredSameHandStickingRuns: section.requiredSameHandStickingRuns,
      pdfSettings: section.pdfSettings,
      pages: section.pages.map(createPageManifest),
    })),
    tableOfContents,
    pages: book.pages.map(createPageManifest),
  };
}

function pageDir(bookRoot, pageNumber) {
  return path.join(bookRoot, "pages", `page-${String(pageNumber).padStart(2, "0")}`);
}

function linePath(bookRoot, pageNumber, lineNumber) {
  return path.join(pageDir(bookRoot, pageNumber), `line-${String(lineNumber).padStart(2, "0")}.json`);
}

function cleanupStaleGeneratedPageFiles(book, bookRoot) {
  const pagesRoot = path.join(bookRoot, "pages");

  if (!fs.existsSync(pagesRoot)) {
    return;
  }

  const activePages = new Map(
    (book.pages || []).map((page) => [
      `page-${String(page.pageNumber).padStart(2, "0")}`,
      new Set((page.lines || []).map((line) =>
        `line-${String(line.lineNumber).padStart(2, "0")}.json`
      )),
    ])
  );

  for (const entry of fs.readdirSync(pagesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^page-\d+$/.test(entry.name)) {
      continue;
    }

    const currentPageDir = path.join(pagesRoot, entry.name);
    const activeLines = activePages.get(entry.name);

    if (!activeLines) {
      fs.rmSync(currentPageDir, { recursive: true, force: true });
      continue;
    }

    for (const lineEntry of fs.readdirSync(currentPageDir, { withFileTypes: true })) {
      if (
        lineEntry.isFile() &&
        /^line-\d+\.json$/.test(lineEntry.name) &&
        !activeLines.has(lineEntry.name)
      ) {
        fs.rmSync(path.join(currentPageDir, lineEntry.name), { force: true });
      }
    }
  }
}

function saveBook(book, bookRoot) {
  fs.mkdirSync(bookRoot, { recursive: true });
  cleanupStaleGeneratedPageFiles(book, bookRoot);

  for (const page of book.pages) {
    fs.mkdirSync(pageDir(bookRoot, page.pageNumber), { recursive: true });

    for (const line of page.lines) {
      writeJson(
        linePath(bookRoot, page.pageNumber, line.lineNumber),
        {
          ...line,
          pageNumber: page.pageNumber,
          lineNumber: line.lineNumber,
        }
      );
    }
  }

  writeJson(path.join(bookRoot, "book.json"), createManifest(book));
}

async function main() {
  const configPath = path.resolve(getArg("--config", DEFAULT_CONFIG_PATH));
  const config = readJson(configPath);
  const bookSlug = (config.book && config.book.slug) || "snare-drum-book";
  const bookRoot = path.resolve(
    getArg("--output-root", path.join(PROJECT_ROOT, "data", "book-builder", bookSlug))
  );
  const bookPath = path.resolve(getArg("--book", path.join(bookRoot, "book.json")));
  const sourceBook = readJson(bookPath);
  const generationConfig = createGenerationConfig(config, sourceBook);
  const allowFallback = getFlag("--allow-fallback") || process.env.BOOK_AI_ALLOW_FALLBACK === "1";
  const noLocalAi = getFlag("--no-local-ai") || process.env.BOOK_AI_DISABLE === "1";
  const dryRun = getFlag("--dry-run");

  if (noLocalAi) {
    process.env.BOOK_AI_DISABLE = "1";
  }

  if (!Array.isArray(generationConfig.sections) || generationConfig.sections.length === 0) {
    throw new Error(`No saved sections found in ${bookPath}`);
  }

  console.log(`Reading generation settings from ${path.relative(PROJECT_ROOT, configPath)}`);
  console.log(`Reading saved sections from ${path.relative(PROJECT_ROOT, bookPath)}`);
  console.log(`Output root: ${path.relative(PROJECT_ROOT, bookRoot)}`);

  const generatedSections = [];
  const usedExerciseShortForms = new Set();
  const totalPageCount = generationConfig.sections.reduce(
    (count, section) => count + section.pages.length,
    0
  );
  let pageProgress = 0;

  for (let sectionIndex = 0; sectionIndex < generationConfig.sections.length; sectionIndex += 1) {
    const section = generationConfig.sections[sectionIndex];
    const generatedPages = [];

    for (const pageConfig of section.pages) {
      generatedPages.push(
        await generateSectionLines(generationConfig, pageConfig, pageProgress, {
          allowFallback: allowFallback || noLocalAi,
          usedExerciseShortForms,
          totalPageCount,
        })
      );
      pageProgress += 1;
    }

    generatedSections.push(generatedPages);
  }

  const book = buildBook(generationConfig, generatedSections);

  if (dryRun) {
    console.log(`Dry run complete. Generated ${book.pages.length} pages and ${book.pages.reduce((sum, page) => sum + page.lines.length, 0)} lines in memory.`);
    return;
  }

  saveBook(book, bookRoot);
  console.log(`Wrote ${book.pages.length} pages to ${path.relative(PROJECT_ROOT, bookRoot)}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { createGenerationConfig, createAiPrompt, createUniqueGeneratedLine, createManifest, buildBook, validatePrimaryRequirements };
