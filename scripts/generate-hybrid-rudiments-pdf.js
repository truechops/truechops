#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");
const { JSDOM } = require("jsdom");
const PDFDocument = require("pdfkit");
const SVGtoPDF = require("svg-to-pdfkit");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DEFAULT_ALL_PATH = path.join(PROJECT_ROOT, "data/rudiments/hybrid/all.js");
const DEFAULT_OUTPUT_PATH = path.join(
  PROJECT_ROOT,
  "book-output/hybrid-rudiments.pdf"
);
const POINTS_PER_INCH = 72;
const MUSICXML_DIVISIONS = 840;
const DEFAULT_MUSESCORE_WORK_DIR = path.join(
  PROJECT_ROOT,
  "book-output/musescore-renders"
);
const ORNAMENTS = {
  ACCENT: "a",
  FLAM: "f",
  DIDDLE: "d",
  CHEESE: "c",
  BUZZ: "b",
  LEFT_STICKING: "l",
  RIGHT_STICKING: "r",
};
const VF_DURATION_TO_MUSICXML_TYPE = {
  1: "whole",
  2: "half",
  4: "quarter",
  8: "eighth",
  16: "16th",
  32: "32nd",
};

function parseArgs(argv) {
  const options = {
    all: DEFAULT_ALL_PATH,
    output: DEFAULT_OUTPUT_PATH,
    renderer: "vexflow",
    trim: "8.5x11",
    margin: 0.5,
    columnGap: 0.18,
    perPage: 24,
    columns: 2,
    numberSize: 8.5,
    numberGutter: 0.18,
    svgWidth: 530,
    fontRegular: process.env.TRUECHOPS_PDF_FONT_REGULAR || null,
    fontBold: process.env.TRUECHOPS_PDF_FONT_BOLD || null,
    debugSvgDir: null,
    musescoreBin: process.env.MUSESCORE_BIN || null,
    musescoreWorkDir: DEFAULT_MUSESCORE_WORK_DIR,
    musescoreTrimImage: 0,
    repeatBarlines: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const [flag, inlineValue] = arg.split("=");
    const nextValue = inlineValue ?? argv[i + 1];

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    if (!flag.startsWith("--")) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    const key = flag.slice(2);
    if (inlineValue == null) i += 1;

    switch (key) {
      case "all":
        options.all = path.resolve(process.cwd(), nextValue);
        break;
      case "output":
        options.output = path.resolve(process.cwd(), nextValue);
        break;
      case "renderer":
        options.renderer = nextValue;
        break;
      case "trim":
        options.trim = nextValue;
        break;
      case "margin":
        options.margin = Number(nextValue);
        break;
      case "column-gap":
        options.columnGap = Number(nextValue);
        break;
      case "per-page":
        options.perPage = Number(nextValue);
        break;
      case "columns":
        options.columns = Number(nextValue);
        break;
      case "number-size":
        options.numberSize = Number(nextValue);
        break;
      case "number-gutter":
        options.numberGutter = Number(nextValue);
        break;
      case "svg-width":
        options.svgWidth = Number(nextValue);
        break;
      case "font-regular":
        options.fontRegular = path.resolve(process.cwd(), nextValue);
        break;
      case "font-bold":
        options.fontBold = path.resolve(process.cwd(), nextValue);
        break;
      case "debug-svg-dir":
        options.debugSvgDir = path.resolve(process.cwd(), nextValue);
        break;
      case "musescore-bin":
        options.musescoreBin = path.resolve(process.cwd(), nextValue);
        break;
      case "musescore-work-dir":
        options.musescoreWorkDir = path.resolve(process.cwd(), nextValue);
        break;
      case "musescore-trim-image":
        options.musescoreTrimImage = Number(nextValue);
        break;
      case "osmd":
        // legacy flag support, ignored; renderer is set with --renderer
        if (inlineValue == null) i -= 1;
        break;
      case "no-repeat-barlines":
        options.repeatBarlines = false;
        if (inlineValue == null) i -= 1;
        break;
      default:
        throw new Error(`Unknown option: ${flag}`);
    }
  }

  if (options.perPage % options.columns !== 0) {
    throw new Error("--per-page must divide evenly by --columns");
  }

  if (!["vexflow", "musescore", "osmd"].includes(options.renderer)) {
    throw new Error('--renderer must be either "vexflow", "musescore", or "osmd"');
  }

  return options;
}

