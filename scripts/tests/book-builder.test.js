const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const vm = require("node:vm");
const babel = require("@babel/core");
const { migrateBookStructure } = require("../../src/lib/book-structure");
const generator = require("../generate-ai-book");

// Load the same ES modules Next uses without starting a server.
const originalLoader = Module._extensions[".js"];
function compile(file) {
  return babel.transformSync(fs.readFileSync(file, "utf8"), {
    presets: [["@babel/preset-env", { targets: { node: "current" } }]],
    babelrc: false, configFile: false,
  }).code;
}
Module._extensions[".js"] = (module, file) => {
  if (file.includes("node_modules")) return originalLoader(module, file);
  module._compile(compile(file), file);
};
const { normalizeBook, getPageGenerationSettings } = require("../../src/components/book-builder/book-data");

const pool = (subdivisions = [], tuplets = [], ornaments = []) => ({ subdivisions, tuplets, ornaments });
const triplet = { actual: 3, normal: 2, type: 8 };

function legacyBook() {
  return { sections: [
    { id: "plain", title: "Sixteenths", subdivisions: ["sixteenths"], ornaments: [], pages: [{ pageNumber: 1, title: "Page 1", lines: [] }] },
    { id: "accent", title: "Sixteenths with accents", subdivisions: ["sixteenths"], ornaments: ["accents"], pages: [{ pageNumber: 2, generationSettings: { minPlayedNotes: 10, maxSameHandStickingRun: 2 }, lines: [] }] },
    { id: "triplets", title: "Triplets", subdivisions: [], tuplets: [triplet], ornaments: ["flams"], pages: [{ pageNumber: 3, lines: [] }] },
  ] };
}

function pageConfig(primary, secondary, ornaments = [], overrides = {}) {
  return generator.createGenerationConfig({}, {
    structureVersion: 2,
    sections: [{ id: "study", title: "Study", primaryRhythms: primary, secondaryRhythms: secondary,
      pages: [{ subsectionId: "study-topic", title: "Topic", generationSettings: { ornaments, ...overrides } }] }],
  }).sections[0].pages[0];
}

function generate(config, count = 50) {
  const seen = new Set();
  return Array.from({ length: count }, (_, index) =>
    generator.createUniqueGeneratedLine(null, config, config.sampleJson, index, seen).score.measures[0].parts[0].voices[0]);
}

test("legacy sections consolidate without losing pages or subsection settings", () => {
  const source = legacyBook();
  const original = JSON.stringify(source);
  const book = normalizeBook(source);
  assert.equal(JSON.stringify(source), original);
  assert.equal(book.sections.length, 2);
  assert.equal(book.pages.length, 3);
  assert.deepEqual(book.pages.map((page) => page.pageNumber), [1, 2, 3]);
  assert.deepEqual(book.pages[1].generationSettings.ornaments, ["accents"]);
  assert.equal(book.pages[1].generationSettings.minPlayedNotes, 10);
  assert.equal(book.pages[1].generationSettings.maxSameHandStickingRun, 2);
  assert.deepEqual(normalizeBook(book), book);
  assert.deepEqual(migrateBookStructure(book), book);
  assert.equal(new Set(book.pages.map((page) => page.subsectionId)).size, 3);
});

test("section rhythm edits apply to all subsections while their ornaments remain independent", () => {
  const book = normalizeBook(legacyBook());
  const section = book.sections[0];
  section.primaryRhythms = pool(["thirtyseconds"]);
  section.secondaryRhythms = pool(["eighths"], [], ["flams"]);
  const updated = normalizeBook(book);
  for (const page of updated.sections[0].pages) {
    const settings = getPageGenerationSettings(page, updated.sections[0]);
    assert.deepEqual(settings.primaryRhythms, section.primaryRhythms);
    assert.deepEqual(settings.secondaryRhythms, section.secondaryRhythms);
  }
  assert.deepEqual(updated.pages[0].generationSettings.ornaments, []);
  assert.deepEqual(updated.pages[1].generationSettings.ornaments, ["accents"]);
});

test("every exercise contains primary rhythms and ornaments; secondary ornaments are optional and scoped", () => {
  const config = pageConfig(pool(["sixteenths"]), pool(["eighths"], [], ["accents"]), ["flams"]);
  const voices = generate(config, 100);
  for (const voice of voices) {
    assert(voice.notes.some((note) => note.notes.length && note.duration === 16 && /f/.test(note.ornaments || "")));
    for (const note of voice.notes) {
      if (/a/.test(note.ornaments || "")) assert.equal(note.duration, 8);
      if (/f/.test(note.ornaments || "")) assert.equal(note.duration, 16);
    }
  }
  assert(voices.some((voice) => voice.notes.some((note) => /a/.test(note.ornaments || ""))));
  assert(voices.some((voice) => !voice.notes.some((note) => /a/.test(note.ornaments || ""))));
});

