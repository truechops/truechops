import crypto from "crypto";
import { getMongoDb, getSessionUser } from "./auth/session";
import { validatePracticeLines } from "./book-practice-score";

export class PracticeError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new PracticeError(status, message); };
const key = (...parts) => crypto.createHash("sha256").update(JSON.stringify(parts)).digest("hex");
// Dependencies are injectable for account-isolation tests.
export function createPracticeService({ db, now = () => new Date() }) {
  const sets = db.collection("bookPracticeSets");
  const limits = db.collection("bookPracticeLimits");
  async function limit(userId, action, maximum, milliseconds) {
    const bucket = Math.floor(now().getTime() / milliseconds);
    const result = await limits.findOneAndUpdate({ _id: key(userId, action, bucket) },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 2) * milliseconds) } },
      { upsert: true, returnDocument: "after", includeResultMetadata: false });
    if (result.count > maximum) fail(429, "Please wait before trying again.");
  }
  return {
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
    await db.collection("bookPracticeLimits").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    indexed.add(db);
  }
  return createPracticeService({ db });
}

export function practiceHandler(route, dependencies = {}) {
  const session = dependencies.session || getSessionUser;
  const service = dependencies.service || productionService;
  const allowed = { sets: ["GET", "POST", "DELETE"] }[route];
  return async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    if (!allowed) return res.status(404).json({ error: "Page not found." });
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
