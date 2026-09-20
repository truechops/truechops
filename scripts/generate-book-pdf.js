#!/usr/bin/env node

const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const PDFDocument = require("pdfkit");
const SVGtoPDF = require("svg-to-pdfkit");
const QRCode = require("qrcode");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DEFAULT_OUTPUT_PATH = path.join(
  PROJECT_ROOT,
  "book-output",
  "snare-drum-book.pdf"
);
const DEFAULT_QR_ORIGIN = "https://truechops.com";
const PDF_PAGE_WIDTH = 612;
const PDF_PAGE_HEIGHT = 792;
const PDF_MARGIN = 24;
const PDF_FOOTER_HEIGHT = 38;
const MIN_CONTINUATION_SYSTEMS = 3;

let domSetup = false;
let renderCounter = 0;

function parseArgs(argv) {
  const options = {
    scope: "book",
    page: 1,
    output: DEFAULT_OUTPUT_PATH,
    qrOrigin: DEFAULT_QR_ORIGIN,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const [flag, inlineValue] = arg.split("=");
    const nextValue = inlineValue ?? argv[index + 1];

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    if (!flag.startsWith("--")) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    if (inlineValue == null) {
      index += 1;
    }

    switch (flag.slice(2)) {
      case "scope":
        options.scope = nextValue;
        break;
      case "page":
        options.page = Number.parseInt(nextValue, 10);
        break;
      case "output":
        options.output = path.resolve(process.cwd(), nextValue);
        break;
      case "qr-origin":
        options.qrOrigin = nextValue;
        break;
      default:
        throw new Error(`Unknown option: ${flag}`);
    }
  }

  if (!["book", "page"].includes(options.scope)) {
    throw new Error('--scope must be either "book" or "page".');
  }

  if (!Number.isInteger(options.page) || options.page < 1) {
    throw new Error("--page must be a positive page number.");
  }

  return options;
}

function printHelp() {
  console.log(`
Generate the TrueChops book PDF from data/book-builder/snare-drum-book.

Usage:
  npm run pdf:book
  npm run pdf:book:page -- --page 6
  node scripts/generate-book-pdf.js --output book-output/snare-drum-book.pdf

Options:
  --scope <book|page>  Render the full book or one page. Default: book.
  --page <number>      Page number when --scope page is used. Default: 1.
  --output <path>      PDF destination.
  --qr-origin <origin> Production QR origin. Default: https://truechops.com.
`);
}

function installProjectTranspiler() {
  const babel = require("@babel/core");
  const originalLoader = require.extensions[".js"];

  require.extensions[".js"] = function loadProjectJs(module, filename) {
    const inProject = filename.startsWith(PROJECT_ROOT);
    const inNodeModules = filename.includes(`${path.sep}node_modules${path.sep}`);

    if (!inProject || inNodeModules) {
      return originalLoader(module, filename);
    }

    const source = fsSync.readFileSync(filename, "utf8");
    const result = babel.transformSync(source, {
      filename,
      babelrc: false,
      configFile: false,
      sourceType: "unambiguous",
      presets: [
        [
          require.resolve("@babel/preset-env"),
          {
            modules: "commonjs",
            targets: { node: "current" },
          },
        ],
      ],
    });

    return module._compile(result.code, filename);
  };
}

function setupDom() {
  if (domSetup) return;
  domSetup = true;

  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    pretendToBeVisual: true,
  });

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;

  try {
    Object.defineProperty(globalThis, "navigator", {
      value: dom.window.navigator,
      writable: true,
      configurable: true,
    });
  } catch {
    // Older Node versions expose navigator as a normal writable property.
    globalThis.navigator = dom.window.navigator;
  }

  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.SVGElement = dom.window.SVGElement;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);

  if (!dom.window.SVGElement.prototype.getBBox) {
    dom.window.SVGElement.prototype.getBBox = function getBBox() {
      const text = this.textContent || "";
      const rawFontSize = this.getAttribute("font-size") || "10";
      const fontSize = Number.parseFloat(rawFontSize) || 10;
      return {
        x: 0,
        y: -fontSize,
        width: text.length * fontSize * 0.58,
        height: fontSize,
      };
    };
  }

  if (!dom.window.Element.prototype.createSVGPoint) {
    dom.window.Element.prototype.createSVGPoint = function createSVGPoint() {
      return {
        x: 0,
        y: 0,
        matrixTransform() {
          return { x: this.x, y: this.y };
        },
      };
    };
  }

  if (!dom.window.Element.prototype.getScreenCTM) {
    dom.window.Element.prototype.getScreenCTM = function getScreenCTM() {
      return {
        inverse() {
          return this;
        },
      };
    };
  }
}

function getPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getScoreRenderConcurrency() {
  return getPositiveInteger(process.env.BOOK_PDF_RENDER_CONCURRENCY, 16);
}

function createAsyncLimiter(limit) {
  let activeCount = 0;
  const queue = [];

  function runNext() {
    if (activeCount >= limit || queue.length === 0) {
      return;
    }

    const next = queue.shift();
    activeCount += 1;

    Promise.resolve()
      .then(next.task)
      .then(next.resolve, next.reject)
      .finally(() => {
        activeCount -= 1;
        runNext();
      });
  }

  return function limitTask(task) {
    return new Promise((resolve, reject) => {
      queue.push({ task, resolve, reject });
      runNext();
    });
  };
}

function pageDir(bookRoot, pageNumber) {
  return path.join(bookRoot, "pages", `page-${String(pageNumber).padStart(2, "0")}`);
}

function linePath(bookRoot, pageNumber, lineNumber) {
  return path.join(pageDir(bookRoot, pageNumber), `line-${String(lineNumber).padStart(2, "0")}.json`);
}

async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function getNoteQuarterUnits(note) {
  const duration = Number(note.duration || 4);
  const dotMultiplier = note.dots ? 1.5 : 1;
  return (4 / duration) * dotMultiplier;
}

function isRest(note) {
  return !Array.isArray(note && note.notes) || note.notes.length === 0;
}

function countPlayedNotes(notes) {
  return (notes || []).filter((note) => !isRest(note)).length;
}