function printHelp() {
  console.log(`
Generate a print PDF from data/rudiments/hybrid/all.js.

Usage:
  npm run pdf:hybrid-rudiments
  node scripts/generate-hybrid-rudiments-pdf.js --output book-output/hybrid-rudiments.pdf

Options:
  --all <path>             Path to the rudiment all.js file.
  --output <path>          PDF destination.
  --renderer <name>        Renderer: vexflow, musescore, or osmd. Default: vexflow.
  --trim <WxH>             Page trim size in inches. Default: 8.5x11.
  --margin <inches>        Page margin in inches. Default: 0.5.
  --column-gap <inches>    Space between the two rhythm columns. Default: 0.18.
  --per-page <number>      Rudiments per page. Default: 24.
  --columns <number>       Rudiments per row. Default: 2.
  --number-size <points>   Exercise number size. Default: 8.5.
  --number-gutter <inches> Space reserved for exercise numbers. Default: 0.18.
  --svg-width <number>     Width passed to the app VexFlow renderer. Default: 530.
  --font-regular <path>    Optional TrueType/OpenType font to embed.
  --font-bold <path>       Optional bold TrueType/OpenType font to embed.
  --debug-svg-dir <path>   Also write one SVG per rudiment for inspection.
  --musescore-bin <path>   MuseScore CLI path. Defaults to MUSESCORE_BIN/PATH.
  --musescore-work-dir     MusicXML/SVG render directory.
  --musescore-trim-image   MuseScore SVG trim margin. Default: 0.
  --no-repeat-barlines     Do not add repeat barlines to MusicXML exports.
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

    const source = fs.readFileSync(filename, "utf8");
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
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    pretendToBeVisual: true,
  });

  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  global.HTMLElement = dom.window.HTMLElement;
  global.SVGElement = dom.window.SVGElement;

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

  if (!dom.window.SVGSVGElement.prototype.createSVGPoint) {
    dom.window.SVGSVGElement.prototype.createSVGPoint = function createSVGPoint() {
      return {
        x: 0,
        y: 0,
        matrixTransform() {
          return { x: this.x, y: this.y };
        },
      };
    };
  }

  if (!dom.window.SVGElement.prototype.getScreenCTM) {
    dom.window.SVGElement.prototype.getScreenCTM = function getScreenCTM() {
      return {
        inverse() {
          return this;
        },
      };
    };
  }
}

function requireDefault(modulePath) {
  const loaded = require(modulePath);
  return loaded.default || loaded;
}

function getPageSize(trim) {
  const match = trim.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/i);
  if (!match) {
    throw new Error(`Invalid --trim value "${trim}". Use a value like 8.5x11.`);
  }

  return {
    width: Number(match[1]) * POINTS_PER_INCH,
    height: Number(match[2]) * POINTS_PER_INCH,
  };
}

function renderRhythmSvgWithVexFlow(rhythm, index, drawScore, initialize, svgWidth) {
  const id = `pdf-rhythm-${index}`;
  const container = document.createElement("div");
  container.id = id;
  document.body.appendChild(container);

  const { renderer, context } = initialize(id);

  drawScore(
    renderer,
    context,
    rhythm.score,
    0,
    () => {},
    { width: svgWidth, scale: 1, hResize: 1, vResize: 1, justifyLastRow: true },
    {}
  );

  const svg = container.querySelector("svg");
  if (!svg) {
    throw new Error(`VexFlow did not create an SVG for "${rhythm.name}".`);
  }

  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("version", "1.1");

  const width = Number.parseFloat(svg.getAttribute("width"));
  const height = Number.parseFloat(svg.getAttribute("height"));
  const source = svg.outerHTML;
  container.remove();

  return { source, width, height };
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getMusicXmlType(vexflowDuration) {
  const type = VF_DURATION_TO_MUSICXML_TYPE[vexflowDuration];
  if (!type) {
    throw new Error(`Unsupported note duration for MusicXML: ${vexflowDuration}`);
  }

  return type;
}

function getBaseMusicXmlDuration(note) {
  let duration = (MUSICXML_DIVISIONS * 4) / note.duration;

  for (let dotIndex = 0; dotIndex < (note.dots || 0); dotIndex += 1) {
    duration += duration / (2 ** (dotIndex + 1));
  }

  return duration;
}

function getMusicXmlDuration(note, tuplet) {
  const baseDuration = getBaseMusicXmlDuration(note);
  const duration = tuplet
    ? (baseDuration * tuplet.normal) / tuplet.actual
    : baseDuration;

  if (!Number.isInteger(duration)) {
    throw new Error(
      `MusicXML duration must be an integer. Saw ${duration} for ${JSON.stringify(note)}`
    );
  }

  return duration;
}

function getTupletForNote(tuplets, noteIndex) {
  return tuplets.find((tuplet) => noteIndex >= tuplet.start && noteIndex < tuplet.end);
}

function getSticking(ornaments) {
  if (ornaments.includes(ORNAMENTS.RIGHT_STICKING)) return "R";
  if (ornaments.includes(ORNAMENTS.LEFT_STICKING)) return "L";
  return null;
}

function getNotePitchXml(note) {
  if (!note.notes || note.notes.length === 0) {
    return "<rest/>";
  }

  const pitch = note.notes[0];
  return [
    "<unpitched>",
    `<display-step>${escapeXml(pitch[0])}</display-step>`,
    `<display-octave>${escapeXml(pitch.slice(1))}</display-octave>`,
    "</unpitched>",
  ].join("");
}

function getNotationsXml(note, tuplet, noteIndex) {
  const ornaments = note.ornaments || "";
  const notations = [];
  const articulations = [];
  const musicXmlOrnaments = [];

  if (ornaments.includes(ORNAMENTS.ACCENT)) {
    articulations.push("<accent/>");
  }

  if (ornaments.includes(ORNAMENTS.DIDDLE) || ornaments.includes(ORNAMENTS.CHEESE)) {
    musicXmlOrnaments.push('<tremolo type="single">1</tremolo>');
  } else if (ornaments.includes(ORNAMENTS.BUZZ)) {
    musicXmlOrnaments.push('<tremolo type="single">3</tremolo>');
  }

  if (tuplet && noteIndex === tuplet.start) {
    notations.push('<tuplet type="start" number="1" bracket="yes"/>');
  }

  if (tuplet && noteIndex === tuplet.end - 1) {
    notations.push('<tuplet type="stop" number="1"/>');
  }

  if (articulations.length) {
    notations.push(`<articulations>${articulations.join("")}</articulations>`);
  }

  if (musicXmlOrnaments.length) {
    notations.push(`<ornaments>${musicXmlOrnaments.join("")}</ornaments>`);
  }

  if (!notations.length) return "";

  return `<notations>${notations.join("")}</notations>`;
}

function getTimeModificationXml(note, tuplet) {
  if (!tuplet) return "";

  return [
    "<time-modification>",
    `<actual-notes>${tuplet.actual}</actual-notes>`,
    `<normal-notes>${tuplet.normal}</normal-notes>`,
    `<normal-type>${getMusicXmlType(note.duration)}</normal-type>`,
    "</time-modification>",
  ].join("");
}

function getLyricXml(sticking) {
  if (!sticking) return "";

  return [
    '<lyric number="1" placement="below">',
    "<syllabic>single</syllabic>",
    `<text>${sticking}</text>`,
    "</lyric>",
  ].join("");
}

function getGraceNoteXml() {
  return [
    "<note>",
    '<grace slash="no"/>',
    "<unpitched><display-step>C</display-step><display-octave>5</display-octave></unpitched>",
    "<type>eighth</type>",
    "<stem>up</stem>",
    "</note>",
  ].join("");
}

function getMusicXmlNote(note, voice, noteIndex) {
  const ornaments = note.ornaments || "";
  const tuplet = getTupletForNote(voice.tuplets || [], noteIndex);
  const sticking = getSticking(ornaments);
  const xml = [];

  if (
    note.notes &&
    note.notes.length > 0 &&
    (ornaments.includes(ORNAMENTS.FLAM) || ornaments.includes(ORNAMENTS.CHEESE))
  ) {
    xml.push(getGraceNoteXml());
  }

  xml.push(
    [
      "<note>",
      getNotePitchXml(note),
      `<duration>${getMusicXmlDuration(note, tuplet)}</duration>`,
      "<voice>1</voice>",
      `<type>${getMusicXmlType(note.duration)}</type>`,
      note.dots ? "<dot/>".repeat(note.dots) : "",
      getTimeModificationXml(note, tuplet),
      note.notes && note.notes.length > 0 ? "<stem>up</stem>" : "",
      getNotationsXml(note, tuplet, noteIndex),
      getLyricXml(sticking),
      "</note>",
    ].join("")
  );

  return xml.join("");
}

function getMeasureXml(measure, measureIndex, isFirstMeasure, isLastMeasure, options) {
  const timeSig = measure.timeSig;
  const part = measure.parts[0];
  const voice = part.voices[0];
  const attributes = [
    "<attributes>",
    `<divisions>${MUSICXML_DIVISIONS}</divisions>`,
    "<key><fifths>0</fifths></key>",
    `<time><beats>${timeSig.num}</beats><beat-type>${timeSig.type}</beat-type></time>`,
    "<clef><sign>percussion</sign><line>2</line></clef>",
    "</attributes>",
  ].join("");
  const leftRepeat = options.repeatBarlines && isFirstMeasure
    ? '<barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>'
    : "";
  const rightRepeat = options.repeatBarlines && isLastMeasure
    ? '<barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward"/></barline>'
    : "";
  const notes = voice.notes
    .map((note, noteIndex) => getMusicXmlNote(note, voice, noteIndex))
    .join("");

  return [
    `<measure number="${measureIndex + 1}">`,
    attributes,
    leftRepeat,
    notes,
    rightRepeat,
    "</measure>",
  ].join("");
}

function getMusicXml(rhythm, options) {
  const measures = rhythm.score.measures
    .map((measure, measureIndex) =>
      getMeasureXml(
        measure,
        measureIndex,
        measureIndex === 0,
        measureIndex === rhythm.score.measures.length - 1,
        options
      )
    )
    .join("");

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="no"?>',
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
    '<score-partwise version="4.0">',
    "<identification><encoding><software>TrueChops</software></encoding></identification>",
    "<part-list>",
    '<score-part id="P1">',
    "<part-name></part-name>",
    '<score-instrument id="P1-I1"><instrument-name>Snare Drum</instrument-name></score-instrument>',
    '<midi-instrument id="P1-I1"><midi-channel>10</midi-channel><midi-program>1</midi-program></midi-instrument>',
    "</score-part>",
    "</part-list>",
    `<part id="P1">${measures}</part>`,
    "</score-partwise>",
  ].join("");
}

function findMuseScoreBinary(options) {
  const candidates = [
    options.musescoreBin,
    process.env.MUSESCORE_BIN,
    "musescore",
    "musescore4",
    "mscore",
    "/Applications/MuseScore Studio 4.app/Contents/MacOS/mscore",
    "/Applications/MuseScore 4.app/Contents/MacOS/mscore",
    "/Applications/MuseScore 3.app/Contents/MacOS/mscore",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate.includes(path.sep)) {
      if (fs.existsSync(candidate)) return candidate;
      continue;
    }

    const result = childProcess.spawnSync("which", [candidate], {
      encoding: "utf8",
    });

    if (result.status === 0 && result.stdout.trim()) {
      return result.stdout.trim();
    }
  }

  throw new Error(
    [
      "MuseScore was not found.",
      "Install MuseScore 4, set MUSESCORE_BIN, or pass --musescore-bin /path/to/mscore.",
      "Common macOS path: /Applications/MuseScore 4.app/Contents/MacOS/mscore",
    ].join(" ")
  );
}

function runMuseScoreExport(museScoreBin, inputPath, outputPath, options) {
  const args = [];

  if (options.musescoreTrimImage != null) {
    args.push("-T", String(options.musescoreTrimImage));
  }

  args.push("-o", outputPath, inputPath);

  const result = childProcess.spawnSync(museScoreBin, args, {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(
      [
        `MuseScore failed while exporting ${path.basename(inputPath)}.`,
        `Command: ${museScoreBin} ${args.map((arg) => JSON.stringify(arg)).join(" ")}`,
        result.stdout ? `stdout:\n${result.stdout}` : "",
        result.stderr ? `stderr:\n${result.stderr}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    );
  }
}

