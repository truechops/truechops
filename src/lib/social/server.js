import crypto from "crypto";
import { ObjectId } from "mongodb";
import { getMongoDb, getSessionUser } from "../auth/session";
import { SocialError, fail, string, normalizeProfile, normalizeMetadata, validateScore, normalizeMutations, searchOptions } from "./validation";
import { publicRhythmFilter, searchPipeline } from "./search";
import { SEARCH_INDEXES } from "./config";
import { createEngagementService } from "./engagement";
import { createMediaService } from "./media";

export function idFilter(id) {
  const value = string(id, 80, "rhythm ID", true);
  return { _id: /^[a-f0-9]{24}$/i.test(value) ? { $in: [value, new ObjectId(value)] } : value };
}
export function canRead(rhythm, userId) {
  return Boolean(rhythm && ((userId && rhythm._userId === userId) || (rhythm.visibility === "public" && rhythm.type === "saved")));
}
export function publicProfile(profile) {
  if (!profile) return null;
  return { id: profile._id, handle: profile.handle, displayName: profile.displayName, bio: profile.bio || "",
    instruments: profile.instruments || [], joinedAt: profile.createdAt };
}
const pageResult = (rows, page, limit) => ({ items: rows.slice(0,limit), page, hasMore: rows.length > limit && page < 100 });
export function requireUser(user) { if (!user?.id) fail(401, "Sign in to save rhythms or manage your profile."); return user.id; }

