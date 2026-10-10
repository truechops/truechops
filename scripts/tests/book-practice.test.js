const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const babel = require("@babel/core");
const originalLoader = Module._extensions[".js"];
Module._extensions[".js"] = (module, file) => {
  if (file.includes("node_modules")) return originalLoader(module, file);
  module._compile(babel.transformSync(fs.readFileSync(file, "utf8"), {
    presets: [["@babel/preset-env", { targets: { node: "current" } }]], babelrc: false, configFile: false,
  }).code, file);
};
const { createPracticeService, createBookChallenge, challengeMatches, practiceHandler, generateBookPractice } = require("../../src/lib/book-practice-server");
const { createSessionCookie, createBookScanCookie, hasBookScan } = require("../../src/lib/auth/session");
const { validatePracticeLines, modifyPracticeScore, practicePlayback } = require("../../src/lib/book-practice-score");
const { normalizeBook } = require("../../src/components/book-builder/book-data");
const { createBookVolume } = require("../../src/lib/book-volumes");
const genericGenerator = require("../../pages/api/exercise-generator").default;
const copy = (value) => structuredClone(value);
const score = (mask) => ({ parts: { snare: { enabled: true } }, measures: [{ timeSig: { num: 4, type: 4 },
  parts: [{ instrument: "snare", voices: [{ notes: Array.from({ length: 4 }, (_, i) => ({
    duration: 4, notes: mask & (1 << i) ? ["C5"] : [], dots: 0, ornaments: mask & (1 << i) ? "ar" : "",
  })), tuplets: [] }] }] }] });
const fixture = { book: "test-book", title: "Test book", edition: 1, contentVersion: 1,
  pages: Array.from({ length: 4 }, (_, i) => ({ pageNumber: i + 1,
    lines: Array.from({ length: 8 }, (_, j) => ({ lineNumber: j + 1, score: score(j + 1) })) })) };

