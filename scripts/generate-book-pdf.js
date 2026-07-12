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
const LINE_NUMBER_CENTER_OFFSET = 1.25;

let domSetup = false;
let renderCounter = 0;

function parseArgs(argv) {
  const options = {
    scope: "book",
    page: 1,
    output: DEFAULT_OUTPUT_PATH,
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

async function getPracticeQrSvg(book, page, getBookPageQrUrl) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://truechops.com";
  const practiceUrl = getBookPageQrUrl(page.pageNumber, book, siteUrl);
  return QRCode.toString(practiceUrl, { type: "svg", margin: 1 });
}

function getMeasureCenterY(svg) {
  const staffLineYs = [...svg.source.matchAll(/M[\d.]+ ([\d.]+)L[\d.]+ \1/g)]
    .map((match) => Number(match[1]))
    .filter(Number.isFinite)
    .slice(0, 5);

  if (!staffLineYs.length) {
    return svg.height / 2;
  }

  return (Math.min(...staffLineYs) + Math.max(...staffLineYs)) / 2;
}

function renderScoreSvg(line, renderKey, pdfSettings, rendererApi, createBlankLineScore) {
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
      line.score || createBlankLineScore(),
      null,
      () => {},
      {
        width: pdfSettings.noteRenderWidth,
        scale: 1,
        hResize: 1,
        vResize: 1,
        justifyLastRow: true,
        measureNoteStartPadding: pdfSettings.noteStartPadding,
        measureNoteEndPadding: pdfSettings.noteEndPadding,
        hideTimeSignature: true,
        maxMeasureWidth: pdfSettings.noteRenderWidth,
      },
      { start: 0, end: 0 }
    );

    const svg = container.querySelector("svg");
    if (!svg) {
      throw new Error(`Unable to render page ${line.pageNumber}, slot ${line.lineNumber}`);
    }

    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svg.setAttribute("version", "1.1");

    const rendered = {
      source: svg.outerHTML,
      width: Number.parseFloat(svg.getAttribute("width")),
      height: Number.parseFloat(svg.getAttribute("height")),
    };

    rendered.staffCenterY = getMeasureCenterY(rendered);
    return rendered;
  } finally {
    container.remove();
  }
}