function findMuseScoreSvgOutput(outputPath) {
  if (fs.existsSync(outputPath)) return outputPath;

  const directory = path.dirname(outputPath);
  const stem = path.basename(outputPath, ".svg");
  const candidates = fs
    .readdirSync(directory)
    .filter((filename) => filename.startsWith(stem) && filename.endsWith(".svg"))
    .sort();

  if (!candidates.length) {
    throw new Error(`MuseScore did not produce ${outputPath}`);
  }

  return path.join(directory, candidates[0]);
}

function getSvgDimensionsFromSource(source) {
  const widthMatch = source.match(/\swidth="([^"]+)"/);
  const heightMatch = source.match(/\sheight="([^"]+)"/);
  const viewBoxMatch = source.match(/\sviewBox="([^"]+)"/);

  if (widthMatch && heightMatch) {
    return {
      width: Number.parseFloat(widthMatch[1]),
      height: Number.parseFloat(heightMatch[1]),
    };
  }

  if (viewBoxMatch) {
    const [, , width, height] = viewBoxMatch[1].split(/\s+/).map(Number);
    return { width, height };
  }

  throw new Error("Could not read SVG dimensions from MuseScore output.");
}

function renderRhythmSvgWithMuseScore(rhythm, index, museScoreBin, options) {
  fs.mkdirSync(options.musescoreWorkDir, { recursive: true });
  const basename = `${String(index + 1).padStart(2, "0")}-${slugify(rhythm.name)}`;
  const musicXmlPath = path.join(options.musescoreWorkDir, `${basename}.musicxml`);
  const svgPath = path.join(options.musescoreWorkDir, `${basename}.svg`);

  fs.writeFileSync(musicXmlPath, getMusicXml(rhythm, options), "utf8");
  runMuseScoreExport(museScoreBin, musicXmlPath, svgPath, options);

  const actualSvgPath = findMuseScoreSvgOutput(svgPath);
  const source = fs.readFileSync(actualSvgPath, "utf8");
  const dimensions = getSvgDimensionsFromSource(source);

  return {
    source,
    width: dimensions.width,
    height: dimensions.height,
  };
}

