// Keep old score/link clients working without providing a second, unprotected
// route to the same private rhythm collection.
import crypto from "crypto";
import { idFilter, canRead, requireUser, checkOrigin, createSocialService } from "./server";
import { normalizeMetadata, normalizeMutations, validateScore } from "./validation";

const unsupported = () => { throw new Error("Use your profile to manage rhythms."); };
export const legacyQueries = {
  async getLinkRhythmById(_, { input }, { db, currentUser }) {
    if (typeof input !== "string") return null;
    const link = await db.collection("links").findOne({ _id: input });
    if (!link) return null;
    const rhythm = await db.collection("rhythms").findOne(idFilter(String(link.value)));
    return rhythm?.type === "link" || canRead(rhythm,currentUser?.id) ? rhythm : null;
  },
  async getRhythmById(_, { input }, { db, currentUser }) {
    const rhythm = await db.collection("rhythms").findOne(idFilter(input));
    return canRead(rhythm,currentUser?.id) ? rhythm : null;
  },
  async rhythm(_, { query }, context) {
    return query?._id ? legacyQueries.getRhythmById(_, { input: query._id },context) : null;
  },
  async rhythms(_, { query, limit }, { db, currentUser }) {
    const userId = requireUser(currentUser);
    return db.collection("rhythms").find({ _userId: userId, type: "saved", ...(query?._id ? idFilter(query._id) : {}) })
      .sort({ date: -1 }).limit(Math.min(100,Math.max(1,limit || 100))).toArray();
  },
  link: unsupported,
  links: unsupported,
};
const blocked = ["deleteManyLinks","deleteManyRhythms","deleteOneLink","insertManyLinks","insertManyRhythms","insertOneLink",
  "replaceOneLink","replaceOneRhythm","updateManyLinks","updateManyRhythms","updateOneLink","updateOneRhythm","upsertOneLink","upsertOneRhythm"];
export const legacyMutations = {
  ...Object.fromEntries(blocked.map((name) => [name,unsupported])),
  async insertOneRhythm(_, { data }, { db, currentUser, req }) {
    checkOrigin(req); requireUser(currentUser);
    const { rhythm } = await createSocialService(db).createRhythm(currentUser,{ ...data, visibility: "private" });
    return db.collection("rhythms").findOne(idFilter(rhythm.id));
  },
  async deleteOneRhythm(_, { query }, { db, currentUser, req }) {
    checkOrigin(req);
    const userId = requireUser(currentUser);
    const filter = { ...idFilter(query?._id), _userId: userId, type: "saved" };
    const row = await db.collection("rhythms").findOne(filter);
    if (row) await createSocialService(db).removeRhythm(currentUser,String(row._id));
    return row;
  },
  async getRhythmLink(_, { input }, { db, currentUser, req }) {
    checkOrigin(req);
    const userId = requireUser(currentUser);
    const data = { _id: crypto.randomUUID(), _userId: userId, type: "link", ...normalizeMetadata({ ...input, visibility: "private" }),
      ...validateScore(input.score), mutations: normalizeMutations(input.mutations), date: new Date() };
    await db.collection("rhythms").insertOne(data);
    const key = crypto.randomBytes(12).toString("base64url");
    await db.collection("links").insertOne({ _id: key, _userId: userId, type: "rhythm", value: data._id });
    return key;
  },
};
