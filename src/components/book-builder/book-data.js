import _ from "lodash";
import { getEmptyMeasure } from "../../helpers/score";
import { DEFAULT_TEMPO } from "../../consts/score";

export const BOOK_KEY = "true-chops";
export const BOOK_SLUG = "snare-drum-book";
export const BOOK_TITLE = "Snare Drum Book";
export const BOOK_EDITION = 1;
export const BOOK_CONTENT_VERSION = 3;
export const DEFAULT_GLOBAL_AI_RULES = "";
export const DEFAULT_MAX_SAME_HAND_STICKING_RUN = 4;
export const SUBDIVISION_OPTIONS = [
  { id: "eighths", label: "Eighths", duration: 8 },
  { id: "sixteenths", label: "Sixteenths", duration: 16 },
  { id: "thirtyseconds", label: "Thirtyseconds", duration: 32 },
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
export const MEASURES_PER_LINE = 1;
export const PDF_COLUMNS = 2;
export const PDF_ROWS = 12;
export const PDF_COLUMN_OPTIONS = [2, 3];
export const LINES_PER_PAGE = PDF_COLUMNS * PDF_ROWS;

export const DEFAULT_PDF_SETTINGS = {
  columns: PDF_COLUMNS,
  rows: PDF_ROWS,
  noteRenderWidth: 420,
  noteStartPadding: 25,
  noteEndPadding: 25,
};

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

export function normalizeGlobalAiRules(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join("\n");
  }

  return typeof value === "string" ? value : DEFAULT_GLOBAL_AI_RULES;
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
  return normalizeOptionList(
    value,
    SUBDIVISION_OPTIONS,
    inferSectionSubdivisions(section)
  );
}

export function normalizeSectionOrnaments(value, section = {}) {
  if (Array.isArray(value)) {
    return normalizeOptionList(value, ORNAMENT_OPTIONS, []);
  }

  return inferSectionOrnaments(section);
}

export function normalizePdfSettings(pdfSettings = {}) {
  const columns = PDF_COLUMN_OPTIONS.includes(Number(pdfSettings.columns))
    ? Number(pdfSettings.columns)
    : DEFAULT_PDF_SETTINGS.columns;

  return {
    ...DEFAULT_PDF_SETTINGS,
    ...pdfSettings,
    columns,
    rows: PDF_ROWS,
  };
}

export function getLinesPerPage(pdfSettings) {
  const normalizedSettings = normalizePdfSettings(pdfSettings);
  return normalizedSettings.columns * normalizedSettings.rows;
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

export function createBlankPage(pageNumber, pdfSettings = DEFAULT_PDF_SETTINGS) {
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
  const normalizedSettings = normalizePdfSettings({
    ...pdfSettings,
    ...(template.pdfSettings || {}),
    ...(overrides.pdfSettings || {}),
  });

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
    pageCount: normalizeSectionPageCount(
      overrides.pageCount ?? template.pageCount,
      overrides.pages?.length || template.pages?.length || 1
    ),
    minPlayedNotes: normalizeSectionMinPlayedNotes(
      overrides.minPlayedNotes ?? template.minPlayedNotes
    ),
    maxSameHandStickingRun: normalizeSectionMaxSameHandStickingRun(
      overrides.maxSameHandStickingRun ?? template.maxSameHandStickingRun
    ),
    pdfSettings: normalizedSettings,
    pages: overrides.pages || [createBlankPage(1, normalizedSettings)],
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
    pdfSettings: normalizePdfSettings(),
    sections: DEFAULT_BOOK_SECTIONS.map((section, index) =>
      createBookSection(index + 1, section, normalizePdfSettings())
    ),
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
    measures: Array.from({ length: MEASURES_PER_LINE }, () =>
      _.cloneDeep(getEmptyMeasure(timeSig, ["snare"]))
    ),
  };
}

export function scoreToBookLine(score) {
  return score && Array.isArray(score.measures)
    ? cloneJson(score)
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
    pdfSettings,
    sections,
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
      pageCount: normalizeSectionPageCount(section.pageCount, normalizedPages.length),
      minPlayedNotes: normalizeSectionMinPlayedNotes(section.minPlayedNotes),
      maxSameHandStickingRun: normalizeSectionMaxSameHandStickingRun(section.maxSameHandStickingRun),
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
          lines: page.lines.map((line, lineIndex) => ({
            ...line,
            pageNumber,
            lineNumber: lineIndex + 1,
            sectionId: id,
            sectionPageNumber: sectionPageIndex + 1,
            tempo: Number(line.tempo || DEFAULT_TEMPO),
            score: line.score ? cloneJson(line.score) : null,
            exerciseShortForm: line.exerciseShortForm || "",
          })),
        };
      }),
    };
  });
}

function isBlankLine(line) {
  return !line || (!line.score && !line.title && !line.notes);
}

export function renumberPages(pages, pdfSettings = DEFAULT_PDF_SETTINGS) {
  const normalizedBookSettings = normalizePdfSettings(pdfSettings);
  const flatLines = pages.flatMap((page) => page.lines || []);
  const pageSettings = pages.map((page) =>
    getPagePdfSettings(page, normalizedBookSettings)
  );
  const minimumLinesPerPage = getLinesPerPage(normalizedBookSettings);

  while (flatLines.length > minimumLinesPerPage && isBlankLine(flatLines[flatLines.length - 1])) {
    flatLines.pop();
  }

  const nextPages = [];
  let nextLineIndex = 0;

  while (nextLineIndex < flatLines.length || nextPages.length === 0) {
    const pageIndex = nextPages.length;
    const pageNumber = pageIndex + 1;
    const pagePdfSettings = pageSettings[pageIndex] || normalizedBookSettings;
    const linesPerPage = getLinesPerPage(pagePdfSettings);
    const pageLines = flatLines.slice(nextLineIndex, nextLineIndex + linesPerPage);

    while (pageLines.length < linesPerPage) {
      pageLines.push(createBlankLine(pageNumber, pageLines.length + 1));
    }

    nextPages.push({
      pageNumber,
      title: `Page ${pageNumber}`,
      pdfSettings: pagePdfSettings,
      lines: pageLines.slice(0, linesPerPage).map((line, lineIndex) => ({
        ...createBlankLine(pageNumber, lineIndex + 1),
        ...line,
        pageNumber,
        lineNumber: lineIndex + 1,
        tempo: Number(line.tempo || DEFAULT_TEMPO),
        score: line.score ? cloneJson(line.score) : null,
        exerciseShortForm: line.exerciseShortForm || "",
      })),
    });

    nextLineIndex += linesPerPage;
  }

  return nextPages;
}
