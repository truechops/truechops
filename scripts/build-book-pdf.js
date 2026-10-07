#!/usr/bin/env node

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { BOOK_VOLUMES, getBookVolume, createBookVolume } = require("../src/lib/book-volumes");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SOURCE_ROOT = path.join(PROJECT_ROOT, "data", "book-builder", "snare-drum-book");

function parseArgs(argv) {
  const options = { volume: "all", outputDir: path.join(PROJECT_ROOT, "book-output"), renderArgs: [], dryRun: false, renderOnly: false };
  for (let index = 0; index < argv.length; index += 1) {
    const [flag, inline] = argv[index].split("=");
    if (flag === "--help" || flag === "-h") { options.help = true; continue; }
    if (flag === "--dry-run") { options.dryRun = true; continue; }
    if (flag === "--render-only") { options.renderOnly = true; continue; }
    const value = inline ?? argv[++index];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${flag}`);
    if (flag === "--volume") options.volume = value;
    else if (flag === "--output-dir") options.outputDir = path.resolve(value);
    else if (flag === "--output") options.output = path.resolve(value);
    else if (["--scope", "--page", "--qr-origin"].includes(flag)) options.renderArgs.push(flag, value);
    else throw new Error(`Unknown option: ${flag}`);
  }
  if (!["all", "current"].includes(options.volume)) getBookVolume(options.volume);
  if (options.output && options.volume === "all") throw new Error("Use --output-dir for all six books, or select --volume with --output.");
  const scopeIndex = options.renderArgs.indexOf("--scope");
  if (scopeIndex >= 0 && !["book", "page"].includes(options.renderArgs[scopeIndex + 1])) throw new Error("--scope must be book or page.");
  const pageIndex = options.renderArgs.indexOf("--page");
  if (pageIndex >= 0 && (!/^\d+$/.test(options.renderArgs[pageIndex + 1]) || Number(options.renderArgs[pageIndex + 1]) < 1)) throw new Error("--page must be a positive integer.");
  return options;
}

function runScript(scriptName, args = []) {
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, scriptName), ...args],
    {
      cwd: PROJECT_ROOT,
      env: process.env,
      stdio: "inherit",
    }
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${scriptName} failed (exit ${result.status}).`);
  }
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(`Generate the six-book snare drum collection from the saved book-builder curriculum.

  npm run pdf:book                         Generate all six books
  npm run pdf:book -- --volume 2           Generate one volume
  npm run pdf:book -- --volume current     Regenerate the original working book
  npm run pdf:book -- --render-only        Render previously generated volumes
  npm run pdf:book -- --dry-run            Show the curriculum and page counts

Options: --volume <all|1-6|current>, --output-dir <path>, --output <single-file>,
         --scope <book|page>, --page <number>, --qr-origin <origin>
Book 6 preserves the current book's curriculum, ornament settings and order.`);
    return;
  }
  const source = JSON.parse(fs.readFileSync(path.join(SOURCE_ROOT, "book.json"), "utf8"));
  const volumes = options.volume === "current" ? [null]
    : options.volume === "all" ? BOOK_VOLUMES : [getBookVolume(options.volume)];
  const summary = [];
  for (const volume of volumes) {
    const planned = volume ? createBookVolume(source, volume.number) : source;
    const root = volume ? path.join(PROJECT_ROOT, "data", "book-builder", volume.slug) : SOURCE_ROOT;
    const pageIndex = options.renderArgs.indexOf("--page");
    const scopeIndex = options.renderArgs.indexOf("--scope");
    const pageSuffix = scopeIndex >= 0 && options.renderArgs[scopeIndex + 1] === "page" ? `-page-${pageIndex >= 0 ? options.renderArgs[pageIndex + 1] : 1}` : "";
    const output = options.output || path.join(options.outputDir, `${planned.slug}${pageSuffix}.pdf`);
    const entry = { volume: volume?.number || "current", title: planned.title, sections: planned.sections.length, pages: planned.sections.reduce((n, s) => n + s.pages.length, 0), output };
    summary.push(entry);
    console.log(`${entry.title}: ${entry.sections} sections, ${entry.pages} study pages`);
    if (options.dryRun) continue;
    if (!options.renderOnly) {
      let sourcePath = path.join(SOURCE_ROOT, "book.json");
      if (volume) {
        fs.mkdirSync(root, { recursive: true });
        sourcePath = path.join(root, "book-source.json");
        const { pages, ...stored } = planned;
        fs.writeFileSync(sourcePath, JSON.stringify(stored));
      }
      runScript("generate-ai-book.js", ["--no-local-ai", "--book", sourcePath, "--output-root", root, ...(volume ? ["--compact"] : [])]);
    }
    runScript("generate-book-pdf.js", ["--book-root", root, "--output", output, ...options.renderArgs]);
  }
  if (!options.dryRun && options.volume !== "current" && !options.renderArgs.includes("page")) {
    const manifestPath = path.join(options.outputDir, "collection.json");
    const previous = options.volume !== "all" && fs.existsSync(manifestPath)
      ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : [];
    const updated = [...previous.filter((entry) => !summary.some((next) => next.volume === entry.volume)), ...summary]
      .sort((a, b) => a.volume - b.volume);
    fs.writeFileSync(manifestPath, JSON.stringify(updated, null, 2) + "\n");
  }
}

if (require.main === module) main();
module.exports = { parseArgs };
