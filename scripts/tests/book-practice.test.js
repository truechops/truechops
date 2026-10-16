const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const Module = require("node:module");
const babel = require("@babel/core");
const originalLoader = Module._extensions[".js"];
Module._extensions[".js"] = (module, file) => {
  if (file.includes("node_modules")) return originalLoader(module, file);
  module._compile(babel.transformSync(fs.readFileSync(file, "utf8"), {
    presets: [["@babel/preset-env", { targets: { node: "current" } }]], babelrc: false, configFile: false,
  }).code, file);
};
const { createPracticeService, practiceHandler } = require("../../src/lib/book-practice-server");
const { createSessionCookie, createBookScanCookie, hasBookScan } = require("../../src/lib/auth/session");
const { validatePracticeLines, modifyPracticeScore, practicePlayback } = require("../../src/lib/book-practice-score");
const retiredVerification = require("../../pages/api/book-practice/access").default;
const retiredBookGenerator = require("../../pages/api/book-practice/generate").default;
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
  return { db, api: createPracticeService({ db }) };
}
const rejectsStatus = (promise, status) => assert.rejects(promise, (error) => error.status === status);
const response = () => ({ statusCode: 200, headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test("book verification is retired for every legacy method without authentication or database access", async () => {
  for (const method of ["GET", "POST", "PUT"]) {
    const res = response();
    await retiredVerification({ method, headers: {}, body: {} }, res);
    assert.equal(res.statusCode, 410);
    assert(res.body.error.includes("QR practice page"));
  }
  const { api } = setup();
  assert.equal(api.startVerification, undefined);
  assert.equal(api.finishVerification, undefined);
});

test("book generation is retired and sends clients to the score without database access", async () => {
  const { api } = setup();
  assert.equal(api.generate,undefined);
  for (const method of ["GET","POST"]) {
    const res=response();
    await retiredBookGenerator({method,headers:{},body:{token:"page-token",count:8}},res);
    assert.equal(res.statusCode,410);
    assert(res.body.error.includes("Open in score"));
  }
});

test("unverified accounts can save sets with notation and tempo while account isolation remains enforced", async () => {
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
  const { api } = setup();
  const handler = practiceHandler("sets", { service: async () => api });
  const req = { method: "POST", headers: { host: "localhost", cookie }, query: {}, body: { name:"Saved practice",tempo:80,lines:[{score:score(7)}] } };
  let res = response(); await handler(req, res); assert.equal(res.statusCode, 401);
  req.headers.cookie += `; ${createSessionCookie({ id: "owner" }).split(";")[0]}`;
  res = response(); await handler(req, res); assert.equal(res.statusCode, 200);
  req.headers.origin = "https://another-site.example";
  res = response(); await handler(req, res); assert.equal(res.statusCode, 403);
  req.method = "PATCH";
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
