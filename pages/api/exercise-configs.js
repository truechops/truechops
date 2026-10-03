import crypto from "crypto";
import { getMongoDb, getSessionUser } from "../../src/lib/auth/session";
import { normalizeExerciseConfig } from "../../src/lib/exercise-config";

const MAX_SAVED_CONFIGS = 100;

// A signed-in user's saved exercise configurations.
// GET → { configs }, POST { config } → { config } (creates or updates by id),
// DELETE ?id= → { ok }.
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  const user = getSessionUser(req);

  if (!user?.id) {
    res.status(401).json({ error: "Sign in to save configurations." });
    return;
  }

  try {
    const collection = (await getMongoDb()).collection("exerciseConfigs");

    if (req.method === "GET") {
      const docs = await collection.find({ userId: user.id }).sort({ updatedAt: -1 }).limit(MAX_SAVED_CONFIGS).toArray();
      res.status(200).json({ configs: docs.map((doc) => normalizeExerciseConfig({ ...doc.config, id: doc._id })) });
      return;
    }

    if (req.method === "POST") {
      const config = normalizeExerciseConfig(req.body?.config);
      const id = config.id || crypto.randomUUID();
      const stored = { ...config };
      delete stored.id;
      await collection.updateOne(
        { _id: id, userId: user.id },
        { $set: { config: stored, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
        { upsert: true }
      );
      res.status(200).json({ config: { ...stored, id } });
      return;
    }

    if (req.method === "DELETE") {
      await collection.deleteOne({ _id: String(req.query.id || ""), userId: user.id });
      res.status(200).json({ ok: true });
      return;
    }

    res.setHeader("Allow", ["GET", "POST", "DELETE"]);
    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