export function createSocialService(db, { now = () => new Date(), ensureSearch = async () => {}, bunny } = {}) {
  const profiles = db.collection("profiles"), rhythms = db.collection("rhythms"), saves = db.collection("rhythmSaves");
  async function cards(rows, userId, full = false) {
    if (!rows.length) return [];
    const creators = await profiles.find({ userId: { $in: [...new Set(rows.map((r) => r._userId))] } }).toArray();
    const saved = userId ? await saves.find({ userId, rhythmId: { $in: rows.map((r) => String(r._id)) } }).toArray() : [];
    const recordings = await media.mediaCards(rows);
    return rows.map((r) => ({ media:recordings.get(String(r._id)) || [], id: String(r._id), name: r.name, description: r.description || "", tags: r.tags || [],
      instruments: r.instruments || Object.keys(r.score?.parts || {}).filter((key) => r.score.parts[key]), difficulty: r.difficulty || "",
      visibility: r.visibility === "public" ? "public" : "private", tempo: r.tempo || 90, createdAt: r.date,
      measureCount: r.score?.measures?.length || 0,
      score: full ? r.score : { ...r.score, measures: r.score?.measures?.slice(0,2) || [] },
      ...(full ? { mutations: r.mutations || [] } : {}),
      creator: publicProfile(creators.find((p) => p.userId === r._userId)),
      isOwner: Boolean(userId && r._userId === userId), saved: saved.some((s) => s.rhythmId === String(r._id)),
    }));
  }
  async function readable(id, userId) {
    const row = await rhythms.findOne(idFilter(id));
    if (!canRead(row,userId)) fail(404,"This rhythm is private or no longer available.");
    return row;
  }
  async function requireProfile(userId, visibility) {
    if (visibility === "public" && !await profiles.findOne({ userId })) fail(409, "Create your public profile before publishing a rhythm.");
  }
  const engagement = createEngagementService(db,{ readable, publicProfile, now });
  const media = createMediaService(db,{ readable, now, bunny });
  return {
    ...engagement,
    ...media,
    async search(user, query) {
      const options = searchOptions(query);
      if (options.q) await ensureSearch(options.type);
      const rows = await (options.type === "users" ? profiles : rhythms).aggregate(searchPipeline(options), { maxTimeMS: 5000 }).toArray();
      const page = pageResult(rows,options.page,options.limit);
      return { ...page, type: options.type, items: options.type === "users" ? page.items.map(publicProfile) : await cards(page.items,user?.id) };
    },
    async myProfile(user) {
      const userId = requireUser(user);
      return { profile: publicProfile(await profiles.findOne({ userId })) };
    },
    async saveProfile(user, body) {
      const userId = requireUser(user), data = normalizeProfile(body);
      try {
        await profiles.updateOne({ userId }, { $set: { ...data, updatedAt: now() }, $setOnInsert: { _id: crypto.randomUUID(), userId, createdAt: now() } }, { upsert: true });
      } catch (error) { if (error.code === 11000) fail(409, "That handle is already in use. Please choose another."); throw error; }
      return { profile: publicProfile(await profiles.findOne({ userId })) };
    },
    async profile(user, handle, query) {
      const name = string(handle,24,"handle",true).toLowerCase();
      const profile = await profiles.findOne({ handle: name });
      if (!profile) fail(404, "This profile doesn't exist yet.");
      const { page, limit } = searchOptions(query);
      const rows = await rhythms.find(publicRhythmFilter({ _userId: profile.userId })).sort({ updatedAt: -1, _id: -1 }).skip((page-1)*limit).limit(limit+1).toArray();
      const result = pageResult(rows,page,limit);
      return { ...result, items: await cards(result.items,user?.id), profile: publicProfile(profile), isOwner: profile.userId === user?.id };
    },
    async library(user, query) {
      const userId = requireUser(user), { page, limit } = searchOptions(query);
      const tab = query.tab || "created";
      if (!["created","saved"].includes(tab)) fail(400,"Choose a library tab.");
      let rows;
      if (tab === "created") {
        rows = await rhythms.find({ _userId: userId, type: "saved" }).sort({ date: -1, _id: -1 }).skip((page-1)*limit).limit(limit+1).toArray();
      } else {
        rows = await saves.aggregate([
          { $match: { userId } }, { $sort: { createdAt: -1, _id: -1 } },
          { $lookup: { from: "rhythms", let: { id: "$rhythmId" }, pipeline: [
            { $match: { $expr: { $eq: [{ $toString: "$_id" }, "$$id"] } } },
            { $match: { $or: [publicRhythmFilter(), { _userId: userId }] } },
          ], as: "rhythm" } },
          { $unwind: "$rhythm" }, { $replaceRoot: { newRoot: "$rhythm" } },
          { $skip: (page-1)*limit }, { $limit: limit+1 },
        ]).toArray();
      }
      const result = pageResult(rows,page,limit);
      return { ...result, items: await cards(result.items,userId) };
    },
    async getRhythm(user,id) { return { rhythm: (await cards([await readable(id,user?.id)],user?.id,true))[0] }; },
    async similarRhythms(user,id,query) {
      const source = await readable(id,user?.id), { page } = searchOptions(query), limit = 8;
      const instruments = source.instruments || Object.keys(source.score?.parts || {}).filter((key) => source.score.parts[key]);
      // Bound the candidate pool; visibility is checked in the database, never in a search index.
      const candidates = await rhythms.find(publicRhythmFilter({ instruments: { $in: instruments } })).sort({ updatedAt:-1, _id:-1 }).limit(200).toArray();
      const meter = (row) => row.score?.measures?.map((measure) => `${measure.timeSig.num}/${measure.timeSig.type}`).join(",");
      const sourceMeter = meter(source), tags = new Set(source.tags || []);
      const similarity = (row) => (row.tags || []).filter((tag) => tags.has(tag)).length * 4
        + (meter(row) === sourceMeter ? 3 : 0) + Math.max(0, 3 - Math.abs((row.tempo || 90) - (source.tempo || 90)) / 20);
      const ranked = candidates.filter((row) => String(row._id) !== String(source._id)).sort((a,b) => similarity(b)-similarity(a) || String(a._id).localeCompare(String(b._id)));
      const result = pageResult(ranked.slice((page-1)*limit,page*limit+1),page,limit);
      return { ...result, items: await cards(result.items,user?.id) };
    },
    async createRhythm(user,body) {
      const userId = requireUser(user), data = normalizeMetadata(body), notation = validateScore(body.score), mutations = normalizeMutations(body.mutations);
      await requireProfile(userId,data.visibility);
      const row = { _id: crypto.randomUUID(), _userId: userId, type: "saved", ...data, ...notation, mutations, date: now(), updatedAt: now() };
      await rhythms.insertOne(row);
      return { rhythm: (await cards([row],userId,true))[0] };
    },
    async updateRhythm(user,id,body) {
      const userId = requireUser(user), filter = { ...idFilter(id), _userId: userId, type: "saved" };
      const row = await rhythms.findOne(filter);
      if (!row) fail(404,"Rhythm not found in your library.");
      const data = normalizeMetadata({ ...row, ...Object.fromEntries(["name","description","tags","tempo","difficulty","visibility"].filter((key) => Object.hasOwn(body,key)).map((key) => [key,body[key]])) });
      await requireProfile(userId,data.visibility);
      const result = await rhythms.updateOne(filter, { $set: { ...data, instruments: row.instruments || Object.keys(row.score.parts).filter((key) => row.score.parts[key]), updatedAt: now() } });
      if (!result.matchedCount) fail(404,"Rhythm no longer available.");
      return { rhythm: (await cards([{ ...row, ...data }],userId,true))[0] };
    },
    async removeRhythm(user,id) {
      const userId = requireUser(user);
      const row = await rhythms.findOne({ ...idFilter(id), _userId:userId, type:"saved" });
      if (!row) fail(404,"Rhythm not found in your library.");
      const result = await rhythms.deleteOne({ _id:row._id, _userId:userId });
      if (!result.deletedCount) fail(404,"Rhythm not found in your library.");
      await saves.deleteMany({ rhythmId: String(row._id) });
      await engagement.removeEngagement(String(row._id));
      await media.removeAllMedia(String(row._id));
      return { removed: true };
    },
    async bookmark(user,id,save) {
      const userId = requireUser(user), rawId = string(id,80,"rhythm ID",true);
      const canonicalId = /^[a-f0-9]{24}$/i.test(rawId) ? rawId.toLowerCase() : rawId;
      const key = crypto.createHash("sha256").update(JSON.stringify([userId,canonicalId])).digest("hex");
      if (save) {
        const row = await readable(id,userId);
        if (row._userId === userId) fail(400,"Your own rhythms are already in your library.");
        try { await saves.updateOne({ _id: key }, { $setOnInsert: { userId, rhythmId: String(row._id), createdAt: now() } }, { upsert: true }); }
        catch (error) { if (error.code !== 11000) throw error; }
      } else await saves.deleteOne({ _id: key, userId });
      return { saved: save };
    },
  };
}