function writeDebugSvg(debugSvgDir, rhythm, svg, index) {
  if (!debugSvgDir) return;

  fs.mkdirSync(debugSvgDir, { recursive: true });
  const slug = rhythm.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const filename = `${String(index + 1).padStart(2, "0")}-${slug}.svg`;
  fs.writeFileSync(path.join(debugSvgDir, filename), svg.source);
}

async function renderRhythmSvgsWithOSMD(rudiments, options) {
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });
  await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>', { waitUntil: 'load' });

  // Load OSMD from UNPKG
  await page.addScriptTag({ url: 'https://unpkg.com/opensheetmusicdisplay/build/opensheetmusicdisplay.min.js' });

  const svgs = [];
  for (let i = 0; i < rudiments.length; i += 1) {
    const rhythm = rudiments[i];
    const musicXml = getMusicXml(rhythm, options);

    const result = await page.evaluate(async (xmlString) => {
      const OSMD = window.opensheetmusicdisplay;
      if (!OSMD) throw new Error('OpenSheetMusicDisplay not available in page');

      document.body.innerHTML = '';
      const container = document.createElement('div');
      container.id = 'osmd-root';
      document.body.appendChild(container);

      const osmd = new OSMD.OpenSheetMusicDisplay(container, { backend: 'svg', drawTitle: false, drawSubtitle: false });
      await osmd.load(xmlString);
      await osmd.render();

      const svg = container.querySelector('svg');
      if (!svg) throw new Error('OSMD did not produce an SVG');
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

      const widthAttr = svg.getAttribute('width');
      const heightAttr = svg.getAttribute('height');
      let width = 0;
      let height = 0;
      if (widthAttr && heightAttr) {
        width = Number.parseFloat(widthAttr);
        height = Number.parseFloat(heightAttr);
      } else if (svg.viewBox && svg.viewBox.baseVal) {
        width = svg.viewBox.baseVal.width;
        height = svg.viewBox.baseVal.height;
      }

      return { source: svg.outerHTML, width, height };
    }, musicXml);

    writeDebugSvg(options.debugSvgDir, rhythm, result, i);
    svgs.push(result);
  }

  await browser.close();
  return svgs;
}

