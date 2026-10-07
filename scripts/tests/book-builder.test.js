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
const { createStudySections, createSpanStudy, createQuarterNoteStudy, createOffbeatStudies, createTupletCombinationStudies, createNestedStudies, createFinalStudies, SPAN_STUDIES, STUDY_TOPICS, STUDY_FAMILIES } = require("../../src/lib/book-curriculum");
const { getLineStickingSettings, getSpanPrimaryRhythms, getNestedTupletNotation, getNestedTupletVariants, getLineExerciseStep, getLineRandomOrnaments, getLineOffbeatTuplet, getLineOffbeatPair } = require("../../src/lib/book-structure");
const { BOOK_VOLUMES, createBookVolume, getBookVolume } = require("../../src/lib/book-volumes");
const { RHYTHM_INCLUSION_ORDER, getRhythmKey, getRhythmProgressionStep, getProgressionSecondaryPool } = require("../../src/lib/book-rhythm-progression");

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
// Every struck note carries a sticking (r or l).
const hasStickings = (voice) => voice.notes.every((note) => !note.notes.length || /[rl]/.test(note.ornaments || ""));
const triplet = { actual: 3, normal: 2, type: 8 };

function savedCurriculum() {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../data/book-builder/snare-drum-book/book.json"), "utf8"));
}

test("the six volumes have separate identities and Book 6 preserves the saved curriculum", () => {
  const source = savedCurriculum();
  const before = JSON.stringify(source);
  const volumes = BOOK_VOLUMES.map((volume) => createBookVolume(source, volume.number));
  assert.equal(JSON.stringify(source), before);
  assert.equal(new Set(volumes.map((volume) => volume.book)).size, 6);
  const original = volumes[5];
  assert.deepEqual(original.groups, source.groups);
  assert.deepEqual(original.sections.map((section) => ({ ...section, pages: section.pages.map((page) => ({ ...page, lines: [] })) })),
    source.sections.map((section) => ({ ...section, pages: section.pages.map((page) => ({ ...page, lines: [] })) })));
  assert.equal(original.pages.length, source.pages.length);
  assert.throws(() => getBookVolume("../private"), /Unknown book volume/);
});