let indexesReady;
const readyUntil = new Map();
export async function productionSocialService() {
  const db = await getMongoDb();
  if (!indexesReady) indexesReady = Promise.all([
    db.collection("profiles").createIndex({ userId: 1 }, { unique: true }),
    db.collection("profiles").createIndex({ handle: 1 }, { unique: true }),
    db.collection("rhythmSaves").createIndex({ userId: 1, createdAt: -1 }),
    db.collection("rhythmMedia").createIndex({ libraryId:1, videoId:1 },{ unique:true }),
    db.collection("rhythmMedia").createIndex({ rhythmId:1 }),
    db.collection("rhythmMedia").createIndex({ createdAt:1 }),
    db.collection("rhythmMediaLimits").createIndex({ expiresAt:1 },{ expireAfterSeconds:0 }),
    db.collection("rhythmLikes").createIndex({ rhythmId: 1, userId: 1 },{ unique: true }),
    db.collection("rhythmComments").createIndex({ rhythmId: 1, createdAt: -1, _id: -1 }),
    db.collection("rhythmComments").createIndex({ userId: 1, createdAt: -1 }),
    db.collection("rhythms").createIndex({ _userId: 1, type: 1, date: -1 }),
    db.collection("rhythms").createIndex({ visibility: 1, type: 1, updatedAt: -1 }),
  ]).catch((error) => { indexesReady = null; throw error; });
  await indexesReady;
  return createSocialService(db, { ensureSearch: async (type) => {
    if ((readyUntil.get(type) || 0) > Date.now()) return;
    const spec = SEARCH_INDEXES[type === "users" ? 0 : 1];
    const indexes = await db.collection(spec.collection).listSearchIndexes(spec.name).toArray();
    if (!indexes.some((index) => index.queryable)) fail(503,"Search is being prepared. You can browse the latest rhythms and people in the meantime.");
    readyUntil.set(type,Date.now()+30000);
  } });
}

