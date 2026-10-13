import crypto from "crypto";
import { fail, string } from "./validation";
import { mediaFileInfo } from "./media-config";
import { createBunnyClient } from "./bunny";

export function createMediaService(db, { readable, now = () => new Date(), bunny = createBunnyClient() }) {
  const uploads = db.collection("rhythmMedia"), rhythms = db.collection("rhythms");
  async function owned(user,id) {
    if (!user?.id) fail(401,"Sign in to upload recordings.");
    const rhythm = await readable(id,user.id);
    if (rhythm._userId !== user.id || rhythm.type !== "saved") fail(404,"Rhythm not found in your library.");
    return rhythm;
  }
  async function recording(rhythm,id) {
    const row = await uploads.findOne({ _id:string(id,80,"recording ID",true), rhythmId:String(rhythm._id), userId:rhythm._userId });
    if (!row || row.status === "deleting") fail(404,"Recording not found.");
    return row;
  }
  function card(row) {
    const value = { id:row._id, kind:row.kind, name:row.name, status:row.status, duration:row.duration || 0 };
    if (row.kind === "video" && row.status === "ready") {
      // Configuration changes must not prevent browsing notation.
      try { value.thumbnailUrl = bunny.thumbnail(row.videoId,row.thumbnail,now()); } catch { /* No thumbnail until media is configured. */ }
    }
    return value;
  }
  async function refresh(row) {
    const video = await bunny.get(row.videoId);
    if (String(video.videoLibraryId) !== String(row.libraryId) || video.guid !== row.videoId) fail(502,"Couldn't verify this recording.");
    const state = Number(video.status);
    const status = [3,4].includes(state) ? "ready" : [5,8].includes(state) ? "failed" :
      [1,2,7].includes(state) || state === 0 && video.storageSize > 0 ? "processing" : "uploading";
    const data = { status, checkedAt:now(), duration:Number(video.length) || 0, thumbnail:video.thumbnailFileName || "thumbnail.jpg" };
    await uploads.updateOne({ _id:row._id, status:row.status },{ $set:data });
    const current = await uploads.findOne({ _id:row._id });
    if (!current || current.status === "deleting") fail(404,"Recording not found.");
    return current;
  }
  async function retire(row) {
    // Keep a durable deletion record if Bunny is unavailable; cleanup retries it.
    await uploads.updateOne({ _id:row._id },{ $set:{status:"deleting"} });
    try { await bunny.remove(row.videoId); await uploads.deleteOne({ _id:row._id, status:"deleting" }); }
    catch { /* Retried by media:cleanup; no playback credentials are issued. */ }
  }
  return {
    async mediaCards(rows) {
      const ids = rows.flatMap((row) => Object.values(row.mediaIds || {}).filter(Boolean));
      if (!ids.length) return new Map();
      const records = await uploads.find({ _id:{$in:ids} }).toArray();
      return new Map(rows.map((rhythm) => [String(rhythm._id),records.filter((row) => row.rhythmId === String(rhythm._id) &&
        row.userId === rhythm._userId && rhythm.mediaIds?.[row.kind] === row._id && row.status !== "deleting").map(card)]));
    },
    async startMedia(user,id,body) {
      const rhythm = await owned(user,id);
      let info;
      try { info = mediaFileInfo(body.kind,body); } catch(error) { fail(400,error.message); }
      if (body.uploadId) {
        const existing = await recording(rhythm,body.uploadId);
        if (existing.kind !== info.kind || existing.size !== info.size || existing.name !== info.name || existing.status !== "uploading") fail(409,"Choose this recording's original file, or start a new upload.");
        return { media:card(existing), upload:bunny.credentials(existing.videoId,now()) };
      }
      bunny.config();
      const bucket = crypto.createHash("sha256").update(`${user.id}:${Math.floor(now().getTime()/3600000)}`).digest("hex");
      try {
        await db.collection("rhythmMediaLimits").updateOne({ _id:bucket, count:{$lt:10} },{
          $inc:{count:1}, $setOnInsert:{expiresAt:new Date(now().getTime()+7200000)},
        },{upsert:true});
      } catch(error) {
        if (error.code === 11000) fail(429,"You've started several uploads. Please try again in an hour.");
        throw error;
      }
      const video = await bunny.create(`${rhythm.name} - ${info.kind}`);
      const row = { _id:crypto.randomUUID(), userId:user.id, rhythmId:String(rhythm._id), ...info,
        libraryId:String(bunny.config().libraryId), videoId:video.guid, status:"uploading", createdAt:now(), checkedAt:now() };
      try { await uploads.insertOne(row); }
      catch(error) { await bunny.remove(video.guid).catch(() => {}); throw error; }
      return { media:card(row), upload:bunny.credentials(row.videoId,now()) };
    },
    async completeMedia(user,id,uploadId) {
      const rhythm = await owned(user,id), row = await refresh(await recording(rhythm,uploadId));
      if (row.status === "uploading") fail(409,"The recording hasn't finished uploading. Try saving again in a moment.");
      if (row.status === "failed") fail(422,"This recording couldn't be processed. Remove it and choose another file.");
      const field = `mediaIds.${row.kind}`, previous = rhythm.mediaIds?.[row.kind];
      const result = await rhythms.updateOne({ _id:rhythm._id, _userId:user.id },{ $set:{ [field]:row._id, updatedAt:now() } });
      if (!result.matchedCount) { await retire(row); fail(404,"Rhythm no longer available."); }
      if (previous && previous !== row._id) {
        const old = await uploads.findOne({ _id:previous, userId:user.id, rhythmId:String(rhythm._id) });
        if (old) await retire(old);
      }
      return { media:card(row) };
    },
    async mediaStatus(user,id,uploadId) {
      const rhythm = await readable(id,user?.id);
      let row = await recording(rhythm,uploadId);
      if (rhythm.mediaIds?.[row.kind] !== row._id && rhythm._userId !== user?.id) fail(404,"Recording not found.");
      if (["uploading","processing"].includes(row.status) && now().getTime()-new Date(row.checkedAt).getTime() >= 15000) row = await refresh(row);
      return { media:card(row) };
    },
    async mediaPlayback(user,id,uploadId) {
      const rhythm = await readable(id,user?.id);
      let row = await recording(rhythm,uploadId);
      if (rhythm.mediaIds?.[row.kind] !== row._id) fail(404,"Recording not found.");
      if (row.status !== "ready") row = await refresh(row);
      if (row.status !== "ready") fail(409,row.status === "failed" ? "This recording couldn't be processed." : "This recording is still processing. Try again shortly.");
      return { embedUrl:bunny.embed(row.videoId,now()), expiresAt:new Date(now().getTime()+3600000) };
    },
    async removeMedia(user,id,uploadId) {
      const rhythm = await owned(user,id);
      const row = await uploads.findOne({ _id:string(uploadId,80,"recording ID",true), rhythmId:String(rhythm._id), userId:user.id });
      if (!row) return { removed:true };
      const field = `mediaIds.${row.kind}`;
      await rhythms.updateOne({ _id:rhythm._id, [field]:row._id },{ $unset:{[field]:""}, $set:{updatedAt:now()} });
      await retire(row);
      return { removed:true };
    },
    async removeAllMedia(id) {
      const rows = await uploads.find({ rhythmId:String(id) }).toArray();
      await Promise.all(rows.map(retire));
    },
    async syncMediaWebhook(libraryId,videoId) {
      const row = await uploads.findOne({ libraryId:String(libraryId), videoId });
      if (!row || row.status === "deleting") return;
      // Query Bunny for current state: duplicate/out-of-order callbacks can't roll it back.
      await refresh(row);
    },
    async cleanupMedia({ dryRun = false } = {}) {
      const rows = await uploads.find({}).toArray();
      let removed = 0;
      for (const row of rows) {
        let rhythm;
        try { rhythm = await readable(row.rhythmId,row.userId); }
        catch(error) { if (error.status !== 404) throw error; }
        const attached = rhythm?.mediaIds?.[row.kind] === row._id;
        if (row.status === "deleting" || !attached && new Date(row.createdAt).getTime() < now().getTime()-86400000) {
          if (!dryRun) await retire(row);
          removed++;
        }
      }
      return { processed:removed };
    },
  };
}