test("multiple primary subdivisions are all required even with faster secondary rhythms", () => {
  for (const voice of generate(pageConfig(pool(["eighths", "sixteenths"]), pool(["thirtyseconds"])))) {
    assert(voice.notes.some((note) => note.notes.length && note.duration === 8));
    assert(voice.notes.some((note) => note.notes.length && note.duration === 16));
  }
});

test("primary tuplets and secondary regular rhythms keep ornaments in their pools", () => {
  for (const voice of generate(pageConfig(pool([], [triplet]), pool(["sixteenths"], [], ["accents"]), ["diddles"]))) {
    assert(voice.tuplets.length);
    assert(voice.notes.some((note) => /d/.test(note.ornaments || "")));
    voice.notes.forEach((note, index) => {
      const tuplet = voice.tuplets.find((item) => item.start <= index && index < item.end);
      if (/d/.test(note.ornaments || "")) assert(tuplet);
      if (/a/.test(note.ornaments || "")) assert(!tuplet);
    });
  }
});

test("secondary tuplets are not required in every exercise", () => {
  const voices = generate(pageConfig(pool(["sixteenths"]), pool([], [triplet], ["accents"]), ["flams"]), 100);
  assert(voices.some((voice) => voice.tuplets.length));
  assert(voices.some((voice) => !voice.tuplets.length));
});

test("same-ratio tuplets at different note values both remain primary requirements", () => {
  const config = pageConfig(pool([], [triplet, { ...triplet, type: 16 }]), pool());
  for (const voice of generate(config, 30)) {
    const types = voice.tuplets.map((tuplet) => 4 * tuplet.actual / voice.notes.slice(tuplet.start, tuplet.end)
      .reduce((sum, note) => sum + 4 / note.duration * (note.dots ? 1.5 : 1), 0));
    assert(types.includes(8));
    assert(types.includes(16));
  }
});

test("impossible primary combinations fail instead of dropping study material", () => {
  const config = pageConfig(pool([], [{ actual: 5, normal: 4, type: 4 }, triplet]), pool());
  assert.throws(() => generate(config, 1), /cannot all fit/);
});

test("manifest round trip preserves both pools and subsection IDs", () => {
  const book = normalizeBook(legacyBook());
  book.sections[0].secondaryRhythms = pool(["eighths"], [triplet], ["flams"]);
  const saved = generator.createManifest(normalizeBook(book));
  const loaded = normalizeBook(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(loaded.sections[0].secondaryRhythms, book.sections[0].secondaryRhythms);
  assert.deepEqual(loaded.pages.map((page) => page.subsectionId), book.pages.map((page) => page.subsectionId));
  assert.equal(loaded.pages.length, 3);
});

test("API saves and reloads pools, preserves reordered scores, and invalidates changed generation settings", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "truechops-book-test-"));
  try {
    const file = path.resolve(__dirname, "../../pages/api/book-builder.js");
    const localRequire = Module.createRequire(file);
    const api = { exports: {} };
    vm.runInThisContext(Module.wrap(compile(file)))(api.exports,
      (name) => name === "process" ? { ...process, cwd: () => directory } : localRequire(name),
      api, file, path.dirname(file));
    const request = async (method, body = {}) => {
      let status; let payload;
      await api.exports.default({ method, query: { includeScores: "1" }, body }, {
        setHeader() {}, status(code) { status = code; return this; }, json(data) { payload = data; },
      });
      assert.equal(status, 200, payload?.error);
      return payload.book;
    };
    let book = normalizeBook(legacyBook());
    const config = pageConfig(pool(["sixteenths"]), pool());
    const score = generator.createUniqueGeneratedLine(null, config, config.sampleJson, 0, new Set()).score;
    book.pages[0].lines[0].score = score;
    book.pages[0].lines[0].title = "Preserved exercise";
    await request("POST", { book });
    book = await request("GET");
    assert.deepEqual(book.pages[0].lines[0].score, score);
    book.sections[0].pages.reverse();
    book = normalizeBook(book);
    await request("POST", { book: generator.createManifest(book) });
    book = await request("GET");
    assert.equal(book.pages[1].lines[0].title, "Preserved exercise");
    assert.deepEqual(book.pages[1].lines[0].score, score);
    book.sections[0].secondaryRhythms = pool(["eighths"], [], ["flams"]);
    await request("POST", { book });
    book = await request("GET");
    assert.deepEqual(book.sections[0].secondaryRhythms, pool(["eighths"], [], ["flams"]));
    assert.equal(book.pages[1].lines[0].score, null);
  } finally {
    // This directory was created exclusively for the test under the OS temp root.
    assert(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