function firstExistingPath(paths) {
  return paths.find((candidate) => candidate && fs.existsSync(candidate));
}

function registerPdfFonts(doc, options) {
  const regularPath = firstExistingPath([
    options.fontRegular,
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/Library/Fonts/Arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
  ]);
  const boldPath = firstExistingPath([
    options.fontBold,
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
  ]);

  if (!regularPath) {
    return { regular: "Helvetica", bold: "Helvetica-Bold" };
  }

  doc.registerFont("TrueChopsSans", regularPath);
  doc.registerFont("TrueChopsSans-Bold", boldPath || regularPath);
  return { regular: "TrueChopsSans", bold: "TrueChopsSans-Bold" };
}

function drawPdf(rudiments, svgs, options) {
  const pageSize = getPageSize(options.trim);
  const margin = options.margin * POINTS_PER_INCH;
  const columnGap = options.columnGap * POINTS_PER_INCH;
  const numberGutter = options.numberGutter * POINTS_PER_INCH;
  const rows = options.perPage / options.columns;
  const usableWidth = pageSize.width - margin * 2 - columnGap * (options.columns - 1);
  const usableHeight = pageSize.height - margin * 2;
  const cellWidth = usableWidth / options.columns;
  const cellHeight = usableHeight / rows;

  fs.mkdirSync(path.dirname(options.output), { recursive: true });

  const doc = new PDFDocument({
    autoFirstPage: false,
    margin: 0,
    size: [pageSize.width, pageSize.height],
    info: {
      Title: "TrueChops Hybrid Rudiments",
      Subject: "Hybrid snare rudiments rendered from TrueChops VexFlow data",
      Creator: "TrueChops PDF generator",
    },
  });
  const fonts = registerPdfFonts(doc, options);
  const stream = fs.createWriteStream(options.output);
  const finished = new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  doc.pipe(stream);

  rudiments.forEach((rhythm, index) => {
    if (index % options.perPage === 0) {
      doc.addPage();
    }

    const position = index % options.perPage;
    const column = Math.floor(position / rows);
    const row = position % rows;
    const x = margin + column * (cellWidth + columnGap);
    const y = margin + row * cellHeight;
    const svg = svgs[index];
    const notationX = x + numberGutter;
    const notationWidth = Math.max(cellWidth - numberGutter, 1);
    const availableSvgHeight = Math.max(cellHeight, 1);
    const scale = Math.min(notationWidth / svg.width, availableSvgHeight / svg.height);
    const width = svg.width * scale;
    const height = svg.height * scale;
    const svgX = notationX;
    const svgY = y + (cellHeight - height) / 2;
    const numberY = svgY + height * 0.35 - options.numberSize / 2;

    doc
      .font(fonts.bold)
      .fontSize(options.numberSize)
      .fillColor("black")
      .text(`${index + 1}`, x, numberY, {
        width: Math.max(numberGutter - 3, 1),
        align: "right",
        lineBreak: false,
      });

    SVGtoPDF(doc, svg.source, svgX, svgY, {
      width,
      height,
      assumePt: true,
      preserveAspectRatio: "xMidYMin meet",
      fontCallback(fontFamily, bold, italic) {
        return bold ? fonts.bold : fonts.regular;
      },
      warningCallback(message) {
        if (!/Font|style/i.test(message)) {
          console.warn(`SVG warning for ${rhythm.name}: ${message}`);
        }
      },
    });
  });

  doc.end();
  return finished;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  installProjectTranspiler();

  const allPath = require.resolve(options.all);
  const rudiments = requireDefault(allPath);
  let svgs;

  if (options.renderer === "musescore") {
    const museScoreBin = findMuseScoreBinary(options);

    svgs = rudiments.map((rhythm, index) => {
      const svg = renderRhythmSvgWithMuseScore(
        rhythm,
        index,
        museScoreBin,
        options
      );
      writeDebugSvg(options.debugSvgDir, rhythm, svg, index);
      return svg;
    });
  } else if (options.renderer === "osmd") {
    svgs = await renderRhythmSvgsWithOSMD(rudiments, options);
  } else {
    setupDom();
    const { initialize, drawScore } = require(path.join(PROJECT_ROOT, "src/lib/vexflow.js"));

    svgs = rudiments.map((rhythm, index) => {
      const svg = renderRhythmSvgWithVexFlow(
        rhythm,
        index,
        drawScore,
        initialize,
        options.svgWidth
      );
      writeDebugSvg(options.debugSvgDir, rhythm, svg, index);
      return svg;
    });
  }

  await drawPdf(rudiments, svgs, options);

  console.log(
    `Generated ${path.relative(PROJECT_ROOT, options.output)} with ${rudiments.length} rudiments, ${options.columns} per row, ${options.perPage} per page, using ${options.renderer}.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
