import crypto from "crypto";
import { getMongoDb, getSessionUser, hasBookScan } from "./auth/session";
import { findStoredBookQrPage, loadPracticeBook, getPracticeBookCatalog } from "./book-builder-storage";
import { validatePracticeLines } from "./book-practice-score";
import { createGenerationConfig, createUniqueGeneratedLine } from "../../scripts/generate-ai-book";

export class PracticeError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new PracticeError(status, message); };
const key = (...parts) => crypto.createHash("sha256").update(JSON.stringify(parts)).digest("hex");
const shuffle = (items) => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};
const identity = (book) => ({ book: book.book, edition: book.edition, title: book.title });
const entitlementId = (userId, book) => key(userId, book.book, book.edition);

// The nonce, solution, and source line metadata stay in MongoDB. Options expose
// only notation and random IDs, so their positions/filenames cannot give answers.
export function createBookChallenge(book, now = new Date()) {
  const usable = shuffle(book.pages.filter((page) => page.lines.filter((line) => line.score).length >= 4));
  const questions = [];
  const answers = [];
  for (const page of usable) {
    const unique = new Map();
    for (const line of page.lines.filter((candidate) => candidate.score)) {
      const clean = validatePracticeLines([line])[0].score;
      unique.set(JSON.stringify(clean), { line, score: clean });
    }
    if (unique.size < 4) continue;
    const [correct, ...others] = shuffle([...unique.values()]).slice(0, 4);
    const questionId = crypto.randomUUID();
    const correctId = crypto.randomUUID();
    questions.push({
      id: questionId, page: page.pageNumber, rhythm: correct.line.lineNumber,
      options: shuffle([{ id: correctId, score: correct.score }, ...others.map(({ score }) => ({ id: crypto.randomUUID(), score }))]),
    });
    answers.push({ questionId, optionId: correctId });
    if (questions.length === 3) break;
  }
  if (questions.length !== 3) fail(503, "This edition does not yet have enough published rhythms to verify.");
  return { id: crypto.randomUUID(), book: identity(book), contentVersion: book.contentVersion, questions, answers,
    expiresAt: new Date(now.getTime() + 10 * 60 * 1000) };
}

export function challengeMatches(challenge, answers) {
  return Array.isArray(answers) && answers.length === 3 &&
    answers.every((answer) => answer && typeof answer.questionId === "string" && typeof answer.optionId === "string") && new Set(answers.map((answer) => answer?.questionId)).size === 3 &&
    challenge.answers.every((expected) => answers.some((answer) => answer.questionId === expected.questionId && answer.optionId === expected.optionId));
}

export function generateBookPractice(book, pageNumber, count) {
  const sourceSection = book.sections.find((section) => section.pages.some((page) => page.pageNumber === pageNumber));
  if (!sourceSection) fail(404, "Book page not found.");
  const pageIndex = sourceSection.pages.findIndex((page) => page.pageNumber === pageNumber);
  // Keep all subsection pages so ordered plans and density offsets are exact.
  const generation = createGenerationConfig({}, { ...book, sections: [sourceSection] });
  const config = generation.sections[0].pages[pageIndex];
  const seeded = { ...config, id: `${config.id}-${crypto.randomUUID()}` };
  const sourcePage = sourceSection.pages[pageIndex];
  const period = sourcePage.lines.length;
  const finiteQuarterEighths = (config.rhythmCombination?.rhythms.length === 2 &&
    config.rhythmCombination.rhythms.includes("quarters") && config.rhythmCombination.rhythms.includes("eighths")) ||
    (config.rhythmProgression?.preceding.length === 1 && config.primaryRhythms?.subdivisions.includes("eighths"));
  const finiteOrder = finiteQuarterEighths ? shuffle(Array.from({ length: period }, (_, index) => index)) : null;
  const used = new Set();
  const lines = [];
  for (let i = 0; i < count; i++) {
    if (finiteOrder && i >= finiteOrder.length) break;
    const index = finiteOrder ? finiteOrder[i] : count <= period ? Math.floor(i * (period - 1) / Math.max(1, count - 1)) : i % period;
    try {
      const result = createUniqueGeneratedLine(null, seeded, config.sampleJson, index, used);
      lines.push({ lineNumber: i + 1, score: result.score });
    } catch (error) {
      // Small quarter-note vocabularies can run out of distinct exercises.
      if (lines.length && /unique/i.test(error.message)) break;
      throw error;
    }
  }
  return { lines, ...(lines.length < count ? { notice: `Created ${lines.length} distinct rhythms; this page has a small rhythm pool.` } : {}) };
}