function drawSlotSvg(doc, line, svg, x, y, width, height) {
  const numberWidth = 18;
  const notationX = x + numberWidth + 2;
  const notationWidth = width - numberWidth - 2;
  const scale = notationWidth / svg.width;
  const svgWidth = notationWidth;
  const svgHeight = svg.height * scale;
  const staffCenterInSvg = svg.staffCenterY ?? getMeasureCenterY(svg);
  const slotCenterY = y + height / 2;
  const svgY = slotCenterY - staffCenterInSvg * scale;
  const measureCenterY = slotCenterY;
  const fontSize = 13;
  const lineNumber = String(line.lineNumber);

  doc
    .font("Times-Roman")
    .fontSize(fontSize)
    .fillColor("#111111");

  const numberHeight = doc.currentLineHeight();

  doc.text(lineNumber, x, measureCenterY - numberHeight / 2 + LINE_NUMBER_CENTER_OFFSET, {
    width: numberWidth,
    align: "right",
    lineBreak: false,
  });

  // Horizontal clipping keeps columns tidy; vertical bleed protects accents
  // and other above-staff markings from being cropped.
  const verticalBleed = Math.min(18, height * 0.28);
  doc.save();
  doc.rect(notationX, y - verticalBleed, notationWidth, height + verticalBleed * 2).clip();
  SVGtoPDF(doc, svg.source, notationX, svgY, {
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
  limitScoreRender
) {
  const {
    createBlankLineScore,
    getLinesPerPage,
    getPagePdfSettings,
  } = bookData;
  const pdfSettings = getPagePdfSettings(page, book.pdfSettings);
  const linesPerPage = getLinesPerPage(pdfSettings);
  const pageLines = page.lines.slice(0, linesPerPage);
  const [svgs, qrSvg] = await Promise.all([
    Promise.all(
      pageLines.map((line, index) =>
        limitScoreRender(() =>
          renderScoreSvg(
            line,
            `${page.pageNumber}-${line.lineNumber}-${index}`,
            pdfSettings,
            rendererApi,
            createBlankLineScore
          )
        )
      )
    ),
    getPracticeQrSvg(book, page, getBookPageQrUrl),
  ]);

  return {
    page,
    pdfSettings,
    pageLines,
    svgs,
    qrSvg,
  };
}

function drawBookPage(doc, book, pageAssets, bookTitle) {
  const { page, pdfSettings, pageLines, svgs, qrSvg } = pageAssets;
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 24;
  const headerHeight = 34;
  const footerHeight = 46;
  const columnGap = 20;
  const usableWidth = pageWidth - margin * 2 - columnGap * (pdfSettings.columns - 1);
  const columnWidth = usableWidth / pdfSettings.columns;
  const rowHeight = (pageHeight - margin * 2 - headerHeight - footerHeight) / pdfSettings.rows;

  doc.addPage();
  doc.font("Times-Roman").fillColor("#111111").fontSize(15).text(book.title || bookTitle, margin, 7, {
    width: pageWidth - margin * 2,
    align: "center",
    lineBreak: false,
  });
  doc.font("Times-Bold").fontSize(10).text(String(page.pageNumber), pageWidth - margin - 18, 8, {
    width: 18,
    align: "right",
    lineBreak: false,
  });
  doc.font("Times-Italic").fontSize(7.5).text("Read downward", margin - 7, margin + 8, {
    width: 80,
    lineBreak: false,
  });

  pageLines.forEach((line, index) => {
    const column = Math.floor(index / pdfSettings.rows);
    const row = index % pdfSettings.rows;
    const x = margin + column * (columnWidth + columnGap);
    const y = margin + headerHeight + row * rowHeight;

    drawSlotSvg(
      doc,
      line,
      svgs[index],
      x,
      y,
      columnWidth,
      rowHeight
    );
  });

  doc.font("Times-Roman").fillColor("#111111").fontSize(9).text("*  R = right stick", margin + 18, pageHeight - margin - 2, {
    lineBreak: false,
  });
  doc.fontSize(9).text("L  = left stick", margin + 26, pageHeight - margin + 10, {
    lineBreak: false,
  });
  doc.fontSize(10).text("Repeat each exercise 20 times.", margin, pageHeight - margin + 9, {
    width: pageWidth - margin * 2,
    align: "center",
    lineBreak: false,
  });

  const contentBottom = margin + headerHeight + rowHeight * pdfSettings.rows;
  const qrSize = 36;
  const qrX = pageWidth - margin - qrSize;
  const qrY = contentBottom + 5;
  SVGtoPDF(doc, qrSvg, qrX, qrY, { width: qrSize, height: qrSize });
}

async function renderPdf(book, pages, dependencies) {
  const { bookData, rendererApi, getBookPageQrUrl } = dependencies;
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
      limitScoreRender
    )
  );

  for (const pageAssetsPromise of pageAssetPromises) {
    drawBookPage(doc, book, await pageAssetsPromise, BOOK_TITLE);
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
  const pages = options.scope === "page"
    ? [book.pages.find((page) => page.pageNumber === options.page)].filter(Boolean)
    : book.pages;

  if (!pages.length) {
    throw new Error(`No book page found for page ${options.page}.`);
  }

  console.log(`Rendering ${pages.length} page${pages.length === 1 ? "" : "s"} from ${bookRoot}`);
  const pdf = await renderPdf(book, pages, {
    bookData,
    rendererApi,
    getBookPageQrUrl,
  });

  await fs.mkdir(path.dirname(options.output), { recursive: true });
  await fs.writeFile(options.output, pdf);
  console.log(`Wrote ${options.output} (${(pdf.length / 1024 / 1024).toFixed(2)} MB)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
