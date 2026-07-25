#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");

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
  columns: 2,
  rows: 12,
  noteRenderWidth: 420,
  noteStartPadding: 25,
  noteEndPadding: 25,
};

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
const ORNAMENT_SETTINGS = [
  { id: "stickings", label: "stickings", chars: "rl" },
  { id: "accents", label: "accents", chars: "a" },
  { id: "flams", label: "flams", chars: "f" },
  { id: "diddles", label: "diddles", chars: "d" },
  { id: "cheese", label: "cheese", chars: "c" },
];
const DEFAULT_MAX_SAME_HAND_STICKING_RUN = 4;
const MAX_UNIQUE_LINE_ATTEMPTS = 250;

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

function normalizePdfSettings(pdfSettings = {}) {
  const columns = [2, 3].includes(Number(pdfSettings.columns))
    ? Number(pdfSettings.columns)
    : DEFAULT_PDF_SETTINGS.columns;

  return {
    ...DEFAULT_PDF_SETTINGS,
    ...pdfSettings,
    columns,
    rows: DEFAULT_PDF_SETTINGS.rows,
  };
}

function getLinesPerPage(pdfSettings) {
  const normalized = normalizePdfSettings(pdfSettings);
  return normalized.columns * normalized.rows;
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

function createBlankPage(pageNumber, pdfSettings) {
  const normalizedSettings = normalizePdfSettings(pdfSettings);
  const linesPerPage = getLinesPerPage(normalizedSettings);

  return {
    pageNumber,
    title: `Page ${pageNumber}`,
    pdfSettings: normalizedSettings,
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
  const explicit = normalizeOptionIds(section && section.subdivisions, SUBDIVISION_SETTINGS);
  return explicit.length ? explicit : inferGenerationSubdivisions(section || {}, samplePayload);
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
  if (section && Array.isArray(section.ornaments)) {
    return normalizeOptionIds(section.ornaments, ORNAMENT_SETTINGS);
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

function createStructuredSectionInstructions(section, samplePayload) {
  const subdivisions = getGenerationSubdivisions(section, samplePayload);
  const ornaments = getGenerationOrnaments(section, samplePayload);

  return [
    `Use these subdivisions only: ${getOptionLabels(SUBDIVISION_SETTINGS, subdivisions, "eighth notes")}.`,
    ornaments.length
      ? `Use these ornaments only when musically appropriate: ${getOptionLabels(ORNAMENT_SETTINGS, ornaments, "none")}.`
      : "Use no ornaments.",
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

function splitIntoSlotGroups(notes, groupSlots) {
  if (!groupSlots) {
    return [notes || []];
  }

  const groups = [];
  let group = [];
  let groupUsedSlots = 0;

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

function preferLongerValues(notes, options = {}) {
  const {
    groupSlots = 0,
  } = options;

  return splitIntoSlotGroups(notes, groupSlots).flatMap((group) => {
    if (!groupHasPlayedNotes(group)) {
      const restSlots = group.reduce((total, note) => total + getNoteSlotCount(note), 0);
      const firstRest = group.find((note) => isRest(note)) || group[0];
      const compressedRests = [];
      pushCompressedRests(compressedRests, restSlots, firstRest);
      return compressedRests;
    }

    return preferLongerValuesInGroup(group);
  });
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
  const totalUnits = getNotesQuarterUnits(notes);

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
          tuplets: Array.isArray(voice && voice.tuplets) ? voice.tuplets : [],
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

  return notes.map((note) => {
    const type = isRest(note) ? "r" : "n";
    const dots = Number(note.dots || 0);
    const duration = `${Number(note.duration || 4)}${dots ? ".".repeat(dots) : ""}`;
    return `${type}${duration}${type === "n" ? normalizeOrnamentText(note.ornaments) : ""}`;
  }).join(" ");
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

function applySectionOrnamentPolicy(section, score) {
  const allowedChars = getAllowedOrnamentChars(section);
  const allowedPattern = allowedChars ? new RegExp(`[^${allowedChars}]`, "g") : /[a-z]/g;

  return {
    ...score,
    measures: (score.measures || []).map((measure) => ({
      ...measure,
      parts: (measure.parts || []).map((part) => ({
        ...part,
        voices: (part.voices || []).map((voice) => ({
          ...voice,
          notes: (voice.notes || []).map((note) => {
            if (note.ornaments == null) {
              return note;
            }

            if (isRest(note)) {
              const { ornaments: _ornaments, ...rest } = note;
              return rest;
            }

            const ornaments = String(note.ornaments).replace(allowedPattern, "");

            if (!ornaments) {
              const { ornaments: _ornaments, ...rest } = note;
              return rest;
            }

            return {
              ...note,
              ornaments,
            };
          }),
        })),
      })),
    })),
  };
}

function getSectionMinPlayedNotes(section) {
  return getNonNegativeInteger(section && section.minPlayedNotes, 0);
}

function getSectionMaxSameHandStickingRun(section) {
  return getPositiveInteger(
    section && section.maxSameHandStickingRun,
    DEFAULT_MAX_SAME_HAND_STICKING_RUN
  );
}

function countPlayedNotes(notes) {
  return (notes || []).filter((note) => !isRest(note)).length;
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
          notes: enforceMinimumPlayedNotesInNotes(section, voice.notes || [], lineIndex),
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

function ensureStickingsOnNotes(section, notes) {
  if (!sectionUsesStickings(section)) {
    return notes;
  }

  let playedIndex = 0;

  return (notes || []).map((note) => {
    if (isRest(note)) {
      return note;
    }

    const existingSticking = getNoteSticking(note);
    const sticking = existingSticking || (playedIndex % 2 === 0 ? "r" : "l");
    playedIndex += 1;

    return existingSticking
      ? note
      : withPrependedSticking(note, sticking);
  });
}

function areConsecutiveSixteenthNotes(left, right) {
  return left &&
    right &&
    !isRest(left) &&
    !isRest(right) &&
    Number(left.duration) === 16 &&
    Number(right.duration) === 16 &&
    Number(left.dots || 0) === 0 &&
    Number(right.dots || 0) === 0;
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

function removeDiddleBeforeConsecutiveCheese(notes) {
  const cleaned = (notes || []).map((note) => ({ ...note }));

  for (let index = 0; index < cleaned.length - 1; index += 1) {
    const note = cleaned[index];
    const next = cleaned[index + 1];

    if (
      areConsecutiveSixteenthNotes(note, next) &&
      /d/.test(String(note.ornaments || "")) &&
      /c/.test(String(next.ornaments || ""))
    ) {
      cleaned[index + 1] = removeOrnamentChars(next, "c");
    }
  }

  return cleaned;
}

function enforceStickingSequenceRules(section, notes) {
  const cleaned = removeDiddleBeforeConsecutiveCheese(notes);

  if (!sectionUsesStickings(section)) {
    return cleaned;
  }

  const maxSameHandRun = getSectionMaxSameHandStickingRun(section);
  const nextNotes = cleaned.map((note) => ({ ...note }));
  let previousNote = null;
  let previousSticking = "";
  let sameHandRun = 0;

  for (let index = 0; index < nextNotes.length; index += 1) {
    const note = nextNotes[index];

    if (isRest(note)) {
      previousNote = null;
      previousSticking = "";
      sameHandRun = 0;
      continue;
    }

    const currentSticking = getNoteSticking(note) || (previousSticking === "r" ? "l" : "r");
    const previousRequiresOpposite = previousNote &&
      areConsecutiveSixteenthNotes(previousNote, note) &&
      /[dc]/.test(String(previousNote.ornaments || "")) &&
      getNoteSticking(previousNote);
    let nextSticking = currentSticking;

    if (previousRequiresOpposite) {
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
    previousSticking = nextSticking;
  }

  return nextNotes;
}

function cleanSequentialOrnaments(notes) {
  const cleaned = (notes || []).map((note) => ({ ...note }));

  for (let index = 0; index < cleaned.length; index += 1) {
    const note = cleaned[index];
    const next = cleaned[index + 1];
    const previous = cleaned[index - 1];
    const isSequentialSixteenth = next &&
      !isRest(note) &&
      !isRest(next) &&
      Number(note.duration) === 16 &&
      Number(next.duration) === 16;
    const previousSequentialSixteenth = previous &&
      !isRest(previous) &&
      !isRest(note) &&
      Number(previous.duration) === 16 &&
      Number(note.duration) === 16;

    if (isSequentialSixteenth && /[dc]/.test(String(note.ornaments || "")) && /f/.test(String(next.ornaments || ""))) {
      cleaned[index] = removeOrnamentChars(note, "dc");
    }

    if (previousSequentialSixteenth && /c/.test(String(previous.ornaments || "")) && /c/.test(String(cleaned[index].ornaments || ""))) {
      cleaned[index] = removeOrnamentChars(cleaned[index], "c");
    }
  }

  return cleaned;
}

function finalizeGeneratedScore(section, score, lineIndex = 0) {
  const policyScore = applySectionOrnamentPolicy(section, score);
  const minimumScore = enforceMinimumPlayedNotes(section, policyScore, lineIndex);

  return {
    ...minimumScore,
    measures: (minimumScore.measures || []).map((measure) => ({
      ...measure,
      parts: (measure.parts || []).map((part) => ({
        ...part,
        voices: (part.voices || []).map((voice) => ({
          ...voice,
          notes: enforceStickingSequenceRules(
            section,
            preferLongerValues(
              cleanSequentialOrnaments(
                ensureStickingsOnNotes(section, voice.notes || [])
              ),
              getPreferLongerValueOptions()
            ),
          ),
        })),
      })),
    })),
  };
}

function getFallbackGenerationOptions(section, samplePayload) {
  const subdivisions = getGenerationSubdivisions(section, samplePayload);
  const ornaments = getGenerationOrnaments(section, samplePayload);
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
    subdivisions,
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

  if (options.allowSticking) {
    ornaments += random() < 0.5 ? "r" : "l";
  }

  if (options.allowFlams && random() < 0.14) {
    ornaments += "f";
  }

  if (options.allowAccents && random() < 0.28) {
    ornaments += "a";
  }

  if (options.allowDiddles && !ornaments.includes("f") && random() < 0.12) {
    ornaments += "d";
  }

  if (
    options.allowCheese &&
    !ornaments.includes("f") &&
    !String(previousOrnaments || "").includes("c") &&
    random() < 0.1
  ) {
    ornaments += "c";
  }

  return ornaments;
}

function createRandomPlayedSlots(slotCount, minimumPlayedNotes, random) {
  const naturalMinimum = Math.ceil(slotCount * (slotCount >= 16 ? 0.45 : 0.35));
  const lowerBound = Math.min(slotCount, Math.max(minimumPlayedNotes, naturalMinimum));
  const playedSlotCount = randomInteger(random, lowerBound, slotCount);
  const playedIndexes = new Set(shuffledIndexes(slotCount, random).slice(0, playedSlotCount));

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

function createFallbackGeneratedScore(section, samplePayload, lineIndex, attempt = 0) {
  const options = getFallbackGenerationOptions(section, samplePayload);
  const retrySeed = attempt ? `:retry:${attempt}` : "";
  const random = createSeededRandom(
    `${section.id || section.title || "section"}:fallback:${lineIndex}${retrySeed}:${section.instructions || ""}`
  );
  const slotCount = options.maxSubdivisionDuration;
  const unitPerSlot = 1;
  const playedSlots = createRandomPlayedSlots(
    slotCount,
    getSectionMinPlayedNotes(section),
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
  const score = scoreSource
    ? normalizeGeneratedScore(scoreSource, fallbackScore)
    : fallbackLine.score;
  const finalizedScore = finalizeGeneratedScore(section, score, index);

  return {
    title: (input && input.title) || fallbackLine.title,
    notes: (input && input.notes) || "",
    tempo: getPositiveInteger(input && input.tempo, fallbackLine.tempo),
    score: finalizedScore,
    exerciseShortForm: getExerciseShortForm(finalizedScore),
  };
}

function createUniqueGeneratedLine(input, section, samplePayload, index, usedExerciseShortForms) {
  for (let attempt = 0; attempt < MAX_UNIQUE_LINE_ATTEMPTS; attempt += 1) {
    const candidateInput = attempt === 0 ? input : null;
    const line = normalizeGeneratedLine(candidateInput, section, samplePayload, index, attempt);

    if (!line.exerciseShortForm || !usedExerciseShortForms.has(line.exerciseShortForm)) {
      if (line.exerciseShortForm) {
        usedExerciseShortForms.add(line.exerciseShortForm);
      }

      return line;
    }
  }

  throw new Error(
    `${section.title || "Section"} line ${index + 1}: could not create a unique exercise after ${MAX_UNIQUE_LINE_ATTEMPTS} attempts.`
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
  return parseJsonLoose(section.sampleJson) || {};
}

function createGenerationSectionsFromBook(book, globalRules = "") {
  const bookPdfSettings = normalizePdfSettings(book.pdfSettings);

  return (book.sections || []).map((section, sectionIndex) => {
    const sectionPdfSettings = normalizePdfSettings({
      ...bookPdfSettings,
      ...(section.pdfSettings || {}),
    });
    const existingPageCount = Array.isArray(section.pages) && section.pages.length
      ? section.pages.length
      : 1;
    const sampleJson = getSectionSampleJson(section);
    const subdivisions = getGenerationSubdivisions(section, sampleJson);
    const ornaments = getGenerationOrnaments(section, sampleJson);
    const structuredSection = {
      ...section,
      subdivisions,
      ornaments,
      sampleJson,
    };

    return {
      id: section.id || `section-${sectionIndex + 1}`,
      title: section.title || `Section ${sectionIndex + 1}`,
      pageCount: getPositiveInteger(
        section.pageCount,
        existingPageCount || inferPageCount(section)
      ),
      minPlayedNotes: getSectionMinPlayedNotes(section),
      maxSameHandStickingRun: getSectionMaxSameHandStickingRun(section),
      globalRules,
      instructions: createStructuredSectionInstructions(structuredSection, sampleJson),
      subdivisions,
      ornaments,
      sampleJson,
      pdfSettings: sectionPdfSettings,
    };
  });
}

function createGenerationConfig(config, sourceBook) {
  const configGeneration = config.generation || {};
  const bookGlobalRules = normalizeGlobalAiRules(sourceBook.globalAiRules);

  return {
    ...config,
    generation: {
      ...configGeneration,
      globalInstructions: normalizeInstructionList(configGeneration.globalInstructions),
      bookGlobalRules,
    },
    book: {
      ...(config.book || {}),
      book: sourceBook.book || (config.book && config.book.book) || "true-chops",
      slug: sourceBook.slug || (config.book && config.book.slug) || "snare-drum-book",
      title: sourceBook.title || (config.book && config.book.title) || "Snare Drum Book",
      edition: Number(sourceBook.edition || (config.book && config.book.edition) || 1),
      contentVersion: Number(sourceBook.contentVersion || (config.book && config.book.contentVersion) || 1),
      pdfSettings: normalizePdfSettings({
        ...((config.book && config.book.pdfSettings) || {}),
        ...(sourceBook.pdfSettings || {}),
      }),
    },
    sections: createGenerationSectionsFromBook(sourceBook, bookGlobalRules),
  };
}

function createAiPrompt(config, section, samplePayload, count, offset, linesPerPage) {
  const globalInstructions = normalizeInstructionList(
    config.generation && config.generation.globalInstructions
  );
  const bookGlobalRules = normalizeGlobalAiRules(
    (config.generation && config.generation.bookGlobalRules) || section.globalRules
  );

  return [
    ...globalInstructions,
    bookGlobalRules ? `Book-wide UI rules:\n${bookGlobalRules}` : "",
    "",
    `Section title: ${section.title || "Untitled section"}`,
    `Section instructions: ${section.instructions || ""}`,
    "Randomize played notes and rests across the whole measure. Do not favor beat four or any other beat.",
    "Rests may occur on any selected subdivision position, including offbeat sixteenth-note and thirty-second-note positions when those subdivisions are selected.",
    sectionUsesStickings(section)
      ? "Every played note in this section must include a sticking ornament: either \"r\" or \"l\". Rests must not have stickings."
      : "",
    section.minPlayedNotes
      ? `Each generated rhythm in this section must have at least ${section.minPlayedNotes} played note events. Rests do not count as played notes.`
      : "",
    sectionUsesStickings(section)
      ? `Do not use more than ${getSectionMaxSameHandStickingRun(section)} consecutive played notes with the same sticking. Rests reset this count.`
      : "",
    sectionUsesStickings(section)
      ? "When a diddle or cheese is followed immediately by the next sixteenth note, that following note must use the opposite sticking. A diddle must not directly precede a cheese on consecutive sixteenth notes."
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
    `[${sectionIndex + 1}/${config.sections.length}] ${section.title}: generate ${pageCount} pages, ${lineCount} lines`
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

function createGeneratedPages(section, generated, now) {
  return Array.from({ length: generated.pageCount }, (_, pageIndex) => {
    const page = createBlankPage(pageIndex + 1, generated.pdfSettings);

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
    const generated = generatedSections[sectionIndex];
    const pages = createGeneratedPages(section, generated, now).map((page, sectionPageIndex) => {
      const pageNumber = globalPageNumber;
      globalPageNumber += 1;

      return {
        ...page,
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

    return {
      id: section.id,
      title: section.title,
      prompt: "",
      sampleJson: JSON.stringify(section.sampleJson || {}, null, 2),
      subdivisions: section.subdivisions,
      ornaments: section.ornaments,
      pageCount: generated.pageCount,
      minPlayedNotes: section.minPlayedNotes,
      maxSameHandStickingRun: section.maxSameHandStickingRun,
      pdfSettings: generated.pdfSettings,
      pages,
    };
  });

  const pages = sections.flatMap((section) => section.pages);

  return {
    book: (config.book && config.book.book) || "true-chops",
    slug: (config.book && config.book.slug) || "snare-drum-book",
    title: (config.book && config.book.title) || "Snare Drum Book",
    edition: Number((config.book && config.book.edition) || 1),
    contentVersion: Number((config.book && config.book.contentVersion) || 1),
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
    pageNumber: page.pageNumber,
    sectionId: page.sectionId,
    sectionTitle: page.sectionTitle,
    sectionPageNumber: page.sectionPageNumber,
    title: page.title,
    pdfSettings: page.pdfSettings,
    lines: page.lines.map(createLineManifest),
  });

  return {
    book: book.book,
    slug: book.slug,
    title: book.title,
    edition: book.edition,
    contentVersion: book.contentVersion,
    updatedAt: book.updatedAt,
    globalAiRules: book.globalAiRules,
    pdfSettings: book.pdfSettings,
    sections: book.sections.map((section) => ({
      id: section.id,
      title: section.title,
      prompt: section.prompt,
      sampleJson: section.sampleJson,
      subdivisions: section.subdivisions,
      ornaments: section.ornaments,
      pageCount: section.pageCount,
      minPlayedNotes: section.minPlayedNotes,
      maxSameHandStickingRun: section.maxSameHandStickingRun,
      pdfSettings: section.pdfSettings,
      pages: section.pages.map(createPageManifest),
    })),
    pages: book.pages.map(createPageManifest),
  };
}

function pageDir(bookRoot, pageNumber) {
  return path.join(bookRoot, "pages", `page-${String(pageNumber).padStart(2, "0")}`);
}

function linePath(bookRoot, pageNumber, lineNumber) {
  return path.join(pageDir(bookRoot, pageNumber), `line-${String(lineNumber).padStart(2, "0")}.json`);
}

function saveBook(book, bookRoot) {
  fs.mkdirSync(bookRoot, { recursive: true });

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

  for (let sectionIndex = 0; sectionIndex < generationConfig.sections.length; sectionIndex += 1) {
    generatedSections.push(
      await generateSectionLines(generationConfig, generationConfig.sections[sectionIndex], sectionIndex, {
        allowFallback: allowFallback || noLocalAi,
        usedExerciseShortForms,
      })
    );
  }

  const book = buildBook(generationConfig, generatedSections);

  if (dryRun) {
    console.log(`Dry run complete. Generated ${book.pages.length} pages and ${book.pages.reduce((sum, page) => sum + page.lines.length, 0)} lines in memory.`);
    return;
  }

  saveBook(book, bookRoot);
  console.log(`Wrote ${book.pages.length} pages to ${path.relative(PROJECT_ROOT, bookRoot)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