function getSectionMinPlayedNotes(section) {
  const parsed = Number.parseInt(section && section.minPlayedNotes, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function getSectionInstructionText(section) {
  return [
    section.title || "",
    section.instructions || section.prompt || "",
  ].join("\n").toLowerCase();
}

function getShortestAllowedDuration(section, notes) {
  const prompt = getSectionInstructionText(section);
  const durations = (notes || [])
    .map((note) => Number(note && note.duration))
    .filter((duration) => [1, 2, 4, 8, 16, 32].includes(duration));

  if (prompt.includes("sixteenth") || durations.includes(16)) {
    return 16;
  }

  if (prompt.includes("eighth") || durations.includes(8)) {
    return 8;
  }

  return durations.length ? Math.max(...durations) : 4;
}

function shuffleArray(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function requiresStickings(section) {
  return /sticking/.test(getSectionInstructionText(section));
}

function applyStickingsToNotes(notes) {
  let playedIndex = 0;
  return notes.map((note) => {
    if (isRest(note)) return note;
    const sticking = playedIndex % 2 === 0 ? "R" : "L";
    playedIndex += 1;
    const baseOrnaments = String(note.ornaments || "").replace(/[RL]/g, "");
    return { ...note, ornaments: sticking + baseOrnaments };
  });
}

function createPlayedNoteFrom(note) {
  return {
    ...note,
    notes: ["C5"],
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

  return Array.from({ length: pieces }, () => ({
    notes: ["C5"],
    duration: targetDuration,
    dots: 0,
    velocity: Number((note && note.velocity) || 0.5),
  }));
}

function enforceMinimumPlayedNotesInNotes(section, notes, { preserveNoteCount = false } = {}) {
  const minimum = getSectionMinPlayedNotes(section);

  if (!minimum || countPlayedNotes(notes) >= minimum) {
    return notes;
  }

  let nextNotes = (notes || []).map((note) => ({ ...note }));
  let playedCount = countPlayedNotes(nextNotes);
  const needed = minimum - playedCount;

  // Randomly choose which rests to convert so hits are distributed throughout
  const restIndices = nextNotes.reduce((acc, note, i) => {
    if (isRest(note)) acc.push(i);
    return acc;
  }, []);
  const convertSet = new Set(shuffleArray(restIndices).slice(0, needed));

  nextNotes = nextNotes.map((note, i) => {
    if (!isRest(note) || !convertSet.has(i)) return note;
    playedCount += 1;
    return createPlayedNoteFrom(note);
  });

  if (playedCount >= minimum) {
    return nextNotes;
  }

  if (preserveNoteCount) {
    return nextNotes;
  }

  // Still short — split notes into shorter durations to get more hits
  const targetDuration = getShortestAllowedDuration(section, nextNotes);
  const expandedNotes = [];

  for (const note of nextNotes) {
    if (playedCount < minimum) {
      const pieces = splitIntoPlayedNotes(note, targetDuration);

      if (pieces) {
        playedCount += pieces.length - (isRest(note) ? 0 : 1);
        expandedNotes.push(...pieces);
        continue;
      }
    }

    expandedNotes.push(note);
  }

  return expandedNotes;
}

function enforceMinimumPlayedNotes(section, score) {
  const minimum = getSectionMinPlayedNotes(section);

  if (!minimum) {
    return score;
  }

  const needsStickings = requiresStickings(section);

  return {
    ...score,
    measures: (score.measures || []).map((measure) => ({
      ...measure,
      parts: (measure.parts || []).map((part) => ({
        ...part,
        voices: (part.voices || []).map((voice) => {
          const enforced = enforceMinimumPlayedNotesInNotes(
            section,
            voice.notes || [],
            { preserveNoteCount: Array.isArray(voice.tuplets) && voice.tuplets.length > 0 }
          );
          return {
            ...voice,
            notes: needsStickings ? applyStickingsToNotes(enforced) : enforced,
          };
        }),
      })),
    })),
  };
}

function enforceBookMinPlayedNotes(book) {
  const sectionsById = Object.fromEntries(
    (book.sections || []).map((section) => [section.id, section])
  );

  for (const page of book.pages || []) {
    const section = sectionsById[page.sectionId];

    if (!section || !getSectionMinPlayedNotes(section)) {
      continue;
    }

    for (const line of page.lines || []) {
      if (!line.score) continue;
      line.score = enforceMinimumPlayedNotes(section, line.score);
    }
  }
}

async function loadBook(bookData, bookRoot) {
  const {
    createDefaultBook,
    normalizeBook,
  } = bookData;
  const manifestPath = path.join(bookRoot, "book.json");
  const manifest = (await readJson(manifestPath)) || createDefaultBook();
  const hydratePage = async (page, pageIndex) => ({
    ...page,
    pageNumber: page.pageNumber || pageIndex + 1,
    lines: await Promise.all(
      (page.lines || []).map(async (line, lineIndex) => {
        const pageNumber = page.pageNumber || pageIndex + 1;
        const lineNumber = line.lineNumber || lineIndex + 1;
        const lineFile = await readJson(linePath(bookRoot, pageNumber, lineNumber));

        return {
          ...line,
          ...(lineFile || {}),
          pageNumber,
          lineNumber,
        };
      })
    ),
  });

  if (Array.isArray(manifest.sections) && manifest.sections.length) {
    const sections = await Promise.all(
      manifest.sections.map(async (section) => ({
        ...section,
        pages: await Promise.all((section.pages || []).map(hydratePage)),
      }))
    );

    return normalizeBook({
      ...manifest,
      sections,
    });
  }

  const manifestPages = Array.isArray(manifest.pages) && manifest.pages.length
    ? manifest.pages
    : createDefaultBook().pages;
  const pages = await Promise.all(manifestPages.map(hydratePage));

  return normalizeBook({
    ...manifest,
    pages,
  });
}

function getPdfBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

function createBookPdfDocument(book, title) {
  return new PDFDocument({
    autoFirstPage: false,
    margin: 0,
    size: "LETTER",
    info: {
      Title: title,
      Creator: "TrueChops Book Builder",
    },
  });
}

async function getPracticeQrSvg(book, page, getBookPageQrUrl, qrOrigin = DEFAULT_QR_ORIGIN) {
  const practiceUrl = getBookPageQrUrl(page.pageNumber, book, qrOrigin || DEFAULT_QR_ORIGIN);
  return QRCode.toString(practiceUrl, { type: "svg", margin: 1 });
}

function renderPageScoreSvg(
  score,
  renderKey,
  pageNumber,
  rendererApi,
  pdfSettings,
  bookData
) {
  setupDom();

  const { initialize, drawScore } = rendererApi;
  renderCounter += 1;
  const safeRenderKey = String(renderKey).replace(/[^a-zA-Z0-9_-]/g, "-");
  const id = `book-pdf-script-slot-${safeRenderKey}-${renderCounter}`;
  const container = globalThis.document.createElement("div");
  container.id = id;
  globalThis.document.body.appendChild(container);

  try {
    const { renderer, context } = initialize(id);
    drawScore(
      renderer,
      context,
      score,
      null,
      () => {},
      {
        width: bookData.getScoreRenderWidth(pdfSettings),
        scale: 1,
        hResize: 1,
        vResize: 1,
        justifyLastRow: true,
        measureNoteStartPadding: bookData.SCORE_MEASURE_START_PADDING,
        measureNoteEndPadding: bookData.SCORE_MEASURE_END_PADDING,
        measureGap: bookData.SCORE_MEASURE_GAP,
        minimumNoteSpacing: bookData.SCORE_MINIMUM_NOTE_SPACING,
        measuresPerLine: pdfSettings.measuresPerLine,
        hideTimeSignature: false,
        showMeasureNumbers: true,
        systemSpacing: pdfSettings.lineSpacing,
      },
      { start: [], end: [] }
    );

    const svg = container.querySelector("svg");
    if (!svg) {
      throw new Error(`Unable to render page ${pageNumber}`);
    }

    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svg.setAttribute("version", "1.1");

    const rendered = {
      source: svg.outerHTML,
      width: Number.parseFloat(svg.getAttribute("width")),
      height: Number.parseFloat(svg.getAttribute("height")),
    };

    return rendered;
  } finally {
    container.remove();
  }
}

function getPageScoreSlices(svg, width, height, lineSpacing) {
  const scale = width / svg.width;
  const systemHeight = lineSpacing * scale;
  const totalSystems = Math.max(
    1,
    Math.round(svg.height / lineSpacing)
  );
  const maxSystemsPerPage = Math.max(1, Math.floor(height / systemHeight));
  const minimumContinuationSystems = Math.min(
    MIN_CONTINUATION_SYSTEMS,
    maxSystemsPerPage
  );
  const slices = [];
  let systemStart = 0;

  while (systemStart < totalSystems) {
    const remainingSystems = totalSystems - systemStart;
    let systemCount = Math.min(maxSystemsPerPage, remainingSystems);
    const continuationSystems = remainingSystems - systemCount;

    if (
      continuationSystems > 0 &&
      continuationSystems < minimumContinuationSystems
    ) {
      systemCount -= minimumContinuationSystems - continuationSystems;
    }

    slices.push({ systemStart, systemCount });
    systemStart += systemCount;
  }

  return slices;
}

function drawPageScoreSvg(doc, svg, x, y, width, height, slice, lineSpacing) {
  const scale = width / svg.width;
  const svgWidth = svg.width * scale;
  const svgHeight = svg.height * scale;
  const sliceTop = slice.systemStart * lineSpacing * scale;
  const sliceHeight = slice.systemCount * lineSpacing * scale;

  if (sliceHeight > height) {
    throw new Error(
      `Continuous score slice height ${sliceHeight.toFixed(1)} exceeds the page area ${height.toFixed(1)}.`
    );
  }

  doc.save();
  doc.rect(x, y, width, sliceHeight).clip();
  SVGtoPDF(doc, svg.source, x, y - sliceTop, {
    width: svgWidth,
    height: svgHeight,
    assumePt: true,
    preserveAspectRatio: "xMidYMid meet",
    fontCallback(fontFamily, bold) {
      return bold ? "Times-Bold" : "Times-Roman";
    },
    warningCallback() {},
  });
  doc.restore();
}

async function renderBookPageAssets(
  book,
  page,
  bookData,
  rendererApi,
  getBookPageQrUrl,
  qrOrigin,
  limitScoreRender
) {
  const {
    createContinuousPageScore,
    getLinesPerPage,
    getPagePdfSettings,
  } = bookData;
  const pdfSettings = getPagePdfSettings(page, book.pdfSettings);
  const linesPerPage = getLinesPerPage(pdfSettings);
  const pageLines = page.lines.slice(0, linesPerPage);
  const pageScore = createContinuousPageScore(pageLines);
  const [scoreSvg, qrSvg] = await Promise.all([
    limitScoreRender(() => {
      try {
        return renderPageScoreSvg(
          pageScore,
          `${page.pageNumber}-continuous`,
          page.pageNumber,
          rendererApi,
          pdfSettings,
          bookData
        );
      } catch (error) {
        throw new Error(
          `Unable to render page ${page.pageNumber}: ${error.message}`,
          { cause: error }
        );
      }
    }),
    getPracticeQrSvg(book, page, getBookPageQrUrl, qrOrigin),
  ]);

  return {
    page,
    pdfSettings,
    scoreSvg,
    qrSvg,
  };
}

function drawBookPage(doc, book, pageAssets) {
  const { page, pdfSettings, scoreSvg, qrSvg } = pageAssets;
  const pageWidth = PDF_PAGE_WIDTH;
  const pageHeight = PDF_PAGE_HEIGHT;
  const margin = PDF_MARGIN;
  const footerHeight = PDF_FOOTER_HEIGHT;
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2 - footerHeight;
  const slices = getPageScoreSlices(
    scoreSvg,
    contentWidth,
    contentHeight,
    pdfSettings.lineSpacing
  );

  slices.forEach((slice) => {
    doc.addPage();
    doc.font("Times-Bold").fontSize(13).text(String(page.pageNumber), pageWidth - margin - 24, 7, {
      width: 24,
      align: "right",
      lineBreak: false,
    });
    drawPageScoreSvg(
      doc,
      scoreSvg,
      margin,
      margin,
      contentWidth,
      contentHeight,
      slice,
      pdfSettings.lineSpacing
    );

    const qrSize = 36;
    const qrX = pageWidth - margin - qrSize;
    const qrBottomMargin = 10;
    const qrY = pageHeight - qrBottomMargin - qrSize;
    SVGtoPDF(doc, qrSvg, qrX, qrY, { width: qrSize, height: qrSize });
  });
}

function getTableOfContentsEntries(book) {
  if (Array.isArray(book.tableOfContents) && book.tableOfContents.length) {
    return book.tableOfContents;
  }

  return (book.sections || []).map((section) => {
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

function drawTableOfContentsPage(doc, book, bookTitle) {
  const entries = getTableOfContentsEntries(book);
  const margin = 48;
  const pageNumberWidth = 46;
  const contentWidth = PDF_PAGE_WIDTH - margin * 2;
  const titleWidth = contentWidth - pageNumberWidth - 12;
  const rowHeight = Math.min(26, 590 / Math.max(entries.length, 1));
  const rowFontSize = entries.length > 24 ? 9.5 : 11;
  const firstRowY = 142;

  doc.addPage();
  doc
    .font("Times-Roman")
    .fillColor("#111111")
    .fontSize(24)
    .text(book.title || bookTitle, margin, 48, {
      width: contentWidth,
      align: "center",
      lineBreak: false,
    });
  doc
    .font("Times-Bold")
    .fontSize(18)
    .text("Table of Contents", margin, 91, {
      width: contentWidth,
      align: "center",
      lineBreak: false,
    });

  entries.forEach((entry, index) => {
    const y = firstRowY + index * rowHeight;
    const pageLabel = entry.pageStart == null
      ? ""
      : entry.pageEnd && entry.pageEnd !== entry.pageStart
        ? `${entry.pageStart}\u2013${entry.pageEnd}`
        : String(entry.pageStart);
    const label = `${index + 1}. ${entry.title}`;

    doc.font("Times-Roman").fontSize(rowFontSize).fillColor("#111111");
    doc.text(label, margin, y, {
      width: titleWidth,
      lineBreak: false,
      ellipsis: true,
    });
    doc.text(pageLabel, margin + contentWidth - pageNumberWidth, y, {
      width: pageNumberWidth,
      align: "right",
      lineBreak: false,
    });

    const labelWidth = Math.min(doc.widthOfString(label), titleWidth - 8);
    const leaderStart = margin + labelWidth + 7;
    const leaderEnd = margin + contentWidth - pageNumberWidth - 7;
    const leaderY = y + rowFontSize * 0.78;

    if (leaderEnd > leaderStart) {
      doc
        .save()
        .strokeColor("#777777")
        .lineWidth(0.5)
        .dash(1, { space: 2 })
        .moveTo(leaderStart, leaderY)
        .lineTo(leaderEnd, leaderY)
        .stroke()
        .restore();
    }
  });
}

async function renderPdf(book, pages, dependencies) {
  const {
    bookData,
    rendererApi,
    getBookPageQrUrl,
    qrOrigin,
    includeTableOfContents,
  } = dependencies;
  const { BOOK_TITLE } = bookData;
  const title = pages.length === 1
    ? `${book.title || BOOK_TITLE} Page ${pages[0].pageNumber}`
    : book.title || BOOK_TITLE;
  const doc = createBookPdfDocument(book, title);
  const finished = getPdfBuffer(doc);
  const limitScoreRender = createAsyncLimiter(getScoreRenderConcurrency());
  const pageAssetPromises = pages.map((page) =>
    renderBookPageAssets(
      book,
      page,
      bookData,
      rendererApi,
      getBookPageQrUrl,
      qrOrigin,
      limitScoreRender
    )
  );

  if (includeTableOfContents) {
    drawTableOfContentsPage(doc, book, BOOK_TITLE);
  }

  for (const pageAssetsPromise of pageAssetPromises) {
    const pageAssets = await pageAssetsPromise;
    drawBookPage(doc, book, pageAssets);
  }

  doc.end();
  return finished;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  installProjectTranspiler();
  setupDom();

  const bookData = require(path.join(PROJECT_ROOT, "src/components/book-builder/book-data.js"));
  const rendererApi = require(path.join(PROJECT_ROOT, "src/lib/vexflow.js"));
  const { getBookPageQrUrl } = require(path.join(PROJECT_ROOT, "src/lib/book-qr.js"));
  const bookRoot = path.join(PROJECT_ROOT, "data", "book-builder", bookData.BOOK_SLUG);
  const book = await loadBook(bookData, bookRoot);
  enforceBookMinPlayedNotes(book);
  const pages = options.scope === "page"
    ? [book.pages.find((page) => page.pageNumber === options.page)].filter(Boolean)
    : book.pages;

  if (!pages.length) {
    throw new Error(`No book page found for page ${options.page}.`);
  }

  console.log(`Rendering ${pages.length} page${pages.length === 1 ? "" : "s"} from ${bookRoot}`);
  console.log(`QR origin: ${options.qrOrigin}`);
  const pdf = await renderPdf(book, pages, {
    bookData,
    rendererApi,
    getBookPageQrUrl,
    qrOrigin: options.qrOrigin,
    includeTableOfContents: options.scope === "book",
  });

  await fs.mkdir(path.dirname(options.output), { recursive: true });
  await fs.writeFile(options.output, pdf);
  console.log(`Wrote ${options.output} (${(pdf.length / 1024 / 1024).toFixed(2)} MB)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