export function checkOrigin(req) {
  const origin = req.headers.origin;
  let originHost;
  try { originHost = origin ? new URL(origin).host : null; } catch { fail(403,"Please submit this request from TrueChops."); }
  if (req.headers["sec-fetch-site"] === "cross-site" || (originHost && originHost !== req.headers.host)) fail(403,"Please submit this request from TrueChops.");
}
export function socialHandler({ service = productionSocialService, session = getSessionUser } = {}) {
  return async (req,res) => {
    res.setHeader("Cache-Control","private, no-store");
    const route = req.query.route || [], [area,id,action,commentId,mediaAction] = route;
    const allowed = route.length === 1 ? { search: ["GET"], profile: ["GET","PUT"], library: ["GET"], rhythms: ["POST"] }[area]
      : route.length === 2 && area === "profiles" ? ["GET"]
      : route.length === 2 && area === "rhythms" ? ["GET","PATCH","DELETE"]
      : route.length === 3 && area === "rhythms" ? { save: ["PUT","DELETE"], like: ["PUT","DELETE"], comments: ["GET","POST"], engagement: ["GET"], similar: ["GET"], media: ["POST"] }[action]
      : route.length === 4 && area === "rhythms" && action === "comments" ? ["DELETE"]
      : route.length === 4 && area === "rhythms" && action === "media" ? ["GET","DELETE"]
      : route.length === 5 && area === "rhythms" && action === "media" ? { complete:["POST"], playback:["GET"] }[mediaAction] : null;
    if (!allowed) return res.status(404).json({ error: "Page not found." });
    if (!allowed.includes(req.method)) { res.setHeader("Allow",allowed.join(", ")); return res.status(405).json({ error: "Method not allowed." }); }
    try {
      const user = session(req), method = req.method;
      if (method !== "GET") { checkOrigin(req); requireUser(user); }
      if (area === "library" || area === "profile") requireUser(user);
      // Next parses bodyless requests without a JSON content type as an empty string.
      const body = req.body == null || req.body === "" ? {} : req.body;
      if (typeof body !== "object" || Array.isArray(body)) fail(400,"Invalid request.");
      const api = await service();
      let result;
      if (area === "search") result = await api.search(user,req.query);
      if (area === "profile") result = method === "GET" ? await api.myProfile(user) : await api.saveProfile(user,body);
      if (area === "profiles") result = await api.profile(user,id,req.query);
      if (area === "library") result = await api.library(user,req.query);
      if (area === "rhythms") {
        if (action === "media") result = mediaAction === "playback" ? await api.mediaPlayback(user,id,commentId)
          : mediaAction === "complete" ? await api.completeMedia(user,id,commentId)
          : method === "GET" ? await api.mediaStatus(user,id,commentId)
          : method === "DELETE" ? await api.removeMedia(user,id,commentId) : await api.startMedia(user,id,body);
        else if (action === "save") result = await api.bookmark(user,id,method === "PUT");
        else if (action === "like") result = await api.like(user,id,method === "PUT");
        else if (action === "engagement") result = await api.engagement(user,id);
        else if (action === "similar") result = await api.similarRhythms(user,id,req.query);
        else if (action === "comments") result = method === "GET" ? await api.comments(user,id,req.query)
          : method === "POST" ? await api.addComment(user,id,body) : await api.removeComment(user,id,commentId);
        else if (method === "GET") result = await api.getRhythm(user,id);
        else if (method === "POST") result = await api.createRhythm(user,body);
        else if (method === "PATCH") result = await api.updateRhythm(user,id,body);
        else result = await api.removeRhythm(user,id);
      }
      return res.status(method === "POST" ? 201 : 200).json(result);
    } catch (error) {
      return res.status(error instanceof SocialError ? error.status : 503).json({ error: error instanceof SocialError ? error.message : "Community is temporarily unavailable. Please try again shortly." });
    }
  };
}
