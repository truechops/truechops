import _ from "lodash";
import {
  getEmptyMeasure,
  getRestsFromTCDuration,
  getTCDurationSingle,
} from "../../helpers/score";
import { DEFAULT_TEMPO } from "../../consts/score";

export const BOOK_SLUG = "snare-drum-book";
export const BOOK_TITLE = "Snare Drum Book";
export const LINES_PER_PAGE = 12;
export const MEASURES_PER_LINE = 2;

export function createBlankLine(pageNumber, lineNumber) {
  return {
    pageNumber,
    lineNumber,
    title: "",
    notes: "",
    tempo: DEFAULT_TEMPO,
    score: null,
    updatedAt: null,
  };
}

export function createBlankPage(pageNumber) {
  return {
    pageNumber,
    title: `Page ${pageNumber}`,
    lines: Array.from({ length: LINES_PER_PAGE }, (_, index) =>
      createBlankLine(pageNumber, index + 1)
    ),
  };
}

export function createDefaultBook() {
  return {
    slug: BOOK_SLUG,
    title: BOOK_TITLE,
    updatedAt: null,
    pages: [createBlankPage(1)],
  };
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

function normalizeLineScore(score) {
  const fallbackScore = createBlankLineScore();

  if (!score || !Array.isArray(score.measures)) {
    return fallbackScore;
  }

  const normalizedScore = {
    parts: score.parts || {
      snare: {
        enabled: true,
      },
    },
    measures: cloneJson(score.measures.slice(0, MEASURES_PER_LINE)),
  };

  while (normalizedScore.measures.length < MEASURES_PER_LINE) {
    normalizedScore.measures.push(_.cloneDeep(fallbackScore.measures[normalizedScore.measures.length]));
  }

  normalizedScore.measures = normalizedScore.measures.map((measure, measureIndex) =>
    normalizeMeasureToFourFour(measure, fallbackScore.measures[measureIndex])
  );

  return normalizedScore;
}

function normalizeVoiceToFourFour(voice) {
  const targetDuration = 32;
  let totalDuration = 0;
  const notes = [];

  for (const note of voice.notes || []) {
    const noteDuration = getTCDurationSingle(note.duration, note.dots);

    if (totalDuration + noteDuration > targetDuration) {
      break;
    }

    notes.push(note);
    totalDuration += noteDuration;
  }

  if (totalDuration < targetDuration) {
    notes.push(...getRestsFromTCDuration(targetDuration - totalDuration));
  }

  return {
    ...voice,
    notes,
    tuplets: (voice.tuplets || []).filter((tuplet) => tuplet.end <= notes.length),
  };
}

function normalizeMeasureToFourFour(measure, fallbackMeasure) {
  const sourceMeasure =
    measure && Array.isArray(measure.parts) && measure.parts.length
      ? measure
      : fallbackMeasure;

  return {
    ...sourceMeasure,
    timeSig: {
      num: 4,
      type: 4,
    },
    parts: sourceMeasure.parts.map((part) => ({
      ...part,
      voices: (part.voices || []).map(normalizeVoiceToFourFour),
    })),
  };
}

export function scoreToBookLine(score) {
  return normalizeLineScore(score);
}

export function normalizeBook(rawBook) {
  if (!rawBook || !Array.isArray(rawBook.pages)) {
    return createDefaultBook();
  }

  const pages = rawBook.pages.length ? rawBook.pages : [createBlankPage(1)];

  return {
    slug: rawBook.slug || BOOK_SLUG,
    title: rawBook.title || BOOK_TITLE,
    updatedAt: rawBook.updatedAt || null,
    pages: pages.map((page, pageIndex) => {
      const pageNumber = pageIndex + 1;
      const lines = Array.isArray(page.lines) ? page.lines : [];

      return {
        pageNumber,
        title: page.title || `Page ${pageNumber}`,
        lines: Array.from({ length: LINES_PER_PAGE }, (_, lineIndex) => {
          const lineNumber = lineIndex + 1;
          const line = lines[lineIndex] || {};

          return {
            ...createBlankLine(pageNumber, lineNumber),
            ...line,
            pageNumber,
            lineNumber,
            tempo: Number(line.tempo || DEFAULT_TEMPO),
            score: line.score ? normalizeLineScore(line.score) : null,
          };
        }),
      };
    }),
  };
}

export function renumberPages(pages) {
  const flatLines = pages.flatMap((page) => page.lines || []);
  const nextPages = [];
  const pageCount = Math.max(1, Math.ceil(flatLines.length / LINES_PER_PAGE));

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    const pageNumber = pageIndex + 1;
    const pageLines = flatLines.slice(
      pageIndex * LINES_PER_PAGE,
      (pageIndex + 1) * LINES_PER_PAGE
    );

    while (pageLines.length < LINES_PER_PAGE) {
      pageLines.push(createBlankLine(pageNumber, pageLines.length + 1));
    }

    nextPages.push({
      pageNumber,
      title: `Page ${pageNumber}`,
      lines: pageLines.slice(0, LINES_PER_PAGE).map((line, lineIndex) => ({
        ...line,
        pageNumber,
        lineNumber: lineIndex + 1,
      })),
    });
  }

  return nextPages;
}
