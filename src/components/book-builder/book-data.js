import _ from "lodash";
import { getEmptyMeasure } from "../../helpers/score";
import { DEFAULT_TEMPO } from "../../consts/score";

export const BOOK_KEY = "true-chops";
export const BOOK_SLUG = "snare-drum-book";
export const BOOK_TITLE = "Snare Drum Book";
export const BOOK_EDITION = 1;
export const BOOK_CONTENT_VERSION = 3;
export const DEFAULT_GLOBAL_AI_RULES = "";
export const DEFAULT_GLOBAL_ORNAMENT_DENSITY = 100;
export const DEFAULT_MAX_SAME_HAND_STICKING_RUN = 4;
export const SUBDIVISION_OPTIONS = [
  { id: "eighths", label: "Eighths", duration: 8 },
  { id: "sixteenths", label: "Sixteenths", duration: 16 },
  { id: "thirtyseconds", label: "Thirtyseconds", duration: 32 },
];
export const TUPLET_TYPE_OPTIONS = [
  { id: "quarter", label: "Quarter", type: 4 },
  { id: "eighth", label: "Eighth", type: 8 },
  { id: "sixteenth", label: "Sixteenth", type: 16 },
];
const LEGACY_TUPLET_OPTIONS = [
  { id: "eighth-triplets", label: "Eighth triplets", actual: 3, normal: 2, type: 8 },
  { id: "sixteenth-triplets", label: "Sixteenth triplets", actual: 3, normal: 2, type: 16 },
  { id: "sixteenth-quintuplets", label: "Sixteenth quintuplets", actual: 5, normal: 4, type: 16 },
  { id: "sixteenth-septuplets", label: "Sixteenth septuplets", actual: 7, normal: 4, type: 16 },
];
export const ORNAMENT_OPTIONS = [
  { id: "stickings", label: "Stickings" },
  { id: "accents", label: "Accents" },
  { id: "flams", label: "Flams" },
  { id: "diddles", label: "Diddles" },
  { id: "cheese", label: "Cheese" },
];
export const DEFAULT_BOOK_SECTIONS = [
  {
    id: "eighth-notes",
    title: "Eighth Notes",
    prompt: "",
    sampleJson: "{\n  \"rhythmFamily\": \"eighth-notes\",\n  \"allowedDurations\": [8],\n  \"accents\": false\n}",
    subdivisions: ["eighths"],
    ornaments: [],
  },
  {
    id: "eighth-notes-accents",
    title: "Eighth Notes with Accents",
    prompt: "",
    sampleJson: "{\n  \"rhythmFamily\": \"eighth-notes\",\n  \"allowedDurations\": [8],\n  \"accents\": true\n}",
    subdivisions: ["eighths"],
    ornaments: ["accents"],
  },
];
export const MEASURES_PER_SCORE = 1;
export const PDF_PAGE_WIDTH = 612;
export const PDF_PAGE_HEIGHT = 792;
export const PDF_PAGE_MARGIN = 28;
export const PDF_PAGE_FOOTER_HEIGHT = 38;
export const SCORE_RENDER_BASE_WIDTH = 1100;
export const SCORE_RENDER_ROOT_PADDING = 50;
export const SCORE_MEASURE_GAP = 0;
export const SCORE_MEASURE_START_PADDING = 4;
export const SCORE_MEASURE_END_PADDING = 8;
export const SCORE_MINIMUM_NOTE_SPACING = 22;

export const DEFAULT_PDF_SETTINGS = {
  measuresPerLine: 2,
  lineSpacing: 130,
  noteSize: 100,
};

function normalizeBoundedNumber(value, fallback, minimum, maximum, integer = false) {
  const parser = integer ? Number.parseInt : Number.parseFloat;
  const parsed = parser(value, 10);
  const parsedFallback = parser(fallback, 10);
  const safeFallback = Number.isFinite(parsedFallback) ? parsedFallback : minimum;

  return Math.min(
    maximum,
    Math.max(minimum, Number.isFinite(parsed) ? parsed : safeFallback)
  );
}

// Kept for callers that still import the legacy helper. Page capacity is now
// derived from note size and line spacing instead of a manually selected row count.
export function normalizePdfRows(value, fallback = 10) {
  const parsed = Number.parseInt(value, 10);
  const normalizedFallback = Number.parseInt(fallback, 10);

  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return Number.isInteger(normalizedFallback) && normalizedFallback > 0
    ? normalizedFallback
    : 10;
}