function memoryDb() {
  const collections = new Map();
  const matches = (doc, query) => Object.entries(query).every(([key, value]) =>
    value && typeof value === "object" && "$gt" in value ? doc[key] > value.$gt : doc[key] === value);
  const project = (doc, projection = {}) => Object.fromEntries(Object.entries(copy(doc)).filter(([key]) => projection[key] !== 0));
  return { collection(name) {
    if (collections.has(name)) return collections.get(name);
    const documents = new Map();
    const collection = {
      documents,
      async findOne(query, options = {}) { const doc = [...documents.values()].find((item) => matches(item, query)); return doc ? project(doc, options.projection) : null; },
      find(query) {
        let projection = {}, maximum = Infinity, order;
        const cursor = { project(value) { projection = value; return cursor; }, sort(value) { order = value; return cursor; }, limit(value) { maximum = value; return cursor; },
          async toArray() { let rows = [...documents.values()].filter((doc) => matches(doc, query));
            if (order) { const [field, direction] = Object.entries(order)[0]; rows = rows.sort((a, b) => (a[field] - b[field]) * direction); }
            return rows.slice(0, maximum).map((doc) => project(doc, projection)); } };
        return cursor;
      },
      async replaceOne(query, doc) { documents.set(query._id, copy(doc)); },
      async updateOne(query, update) { await collection.findOneAndUpdate(query, update); },
      async findOneAndUpdate(query, update) {
        const existing = documents.get(query._id);
        const doc = existing || { ...query, ...copy(update.$setOnInsert || {}) };
        Object.assign(doc, copy(update.$set || {}));
        for (const [key, amount] of Object.entries(update.$inc || {})) doc[key] = (doc[key] || 0) + amount;
        documents.set(doc._id, doc); return copy(doc);
      },
      async findOneAndDelete(query) { const doc = [...documents.values()].find((item) => matches(item, query)); if (!doc) return null; documents.delete(doc._id); return copy(doc); },
      async insertOne(doc) { documents.set(doc._id, copy(doc)); },
      async countDocuments(query) { return [...documents.values()].filter((doc) => matches(doc, query)).length; },
      async deleteOne(query) { return { deletedCount: await collection.findOneAndDelete(query) ? 1 : 0 }; },
    };
    collections.set(name, collection); return collection;
  } };
}
function setup() {
  const db = memoryDb();
  let date = new Date("2026-10-10T00:00:00Z");
  let calls = 0;
  const api = createPracticeService({ db, now: () => date,
    loadBook: async (book) => [fixture.book, "other-book"].includes(book) ? { ...copy(fixture), book } : null,
    catalog: async () => [{ book: fixture.book, title: fixture.title, edition: 1 }],
    resolve: async (token) => ["page-token", "other-token"].includes(token) ? { pageRef: { book: token === "page-token" ? fixture.book : "other-book", edition: 1, page: 1 } } : null,
    generate: (book, page, count) => { calls++; return { lines: Array.from({ length: count }, (_, i) => ({ score: score(i + 1) })) }; },
  });
  async function verify(user = "owner") {
    const { challenge } = await api.startVerification(user, fixture.book);
    const stored = [...db.collection("bookVerificationChallenges").documents.values()].find((item) => item.userId === user);
    return api.finishVerification(user, fixture.book, challenge.id, stored.answers);
  }
  return { db, api, verify, calls: () => calls, advance: (ms) => { date = new Date(date.getTime() + ms); } };
}
const rejectsStatus = (promise, status) => assert.rejects(promise, (error) => error.status === status);
const response = () => ({ statusCode: 200, headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test("verification uses three different printed pages and visually unique opaque choices", () => {
  const challenge = createBookChallenge(fixture);
  assert.equal(challenge.questions.length, 3);
  assert.equal(new Set(challenge.questions.map((question) => question.page)).size, 3);
  for (const question of challenge.questions) {
    assert.equal(new Set(question.options.map((option) => JSON.stringify(option.score))).size, 4);
    assert(question.options.every((option) => !option.lineNumber && !option.exerciseShortForm));
    const solution = challenge.answers.find((answer) => answer.questionId === question.id);
    const correct = question.options.find((option) => option.id === solution.optionId);
    const printed = fixture.pages.find((page) => page.pageNumber === question.page).lines.find((line) => line.lineNumber === question.rhythm);
    assert.deepEqual(correct.score, validatePracticeLines([printed])[0].score);
  }
  assert(challengeMatches(challenge, challenge.answers));
  assert(!challengeMatches(challenge, [challenge.answers[0], challenge.answers[0], challenge.answers[0]]));
  assert(!challengeMatches(challenge, challenge.answers.slice(0, 2)));
});

test("verification solutions are private; failures consume checks and successes belong only to that account/book", async () => {
  const { db, api, verify } = setup();
  const { challenge } = await api.startVerification("owner", fixture.book);
  assert(!challenge.answers);
  const secret = [...db.collection("bookVerificationChallenges").documents.values()][0];
  await rejectsStatus(api.finishVerification("stranger", fixture.book, challenge.id, secret.answers), 410);
  await rejectsStatus(api.finishVerification("owner", fixture.book, challenge.id, []), 400);
  await rejectsStatus(api.finishVerification("owner", fixture.book, challenge.id, secret.answers), 410);
  assert.equal((await api.status("owner", "page-token")).verified, false);
  await verify();
  assert.equal((await api.status("owner", "page-token")).verified, true);
  assert.equal((await api.status("stranger", "page-token")).verified, false);
  assert.equal((await api.status("owner", "other-token")).verified, false);
});

test("expired checks, replaced checks, concurrent answers and guessing limits are enforced", async () => {
  const { db, api, advance } = setup();
  const first = await api.startVerification("owner", fixture.book);
  const second = await api.startVerification("owner", fixture.book);
  const secret = [...db.collection("bookVerificationChallenges").documents.values()][0];
  await rejectsStatus(api.finishVerification("owner", fixture.book, first.challenge.id, secret.answers), 410);
  const results = await Promise.allSettled([1, 2].map(() => api.finishVerification("owner", fixture.book, second.challenge.id, secret.answers)));
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const expired = await api.startVerification("other", fixture.book);
  advance(11 * 60 * 1000);
  await rejectsStatus(api.finishVerification("other", fixture.book, expired.challenge.id, []), 410);
  for (let i = 0; i < 4; i++) await api.startVerification("other", fixture.book);
  await rejectsStatus(api.startVerification("other", "other-book"), 429);
});

test("generation requires both verification and page scan; limits run before generator calls", async () => {
  const { api, verify, calls } = setup();
  await rejectsStatus(api.generate("owner", "page-token", 8, true), 403);
  await verify();
  await rejectsStatus(api.generate("owner", "page-token", 8, false), 403);
  await rejectsStatus(api.generate("owner", "other-token", 8, true), 403);
  for (const count of [0, -1, 33, 2.5, "8", NaN]) await rejectsStatus(api.generate("owner", "page-token", count, true), 400);
  assert.equal(calls(), 0);
  for (let i = 0; i < 6; i++) assert.equal((await api.generate("owner", "page-token", 3, true)).lines.length, 3);
  await rejectsStatus(api.generate("owner", "page-token", 3, true), 429);
  assert.equal(calls(), 6);
});

test("saved sets preserve notation and tempo, strip generation rights, and enforce account isolation", async () => {
  const { api } = setup();
  const saved = await api.save("owner", { name: "My practice", tempo: 95, token: "page-token", config: {}, userId: "stranger", lines: [{ score: score(7), token: "page-token" }] });
  const reopened = (await api.get("owner", saved.id)).set;
  assert.equal(reopened.tempo, 95); assert.equal(reopened.name, "My practice");
  assert(!reopened.config && !reopened.token && !reopened.lines[0].token);
  assert.deepEqual(reopened.lines, validatePracticeLines([{ score: score(7) }]));
  assert.equal((await api.list("owner")).sets.length, 1);
  assert.equal((await api.list("stranger")).sets.length, 0);
  await rejectsStatus(api.get("stranger", saved.id), 404);
  await rejectsStatus(api.remove("stranger", saved.id), 404);
  await rejectsStatus(api.save("owner", { name: "bad", tempo: 80, lines: [{ score: { measures: [] } }] }), 400);
  await api.remove("owner", saved.id);
  await rejectsStatus(api.get("owner", saved.id), 404);
});

test("QR grants are signed, expire, are page-specific, and cannot replace account authentication", async () => {
  const cookie = createBookScanCookie("page-token").split(";")[0];
  assert(hasBookScan({ headers: { cookie } }, "page-token"));
  assert(!hasBookScan({ headers: { cookie } }, "other-token"));
  assert(!hasBookScan({ headers: { cookie: `${cookie}broken` } }, "page-token"));
  const realNow = Date.now;
  try { Date.now = () => realNow() + 3 * 60 * 60 * 1000; assert(!hasBookScan({ headers: { cookie } }, "page-token")); }
  finally { Date.now = realNow; }
  const { api, verify } = setup();
  await verify();
  const handler = practiceHandler("generate", { service: async () => api });
  const req = { method: "POST", headers: { host: "localhost", cookie }, query: {}, body: { token: "page-token", count: 2 } };
  let res = response(); await handler(req, res); assert.equal(res.statusCode, 401);
  req.headers.cookie += `; ${createSessionCookie({ id: "owner" }).split(";")[0]}`;
  res = response(); await handler(req, res); assert.equal(res.statusCode, 200);
  req.headers.origin = "https://another-site.example";
  res = response(); await handler(req, res); assert.equal(res.statusCode, 403);
  req.method = "GET";
  res = response(); await handler(req, res); assert.equal(res.statusCode, 405);
});

test("the generic generator cannot accept a book-page reference", () => {
  const res = response();
  genericGenerator({ method: "POST", body: { config: { sourcePage: { page: 2 } } } }, res);
  assert.equal(res.statusCode, 403);
});

test("modification buttons leave timing intact; playback includes rests, dots, nested ratios, and grace notes", () => {
  const original = score(7);
  const changed = modifyPracticeScore(original, "alternate");
  assert.deepEqual(changed.measures[0].parts[0].voices[0].notes.map((note) => note.ornaments), ["ar", "al", "ar", ""]);
  assert.deepEqual(modifyPracticeScore(changed, "swap").measures[0].parts[0].voices[0].notes.map((note) => note.ornaments), ["al", "ar", "al", ""]);
  assert(original.measures[0].parts[0].voices[0].notes[1].ornaments === "ar");
  assert.equal(practicePlayback(original, 60).duration, 4);
  assert.equal(practicePlayback(original, 60, true).events.length, 7);
  const tuplets = copy(original);
  tuplets.measures[0].parts[0].voices[0] = { notes: Array.from({ length: 5 }, () => ({ duration: 8, dots: 1, notes: ["C5"], ornaments: "c" })),
    tuplets: [{ start: 0, end: 5, normal: 2, actual: 3 }, { start: 0, end: 3, normal: 2, actual: 3 }] };
  const audio = practicePlayback(tuplets, 60);
  assert.equal(audio.events.length, 15);
  assert(audio.events.every((event) => event.time >= 0));
  assert.equal(audio.initialGrace.length, 1);
  assert(audio.events.every((event) => event.time < audio.duration));
  assert(Math.abs(audio.events[3].time - 1 / 3) < 1e-8);
});

test("practice generator retains Book 1/2 page rules, phrase length, and no ornaments", () => {
  const source = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../data/book-builder/snare-drum-book/book.json")));
  for (const [volume, indices] of [[1, [0, 52, 105]], [2, [0, 4, 60, 61, 130, 132]]]) {
    const book = normalizeBook(createBookVolume(source, volume));
    for (const index of indices) {
      const printed = book.sections.flatMap((section) => section.pages)[index];
      const first = generateBookPractice(book, printed.pageNumber, 4);
      assert.equal(first.lines.length, 4);
      validatePracticeLines(first.lines);
      const expectedMeasures = printed.pdfSettings.measuresPerExercise || 1;
      for (const line of first.lines) {
        assert.equal(line.score.measures.length, expectedMeasures);
        for (const measure of line.score.measures) for (const note of measure.parts[0].voices[0].notes) assert(!note.ornaments);
      }
      const second = generateBookPractice(book, printed.pageNumber, 4);
      assert.notDeepEqual(first.lines, second.lines, `Book ${volume}, page ${printed.pageNumber}: fresh random seed`);
    }
  }
});