// Dependencies are injectable for account-isolation and concurrency tests;
// production always uses signed sessions, MongoDB, and published book files.
export function createPracticeService({ db, loadBook = loadPracticeBook, resolve = findStoredBookQrPage,
  catalog = getPracticeBookCatalog, generate = generateBookPractice, now = () => new Date() }) {
  const ownership = db.collection("bookOwnership");
  const challenges = db.collection("bookVerificationChallenges");
  const sets = db.collection("bookPracticeSets");
  const limits = db.collection("bookPracticeLimits");
  async function bookFor(bookKey) {
    if (typeof bookKey !== "string" || bookKey.length > 100) fail(400, "Choose a book.");
    const book = await loadBook(bookKey);
    if (!book) fail(404, "Book not found.");
    return book;
  }
  async function limit(userId, action, maximum, milliseconds) {
    const bucket = Math.floor(now().getTime() / milliseconds);
    const result = await limits.findOneAndUpdate({ _id: key(userId, action, bucket) },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 2) * milliseconds) } },
      { upsert: true, returnDocument: "after", includeResultMetadata: false });
    if (result.count > maximum) fail(429, "Please wait before trying again.");
  }
  async function verified(userId, book) {
    return Boolean(await ownership.findOne({ _id: entitlementId(userId, book), userId }));
  }
  return {
    async status(userId, token) {
      const books = await catalog();
      const verifiedBooks = userId ? await ownership.find({ userId }).project({ _id: 0, userId: 0 }).toArray() : [];
      const reference = token ? await resolve(token) : null;
      if (token && !reference) fail(404, "Book page not found.");
      return { books, verifiedBooks, verified: Boolean(reference && userId && await verified(userId, reference.pageRef)) };
    },
    async startVerification(userId, bookKey) {
      const book = await bookFor(bookKey);
      if (await verified(userId, book)) return { verified: true };
      // One account-wide limit prevents switching books to bypass the limit.
      await limit(userId, "verification", 5, 60 * 60 * 1000);
      const numbers = shuffle(book.pages.map((page) => page.pageNumber));
      // Read a small selection, then all pages only for unusually sparse books.
      let sample = await loadBook(bookKey, numbers.slice(0, 12));
      let challenge;
      try { challenge = createBookChallenge(sample, now()); }
      catch (error) {
        if (!(error instanceof PracticeError)) throw error;
        sample = await loadBook(bookKey, numbers);
        challenge = createBookChallenge(sample, now());
      }
      await challenges.replaceOne({ _id: entitlementId(userId, book) }, { ...challenge,
        _id: entitlementId(userId, book), userId }, { upsert: true });
      const publicChallenge = { ...challenge };
      delete publicChallenge.answers;
      return { challenge: publicChallenge };
    },
    async finishVerification(userId, bookKey, challengeId, answers) {
      const book = await bookFor(bookKey);
      // Atomic consumption prevents replay, concurrent guessing, and reuse by another account.
      const challenge = await challenges.findOneAndDelete({ _id: entitlementId(userId, book), userId,
        id: String(challengeId || ""), expiresAt: { $gt: now() } }, { includeResultMetadata: false });
      if (!challenge) fail(410, "This check expired or was already used. Start a new check.");
      if (challenge.contentVersion !== book.contentVersion) fail(409, "This edition changed. Start a new check.");
      if (!challengeMatches(challenge, answers)) fail(400, "The three matches were not all correct. Check the printed page numbers and try a new check.");
      await ownership.updateOne({ _id: entitlementId(userId, book) }, {
        $setOnInsert: { userId, ...identity(book), verifiedAt: now(), method: "three-rhythm-match" },
      }, { upsert: true });
      return { verified: true };
    },
    async generate(userId, token, count, scanAllowed) {
      if (!scanAllowed) fail(403, "Scan this page's QR code again to generate more rhythms.");
      if (!Number.isInteger(count) || count < 1 || count > 32) fail(400, "Choose between 1 and 32 rhythms.");
      const resolved = await resolve(token);
      if (!resolved) fail(404, "Book page not found.");
      if (!await verified(userId, resolved.pageRef)) fail(403, "Verify this book in your account before generating rhythms.");
      await limit(userId, "generate", 6, 60 * 1000);
      const book = await loadBook(resolved.pageRef.book, [resolved.pageRef.page]);
      return generate(book, resolved.pageRef.page, count);
    },
    async save(userId, value) {
      let lines;
      try { lines = validatePracticeLines(value?.lines); } catch (error) { fail(400, error.message); }
      const name = typeof value?.name === "string" ? value.name.trim().slice(0, 100) : "";
      if (!name) fail(400, "Give your practice set a name.");
      const tempo = Number(value.tempo);
      if (!Number.isInteger(tempo) || tempo < 30 || tempo > 300) fail(400, "Choose a tempo from 30 to 300 BPM.");
      await limit(userId, "save", 20, 60 * 1000);
      if (await sets.countDocuments({ userId }) >= 100) fail(409, "You have 100 saved sets. Delete an older set to save another.");
      // Intentionally whitelist: no QR token, generation config, or capability.
      const saved = { _id: crypto.randomUUID(), userId, name, tempo, lines, createdAt: now() };
      await sets.insertOne(saved);
      return { id: saved._id, name };
    },
    async list(userId) {
      return { sets: await sets.find({ userId }).project({ userId: 0, lines: 0 }).sort({ createdAt: -1 }).limit(100).toArray() };
    },
    async get(userId, id) {
      const saved = await sets.findOne({ _id: String(id), userId }, { projection: { userId: 0 } });
      if (!saved) fail(404, "Practice set not found.");
      return { set: saved };
    },
    async remove(userId, id) {
      const result = await sets.deleteOne({ _id: String(id), userId });
      if (!result.deletedCount) fail(404, "Practice set not found.");
      return { ok: true };
    },
  };
}

