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
const { createStudySections, createSpanStudy, createCombinedStudies, createTupletCombinationStudies, SPAN_STUDIES, STUDY_TOPICS, STUDY_FAMILIES } = require("../../src/lib/book-curriculum");
const { getLineStickingSettings, getSpanPrimaryRhythms } = require("../../src/lib/book-structure");

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
    assert.deepEqual(required(3), ["accents"]);
    assert.deepEqual(required(4), ["stickings", "accents"]);
    assert.deepEqual(required(21), ["stickings", "accents", "flams", "diddles", "cheese"]);
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

test("combined-subdivision pages draw at random from a pool that grows each section", () => {
  const { groups, sections } = createCombinedStudies({ measuresPerLine: 2, lineSpacing: 130, noteSize: 100 });
  // Seven one-beat pools, then one section per span category; two pages each.
  assert.equal(sections.length, 7 + SPAN_STUDIES.length);
  assert(sections.every((section) => section.pages.length === 2));
  assert.equal(sections.at(-1).primaryRhythms.tuplets.length + sections.at(-1).primaryRhythms.subdivisions.length,
    7 + SPAN_STUDIES.reduce((sum, study) => sum + study.familyIds.length, 0));
  const config = generator.createGenerationConfig({}, { structureVersion: 3, groups, sections });
  const poolSize = (section) => section.primaryRhythms.subdivisions.length + section.primaryRhythms.tuplets.length;
  sections.slice(1).forEach((section, index) => assert(poolSize(section) >= poolSize(sections[index])));
  const last = config.sections.at(-1).pages[0];
  const used = new Set();
  generate(last, 22).forEach((voice) => {
    voice.tuplets.forEach((tuplet) => used.add(`${tuplet.actual}:${tuplet.normal}`));
  });
  // No rhythm is required, yet the last page draws widely from its pool.
  assert(used.size >= 8, `only ${used.size} tuplet kinds on the last page`);
  // Groups of 7-9 in a quarter note or less take only stickings; sextuplets only flams.
  generate(config.sections[6].pages[0], 22).forEach((voice) => voice.tuplets.forEach((tuplet) => {
    const notes = voice.notes.slice(tuplet.start, tuplet.end);
    const allowed = tuplet.actual === 6 ? /^[frl]*$/ : tuplet.actual >= 7 ? /^[rl]*$/ : /./;
    notes.forEach((note) => assert(!note.ornaments || allowed.test(note.ornaments), `${tuplet.actual}:${tuplet.normal} has ${note.ornaments}`));
  }));
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
      return voice.tuplets.map((tuplet) => tuplet.actual);
    });
  // Sextuplets join the pool at row 4; nontuplets only near the end.
  assert(tupletKinds.slice(0, 6).every((kinds) => !kinds.includes(6) && !kinds.includes(9)));
  assert(tupletKinds.slice(36).some((kinds) => kinds.includes(9)));
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
