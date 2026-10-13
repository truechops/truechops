import crypto from "crypto";
import { fail, string } from "./validation";

export function createEngagementService(db, { readable, publicProfile, now }) {
  const likes = db.collection("rhythmLikes"), comments = db.collection("rhythmComments"), profiles = db.collection("profiles");
  const requireAccount = (user) => { if (!user?.id) fail(401,"Sign in to join the conversation."); return user.id; };
  async function published(user,id) {
    const row = await readable(id,user?.id);
    if (row.visibility !== "public") fail(404,"This rhythm is private or no longer available.");
    return row;
  }
  async function summary(user,id) {
    const [likeCount,commentCount,liked] = await Promise.all([
      likes.countDocuments({ rhythmId: id }), comments.countDocuments({ rhythmId: id }),
      user?.id ? likes.findOne({ rhythmId: id, userId: user.id }) : null,
    ]);
    return { likeCount, commentCount, liked: Boolean(liked) };
  }
  async function commentCards(rows,user,rhythm) {
    const authors = await profiles.find({ userId: { $in: [...new Set(rows.map((row) => row.userId))] } }).toArray();
    return rows.map((row) => ({ id: row._id, text: row.text, createdAt: row.createdAt,
      author: publicProfile(authors.find((profile) => profile.userId === row.userId)),
      canDelete: Boolean(user?.id && (row.userId === user.id || rhythm._userId === user.id)),
    }));
  }
  return {
    async engagement(user,id) {
      const row = await readable(id,user?.id);
      return summary(user,String(row._id));
    },
    async like(user,id,liked) {
      const userId = requireAccount(user), row = await published(user,id), rhythmId = String(row._id);
      const key = crypto.createHash("sha256").update(JSON.stringify([userId,rhythmId])).digest("hex");
      if (liked) {
        try { await likes.updateOne({ _id: key },{ $setOnInsert: { userId, rhythmId, createdAt: now() } },{ upsert: true }); }
        catch (error) { if (error.code !== 11000) throw error; }
      } else await likes.deleteOne({ _id: key, userId });
      return summary(user,rhythmId);
    },
    async comments(user,id,query = {}) {
      const row = await published(user,id), rhythmId = String(row._id);
      if (typeof query.page === "object") fail(400,"Invalid comment page.");
      const page = Number(query.page || 1), limit = 20;
      if (!Number.isInteger(page) || page < 1 || page > 1000) fail(400,"Invalid comment page.");
      const rows = await comments.find({ rhythmId }).sort({ createdAt: -1, _id: -1 }).skip((page-1)*limit).limit(limit+1).toArray();
      return { items: await commentCards(rows.slice(0,limit),user,row), page, hasMore: rows.length > limit && page < 1000 };
    },
    async addComment(user,id,body) {
      const userId = requireAccount(user), text = string(body.text,1000,"comment",true);
      const row = await published(user,id);
      if (!await profiles.findOne({ userId })) fail(409,"Create your public profile before commenting.");
      // Bound accidental repeats/spam without exposing account details publicly.
      if (await comments.countDocuments({ userId, createdAt: { $gte: new Date(now().getTime()-60000) } }) >= 10) fail(429,"Take a moment before posting another comment.");
      const comment = { _id: crypto.randomUUID(), userId, rhythmId: String(row._id), text, createdAt: now() };
      await comments.insertOne(comment);
      return { comment: (await commentCards([comment],user,row))[0], ...await summary(user,String(row._id)) };
    },
    async removeComment(user,id,commentId) {
      const userId = requireAccount(user), row = await readable(id,userId);
      const filter = { _id: string(commentId,80,"comment ID",true), rhythmId: String(row._id), ...(row._userId === userId ? {} : { userId }) };
      const result = await comments.deleteOne(filter);
      if (!result.deletedCount) fail(404,"Comment not found.");
      return { removed: true, ...await summary(user,String(row._id)) };
    },
    async removeEngagement(id) {
      await Promise.all([likes.deleteMany({ rhythmId: id }),comments.deleteMany({ rhythmId: id })]);
    },
  };
}