const indexed = new WeakSet();
async function productionService() {
  const db = await getMongoDb();
  if (!indexed.has(db)) {
    await Promise.all(["bookVerificationChallenges", "bookPracticeLimits"].map((name) =>
      db.collection(name).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })));
    indexed.add(db);
  }
  return createPracticeService({ db });
}

export function practiceHandler(route, dependencies = {}) {
  const session = dependencies.session || getSessionUser;
  const scan = dependencies.scan || hasBookScan;
  const service = dependencies.service || productionService;
  const allowed = { access: ["GET", "POST", "PUT"], generate: ["POST"], sets: ["GET", "POST", "DELETE"] }[route];
  return async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    if (!allowed.includes(req.method)) {
      res.setHeader("Allow", allowed);
      return res.status(405).json({ error: "Method not allowed." });
    }
    try {
      if (req.method !== "GET") {
        const origin = req.headers.origin;
        if (req.headers["sec-fetch-site"] === "cross-site" || (origin && new URL(origin).host !== req.headers.host)) fail(403, "Please use this website to submit your request.");
      }
      const user = session(req);
      if (!user?.id) fail(401, "Sign in to use your book account.");
      const api = await service();
      const body = req.body || {};
      let result;
      if (route === "access") {
        if (req.method === "GET") result = { ...await api.status(user.id, req.query.token), scanActive: scan(req, req.query.token) };
        if (req.method === "POST") result = await api.startVerification(user.id, body.book);
        if (req.method === "PUT") result = await api.finishVerification(user.id, body.book, body.challengeId, body.answers);
      }
      if (route === "generate") result = await api.generate(user.id, body.token, body.count, scan(req, body.token));
      if (route === "sets") {
        if (req.method === "GET") result = req.query.id ? await api.get(user.id, req.query.id) : await api.list(user.id);
        if (req.method === "POST") result = await api.save(user.id, body);
        if (req.method === "DELETE") result = await api.remove(user.id, req.query.id);
      }
      return res.status(200).json(result);
    } catch (error) {
      const status = error instanceof PracticeError ? error.status : 503;
      if (status === 429) res.setHeader("Retry-After", "60");
      return res.status(status).json({ error: status === 503 ? "Book practice is temporarily unavailable. Please try again shortly." : error.message });
    }
  };
}