test("basic volumes progress from quarters through nontuplets; span volumes exclude one-beat studies", () => {
  const source = savedCurriculum();
  for (const number of [4]) {
    const book = createBookVolume(source, number);
    assert(book.sections.every((section) => ["one-quarter", "combinations-one-quarter"].includes(section.groupId)));
    assert.equal(book.sections[0].primaryRhythms.subdivisions[0], "quarters");
    assert.equal(book.sections[1].primaryRhythms.subdivisions[0], "eighths");
    const counts = book.sections.filter((section) => section.groupId === "one-quarter").map((section) =>
      section.primaryRhythms.tuplets[0]?.actual || ({ quarters: 1, eighths: 2, sixteenths: 4, thirtyseconds: 8 })[section.primaryRhythms.subdivisions[0]]);
    assert.deepEqual([...new Set(counts)], [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert(!book.sections.some((section) => /crazy/i.test(section.title)));
  }
  for (const number of [2, 5]) {
    const book = createBookVolume(source, number);
    assert(book.sections.every((section) => section.rhythmSpan.count * 4 / section.rhythmSpan.unit !== 1));
    for (const study of SPAN_STUDIES) {
      for (const section of book.sections.filter((section) => section.groupId === study.groupId)) {
        const previous = source.sections.find((candidate) => candidate.id === section.id);
        const exercises = (pages) => pages.reduce((count, page) => count + 11 * page.pdfSettings.measuresPerLine, 0);
        assert.equal(exercises(section.pages) - exercises(previous.pages), 44);
        assert(section.pages.some((page) => page.generationSettings.playedShareRamp));
      }
    }
  }
  for (const number of [3, 6]) {
    const book = createBookVolume(source, number);
    for (const prefix of ["offbeat", "nested", "random-subdivisions"]) assert(book.groups.some((group) => group.id.startsWith(prefix)));
    assert(book.sections.some((section) => /crazy/i.test(section.title)));
  }
});

test("unornamented volumes clear all ornament sources and generate clean basic, span, offbeat and nested exercises", () => {
  const source = savedCurriculum();
  for (const number of [1, 2, 3]) {
    const book = createBookVolume(source, number);
    const config = generator.createGenerationConfig({}, book);
    for (const section of config.sections) {
      assert.deepEqual(section.secondaryRhythms.ornaments, []);
      for (const page of section.pages) {
        assert.deepEqual(page.ornaments, []);
        assert.equal(page.stickingTail, null);
        assert.deepEqual(page.requiredSameHandStickingRuns, []);
        assert(!page.randomOrnaments);
        assert(!page.ornamentSegments);
        for (const step of page.exerciseSteps || []) {
          assert.deepEqual(step.ornaments, []);
          assert(!step.randomOrnaments);
        }
      }
    }
    const targets = config.sections.filter((section) =>
      ["rhythm-progression-eighths", "two-quarters-quintuplets", "offbeat-5", "nested-one-quarter-5", "random-subdivisions-one-quarter"].includes(section.id));
    for (const section of targets) {
      for (const voice of generate(section.pages[0], 12)) {
        assert(voice.notes.every((note) => !note.ornaments));
      }
    }
  }
});

test("rhythm-only progression follows the requested order, balances exercise counts, and grows by exercise", () => {
  const source = savedCurriculum();
  assert.deepEqual(RHYTHM_INCLUSION_ORDER.map((rhythm) => rhythm.id), [
    "quarters", "eighths", "sixteenths", "triplets", "sextuplets", "thirtyseconds", "quintuplets", "septuplets", "nontuplets",
  ]);
  for (const number of [1, 3]) {
    const book = normalizeBook(createBookVolume(source, number));
    const sections = book.sections.slice(0, 8);
    assert.deepEqual(sections.map((section) => section.id), RHYTHM_INCLUSION_ORDER.slice(1).map((rhythm) => `rhythm-progression-${rhythm.id}`));
    sections.forEach((section, sectionIndex) => {
      assert.equal(section.pages.reduce((count, page) => count + page.lines.length, 0), 132);
      assert.equal(new Set(section.pages.map((page) => page.subsectionId)).size, 3);
      const previous = RHYTHM_INCLUSION_ORDER.slice(0, sectionIndex + 1).map(getRhythmKey);
      const plan = section.pages[0].generationSettings.rhythmProgression;
      assert.deepEqual(plan.preceding, previous);
      if (previous.length <= 3) {
        previous.forEach((key, index) => assert.deepEqual(getRhythmProgressionStep(plan, index * 12 / previous.length).keys, [key]));
      } else {
        assert(getRhythmProgressionStep(plan, 0).keys.length >= 2);
      }
      for (let index = 12; index < 22; index += 1) {
        const step = getRhythmProgressionStep(plan, index);
        assert.deepEqual(step.keys, previous.slice(0, Math.min(previous.length, 2 + index - 12)));
        assert(step.keys.includes(step.requiredKey));
      }
    });
  }
});

test("every progression exercise is unique, unmarked, in 4/4, and contains its main and companion rhythm", () => {
  const config = generator.createGenerationConfig({}, createBookVolume(savedCurriculum(), 1));
  const seen = new Set();
  for (const section of config.sections) {
    let exerciseCount = 0;
    const densities = new Map();
    for (const page of section.pages) {
      for (let index = 0; index < 11 * page.pdfSettings.measuresPerLine; index += 1) {
        const line = generator.createUniqueGeneratedLine(null, page, page.sampleJson, index, seen);
        const voice = line.score.measures[0].parts[0].voices[0];
        const step = getRhythmProgressionStep(page.rhythmProgression, index + page.subsectionLineOffset);
        generator.validatePrimaryRequirements({ ...page,
          secondaryRhythms: getProgressionSecondaryPool(page.secondaryRhythms, step),
          requiredSecondaryKeys: [step.requiredKey],
        }, line.score);
        assert(voice.notes.every((note) => !note.ornaments));
        assert(Math.abs(nestedVoiceQuarters(voice) - 4) < 1e-8);
        exerciseCount += 1;
        const name = page.rhythmProgression.density;
        const counts = densities.get(name) || [];
        counts.push(voice.notes.filter((note) => note.notes.length).length);
        densities.set(name, counts);
      }
    }
    assert.equal(exerciseCount, 132);
    const mean = (name) => densities.get(name).reduce((a, b) => a + b) / densities.get(name).length;
    assert(mean("dense") > mean("sparse"), section.title);
  }
  assert.equal(seen.size, 1056);
});

test("volume CLI validates selections and separate output destinations before generating", () => {
  const { parseArgs } = require("../build-book-pdf");
  assert.equal(parseArgs([]).volume, "all");
  assert.equal(parseArgs(["--volume=6", "--render-only"]).renderOnly, true);
  assert.throws(() => parseArgs(["--volume", "7"]), /Unknown book volume/);
  assert.throws(() => parseArgs(["--output", "same.pdf"]), /output-dir/);
  assert.throws(() => parseArgs(["--page", "0"]), /positive integer/);
  assert.throws(() => parseArgs(["--volume"]), /Missing value/);
});

test("volume QR tokens cannot collide with the original or each other", () => {
  const { getBookPageQrPath, findBookQrPage } = require("../../src/lib/book-qr");
  const source = savedCurriculum();
  const books = [source, ...BOOK_VOLUMES.map((volume) => normalizeBook(createBookVolume(source, volume.number)))];
  const paths = books.map((book) => getBookPageQrPath(1, book));
  assert.equal(new Set(paths).size, 7);
  books.forEach((book, index) => {
    const token = paths[index].split("/").at(-1);
    assert.equal(findBookQrPage(book, token).page.pageNumber, 1);
    assert.equal(findBookQrPage(books[(index + 1) % books.length], token), null);
  });
});

test("stored volume QR lookup resolves inline scores without requiring individual exercise files", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "truechops-volume-test-"));
  try {
    const file = path.resolve(__dirname, "../../src/lib/book-builder-storage.js");
    const localRequire = Module.createRequire(file);
    const storage = { exports: {} };
    vm.runInThisContext(Module.wrap(compile(file)))(storage.exports,
      (name) => name === "process" ? { ...process, cwd: () => directory } : localRequire(name),
      storage, file, path.dirname(file));
    const { getBookPageQrPath } = require("../../src/lib/book-qr");
    const config = pageConfig(pool(["sixteenths"]), pool());
    const score = generator.createUniqueGeneratedLine(null, config, config.sampleJson, 0, new Set()).score;
    for (const volume of BOOK_VOLUMES) {
      const book = normalizeBook({ ...legacyBook(), book: `test-volume-${volume.number}`, slug: volume.slug });
      book.pages[0].lines[0].score = score;
      const root = path.join(directory, "data", "book-builder", volume.slug);
      fs.mkdirSync(root, { recursive: true });
      const { pages, ...stored } = book;
      fs.writeFileSync(path.join(root, "book.json"), JSON.stringify(stored));
      fs.writeFileSync(path.join(root, "qr-index.json"), JSON.stringify({
        book: book.book, edition: book.edition, contentVersion: book.contentVersion,
        pages: pages.map(({ pageNumber, title }) => ({ pageNumber, title })),
      }));
      const token = getBookPageQrPath(1, book).split("/").at(-1);
      const reference = await storage.exports.findStoredBookQrPage(token);
      assert.equal(reference.pageRef.book, book.book);
      assert(!reference.page);
      const resolved = await storage.exports.findStoredBookQrPage(token, { includeScores: true });
      assert.equal(resolved.pageRef.book, book.book);
      assert.deepEqual(resolved.page.lines[0].score, score);
      const manifest = await storage.exports.loadBook({ volume: volume.number, pageNumbers: [] });
      assert.equal(manifest.pages[0].lines[0].score, null);
    }
    assert.equal(await storage.exports.findStoredBookQrPage("unknown-token"), null);
  } finally {
    assert(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

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

test("subsections span their page count and share settings across pages", () => {
  const book = normalizeBook(legacyBook());
  book.sections[0].pages[0].subsectionPageCount = 3;
  const expanded = normalizeBook(book);
  assert.deepEqual(expanded.pages.map((page) => page.pageNumber), [1, 2, 3, 4, 5]);
  const spanned = expanded.sections[0].pages.slice(0, 3);
  assert.deepEqual(spanned.map((page) => page.subsectionPageNumber), [1, 2, 3]);
  assert.equal(new Set(spanned.map((page) => page.subsectionId)).size, 1);
  assert.ok(spanned.every((page) => page.title === spanned[0].title && page.lines.length === spanned[0].lines.length));
  assert.equal(expanded.sections[0].pages[3].subsectionNumber, 2);
  const entry = expanded.tableOfContents.find((item) => item.subsectionId === spanned[0].subsectionId);
  assert.deepEqual([entry.pageStart, entry.pageEnd], [1, 3]);

  const loaded = normalizeBook(JSON.parse(JSON.stringify(generator.createManifest(expanded))));
  assert.deepEqual(loaded.pages.map((page) => page.subsectionPageCount), [3, 3, 3, 1, 1]);
  assert.deepEqual(normalizeBook(loaded), loaded);

  loaded.sections[0].pages[0].subsectionPageCount = 1;
  assert.equal(normalizeBook(loaded).pages.length, 3);

  const configs = generator.createGenerationConfig({}, expanded).sections[0].pages;
  assert.deepEqual(configs.map((config) => config.finalSubsectionPage), [false, false, true, true]);
});

test("rhythms over two beats use standard tuplet notation", () => {
  const span = { count: 2, unit: 4 };
  const over = (id) => getSpanPrimaryRhythms(pool([], STUDY_FAMILIES.find((family) => family.id === id).tuplets), span);
  assert.deepEqual(over("eighth-triplets").tuplets, [{ actual: 3, normal: 2, type: 4 }]);
  assert.deepEqual(over("quintuplets").tuplets, [{ actual: 5, normal: 4, type: 8 }]);
  assert.deepEqual(over("septuplets").tuplets, [{ actual: 7, normal: 4, type: 8 }]);
  assert.deepEqual(over("nine-eight-thirtyseconds").tuplets, [{ actual: 9, normal: 8, type: 16 }]);
  assert.deepEqual(getSpanPrimaryRhythms(pool(["sixteenths"]), span), pool(["eighths"]));
});

test("span pages cycle ornament topics, grow the secondary pool, and start tuplets on beats", () => {
  const pdf = { measuresPerLine: 2, lineSpacing: 130, noteSize: 100 };
  const studies = SPAN_STUDIES.map((study) => createSpanStudy(study, pdf));
  const config = generator.createGenerationConfig({}, { structureVersion: 3,
    groups: studies.map((study) => study.group),
    sections: studies.flatMap((study) => study.sections),
  });
  assert.equal(config.sections.length, SPAN_STUDIES.reduce((sum, study) => sum + study.familyIds.length, 0));
  for (const section of config.sections) {
    const page = section.pages[0];
    const voices = generate(page, 22);
    const primary = getSpanPrimaryRhythms(page.primaryRhythms, page.rhythmSpan).tuplets[0];
    voices.forEach((voice, index) => {
      const groups = voice.tuplets.filter((tuplet) => tuplet.actual === primary.actual && tuplet.normal === primary.normal);
      // The secondary pool grows by row: 3s and 6s from row 1, 5s from row 4, 7s from row 8, 9s from row 10.
      const row = Math.floor(index / 2) + 1;
      const joinRow = { 3: 1, 6: 1, 5: 4, 7: 8, 9: 10 };
      voice.tuplets.filter((tuplet) => !groups.includes(tuplet)).forEach((tuplet) => {
        assert(joinRow[tuplet.actual] <= row, `${section.title} exercise ${index + 1} uses ${tuplet.actual}s before row ${joinRow[tuplet.actual]}`);
      });
      if (row < 3) {
        assert(voice.notes.every((note, noteIndex) => note.duration !== 32 ||
          voice.tuplets.some((tuplet) => noteIndex >= tuplet.start && noteIndex < tuplet.end)),
          `${section.title} exercise ${index + 1} uses 32nds before row 3`);
      }
      assert(groups.length, `${section.title} exercise ${index + 1} lacks the primary rhythm`);
      const value = (note) => 32 / note.duration * (note.dots ? 1.5 : 1);
      const tupletSlots = (tuplet) => voice.notes.slice(tuplet.start, tuplet.end)
        .reduce((sum, note) => sum + value(note), 0) * tuplet.normal / tuplet.actual;
      let slots = 0;
      voice.notes.forEach((note, noteIndex) => {
        const tuplet = voice.tuplets.find((candidate) => noteIndex >= candidate.start && noteIndex < candidate.end);
        if (tuplet?.start === noteIndex && Math.round(tupletSlots(tuplet)) % 8 === 0) {
          assert.equal(Math.round(slots * 1000) % 8000, 0, `${section.title} exercise ${index + 1} starts a tuplet off the beat`);
        }
        slots += tuplet ? value(note) * tuplet.normal / tuplet.actual : value(note);
        // Diddles and cheese never sit on quarters or on eighths outside a tuplet.
        if (/[dc]/.test(note.ornaments || "")) assert(note.duration > 8 || (note.duration === 8 && tuplet));
      });
    });
    const required = (index) => page.ornamentSegments.flatMap((segment) => Array(segment.count).fill(segment.ornaments))[index];
    // Past the one-beat pages every exercise has stickings: accents with stickings open the page.
    assert.deepEqual(required(0), ["stickings", "accents"]);
    assert.deepEqual(required(6), ["stickings", "accents"]);
    assert.deepEqual(required(7), ["stickings", "accents", "diddles"]);
    assert.deepEqual(required(21), ["stickings", "accents", "flams", "diddles", "cheese"]);
    voices.forEach((voice, index) => assert(hasStickings(voice), `${section.title} exercise ${index + 1} lacks stickings`));
  }
});

test("the exercise generator builds fresh measures from a configuration or a book page", () => {
  const { generateExerciseMeasures } = require("../../src/lib/exercise-generator");
  const { DEFAULT_EXERCISE_CONFIG, exerciseConfigFromBookPage, normalizeExerciseConfig } = require("../../src/lib/exercise-config");
  const first = generateExerciseMeasures(DEFAULT_EXERCISE_CONFIG, 16);
  assert.equal(first.measures.length, 16);
  assert.equal(generateExerciseMeasures(DEFAULT_EXERCISE_CONFIG, 99).measures.length, 16);
  const second = generateExerciseMeasures(DEFAULT_EXERCISE_CONFIG, 16);
  assert.notDeepEqual(first.measures, second.measures);

  const book = normalizeBook({ structureVersion: 3,
    groups: [{ id: "two", rhythmSpan: { count: 2, unit: 4 } }],
    sections: createSpanStudy(SPAN_STUDIES[0], { measuresPerLine: 2, lineSpacing: 130, noteSize: 100 }).sections.slice(0, 1),
  });
  const config = exerciseConfigFromBookPage(book.pages[0], { page: 1 });
  assert.deepEqual(config.rhythmSpan, { count: 2, unit: 4 });
  assert.equal(config.playEveryNote, true);
  assert.deepEqual(config.ornaments, ["stickings", "accents", "flams", "diddles", "cheese"]);
  for (const measure of generateExerciseMeasures(config, 4).measures) {
    const voice = measure.parts[0].voices[0];
    assert(voice.tuplets.some((tuplet) => tuplet.actual === 3 && tuplet.normal === 2));
    assert(voice.notes.every((note) => note.notes.length));
  }
  assert.equal(normalizeExerciseConfig({ name: "", subdivision: "nope" }).subdivision, "sixteenths");
});

test("tuplet combinations keep the section's tuplet in every exercise and grow the secondary pool", () => {
  const { groups, sections } = createTupletCombinationStudies({ measuresPerLine: 2, lineSpacing: 130, noteSize: 100 });
  assert.equal(sections.length, 7 + SPAN_STUDIES.reduce((sum, study) => sum + study.familyIds.length, 0));
  const config = generator.createGenerationConfig({}, { structureVersion: 3, groups, sections });
  const triplets = config.sections[0];
  assert.equal(triplets.title, "Triplets");
  const seen = new Set();
  const tupletKinds = triplets.pages.flatMap((page) => Array.from({ length: 22 }, (_, index) =>
    generator.createUniqueGeneratedLine(null, page, page.sampleJson, index, seen).score.measures[0].parts[0].voices[0]))
    .map((voice, index) => {
      assert(voice.tuplets.some((tuplet) => tuplet.actual === 3 && tuplet.normal === 2), `exercise ${index + 1} lacks triplets`);
      assert(hasStickings(voice), `exercise ${index + 1} lacks stickings`);
      return voice.tuplets.map((tuplet) => tuplet.actual);
    });
  // Sextuplets join the pool at row 4; nontuplets only near the end.
  assert(tupletKinds.slice(0, 6).every((kinds) => !kinds.includes(6) && !kinds.includes(9)));
  assert(tupletKinds.slice(36).some((kinds) => kinds.includes(9)));
});

test("tuplet combinations require the newest secondary rhythm in each exercise", () => {
  const { groups, sections } = createTupletCombinationStudies({ measuresPerLine: 2, lineSpacing: 130, noteSize: 100 });
  const config = generator.createGenerationConfig({}, { structureVersion: 3, groups, sections: sections.slice(0, 1) });
  const page = config.sections[0].pages[0];
  const seen = new Set();
  // Triplets page: sextuplets join at row 4 and stay newest until 32nds join at row 8.
  for (let index = 6; index < 14; index += 1) {
    const voice = generator.createUniqueGeneratedLine(null, page, page.sampleJson, index, seen).score.measures[0].parts[0].voices[0];
    assert(voice.tuplets.some((tuplet) => tuplet.actual === 6), `exercise ${index + 1} lacks sextuplets`);
  }
});

test("the final section keeps at least one grouping of its category in every exercise", () => {
  const { groups, sections } = createFinalStudies({ measuresPerLine: 2, lineSpacing: 130, noteSize: 100 });
  assert.equal(sections.length, 14);
  assert(sections.every((section) => section.pages.length === 3));
  const twoQuarters = sections.find((section) => section.title === "Over two quarter notes");
  const config = generator.createGenerationConfig({}, { structureVersion: 3, groups, sections: [twoQuarters] });
  const seen = new Set();
  config.sections[0].pages.forEach((page) => {
    for (let index = 0; index < 22; index += 1) {
      const voice = generator.createUniqueGeneratedLine(null, page, page.sampleJson, index, seen).score.measures[0].parts[0].voices[0];
      assert(voice.tuplets.some((tuplet) => [3, 5, 7, 9].includes(tuplet.actual) &&
        voice.notes.slice(tuplet.start, tuplet.end).reduce((sum, note) => sum + 4 / note.duration * (note.dots ? 1.5 : 1), 0) *
          tuplet.normal / tuplet.actual > 1.99), `exercise lacks a two-quarter grouping`);
      assert(hasStickings(voice), "exercise lacks stickings");
      const chosen = getLineRandomOrnaments(page, index + page.subsectionLineOffset, page.subsectionId);
      assert(chosen.includes("stickings") && chosen.length >= 2 && chosen.length <= 4, chosen.join());
    }
  });
});

// Quarter-note length of a voice, with every containing tuplet's ratio applied.
function nestedVoiceQuarters(voice) {
  return voice.notes.reduce((sum, note, index) => sum + 4 / note.duration * (note.dots ? 1.5 : 1) *
    voice.tuplets.filter((tuplet) => index >= tuplet.start && index < tuplet.end)
      .reduce((ratio, tuplet) => ratio * tuplet.normal / tuplet.actual, 1), 0);
}

function nestedPairs(voice) {
  return voice.tuplets.flatMap((inner) => voice.tuplets
    .filter((outer) => outer !== inner && outer.start <= inner.start && inner.end <= outer.end && outer.end - outer.start > inner.end - inner.start)
    .map((outer) => ({ outer, inner })));
}

test("nested tuplet variants go through 3-11 over two host notes, then the smaller spans", () => {
  const key = (variants) => variants.map((variant) => `${variant.actual}/${variant.hostNotes}`);
  assert.deepEqual(key(getNestedTupletVariants({ actual: 3, normal: 2, type: 8 })), ["3/2", "5/2", "7/2", "9/2", "11/2"]);
  assert.deepEqual(key(getNestedTupletVariants({ actual: 5, normal: 4, type: 8 })), ["3/2", "5/2", "7/2", "9/2", "11/2", "2/3", "4/3", "3/4", "5/4"]);
  // 9 and 11 over two quintuplet sixteenths would need 64ths.
  assert.deepEqual(key(getNestedTupletVariants({ actual: 5, normal: 4, type: 16 })), ["3/2", "5/2", "7/2", "2/3", "4/3", "3/4", "5/4"]);
  assert(!key(getNestedTupletVariants({ actual: 9, normal: 8, type: 32 })).includes("9/2"));
  assert(key(getNestedTupletVariants({ actual: 9, normal: 8, type: 32 })).includes("11/8"));
  // Five in the time of two triplet eighths is written as 5:4 sixteenths.
  assert.deepEqual(getNestedTupletNotation({ actual: 5, hostNotes: 2 }, { actual: 3, normal: 2, type: 8 }), { actual: 5, normal: 4, type: 16 });
  assert.deepEqual(getNestedTupletNotation({ actual: 4, hostNotes: 5 }, { actual: 5, normal: 4, type: 8 }), { actual: 4, normal: 5, type: 8 });
});

test("nested tuplet pages nest each planned variant inside the primary group and keep 4/4", () => {
  const { groups, sections } = createNestedStudies({ measuresPerLine: 2, lineSpacing: 130, noteSize: 100 });
  assert.equal(groups.length, 4);
  assert.equal(sections.length, 5 + SPAN_STUDIES.filter((study) => ["two-quarters", "three-quarters", "four-quarters"].includes(study.groupId))
    .reduce((sum, study) => sum + study.familyIds.length, 0));
  // Enough pages for every variant to take all four steps: at least three per host.
  sections.forEach((section) => {
    const host = getSpanPrimaryRhythms(section.primaryRhythms, section.rhythmSpan).tuplets[0];
    const variants = getNestedTupletVariants(host).length;
    assert.equal(section.pages.length, Math.max(3, Math.ceil(variants * 4 / 22)), section.id);
    assert(section.pages[0].generationSettings.nestedTupletPlan.every((variant) => variant.count >= 4), section.id);
  });
  assert.equal(sections.find((section) => section.id === "nested-four-quarters-9").pages.length, 4);
  assert.equal(sections.reduce((sum, section) => sum + section.pages.length, 0), 49);
  const quintuplets = sections.find((section) => section.id === "nested-two-quarters-5");
  const config = generator.createGenerationConfig({}, { structureVersion: 3, groups, sections: [quintuplets] });
  const host = getSpanPrimaryRhythms(quintuplets.primaryRhythms, quintuplets.rhythmSpan).tuplets[0];
  const plan = quintuplets.pages[0].generationSettings.nestedTupletPlan;
  assert.equal(plan.reduce((sum, variant) => sum + variant.count, 0), 66);
  const seen = new Set();
  let position = 0;
  for (const [pageIndex, page] of config.sections[0].pages.entries()) {
    for (let index = 0; index < 22; index += 1) {
      const exercise = pageIndex * 22 + index;
      let end = 0;
      const variant = plan.find((candidate) => (end += candidate.count) > exercise);
      const notation = getNestedTupletNotation(variant, host);
      const voice = generator.createUniqueGeneratedLine(null, page, page.sampleJson, index, seen).score.measures[0].parts[0].voices[0];
      assert(Math.abs(nestedVoiceQuarters(voice) - 4) < 1e-9, `exercise ${exercise + 1} is not 4/4`);
      // Each variant steps through: every note with stickings, with accents, sparse with accents, with ornaments.
      const stage = getLineExerciseStep(page, exercise);
      const ornaments = voice.notes.flatMap((note) => [...(note.ornaments || "")].filter((char) => "afdc".includes(char)));
      assert(hasStickings(voice), `exercise ${exercise + 1} lacks stickings`);
      assert.equal(voice.notes.some((note) => !note.notes.length), !stage.playEveryNote, `exercise ${exercise + 1} density (${stage.title})`);
      if (stage.title === "Every note, stickings") assert.equal(ornaments.length, 0);
      if (stage.ornaments.join() === "stickings,accents") assert(ornaments.length && ornaments.every((char) => char === "a"), `exercise ${exercise + 1} accents`);
      if (stage.randomOrnaments) assert(ornaments.length, `exercise ${exercise + 1} shows no ornaments`);
      assert(nestedPairs(voice).some(({ outer, inner }) => outer.actual === host.actual && outer.normal === host.normal &&
        inner.actual === notation.actual && inner.normal === notation.normal),
        `exercise ${exercise + 1} lacks ${variant.actual} over ${variant.hostNotes}`);
      position += 1;
    }
  }
  assert(position > 10);
});

test("the website generator nests tuplets on request and the composer records nested groups", () => {
  const { generateExerciseMeasures } = require("../../src/lib/exercise-generator");
  const { normalizeExerciseConfig, getConfigNestedVariants } = require("../../src/lib/exercise-config");
  assert.equal(normalizeExerciseConfig({ subdivision: "sixteenths", nestedTuplets: "cycle" }).nestedTuplets, null);
  const config = normalizeExerciseConfig({ subdivision: "quintuplets", rhythmSpan: { count: 2, unit: 4 }, nestedTuplets: "cycle", ornaments: ["stickings"] });
  assert.equal(config.nestedTuplets, "cycle");
  assert.equal(getConfigNestedVariants(config).length, 9);
  for (const measure of generateExerciseMeasures(config, 4).measures) {
    const voice = measure.parts[0].voices[0];
    assert(nestedPairs(voice).length, "generated measure lacks a nested tuplet");
    assert(Math.abs(nestedVoiceQuarters(voice) - 4) < 1e-9);
  }
  // With steps, each nested tuplet takes four measures: plain, accents, sparse accents, ornaments.
  const stepped = normalizeExerciseConfig({ ...config, steps: true });
  // Configurations saved before off-beat starts called this nestedSteps.
  const { steps: _steps, ...legacy } = config;
  assert.equal(normalizeExerciseConfig({ ...legacy, nestedSteps: true }).steps, true);
  const ornamentChars = (voice) => voice.notes.flatMap((note) => [...(note.ornaments || "")].filter((char) => "afdc".includes(char)));
  const rests = (voice) => voice.notes.some((note) => !note.notes.length);
  generateExerciseMeasures(stepped, 8).measures.map((measure) => measure.parts[0].voices[0]).forEach((voice, index) => {
    const step = index % 4;
    assert.equal(rests(voice), step === 2, `measure ${index + 1} density`);
    if (step === 0) assert.equal(ornamentChars(voice).length, 0);
    if (step === 1 || step === 2) assert(ornamentChars(voice).length && ornamentChars(voice).every((char) => char === "a"));
    if (step === 3) assert(ornamentChars(voice).length);
  });
  // Measures added one at a time continue the plan: start 4 is the second nested tuplet's first step.
  const second = generateExerciseMeasures(stepped, 1, 4).measures[0].parts[0].voices[0];
  assert.equal(ornamentChars(second).length, 0);
  assert(nestedPairs(second).some(({ inner }) => inner.actual === 5));
  const fixed = normalizeExerciseConfig({ ...config, nestedTuplets: { actual: 7, hostNotes: 2 } });
  assert.deepEqual(fixed.nestedTuplets, { actual: 7, hostNotes: 2 });
  assert.equal(normalizeExerciseConfig({ ...config, nestedTuplets: { actual: 4, hostNotes: 2 } }).nestedTuplets, null);

  // Composer: a 32nd triplet on a quintuplet note nests inside the quintuplet.
  const { modifyNote } = require("../../src/services/score-service");
  const note = (duration) => ({ notes: ["C5"], duration, velocity: 0.5 });
  const state = {
    score: { parts: { snare: { enabled: true } }, measures: [{ timeSig: { num: 4, type: 4 }, parts: [{ instrument: "snare", voices: [{
      notes: [note(16), note(16), note(16), note(16), note(16), note(4), note(4), note(4)],
      tuplets: [{ start: 0, end: 5, actual: 5, normal: 4 }],
    }] }] }] },
    voices: { snare: {} },
    dotSelected: false,
    tuplet: { selected: true, actual: 3, normal: 2, type: 32 },
  };
  modifyNote(state, 2, false, { measureIndex: 0, partIndex: 0, voiceIndex: 0, noteIndex: 1, instrument: "snare" });
  const voice = state.score.measures[0].parts[0].voices[0];
  assert(nestedPairs(voice).some(({ outer, inner }) => outer.actual === 5 && inner.actual === 3));
  assert(Math.abs(nestedVoiceQuarters(voice) - 4) < 1e-9);
});

// A played quarter note (or longer) outside any tuplet.
function hasPlainQuarterNotes(voice) {
  return voice.notes.some((note, index) => note.notes.length && Number(note.duration) <= 4 &&
    !voice.tuplets.some((tuplet) => index >= tuplet.start && index < tuplet.end));
}

test("quarter notes have one short section with stickings, accents, and flams, and appear nowhere else", () => {
  const pdf = { measuresPerLine: 2, lineSpacing: 130, noteSize: 100 };
  const quarters = createQuarterNoteStudy(pdf);
  assert.deepEqual(quarters.pages.map((page) => page.generationSettings.ornaments), [
    ["stickings"], ["stickings", "accents"], ["stickings", "flams"], ["stickings", "accents", "flams"],
  ]);
  const spans = createSpanStudy(SPAN_STUDIES[0], pdf).sections.slice(0, 1);
  const config = generator.createGenerationConfig({}, { structureVersion: 3,
    groups: [{ id: "one-quarter", rhythmSpan: { count: 1, unit: 4 } }, { id: "two-quarters", rhythmSpan: { count: 2, unit: 4 } }],
    sections: [quarters, ...createStudySections(pdf).slice(0, 2), ...spans] });
  const seen = new Set();
  for (const section of config.sections) {
    for (const page of section.pages) {
      for (let index = 0; index < 22; index += 1) {
        const voice = generator.createUniqueGeneratedLine(null, page, page.sampleJson, index, seen).score.measures[0].parts[0].voices[0];
        if (section.id === "quarter-notes") {
          assert(voice.notes.every((note) => !note.notes.length || Number(note.duration) === 4), "only quarter notes and rests");
          assert(voice.notes.every((note) => !/[dc]/.test(note.ornaments || "")), "no diddles or cheese");
          assert(hasStickings(voice));
        } else {
          assert(!hasPlainQuarterNotes(voice), `${section.title} has a quarter note`);
        }
      }
    }
  }
});

// Start of each note in quarter notes, with every containing tuplet's ratio.
function noteStarts(voice) {
  const starts = [];
  voice.notes.reduce((position, note, index) => {
    starts[index] = position;
    return position + 4 / note.duration * (note.dots ? 1.5 : 1) *
      voice.tuplets.filter((tuplet) => index >= tuplet.start && index < tuplet.end).reduce((ratio, tuplet) => ratio * tuplet.normal / tuplet.actual, 1);
  }, 0);
  return starts;
}

test("off-beat tuplets start on the e, +, and a, stepping through the ornaments, then mix in pairs", () => {
  const { groups, sections } = createOffbeatStudies({ measuresPerLine: 2, lineSpacing: 130, noteSize: 100 });
  assert.equal(sections.length, 6);
  assert(sections.every((section) => section.pages.length === 2 && section.pages[0].generationSettings.ornamentDensity === 130));
  assert.deepEqual(sections[0].pages[0].generationSettings.offbeatTupletPlan.map((run) => [run.offset, run.count]), [[1, 15], [2, 15], [3, 14]]);
  assert.deepEqual(sections[0].pages[0].generationSettings.exerciseSteps.map((step) => step.ornaments.filter((id) => id !== "stickings").join("+")),
    ["", "accents", "accents+diddles", "accents+flams", "accents+diddles+flams", "accents+flams+diddles+cheese"]);
  const settings = sections[0].pages[0].generationSettings;
  let runStart = 0;
  for (const run of settings.offbeatTupletPlan) {
    const steps = Array.from({ length: run.count }, (_, index) => getLineExerciseStep(settings, runStart + index).title);
    assert.deepEqual([...new Set(steps)], settings.exerciseSteps.map((step) => step.title));
    assert.equal(steps[0], "No ornaments");
    runStart += run.count;
  }
  const CHARS = { accents: "a", flams: "f", diddles: "d", cheese: "c" };
  const mixed = sections.find((section) => section.id === "offbeat-mixed");
  const config = generator.createGenerationConfig({}, { structureVersion: 3, groups, sections: [sections[0], sections[4], mixed] });
  for (const section of config.sections) {
    const seen = new Set();
    let fullGroups = 0;
    let groupCount = 0;
    let ornamentedTotal = 0;
    let ornamentedGroupCount = 0;
    let diddleSteps = 0;
    let diddlePairs = 0;
    const featured = {};
    section.pages.forEach((page, pageIndex) => {
      for (let index = 0; index < 22; index += 1) {
        const exercise = pageIndex * 22 + index;
        const voice = generator.createUniqueGeneratedLine(null, page, page.sampleJson, index, seen).score.measures[0].parts[0].voices[0];
        const starts = noteStarts(voice);
        const where = `${section.title} exercise ${exercise + 1}`;
        const sixteenths = voice.tuplets.map((tuplet) => starts[tuplet.start] * 4 % 4);
        assert(sixteenths.every((offset) => Math.abs(offset - Math.round(offset)) < 1e-9 && Math.round(offset) % 4 !== 0), `${where}: a tuplet on the beat`);
        const single = getLineOffbeatTuplet(page, exercise);
        if (single) assert(sixteenths.every((offset) => Math.round(offset) === single.offset), `${where}: starts off its "e", "+", or "a"`);
        else {
          // Two different tuplets, every pair in turn.
          const pair = getLineOffbeatPair({ ...page, primaryRhythms: section.primaryRhythms }, exercise);
          assert.deepEqual(voice.tuplets.map((tuplet) => tuplet.actual).sort((left, right) => left - right), pair.map((tuplet) => tuplet.actual), where);
        }
        assert(Math.abs(nestedVoiceQuarters(voice) - 4) < 1e-9);
        assert(hasStickings(voice));
        assert(voice.notes.some((note) => !note.notes.length), `${where}: sparse notes around the tuplet`);
        assert(!hasPlainQuarterNotes(voice), `${where}: quarter notes appear only on the quarter-note pages`);
        const step = getLineExerciseStep(page, exercise);
        const stepRudiments = step.ornaments.filter((id) => ["flams", "diddles", "cheese"].includes(id));
        voice.tuplets.forEach((tuplet) => {
          groupCount += 1;
          const indexes = Array.from({ length: tuplet.end - tuplet.start }, (_, offset) => tuplet.start + offset)
            .filter((index) => voice.notes[index].notes.length);
          const played = indexes.map((index) => voice.notes[index]);
          if (played.length === tuplet.actual) fullGroups += 1;
          // The moving tuplet carries a few ornaments, not one on every note.
          const ornamented = played.filter((note) => /[afdc]/.test(note.ornaments || "")).length;
          if (step.ornaments.includes("accents")) {
            ornamentedGroupCount += 1;
            assert(ornamented >= 1 && ornamented <= Math.min(4, played.length), `${where}: ${ornamented} ornamented notes in a ${tuplet.actual}-note group`);
          } else {
            assert.equal(ornamented, 0, `${where}: the plain step has ornaments`);
          }
          ornamentedTotal += ornamented;
          // Triplets carry the step's flam, diddle, or cheese.
          if (section.title === "Triplets" && stepRudiments.length === 1 && played.length === tuplet.actual) {
            assert(played.some((note) => (note.ornaments || "").includes(CHARS[stepRudiments[0]])), `${where}: the triplet lacks the step's ${stepRudiments[0]}`);
          }
          if (stepRudiments.join() === "diddles" && tuplet.actual === 3 && played.length === 3) {
            diddleSteps += 1;
            if (indexes.some((index, position) => indexes[position + 1] === index + 1 &&
              /d/.test(voice.notes[index].ornaments || "") && /d/.test(voice.notes[index + 1].ornaments || ""))) diddlePairs += 1;
          }
        });
        // Diddles in a row alternate hands (RRLL).
        voice.notes.forEach((note, index) => {
          const next = voice.notes[index + 1];
          if (note.notes.length && next?.notes.length && /d/.test(note.ornaments || "") && /d/.test(next.ornaments || "")) {
            assert.notEqual((note.ornaments.match(/[rl]/) || [])[0], (next.ornaments.match(/[rl]/) || [])[0], `${where}: diddles in a row on one hand`);
          }
        });
        // Each step shows exactly its ornaments (stickings throughout).
        const shown = new Set(voice.notes.flatMap((note) => [...(note.notes.length ? note.ornaments || "" : "")]).filter((char) => "afdc".includes(char)));
        assert.deepEqual([...shown].sort(), step.ornaments.filter((id) => id !== "stickings").map((id) => CHARS[id]).sort(), `${where} (${step.title})`);
        // A step that adds one flam, diddle, or cheese features it.
        const rudiments = step.ornaments.filter((id) => ["flams", "diddles", "cheese"].includes(id));
        if (rudiments.length === 1) {
          const char = CHARS[rudiments[0]];
          const entry = (featured[step.title] ||= { exercises: 0, count: 0 });
          entry.exercises += 1;
          entry.count += voice.notes.filter((note) => note.notes.length && (note.ornaments || "").includes(char)).length;
        }
      }
    });
    Object.entries(featured).forEach(([title, { exercises, count }]) =>
      assert(count / exercises >= 2.5, `${section.title} ${title}: ${count / exercises} of the step's ornament per exercise`));
    assert(ornamentedTotal / ornamentedGroupCount >= 1.3, `${section.title}: ${ornamentedTotal / ornamentedGroupCount} ornamented notes per ornamented group`);
    // Diddle steps often put a pair of diddles in a row on the triplet.
    if (diddleSteps) assert(diddlePairs / diddleSteps >= 0.4, `${section.title}: ${diddlePairs} of ${diddleSteps} triplets have diddles in a row`);
    // About two in three tuplets are played in full.
    assert(fullGroups / groupCount > 0.5 && fullGroups / groupCount < 0.85, `${section.title}: ${fullGroups} of ${groupCount} groups in full`);
  }
  // The website tool: e, +, and a in turn, six measures each with steps.
  const { generateExerciseMeasures } = require("../../src/lib/exercise-generator");
  const { normalizeExerciseConfig } = require("../../src/lib/exercise-config");
  const tool = normalizeExerciseConfig({ subdivision: "quintuplets", offbeat: "cycle", steps: true });
  assert.equal(normalizeExerciseConfig({ subdivision: "sixteenths", offbeat: 2 }).offbeat, null);
  generateExerciseMeasures(tool, 18).measures.forEach((measure, index) => {
    const voice = measure.parts[0].voices[0];
    const starts = noteStarts(voice);
    const quintuplet = voice.tuplets.find((tuplet) => tuplet.actual === 5);
    assert.equal(Math.round(starts[quintuplet.start] * 4 % 4), Math.floor(index / 6) + 1);
    const shown = new Set(voice.notes.flatMap((note) => [...(note.notes.length ? note.ornaments || "" : "")]).filter((char) => "afdc".includes(char)));
    assert.deepEqual([...shown].sort(), settings.exerciseSteps[index % 6].ornaments.filter((id) => id !== "stickings").map((id) => CHARS[id]).sort());
  });
});

test("all seven families follow the exact eight sparse / seven full topic order", () => {
  const sections = createStudySections("quarter", { measuresPerLine: 2, lineSpacing: 130, noteSize: 100 });
  assert.equal(sections.length, 14);
  STUDY_FAMILIES.forEach((family, index) => {
    const [sparse, full] = sections.slice(index * 2, index * 2 + 2);
    assert.equal(sparse.studyFamily, family.id);
    assert.equal(full.studyFamily, family.id);
    assert.deepEqual(sparse.pages.map((page) => page.title), STUDY_TOPICS.map((topic) => topic.title));
    assert.deepEqual(full.pages.map((page) => page.title), STUDY_TOPICS.slice(1).map((topic) => topic.title));
    for (const page of full.pages) {
      assert.equal(page.generationSettings.playEveryNote, true);
      assert.equal(Boolean(page.generationSettings.stickingTail), page.generationSettings.ornaments.includes("stickings"));
    }
  });
});

function repeatingRuns(notes) {
  const hands = notes.map((note) => (note.ornaments || "").match(/[rl]/)?.[0]);
  const runs = [];
  for (let index = 0; index < hands.length; index += 1) {
    if (!hands[index] || hands[(index + hands.length - 1) % hands.length] === hands[index]) continue;
    let length = 1;
    while (length < hands.length && hands[(index + length) % hands.length] === hands[index]) length += 1;
    runs.push(length);
  }
  return runs.length ? runs : [hands.length];
}

test("the final five STAFF rows use 3-or-4 runs in every full sticking page", () => {
  const config = generator.createGenerationConfig({}, { structureVersion: 3,
    sections: createStudySections("one-quarter", { measuresPerLine: 2, lineSpacing: 130, noteSize: 100 }),
  });
  for (const section of config.sections.filter((section) => section.density === "full")) {
    for (const page of section.pages.filter((page) => page.ornaments.includes("stickings"))) {
      const voices = generate(page, 22);
      voices.forEach((voice, index) => {
        assert(voice.notes.every((note) => note.notes.length));
        const runs = repeatingRuns(voice.notes);
        assert(Math.max(...runs) <= (index < 12 ? 2 : 4), `${section.title}/${page.title} exercise ${index + 1}`);
        if (index >= 12) assert(runs.includes(3) || runs.includes(4));
      });
    }
  }
});

test("tail boundary follows the printed layout when measures per row changes", () => {
  const settings = { ornaments: ["stickings"], maxSameHandStickingRun: 2,
    stickingTail: { count: 5, maxSameHandStickingRun: 4, requiredSameHandStickingRuns: [3, 4] } };
  assert.equal(getLineStickingSettings(settings, 17, 33, 3).maxSameHandStickingRun, 2);
  assert.equal(getLineStickingSettings(settings, 18, 33, 3).maxSameHandStickingRun, 4);
  assert.equal(getLineStickingSettings(settings, 33, 33, 3).maxSameHandStickingRun, 2);
});

test("span changes affect group timing and equivalent spans retain identical rhythms", () => {
  const primary = pool(["sixteenths"]);
  assert.deepEqual(getSpanPrimaryRhythms(primary, { count: 1, unit: 4 }), getSpanPrimaryRhythms(primary, { count: 2, unit: 8 }));
  assert.deepEqual(getSpanPrimaryRhythms(primary, { count: 3, unit: 16 }).tuplets, [{ actual: 4, normal: 3, type: 16 }]);
  const config = generator.createGenerationConfig({}, { structureVersion: 3,
    groups: [{ id: "three-sixteenths", rhythmSpan: { count: 3, unit: 16 } }],
    sections: [{ id: "study", groupId: "three-sixteenths", primaryRhythms: primary,
      secondaryRhythms: pool(["sixteenths"]), pages: [{ generationSettings: { playEveryNote: true, ornaments: ["accents"] } }] }],
  });
  for (const voice of generate(config.sections[0].pages[0], 30)) {
    assert(voice.tuplets.some((tuplet) => tuplet.actual === 4 && tuplet.normal === 3));
    assert(voice.notes.every((note) => note.notes.length));
  }
});

test("group spans and per-page tail rules survive manifests and group sorting", () => {
  const book = normalizeBook({ structureVersion: 3,
    groups: [{ id: "a", title: "Quarter", rhythmSpan: { count: 1, unit: 4 } }, { id: "b", title: "Three sixteenths", rhythmSpan: { count: 3, unit: 16 } }],
    sections: [{ ...legacyBook().sections[0], id: "b-section", groupId: "b" }, ...createStudySections("a")],
  });
  assert.equal(book.sections[0].groupId, "a");
  const loaded = normalizeBook(generator.createManifest(book));
  assert.deepEqual(loaded.groups, book.groups);
  assert.deepEqual(loaded.sections.at(-1).rhythmSpan, { count: 3, unit: 16 });
  assert.equal(loaded.sections[1].pages[1].generationSettings.stickingTail.count, 5);
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
    book.pages[1].lines[0].score = score;
    await request("POST", { book });
    book = await request("GET");
    book.groups[0].rhythmSpan = { count: 3, unit: 16 };
    await request("POST", { book });
    book = await request("GET");
    assert.equal(book.pages[1].lines[0].score, null);
    assert.deepEqual(book.sections[0].rhythmSpan, { count: 3, unit: 16 });
  } finally {
    // This directory was created exclusively for the test under the OS temp root.
    assert(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
