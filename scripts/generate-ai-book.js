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
const TUPLET_TYPE_SETTINGS = [
  { id: "quarter", label: "quarter", type: 4 },
  { id: "eighth", label: "eighth", type: 8 },
  { id: "sixteenth", label: "sixteenth", type: 16 },
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
  return {
    ...DEFAULT_PDF_SETTINGS,
    ...pdfSettings,
    columns: DEFAULT_PDF_SETTINGS.columns,
    rows: getPositiveInteger(pdfSettings.rows, DEFAULT_PDF_SETTINGS.rows),
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
    normal < 2 ||
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
  const explicit = normalizeOptionIds(section && section.subdivisions, SUBDIVISION_SETTINGS);
  return explicit.length ? explicit : inferGenerationSubdivisions(section || {}, samplePayload);
}

function inferGenerationTuplet(section, samplePayload) {
  const explicitSampleTuplet = normalizeTupletConfig(samplePayload && samplePayload.tuplet);

  if (explicitSampleTuplet) {
    return explicitSampleTuplet;
  }

  const tuplet = getSampleTuplets(samplePayload)[0];

  if (!tuplet) {
    return null;
  }

  const notes = getSampleNotes(samplePayload);
  const startNote = notes[Number(tuplet.start) || 0];

  return normalizeTupletConfig({
    actual: tuplet.actual,
    normal: tuplet.normal,
    type: startNote?.duration || section?.tupletType || 8,
  });
}

function getGenerationTuplet(section, samplePayload = getSamplePayload(section)) {
  if (section && Object.prototype.hasOwnProperty.call(section, "tuplet")) {
    return normalizeTupletConfig(section.tuplet);
  }

  return inferGenerationTuplet(section || {}, samplePayload);
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
  const tuplet = getGenerationTuplet(section, samplePayload);

  return [
    `Use these subdivisions only: ${getOptionLabels(SUBDIVISION_SETTINGS, subdivisions, "eighth notes")}.`,
    tuplet
      ? `Use this tuplet type: ${getTupletLabel(tuplet)}.`
      : "Use no tuplets.",
    ornaments.length
      ? `Use these ornaments only when musically appropriate: ${getOptionLabels(ORNAMENT_SETTINGS, ornaments, "none")}.`
      : "Use no ornaments.",
    ornaments.some((ornament) => ornament === "diddles" || ornament === "cheese")
      ? "Diddles and cheese may only be used on sixteenth notes or faster; never put them on eighth notes, dotted eighth notes, or quarter notes."
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

function preferLongerValuesInTupletVoice(voice) {
  const notes = Array.isArray(voice && voice.notes) ? voice.notes : [];
  const tuplets = normalizeVoiceTuplets(voice && voice.tuplets, notes)
    .sort((left, right) => left.start - right.start);

  if (!tuplets.length) {
    return {
      notes: preferLongerValues(notes, getPreferLongerValueOptions()),
      tuplets: [],
    };
  }

  const nextNotes = [];
  const nextTuplets = [];
  let cursor = 0;

  for (const tuplet of tuplets) {
    if (tuplet.start < cursor) {
      continue;
    }

    if (tuplet.start > cursor) {
      nextNotes.push(
        ...preferLongerValues(
          notes.slice(cursor, tuplet.start),
          getPreferLongerValueOptions()
        )
      );
    }

    const tupletStart = nextNotes.length;
    nextNotes.push(
      ...preferLongerValues(notes.slice(tuplet.start, tuplet.end), {
        groupSlots: 0,
      })
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
      ...preferLongerValues(notes.slice(cursor), getPreferLongerValueOptions())
    );
  }

  return {
    notes: nextNotes,
    tuplets: nextTuplets,
  };
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
  const ornaments = getGenerationOrnaments(section);

  return ORNAMENT_SETTINGS
    .filter((setting) => setting.id !== "stickings" && ornaments.includes(setting.id))
    .flatMap((setting) => [...setting.chars]);
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

            const ornaments = cleanDurationRestrictedOrnaments(
              note,
              String(note.ornaments).replace(allowedPattern, "")
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
        })),
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

function getSectionMaxSameHandStickingRun(section) {
  return getPositiveInteger(
    section && section.maxSameHandStickingRun,
    DEFAULT_MAX_SAME_HAND_STICKING_RUN
  );
}

function getSectionRequireMaxSameHandStickingRun(section) {
  if (!section) {
    return false;
  }

  if (typeof section.requireMaxSameHandStickingRun === "boolean") {
    return section.requireMaxSameHandStickingRun;
  }

  return section.requireMaxSameHandStickingRun === "true";
}

function countPlayedNotes(notes) {
  return (notes || []).filter((note) => !isRest(note)).length;
}

function getEffectiveSectionMaxPlayedNotes(section) {
  const maximum = getSectionMaxPlayedNotes(section);

  if (!maximum) {
    return 0;
  }

  const minimum = getSectionMinPlayedNotes(section);
  const requiredSameHandRun = sectionUsesStickings(section) &&
    getSectionRequireMaxSameHandStickingRun(section)
    ? getSectionMaxSameHandStickingRun(section)
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

function getProtectedPlayedIndexesForMaximum(section, notes) {
  if (
    !sectionUsesStickings(section) ||
    !getSectionRequireMaxSameHandStickingRun(section)
  ) {
    return new Set();
  }

  const targetRun = findRequiredMaxSameHandRun(
    notes,
    getSectionMaxSameHandStickingRun(section)
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

function cleanDurationRestrictedOrnaments(note, ornaments = note?.ornaments || "") {
  const duration = Number(note?.duration);
  const cleanedOrnaments = duration <= 8
    ? String(ornaments).replace(/[dc]/g, "")
    : String(ornaments);

  return cleanedOrnaments;
}

function enforceDurationOrnamentRules(notes) {
  return (notes || []).map((note) => {
    if (isRest(note) || note.ornaments == null) {
      return note;
    }

    const ornaments = cleanDurationRestrictedOrnaments(note);

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

function removeDiddleBeforeConsecutiveCheese(notes) {
  const cleaned = (notes || []).map((note) => ({ ...note }));

  for (let index = 0; cleaned.length > 1 && index < cleaned.length; index += 1) {
    const note = cleaned[index];
    const nextIndex = (index + 1) % cleaned.length;
    const next = cleaned[nextIndex];

    if (
      areConsecutiveSixteenthNotes(note, next) &&
      /d/.test(String(note.ornaments || "")) &&
      /c/.test(String(next.ornaments || ""))
    ) {
      cleaned[nextIndex] = removeOrnamentChars(next, "c");
    }
  }

  return cleaned;
}

function noteCanShareStickingWithPrevious(left, right) {
  return !(
    areConsecutiveSixteenthNotes(left, right) &&
    /[dc]/.test(String(left.ornaments || ""))
  );
}

function findRequiredMaxSameHandRun(notes, runLength, { allowCleanup = false } = {}) {
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
        !noteCanShareStickingWithPrevious(notes[start + offset - 1], note)
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

  return candidates[
    hashString(JSON.stringify(notes)) % candidates.length
  ];
}

function removeInternalRequiredRunConflicts(notes, targetRun) {
  if (!targetRun || !targetRun.cleanupInternalOrnaments) {
    return notes;
  }

  const nextNotes = notes.map((note) => ({ ...note }));

  for (let index = targetRun.start; index < targetRun.end; index += 1) {
    if (!noteCanShareStickingWithPrevious(nextNotes[index], nextNotes[index + 1])) {
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

function ensureRequiredMaxSameHandRunWindow(section, notes, runLength) {
  if (findRequiredMaxSameHandRun(notes, runLength)) {
    return notes;
  }

  if (findRequiredMaxSameHandRun(notes, runLength, { allowCleanup: true })) {
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

function ensureRequiredMaxSameHandRunWindowFixed(section, notes, runLength) {
  if (findRequiredMaxSameHandRun(notes, runLength)) {
    return notes;
  }

  if (!runLength || notes.length < runLength) {
    return notes;
  }

  const candidates = [];

  for (let start = 0; start <= notes.length - runLength; start += 1) {
    candidates.push({ start, end: start + runLength - 1 });
  }

  const targetRun = candidates[
    hashString(`${section.id || section.title || "section"}:${JSON.stringify(notes)}`) % candidates.length
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
  let cleaned = removeDiddleBeforeConsecutiveCheese(notes);

  if (!sectionUsesStickings(section)) {
    return cleaned;
  }

  const maxSameHandRun = getSectionMaxSameHandStickingRun(section);
  const requireMaxRun = getSectionRequireMaxSameHandStickingRun(section);

  if (requireMaxRun) {
    cleaned = preserveNoteCount
      ? ensureRequiredMaxSameHandRunWindowFixed(section, cleaned, maxSameHandRun)
      : ensureRequiredMaxSameHandRunWindow(section, cleaned, maxSameHandRun);
  }

  let targetRun = requireMaxRun
    ? findRequiredMaxSameHandRun(cleaned, maxSameHandRun)
    : null;

  if (!targetRun && requireMaxRun) {
    targetRun = findRequiredMaxSameHandRun(cleaned, maxSameHandRun, { allowCleanup: true });
    cleaned = removeInternalRequiredRunConflicts(cleaned, targetRun);
  }

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

    if (targetRun && index === targetRun.start) {
      const targetSticking = previousSticking
        ? getOppositeSticking(previousSticking)
        : getNoteSticking(note) || (hashString(JSON.stringify(targetRun)) % 2 ? "l" : "r");

      for (let runIndex = targetRun.start; runIndex <= targetRun.end; runIndex += 1) {
        nextNotes[runIndex] = withSticking(nextNotes[runIndex], targetSticking);
      }

      previousNote = nextNotes[targetRun.end];
      previousSticking = targetSticking;
      sameHandRun = targetRun.end - targetRun.start + 1;
      index = targetRun.end;
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

function enforceDiddleFollowedByOppositeSticking(section, notes) {
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

      if (
        !areConsecutiveSixteenthNotes(note, next) ||
        !/[dc]/.test(String(note.ornaments || ""))
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

function repeatingBoundaryViolatesStickingRules(section, notes) {
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
    areConsecutiveSixteenthNotes(last, first) &&
    /[dc]/.test(String(last.ornaments || "")) &&
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

function repeatingMeasureViolatesStickingRules(section, notes) {
  if (!sectionUsesStickings(section) || !Array.isArray(notes) || notes.length < 2) {
    return false;
  }

  const maximumRun = getSectionMaxSameHandStickingRun(section);

  for (let index = 0; index < notes.length; index += 1) {
    const note = notes[index];
    const next = notes[(index + 1) % notes.length];

    if (
      areConsecutiveSixteenthNotes(note, next) &&
      /[dc]/.test(String(note.ornaments || "")) &&
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

  return false;
}

function enforceRepeatingMeasureStickingRules(section, notes, options = {}) {
  if (!sectionUsesStickings(section)) {
    return notes;
  }

  let nextNotes = (notes || []).map((note) => ({ ...note }));
  const maximumAttempts = Math.max(4, nextNotes.length * 2);

  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    nextNotes = enforceStickingSequenceRules(section, nextNotes, options);
    nextNotes = enforceDiddleFollowedByOppositeSticking(section, nextNotes);

    if (!repeatingMeasureViolatesStickingRules(section, nextNotes)) {
      return nextNotes;
    }

    const boundaryViolation = repeatingBoundaryViolatesStickingRules(section, nextNotes);
    const lastSticking = getNoteSticking(nextNotes[nextNotes.length - 1]);

    if (boundaryViolation && lastSticking && !isRest(nextNotes[0])) {
      nextNotes[0] = withSticking(nextNotes[0], getOppositeSticking(lastSticking));
    }
  }

  throw new Error(
    `${section.title || section.id || "Section"}: could not satisfy sticking rules across the repeat boundary.`
  );
}

function cleanSequentialOrnaments(notes) {
  const cleaned = (notes || []).map((note) => ({ ...note }));

  for (let index = 0; cleaned.length > 1 && index < cleaned.length; index += 1) {
    const note = cleaned[index];
    const nextIndex = (index + 1) % cleaned.length;
    const next = cleaned[nextIndex];
    const isSequentialSixteenth = next &&
      !isRest(note) &&
      !isRest(next) &&
      Number(note.duration) === 16 &&
      Number(next.duration) === 16;

    if (isSequentialSixteenth && /[dc]/.test(String(note.ornaments || "")) && /f/.test(String(next.ornaments || ""))) {
      cleaned[nextIndex] = removeOrnamentChars(next, "f");
    }

    if (isSequentialSixteenth && /c/.test(String(note.ornaments || "")) && /c/.test(String(cleaned[nextIndex].ornaments || ""))) {
      cleaned[nextIndex] = removeOrnamentChars(cleaned[nextIndex], "c");
    }
  }

  return cleaned;
}

function stripStickingsFromNotes(notes) {
  return (notes || []).map((note) => removeOrnamentChars(note, "rl"));
}

function assignInitialStickings(section, notes, lineIndex = 0) {
  if (!sectionUsesStickings(section)) {
    return notes;
  }

  const random = createSeededRandom(
    `${section.id || section.title || "section"}:stickings:${lineIndex}:${JSON.stringify(notes)}`
  );

  return (notes || []).map((note) =>
    isRest(note) ? note : withSticking(note, random() < 0.5 ? "r" : "l")
  );
}

function areAdjacentPlayedSixteenths(notes, leftIndex, rightIndex) {
  const distance = Math.abs(leftIndex - rightIndex);
  return notes.length > 1 && (distance === 1 || distance === notes.length - 1) &&
    areConsecutiveSixteenthNotes(notes[Math.min(leftIndex, rightIndex)], notes[Math.max(leftIndex, rightIndex)]);
}

function getCircularNeighbor(notes, noteIndex, offset) {
  if (!Array.isArray(notes) || notes.length < 2) {
    return null;
  }

  return notes[(noteIndex + offset + notes.length) % notes.length];
}

function canAddRequiredOrnament(notes, noteIndex, ornament) {
  const note = notes[noteIndex];

  if (!note || isRest(note)) {
    return false;
  }

  const current = String(note.ornaments || "");

  if (ornament === "d" || ornament === "c") {
    if (Number(note.duration) < 16 || /f/.test(current)) {
      return false;
    }
  }

  if (ornament === "f" && /[dc]/.test(current)) {
    return false;
  }

  if (ornament === "f") {
    const previous = getCircularNeighbor(notes, noteIndex, -1);

    if (previous && areConsecutiveSixteenthNotes(previous, note) && /[dc]/.test(String(previous.ornaments || ""))) {
      return false;
    }
  }

  if (ornament === "c") {
    const previous = getCircularNeighbor(notes, noteIndex, -1);
    const next = getCircularNeighbor(notes, noteIndex, 1);

    if (previous && areConsecutiveSixteenthNotes(previous, note) && /[dc]/.test(String(previous.ornaments || ""))) {
      return false;
    }

    if (next && areConsecutiveSixteenthNotes(note, next) && /[cf]/.test(String(next.ornaments || ""))) {
      return false;
    }
  }

  if (ornament === "d") {
    const next = getCircularNeighbor(notes, noteIndex, 1);

    if (next && areConsecutiveSixteenthNotes(note, next) && /[fc]/.test(String(next.ornaments || ""))) {
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

function getOrnamentFrequencyProfile(section, notes, lineIndex) {
  const requiredOrnaments = getRequiredSectionOrnamentChars(section);
  const varietyOrnaments = requiredOrnaments.filter((ornament) => ornament !== "a");
  const targets = new Map(requiredOrnaments.map((ornament) => [ornament, 1]));

  if (requiredOrnaments.length < 2) {
    return { featuredOrnament: "", targets, varietyOrnaments };
  }

  if (requiredOrnaments.includes("a")) {
    const playedCount = countPlayedNotes(notes);
    const accentDensity = 1 + (
      lineIndex + hashString(`${section.id || section.title || "section"}:accents`)
    ) % 4;
    targets.set("a", Math.max(1, Math.min(accentDensity, playedCount)));
  }

  if (!varietyOrnaments.length) {
    return { featuredOrnament: "", targets, varietyOrnaments };
  }

  const featuredIndex = (
    lineIndex + hashString(section.id || section.title || "section")
  ) % varietyOrnaments.length;
  const featuredOrnament = varietyOrnaments[featuredIndex];
  const densityStep = Math.floor(lineIndex / varietyOrnaments.length) % 3;
  const eligibleCount = (notes || []).filter((note, noteIndex) =>
    canAddRequiredOrnament(notes, noteIndex, featuredOrnament)
  ).length;
  const musicalMaximum = featuredOrnament === "c"
    ? Math.ceil(eligibleCount / 2)
    : eligibleCount;

  targets.set(featuredOrnament, Math.max(1, Math.min(2 + densityStep, musicalMaximum)));
  return { featuredOrnament, targets, varietyOrnaments };
}

function resetProfiledOrnaments(notes, requiredOrnaments) {
  const pattern = requiredOrnaments.join("");

  return (notes || []).map((note) => {
    const hadAccent = String(note.ornaments || "").includes("a");
    const cleaned = removeOrnamentChars(note, pattern);

    return hadAccent ? { ...cleaned, velocity: 0.5 } : cleaned;
  });
}

function ensureRequiredOrnamentsOnNotes(section, notes, lineIndex = 0) {
  const requiredOrnaments = getRequiredSectionOrnamentChars(section);
  const shouldApplyFrequencyProfile = requiredOrnaments.length > 1;
  const nextNotes = shouldApplyFrequencyProfile
    ? resetProfiledOrnaments(notes, requiredOrnaments)
    : (notes || []).map((note) => ({ ...note }));
  const { featuredOrnament, targets, varietyOrnaments } = getOrnamentFrequencyProfile(
    section,
    nextNotes,
    lineIndex
  );
  const assignedIndexes = new Set();
  const placementOrder = [
    ...varietyOrnaments.filter((ornament) => ornament !== featuredOrnament),
    ...(featuredOrnament ? [featuredOrnament] : []),
    ...(requiredOrnaments.includes("a") ? ["a"] : []),
  ];

  for (const ornament of placementOrder) {
    const targetCount = targets.get(ornament) || 1;

    while (nextNotes.filter((note) =>
      !isRest(note) && String(note.ornaments || "").includes(ornament)
    ).length < targetCount) {
      const candidates = nextNotes
        .map((note, index) => ({ index, note }))
        .filter(({ index, note }) =>
          !String(note.ornaments || "").includes(ornament) &&
          canAddRequiredOrnament(nextNotes, index, ornament)
        )
        .sort((left, right) => {
        const leftUsed = assignedIndexes.has(left.index) ? 1 : 0;
        const rightUsed = assignedIndexes.has(right.index) ? 1 : 0;
        const leftUseRank = ornament === "a" ? 1 - leftUsed : leftUsed;
        const rightUseRank = ornament === "a" ? 1 - rightUsed : rightUsed;
        const leftCount = String(left.note.ornaments || "").length;
        const rightCount = String(right.note.ornaments || "").length;
        const leftAdjacentDiddle = ornament === "d" && nextNotes.some((note, index) =>
          /d/.test(String(note.ornaments || "")) && areAdjacentPlayedSixteenths(nextNotes, left.index, index)
        ) ? 0 : 1;
        const rightAdjacentDiddle = ornament === "d" && nextNotes.some((note, index) =>
          /d/.test(String(note.ornaments || "")) && areAdjacentPlayedSixteenths(nextNotes, right.index, index)
        ) ? 0 : 1;

        return leftAdjacentDiddle - rightAdjacentDiddle ||
          leftUseRank - rightUseRank ||
          leftCount - rightCount ||
          hashString(`${section.id}:${lineIndex}:${ornament}:${left.index}`) -
            hashString(`${section.id}:${lineIndex}:${ornament}:${right.index}`);
        });

      if (!candidates.length) {
        const placedCount = nextNotes.filter((note) =>
          !isRest(note) && String(note.ornaments || "").includes(ornament)
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

function finalizeGeneratedScore(section, score, lineIndex = 0) {
  const policyScore = applySectionOrnamentPolicy(section, score);
  const minimumScore = enforceMinimumPlayedNotes(section, policyScore, lineIndex);
  const boundedScore = enforceMaximumPlayedNotes(section, minimumScore, lineIndex);

  return {
    ...boundedScore,
    measures: (boundedScore.measures || []).map((measure) => ({
      ...measure,
      parts: (measure.parts || []).map((part) => ({
        ...part,
        voices: (part.voices || []).map((voice) => {
          const hasTuplets = Array.isArray(voice.tuplets) && voice.tuplets.length > 0;
          const cleanedNotes = cleanSequentialOrnaments(
            stripStickingsFromNotes(voice.notes || [])
          );
          const notationVoice = hasTuplets
            ? preferLongerValuesInTupletVoice({
                ...voice,
                notes: cleanedNotes,
              })
            : {
                notes: preferLongerValues(cleanedNotes, getPreferLongerValueOptions()),
                tuplets: [],
              };
          const cappedNotes = enforceMaximumPlayedNotesInNotes(
            section,
            enforceDurationOrnamentRules(notationVoice.notes),
            `${lineIndex}:final`
          );
          const notationNotes = hasTuplets
            ? cappedNotes
            : preferLongerValues(cappedNotes, getPreferLongerValueOptions());
          const ornamentedNotes = ensureRequiredOrnamentsOnNotes(
            section,
            removeDiddleBeforeConsecutiveCheese(
              cleanSequentialOrnaments(enforceDurationOrnamentRules(notationNotes))
            ),
            lineIndex
          );
          const stickingNotes = enforceRepeatingMeasureStickingRules(
            section,
            assignInitialStickings(section, ornamentedNotes, lineIndex),
            { preserveNoteCount: hasTuplets }
          );

          return {
            ...voice,
            tuplets: notationVoice.tuplets,
            notes: stickingNotes,
          };
        }),
      })),
    })),
  };
}

function getFallbackGenerationOptions(section, samplePayload) {
  const subdivisions = getGenerationSubdivisions(section, samplePayload);
  const ornaments = getGenerationOrnaments(section, samplePayload);
  const tuplet = getGenerationTuplet(section, samplePayload);
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
    tuplet,
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

function getTupletLayout(tuplet) {
  if (!tuplet) {
    return null;
  }

  const groupQuarterUnits = Number(tuplet.normal) * (4 / Number(tuplet.type));
  const groupCount = Math.floor(4 / groupQuarterUnits);
  const remainderQuarterUnits = 4 - groupCount * groupQuarterUnits;
  const remainderSlots = Math.round(remainderQuarterUnits / THIRTY_SECOND_QUARTER_UNITS);

  return groupCount > 0
    ? { groupCount, remainderSlots }
    : null;
}

function createTupletNotesFromPlayedSlots(slots, tuplet, options, random) {
  const notes = [];
  let playedIndex = 0;

  for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
    const isPlayed = slots[slotIndex];
    const previousOrnaments = notes[notes.length - 1]?.ornaments || "";
    const ornaments = isPlayed
      ? createFallbackOrnaments(options, random, playedIndex, previousOrnaments)
      : "";

    notes.push({
      notes: isPlayed ? ["C5"] : [],
      duration: Number(tuplet.type),
      dots: 0,
      velocity: ornaments.includes("a") ? 1 : 0.5,
      ...(ornaments ? { ornaments } : {}),
    });

    playedIndex += isPlayed ? 1 : 0;
  }

  return notes;
}

function createTupletFallbackGeneratedScore(section, options, random) {
  const tuplet = options.tuplet;
  const layout = getTupletLayout(tuplet);

  if (!layout) {
    return null;
  }

  const { groupCount, remainderSlots } = layout;
  const slotCount = groupCount * tuplet.actual;
  const playedSlots = createRandomPlayedSlots(
    slotCount,
    getSectionMinPlayedNotes(section),
    getEffectiveSectionMaxPlayedNotes(section),
    random
  );
  const notes = createTupletNotesFromPlayedSlots(playedSlots, tuplet, options, random);
  const tuplets = Array.from({ length: groupCount }, (_, groupIndex) => ({
    start: groupIndex * tuplet.actual,
    end: (groupIndex + 1) * tuplet.actual,
    actual: tuplet.actual,
    normal: tuplet.normal,
  }));

  if (remainderSlots > 0) {
    pushCompressedRests(notes, remainderSlots, { velocity: 0.5 });
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

  if (options.tuplet) {
    const tupletScore = createTupletFallbackGeneratedScore(section, options, random);

    if (tupletScore) {
      return tupletScore;
    }
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
  const expectedTuplet = getGenerationTuplet(section, samplePayload);
  const score = scoreHasTuplets(normalizedScore) === Boolean(expectedTuplet)
    ? normalizedScore
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
    const tuplet = getGenerationTuplet(section, sampleJson);
    const structuredSection = {
      ...section,
      subdivisions,
      ornaments,
      tuplet,
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
      maxPlayedNotes: getSectionMaxPlayedNotes(section),
      maxSameHandStickingRun: getSectionMaxSameHandStickingRun(section),
      requireMaxSameHandStickingRun: getSectionRequireMaxSameHandStickingRun(section),
      globalRules,
      instructions: createStructuredSectionInstructions(structuredSection, sampleJson),
      subdivisions,
      ornaments,
      tuplet,
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
  const tuplet = getGenerationTuplet(section, samplePayload);

  return [
    ...globalInstructions,
    bookGlobalRules ? `Book-wide UI rules:\n${bookGlobalRules}` : "",
    "",
    `Section title: ${section.title || "Untitled section"}`,
    `Section instructions: ${section.instructions || ""}`,
    tuplet
      ? `Tuplet type: ${getTupletLabel(tuplet)}. Each voice must include tuplets entries shaped like {"start":0,"end":${tuplet.actual},"actual":${tuplet.actual},"normal":${tuplet.normal}}. The start is inclusive and end is exclusive, using indexes into voice.notes. Use repeated complete tuplet groups of ${tuplet.actual} notes with note duration ${tuplet.type}; if another complete group will not fit in the 4/4 measure, fill the remaining duration with rests.`
      : "Do not use tuplets. Each generated voice should have an empty tuplets array.",
    "Randomize played notes and rests across the whole measure. Do not favor beat four or any other beat.",
    "Rests may occur on any selected subdivision position, including offbeat sixteenth-note and thirty-second-note positions when those subdivisions are selected.",
    sectionUsesStickings(section)
      ? "First choose and place all non-sticking ornaments. Only afterward assign every played note a sticking ornament (\"r\" or \"l\") while applying the sticking rules below. Rests must not have stickings."
      : "",
    getRequiredSectionOrnamentChars(section).length
      ? `Every measure must contain at least one of each selected non-sticking ornament: ${getRequiredSectionOrnamentChars(section).join(", ")}.`
      : "",
    getRequiredSectionOrnamentChars(section).length > 1
      ? "Treat accents independently: they may share notes with any other ornament and must not consume space in the ornament-variety pattern. Rotate variety only among flams, diddles, and cheese, while every selected ornament remains represented. Never place a flam immediately after a diddle or cheese."
      : "",
    section.minPlayedNotes
      ? `Each generated rhythm in this section must have at least ${section.minPlayedNotes} played note events. Rests do not count as played notes.`
      : "",
    section.maxPlayedNotes
      ? `Each generated rhythm in this section must have no more than ${getEffectiveSectionMaxPlayedNotes(section)} played note events. Rests do not count as played notes.`
      : "",
    sectionUsesStickings(section)
      ? `Do not use more than ${getSectionMaxSameHandStickingRun(section)} consecutive played notes with the same sticking. Rests reset this count.`
      : "",
    sectionUsesStickings(section) && getSectionRequireMaxSameHandStickingRun(section)
      ? `Every generated rhythm in this section must include at least one run of exactly ${getSectionMaxSameHandStickingRun(section)} consecutive played notes with the same sticking.`
      : "",
    sectionUsesStickings(section)
      ? "When a diddle or cheese is followed immediately by the next sixteenth note, that following note must use the opposite sticking. A diddle must not directly precede a cheese on consecutive sixteenth notes."
      : "",
    "Every measure repeats. Apply every ornament-sequencing and sticking rule across the repeat boundary, treating the first note as immediately following the last note.",
    sectionUsesDiddlesOrCheese(section)
      ? "Diddles and cheese may only be used on sixteenth notes or faster; never put them on eighth notes, dotted eighth notes, or quarter notes."
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
      tuplet: section.tuplet,
      pageCount: generated.pageCount,
      minPlayedNotes: section.minPlayedNotes,
      maxPlayedNotes: section.maxPlayedNotes,
      maxSameHandStickingRun: section.maxSameHandStickingRun,
      requireMaxSameHandStickingRun: section.requireMaxSameHandStickingRun,
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
      tuplet: section.tuplet,
      pageCount: section.pageCount,
      minPlayedNotes: section.minPlayedNotes,
      maxPlayedNotes: section.maxPlayedNotes,
      maxSameHandStickingRun: section.maxSameHandStickingRun,
      requireMaxSameHandStickingRun: section.requireMaxSameHandStickingRun,
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