export function normalizeSectionPageCount(value, fallback = 1) {
  const parsed = Number.parseInt(value, 10);
  const normalizedFallback = Number.parseInt(fallback, 10);

  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return Number.isInteger(normalizedFallback) && normalizedFallback > 0
    ? normalizedFallback
    : 1;
}

export function normalizeSectionMinPlayedNotes(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  const normalizedFallback = Number.parseInt(fallback, 10);

  if (Number.isInteger(parsed) && parsed >= 0) {
    return parsed;
  }

  return Number.isInteger(normalizedFallback) && normalizedFallback >= 0
    ? normalizedFallback
    : 0;
}

export function normalizeSectionMaxPlayedNotes(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  const normalizedFallback = Number.parseInt(fallback, 10);

  if (Number.isInteger(parsed) && parsed >= 0) {
    return parsed;
  }

  return Number.isInteger(normalizedFallback) && normalizedFallback >= 0
    ? normalizedFallback
    : 0;
}

export function normalizeSectionMaxSameHandStickingRun(value, fallback = DEFAULT_MAX_SAME_HAND_STICKING_RUN) {
  const parsed = Number.parseInt(value, 10);
  const normalizedFallback = Number.parseInt(fallback, 10);

  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return Number.isInteger(normalizedFallback) && normalizedFallback > 0
    ? normalizedFallback
    : DEFAULT_MAX_SAME_HAND_STICKING_RUN;
}

export function normalizeSectionRequireMaxSameHandStickingRun(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
  }

  return Boolean(fallback);
}

export function normalizeSectionRequiredSameHandStickingRuns(value, fallback = []) {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[^0-9]+/)
      : [];
  const normalized = values
    .map((item) => Number.parseInt(item, 10))
    .filter((item) => Number.isInteger(item) && item > 0 && item <= 32);

  if (normalized.length) {
    return [...new Set(normalized)].sort((left, right) => left - right);
  }

  return Array.isArray(fallback) && fallback.length
    ? normalizeSectionRequiredSameHandStickingRuns(fallback, [])
    : [];
}

export function normalizeSectionPlayEveryNote(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
  }

  return Boolean(fallback);
}

export function normalizeGlobalAiRules(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join("\n");
  }

  return typeof value === "string" ? value : DEFAULT_GLOBAL_AI_RULES;
}

export function normalizeGlobalOrnamentDensity(
  value,
  fallback = DEFAULT_GLOBAL_ORNAMENT_DENSITY
) {
  return normalizeBoundedNumber(value, fallback, 25, 200, true);
}

