import _ from "lodash";
import { getEmptyMeasure } from "../../helpers/score";
import { DEFAULT_TEMPO } from "../../consts/score";

export const BOOK_SLUG = "snare-drum-book";
export const BOOK_TITLE = "Snare Drum Booc";
export const LINES_PER_PAGE = 24;
export const MEASURES_PER_LINE = 1;
export const PDF_COLUMNS = 2;
export const PDF_ROWS = 12;

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

export function scoreToBookLine(score) {
  return score && Array.isArray(score.measures)
    ? cloneJson(score)
    : createBlankLineScore();
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
            score: line.score ? cloneJson(line.score) : null,
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