function parseJsonLoose(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getSampleNotes(sampleJson) {
  const sample = typeof sampleJson === "string" ? parseJsonLoose(sampleJson) : sampleJson;
  const score = sample && sample.score && sample.score.measures
    ? sample.score
    : sample && sample.measures
      ? sample
      : null;
  const measure = score && score.measures && score.measures[0];
  const part = measure && Array.isArray(measure.parts)
    ? measure.parts.find((candidate) => candidate.instrument === "snare") || measure.parts[0]
    : null;
  const voice = part && part.voices && part.voices[0];
  return Array.isArray(voice && voice.notes) ? voice.notes : [];
}

function getSampleTuplets(sampleJson) {
  const sample = typeof sampleJson === "string" ? parseJsonLoose(sampleJson) : sampleJson;

  if (Array.isArray(sample && sample.tuplets)) {
    return sample.tuplets;
  }

  const score = sample && sample.score && sample.score.measures
    ? sample.score
    : sample && sample.measures
      ? sample
      : null;
  const measure = score && score.measures && score.measures[0];
  const part = measure && Array.isArray(measure.parts)
    ? measure.parts.find((candidate) => candidate.instrument === "snare") || measure.parts[0]
    : null;
  const voice = part && part.voices && part.voices[0];
  return Array.isArray(voice && voice.tuplets) ? voice.tuplets : [];
}

function normalizeOptionList(value, options, fallback = []) {
  const validIds = new Set(options.map((option) => option.id));
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

  return normalized.length ? normalized : fallback;
}

export function getTupletTypeOptionByValue(value) {
  const type = Number(value && value.type);

  return TUPLET_TYPE_OPTIONS.find((option) => Number(option.type) === type);
}

function normalizeTupletConfig(value) {
  if (!value || value === "none" || value === false) {
    return null;
  }

  if (typeof value === "string") {
    const option = LEGACY_TUPLET_OPTIONS.find((candidate) => candidate.id === value);
    return option
      ? {
          actual: option.actual,
          normal: option.normal,
          type: option.type,
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
    !TUPLET_TYPE_OPTIONS.some((option) => option.type === type)
  ) {
    return null;
  }

  return {
    actual,
    normal,
    type,
  };
}

function inferSectionSubdivisions(section = {}) {
  const text = `${section.title || ""}\n${section.prompt || ""}\n${section.instructions || ""}`.toLowerCase();
  const sample = typeof section.sampleJson === "string"
    ? parseJsonLoose(section.sampleJson)
    : section.sampleJson;
  const durations = new Set(getSampleNotes(section.sampleJson).map((note) => Number(note.duration)));
  const allowedDurations = Array.isArray(sample && sample.allowedDurations)
    ? sample.allowedDurations.map(Number)
    : [];
  const inferred = [];

  if (text.includes("thirtysecond") || text.includes("thirty-second") || durations.has(32) || allowedDurations.includes(32)) {
    inferred.push("thirtyseconds");
  }

  if (text.includes("sixteenth") || durations.has(16) || allowedDurations.includes(16)) {
    inferred.push("sixteenths");
  }

  if (text.includes("eighth") || durations.has(8) || allowedDurations.includes(8)) {
    inferred.push("eighths");
  }

  return inferred.length ? inferred : ["eighths"];
}

function inferSectionTuplets(section = {}) {
  const sample = typeof section.sampleJson === "string"
    ? parseJsonLoose(section.sampleJson)
    : section.sampleJson;
  const explicitSampleTuplets = [
    ...(Array.isArray(sample && sample.tuplets) ? sample.tuplets : []),
    ...(sample && sample.tuplet ? [sample.tuplet] : []),
  ]
    .map(normalizeTupletConfig)
    .filter(Boolean);

  if (explicitSampleTuplets.length) {
    return explicitSampleTuplets;
  }

  const notes = getSampleNotes(section.sampleJson);
  const inferred = getSampleTuplets(section.sampleJson)
    .map((tuplet) => normalizeTupletConfig({
      actual: tuplet.actual,
      normal: tuplet.normal,
      type: notes[Number(tuplet.start) || 0]?.duration || section.tupletType || 8,
    }))
    .filter(Boolean);

  return inferred.filter((tuplet, index) =>
    inferred.findIndex((candidate) =>
      candidate.actual === tuplet.actual &&
      candidate.normal === tuplet.normal &&
      candidate.type === tuplet.type
    ) === index
  );
}

export function normalizeSectionTuplets(value, section = {}) {
  if (value === undefined) {
    return inferSectionTuplets(section);
  }

  const values = Array.isArray(value) ? value : [value];
  const normalized = values.map(normalizeTupletConfig).filter(Boolean);

  return normalized.filter((tuplet, index) =>
    normalized.findIndex((candidate) =>
      candidate.actual === tuplet.actual &&
      candidate.normal === tuplet.normal &&
      candidate.type === tuplet.type
    ) === index
  );
}

function inferSectionOrnaments(section = {}) {
  const text = `${section.title || ""}\n${section.prompt || ""}\n${section.instructions || ""}`.toLowerCase();
  const sample = typeof section.sampleJson === "string"
    ? parseJsonLoose(section.sampleJson)
    : section.sampleJson;
  const sampleOrnaments = getSampleNotes(section.sampleJson)
    .map((note) => String(note.ornaments || ""))
    .join("");
  const noOrnaments = /no\s+ornaments?/.test(text) || /notes?\s+only/.test(text);
  const inferred = [];

  if (noOrnaments) {
    return inferred;
  }

  if (text.includes("sticking") || /[rl]/.test(sampleOrnaments)) inferred.push("stickings");
  if ((text.includes("accent") || sample?.accents === true || sampleOrnaments.includes("a")) && !/no\s+accents?/.test(text)) inferred.push("accents");
  if (text.includes("flam") || sampleOrnaments.includes("f")) {
    if (!/no\s+(?:accents?\s+or\s+)?flams?/.test(text) && !/without\s+flams?/.test(text)) {
      inferred.push("flams");
    }
  }
  if (text.includes("diddle") || sampleOrnaments.includes("d")) inferred.push("diddles");
  if (text.includes("cheese") || sampleOrnaments.includes("c")) inferred.push("cheese");

  return inferred;
}

export function normalizeSectionSubdivisions(value, section = {}) {
  if (Array.isArray(value)) {
    const normalized = normalizeOptionList(value, SUBDIVISION_OPTIONS, []);
    const tuplets = normalizeSectionTuplets(section.tuplets ?? section.tuplet, section);

    if (normalized.length || tuplets.length) {
      return normalized;
    }
  }

  return normalizeOptionList(
    value,
    SUBDIVISION_OPTIONS,
    inferSectionSubdivisions(section)
  );
}

export function normalizeSectionTuplet(value, section = {}) {
  return normalizeSectionTuplets(value, section)[0] || null;
}

export function normalizeSectionOrnaments(value, section = {}) {
  if (Array.isArray(value)) {
    return normalizeOptionList(value, ORNAMENT_OPTIONS, []);
  }

  return inferSectionOrnaments(section);
}

export function normalizePageGenerationSettings(value = {}, fallback = {}) {
  const pageSettings = value && typeof value === "object" ? value : {};
  const source = {
    ...fallback,
    ...pageSettings,
  };
  const maxSameHandStickingRun = normalizeSectionMaxSameHandStickingRun(
    source.maxSameHandStickingRun
  );
  const requiredSameHandStickingRuns = Object.prototype.hasOwnProperty.call(
    pageSettings,
    "requiredSameHandStickingRuns"
  )
    ? normalizeSectionRequiredSameHandStickingRuns(pageSettings.requiredSameHandStickingRuns)
    : normalizeSectionRequiredSameHandStickingRuns(fallback.requiredSameHandStickingRuns);

  return {
    prompt: source.prompt ?? source.instructions ?? "",
    sampleJson: normalizeSectionSampleJson(source.sampleJson),
    subdivisions: normalizeSectionSubdivisions(source.subdivisions, source),
    ornaments: normalizeSectionOrnaments(source.ornaments, source),
    tuplets: normalizeSectionTuplets(source.tuplets ?? source.tuplet, source),
    minPlayedNotes: normalizeSectionMinPlayedNotes(source.minPlayedNotes),
    maxPlayedNotes: normalizeSectionMaxPlayedNotes(source.maxPlayedNotes),
    playEveryNote: normalizeSectionPlayEveryNote(source.playEveryNote),
    maxSameHandStickingRun,
    requiredSameHandStickingRuns: requiredSameHandStickingRuns.filter(
      (runLength) => runLength <= maxSameHandStickingRun
    ),
  };
}

export function normalizePdfSettings(pdfSettings = {}) {
  return {
    measuresPerLine: normalizeBoundedNumber(
      pdfSettings.measuresPerLine,
      DEFAULT_PDF_SETTINGS.measuresPerLine,
      1,
      8,
      true
    ),
    lineSpacing: normalizeBoundedNumber(
      pdfSettings.lineSpacing,
      DEFAULT_PDF_SETTINGS.lineSpacing,
      90,
      240
    ),
    noteSize: normalizeBoundedNumber(
      pdfSettings.noteSize,
      DEFAULT_PDF_SETTINGS.noteSize,
      60,
      160
    ),
  };
}

export function getScoreRenderWidth(pdfSettings) {
  const { noteSize } = normalizePdfSettings(pdfSettings);
  const noteScale = noteSize / DEFAULT_PDF_SETTINGS.noteSize;

  return ((SCORE_RENDER_BASE_WIDTH + SCORE_RENDER_ROOT_PADDING) / noteScale) -
    SCORE_RENDER_ROOT_PADDING;
}

export function getSystemsPerPage(pdfSettings) {
  const normalizedSettings = normalizePdfSettings(pdfSettings);
  const contentWidth = PDF_PAGE_WIDTH - PDF_PAGE_MARGIN * 2;
  const contentHeight = PDF_PAGE_HEIGHT - PDF_PAGE_MARGIN * 2 - PDF_PAGE_FOOTER_HEIGHT;
  const renderedSvgWidth = getScoreRenderWidth(normalizedSettings) + SCORE_RENDER_ROOT_PADDING;
  const pdfScale = contentWidth / renderedSvgWidth;

  return Math.max(
    1,
    Math.floor(contentHeight / (normalizedSettings.lineSpacing * pdfScale))
  );
}

export function getLinesPerPage(pdfSettings) {
  const normalizedSettings = normalizePdfSettings(pdfSettings);
  return normalizedSettings.measuresPerLine * getSystemsPerPage(normalizedSettings);
}

export function getPagePdfSettings(page, bookPdfSettings = DEFAULT_PDF_SETTINGS) {
  return normalizePdfSettings({
    ...bookPdfSettings,
    ...(page?.pdfSettings || {}),
  });
}

export function getPageLinesPerPage(page, bookPdfSettings = DEFAULT_PDF_SETTINGS) {
  return getLinesPerPage(getPagePdfSettings(page, bookPdfSettings));
}

export function getPageGenerationSettings(page, section = {}) {
  return normalizePageGenerationSettings(page?.generationSettings, section);
}

export function createBlankLine(pageNumber, lineNumber) {
  return {
    pageNumber,
    lineNumber,
    title: "",
    notes: "",
    tempo: DEFAULT_TEMPO,
    score: null,
    exerciseShortForm: "",
    updatedAt: null,
  };
}

export function createBlankPage(
  pageNumber,
  pdfSettings = DEFAULT_PDF_SETTINGS,
  generationSettings = {}
) {
  const normalizedSettings = normalizePdfSettings(pdfSettings);
  const linesPerPage = getLinesPerPage(normalizedSettings);

  return {
    pageNumber,
    title: `Page ${pageNumber}`,
    pdfSettings: normalizedSettings,
    generationSettings: normalizePageGenerationSettings(generationSettings),
    lines: Array.from({ length: linesPerPage }, (_, index) =>
      createBlankLine(pageNumber, index + 1)
    ),
  };
}

function slugify(value) {
  return String(value || "section")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "section";
}

function normalizeSectionSampleJson(value) {
  if (value == null) {
    return "";
  }

  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

export function createBookSection(sectionNumber = 1, overrides = {}, pdfSettings = DEFAULT_PDF_SETTINGS) {
  const template = DEFAULT_BOOK_SECTIONS[sectionNumber - 1] || {};
  const title = overrides.title || template.title || `Section ${sectionNumber}`;
  const tuplets = Object.prototype.hasOwnProperty.call(overrides, "tuplets")
    ? overrides.tuplets
    : Object.prototype.hasOwnProperty.call(overrides, "tuplet")
      ? overrides.tuplet
      : template.tuplets ?? template.tuplet;
  const normalizedSettings = normalizePdfSettings({
    ...pdfSettings,
    ...(template.pdfSettings || {}),
    ...(overrides.pdfSettings || {}),
  });
  const maxSameHandStickingRun = normalizeSectionMaxSameHandStickingRun(
    overrides.maxSameHandStickingRun ?? template.maxSameHandStickingRun
  );
  const requiredSameHandStickingRuns = Object.prototype.hasOwnProperty.call(
    overrides,
    "requiredSameHandStickingRuns"
  )
    ? normalizeSectionRequiredSameHandStickingRuns(overrides.requiredSameHandStickingRuns)
    : Object.prototype.hasOwnProperty.call(template, "requiredSameHandStickingRuns")
      ? normalizeSectionRequiredSameHandStickingRuns(template.requiredSameHandStickingRuns)
      : normalizeSectionRequireMaxSameHandStickingRun(
          overrides.requireMaxSameHandStickingRun ?? template.requireMaxSameHandStickingRun
        )
        ? [maxSameHandStickingRun]
        : [];

  return {
    id: overrides.id || template.id || `${slugify(title)}-${sectionNumber}`,
    title,
    prompt: overrides.prompt ?? template.prompt ?? "",
    sampleJson: normalizeSectionSampleJson(overrides.sampleJson ?? template.sampleJson),
    subdivisions: normalizeSectionSubdivisions(
      overrides.subdivisions ?? template.subdivisions,
      { ...template, ...overrides }
    ),
    ornaments: normalizeSectionOrnaments(
      overrides.ornaments ?? template.ornaments,
      { ...template, ...overrides }
    ),
    tuplets: normalizeSectionTuplets(tuplets, { ...template, ...overrides }),
    pageCount: normalizeSectionPageCount(
      overrides.pageCount ?? template.pageCount,
      overrides.pages?.length || template.pages?.length || 1
    ),
    minPlayedNotes: normalizeSectionMinPlayedNotes(
      overrides.minPlayedNotes ?? template.minPlayedNotes
    ),
    maxPlayedNotes: normalizeSectionMaxPlayedNotes(
      overrides.maxPlayedNotes ?? template.maxPlayedNotes
    ),
    playEveryNote: normalizeSectionPlayEveryNote(
      overrides.playEveryNote ?? template.playEveryNote
    ),
    maxSameHandStickingRun,
    requiredSameHandStickingRuns,
    pdfSettings: normalizedSettings,
    pages: overrides.pages || [createBlankPage(
      1,
      normalizedSettings,
      { ...template, ...overrides }
    )],
  };
}

export function createDefaultBook() {
  return normalizeBook({
    book: BOOK_KEY,
    slug: BOOK_SLUG,
    title: BOOK_TITLE,
    edition: BOOK_EDITION,
    contentVersion: BOOK_CONTENT_VERSION,
    updatedAt: null,
    globalAiRules: DEFAULT_GLOBAL_AI_RULES,
    globalOrnamentDensity: DEFAULT_GLOBAL_ORNAMENT_DENSITY,
    pdfSettings: normalizePdfSettings(),
    sections: DEFAULT_BOOK_SECTIONS.map((section, index) =>
      createBookSection(index + 1, section, normalizePdfSettings())
    ),
  });
}

export function createBookTableOfContents(sections = []) {
  return (sections || []).map((section) => {
    const pageNumbers = (section.pages || [])
      .map((page) => Number.parseInt(page.pageNumber, 10))
      .filter((pageNumber) => Number.isInteger(pageNumber) && pageNumber > 0);

    return {
      sectionId: section.id,
      title: section.title || "Untitled section",
      pageStart: pageNumbers.length ? Math.min(...pageNumbers) : null,
      pageEnd: pageNumbers.length ? Math.max(...pageNumbers) : null,
    };
  });
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createBlankLineScore() {
  const timeSig = { num: 4, type: 4 };

  return {
    parts: {
      snare: {
        enabled: true,
      },
    },
    measures: Array.from({ length: MEASURES_PER_SCORE }, () =>
      _.cloneDeep(getEmptyMeasure(timeSig, ["snare"]))
    ),
  };
}

export function createContinuousPageScore(pageLines = []) {
  const scores = pageLines
    .map((line) => line?.score)
    .filter((score) => Array.isArray(score?.measures) && score.measures.length > 0);

  if (!scores.length) {
    return createBlankLineScore();
  }

  return {
    ...cloneJson(scores[0]),
    measures: scores.flatMap((score) => cloneJson(score.measures)),
  };
}

function isUndottedSixteenth(note) {
  return Number(note?.duration) === 16 && Number(note?.dots || 0) === 0;
}

function combineTupletSixteenthNoteRests(notes) {
  const combined = [];

  for (let index = 0; index < notes.length; index += 1) {
    const note = notes[index];
    const nextNote = notes[index + 1];
    const isPlayedNote = Array.isArray(note?.notes) && note.notes.length > 0;
    const isFollowingRest = Array.isArray(nextNote?.notes) && nextNote.notes.length === 0;

    if (
      isPlayedNote &&
      isFollowingRest &&
      isUndottedSixteenth(note) &&
      isUndottedSixteenth(nextNote)
    ) {
      combined.push({
        ...note,
        duration: 8,
        dots: 0,
      });
      index += 1;
      continue;
    }

    combined.push({ ...note });
  }

  return combined;
}

const ORDINARY_REST_VALUES = [
  { duration: 1, dots: 0, quarterUnits: 4 },
  { duration: 2, dots: 1, quarterUnits: 3 },
  { duration: 2, dots: 0, quarterUnits: 2 },
  { duration: 4, dots: 1, quarterUnits: 1.5 },
  { duration: 4, dots: 0, quarterUnits: 1 },
  { duration: 8, dots: 1, quarterUnits: 0.75 },
  { duration: 8, dots: 0, quarterUnits: 0.5 },
  { duration: 16, dots: 1, quarterUnits: 0.375 },
  { duration: 16, dots: 0, quarterUnits: 0.25 },
  { duration: 32, dots: 1, quarterUnits: 0.1875 },
  { duration: 32, dots: 0, quarterUnits: 0.125 },
];

function isRestNote(note) {
  return !Array.isArray(note?.notes) || note.notes.length === 0;
}

function getNoteQuarterUnits(note) {
  const duration = Number(note?.duration || 4);
  const dotMultiplier = Number(note?.dots || 0) > 0 ? 1.5 : 1;
  return (4 / duration) * dotMultiplier;
}

function createOrdinaryRests(quarterUnits, sourceNote) {
  const rests = [];
  let remainingUnits = quarterUnits;

  while (remainingUnits > 0.0001) {
    const value = ORDINARY_REST_VALUES.find(
      (candidate) => candidate.quarterUnits <= remainingUnits + 0.0001
    ) || ORDINARY_REST_VALUES[ORDINARY_REST_VALUES.length - 1];

    rests.push({
      notes: [],
      duration: value.duration,
      dots: value.dots,
      velocity: Number(sourceNote?.velocity || 0.5),
    });
    remainingUnits -= value.quarterUnits;
  }

  return rests;
}

function normalizeTupletVoiceNoteValues(voice) {
  const notes = Array.isArray(voice?.notes) ? voice.notes : [];
  const tuplets = Array.isArray(voice?.tuplets)
    ? voice.tuplets
        .map((tuplet) => ({
          ...tuplet,
          start: Number(tuplet?.start),
          end: Number(tuplet?.end),
        }))
        .filter((tuplet) =>
          Number.isInteger(tuplet.start) &&
          Number.isInteger(tuplet.end) &&
          tuplet.start >= 0 &&
          tuplet.end > tuplet.start &&
          tuplet.end <= notes.length
        )
        .sort((left, right) => left.start - right.start)
    : [];

  if (!tuplets.length) {
    return {
      ...voice,
      notes: notes.map((note) => ({ ...note })),
      tuplets: Array.isArray(voice?.tuplets) ? cloneJson(voice.tuplets) : [],
    };
  }

  const nextNotes = [];
  const nextTuplets = [];
  let cursor = 0;

  tuplets.forEach((tuplet) => {
    if (tuplet.start < cursor) {
      return;
    }

    nextNotes.push(...notes.slice(cursor, tuplet.start).map((note) => ({ ...note })));
    const tupletNotes = notes.slice(tuplet.start, tuplet.end);

    if (tupletNotes.length && tupletNotes.every(isRestNote)) {
      const tupletRatio = Number(tuplet.normal) / Number(tuplet.actual);
      const ordinaryRestUnits = tupletNotes.reduce(
        (total, note) => total + getNoteQuarterUnits(note),
        0
      ) * tupletRatio;

      nextNotes.push(...createOrdinaryRests(ordinaryRestUnits, tupletNotes[0]));
      cursor = tuplet.end;
      return;
    }

    const tupletStart = nextNotes.length;
    nextNotes.push(
      ...combineTupletSixteenthNoteRests(tupletNotes)
    );
    nextTuplets.push({
      ...tuplet,
      start: tupletStart,
      end: nextNotes.length,
    });
    cursor = tuplet.end;
  });

  nextNotes.push(...notes.slice(cursor).map((note) => ({ ...note })));

  return {
    ...voice,
    notes: nextNotes,
    tuplets: nextTuplets,
  };
}

export function normalizeTupletNoteValues(score) {
  if (!score || !Array.isArray(score.measures)) {
    return score;
  }

  return {
    ...score,
    measures: score.measures.map((measure) => ({
      ...measure,
      parts: (measure.parts || []).map((part) => ({
        ...part,
        voices: (part.voices || []).map(normalizeTupletVoiceNoteValues),
      })),
    })),
  };
}

export function scoreToBookLine(score) {
  return score && Array.isArray(score.measures)
    ? normalizeTupletNoteValues(cloneJson(score))
    : createBlankLineScore();
}

export function normalizeBook(rawBook) {
  if (!rawBook || !Array.isArray(rawBook.pages)) {
    if (!rawBook || !Array.isArray(rawBook.sections)) {
      return createDefaultBook();
    }
  }

  const pdfSettings = normalizePdfSettings(rawBook.pdfSettings);
  const sections = normalizeBookSections(rawBook, pdfSettings);
  const pages = sections.flatMap((section) => section.pages);

  return {
    book: rawBook.book || BOOK_KEY,
    slug: rawBook.slug || BOOK_SLUG,
    title: rawBook.title || BOOK_TITLE,
    edition: Number(rawBook.edition || BOOK_EDITION),
    contentVersion: Number(rawBook.contentVersion || BOOK_CONTENT_VERSION),
    updatedAt: rawBook.updatedAt || null,
    globalAiRules: normalizeGlobalAiRules(rawBook.globalAiRules),
    globalOrnamentDensity: normalizeGlobalOrnamentDensity(
      rawBook.globalOrnamentDensity
    ),
    pdfSettings,
    sections,
    tableOfContents: createBookTableOfContents(sections),
    pages,
  };
}

function normalizeBookSections(rawBook, pdfSettings) {
  const rawSections = Array.isArray(rawBook.sections) && rawBook.sections.length
    ? rawBook.sections
    : [{
        id: "imported-pages",
        title: "Imported Pages",
        prompt: "",
        sampleJson: "",
        pdfSettings,
        pages: Array.isArray(rawBook.pages) && rawBook.pages.length
          ? rawBook.pages
          : [createBlankPage(1, pdfSettings)],
      }];
  const seenIds = new Set();
  let globalPageNumber = 1;

  return rawSections.map((rawSection, sectionIndex) => {
    const section = createBookSection(sectionIndex + 1, rawSection, pdfSettings);
    let id = section.id || `${slugify(section.title)}-${sectionIndex + 1}`;
    let suffix = 2;

    while (seenIds.has(id)) {
      id = `${section.id}-${suffix}`;
      suffix += 1;
    }

    seenIds.add(id);

    const sectionPdfSettings = normalizePdfSettings({
      ...pdfSettings,
      ...(section.pdfSettings || {}),
    });
    const sectionPages = Array.isArray(section.pages) && section.pages.length
      ? section.pages
      : [createBlankPage(1, sectionPdfSettings)];
    const normalizedPages = renumberPages(sectionPages, sectionPdfSettings);

    return {
      ...section,
      id,
      title: section.title || `Section ${sectionIndex + 1}`,
      prompt: section.prompt || "",
      sampleJson: normalizeSectionSampleJson(section.sampleJson),
      subdivisions: normalizeSectionSubdivisions(section.subdivisions, section),
      ornaments: normalizeSectionOrnaments(section.ornaments, section),
      tuplets: normalizeSectionTuplets(section.tuplets ?? section.tuplet, section),
      pageCount: normalizeSectionPageCount(section.pageCount, normalizedPages.length),
      minPlayedNotes: normalizeSectionMinPlayedNotes(section.minPlayedNotes),
      maxPlayedNotes: normalizeSectionMaxPlayedNotes(section.maxPlayedNotes),
      playEveryNote: normalizeSectionPlayEveryNote(section.playEveryNote),
      maxSameHandStickingRun: normalizeSectionMaxSameHandStickingRun(section.maxSameHandStickingRun),
      requiredSameHandStickingRuns: Object.prototype.hasOwnProperty.call(
        section,
        "requiredSameHandStickingRuns"
      )
        ? normalizeSectionRequiredSameHandStickingRuns(section.requiredSameHandStickingRuns)
        : normalizeSectionRequireMaxSameHandStickingRun(section.requireMaxSameHandStickingRun)
          ? [normalizeSectionMaxSameHandStickingRun(section.maxSameHandStickingRun)]
          : [],
      pdfSettings: sectionPdfSettings,
      pages: normalizedPages.map((page, sectionPageIndex) => {
        const pageNumber = globalPageNumber;
        globalPageNumber += 1;

        return {
          ...page,
          pageNumber,
          sectionId: id,
          sectionTitle: section.title,
          sectionPageNumber: sectionPageIndex + 1,
          title: page.title || `${section.title} ${sectionPageIndex + 1}`,
          generationSettings: getPageGenerationSettings(page, section),
          lines: page.lines.map((line, lineIndex) => ({
            ...line,
            pageNumber,
            lineNumber: lineIndex + 1,
            sectionId: id,
            sectionPageNumber: sectionPageIndex + 1,
            tempo: Number(line.tempo || DEFAULT_TEMPO),
            score: line.score ? normalizeTupletNoteValues(cloneJson(line.score)) : null,
            exerciseShortForm: line.exerciseShortForm || "",
          })),
        };
      }),
    };
  });
}

export function renumberPages(pages, pdfSettings = DEFAULT_PDF_SETTINGS) {
  const normalizedBookSettings = normalizePdfSettings(pdfSettings);
  const sourcePages = Array.isArray(pages) && pages.length
    ? pages
    : [createBlankPage(1, normalizedBookSettings)];

  return sourcePages.map((sourcePage, pageIndex) => {
    const pageNumber = pageIndex + 1;
    const pagePdfSettings = getPagePdfSettings(sourcePage, normalizedBookSettings);
    const linesPerPage = getLinesPerPage(pagePdfSettings);
    const pageLines = (sourcePage.lines || []).slice(0, linesPerPage);

    while (pageLines.length < linesPerPage) {
      pageLines.push(createBlankLine(pageNumber, pageLines.length + 1));
    }

    return {
      ...sourcePage,
      pageNumber,
      title: sourcePage.title || `Page ${pageNumber}`,
      pdfSettings: pagePdfSettings,
      lines: pageLines.map((line, lineIndex) => ({
        ...createBlankLine(pageNumber, lineIndex + 1),
        ...line,
        pageNumber,
        lineNumber: lineIndex + 1,
        tempo: Number(line.tempo || DEFAULT_TEMPO),
        score: line.score ? normalizeTupletNoteValues(cloneJson(line.score)) : null,
        exerciseShortForm: line.exerciseShortForm || "",
      })),
    };
  });
}
