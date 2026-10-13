import { verifyBunnyWebhook } from "../../../src/lib/social/bunny";
import { productionSocialService } from "../../../src/lib/social/server";
export const config = { api:{bodyParser:false} };

export function webhookHandler({ secret = () => process.env.BUNNY_STREAM_WEBHOOK_SECRET, service = productionSocialService } = {}) {
  return async (req,res) => {
    res.setHeader("Cache-Control","no-store");
    if (req.method !== "POST") { res.setHeader("Allow","POST"); return void res.status(405).end(); }
    if (!secret()) return res.status(503).json({error:"Media callbacks aren't configured."});
    try {
      const chunks = []; let length = 0;
      for await (const chunk of req) {
        length += chunk.length;
        if (length > 32768) return void res.status(413).end();
        chunks.push(Buffer.from(chunk));
      }
      const raw = Buffer.concat(chunks);
      if (!verifyBunnyWebhook(raw,req.headers,secret())) return void res.status(401).end();
      let body;
      try { body = JSON.parse(raw.toString("utf8")); } catch { return void res.status(400).end(); }
      if (!body || !/^\d+$/.test(String(body.VideoLibraryId)) || typeof body.VideoGuid !== "string" || !/^[a-f0-9-]{36}$/i.test(body.VideoGuid)) return void res.status(400).end();
      const api = await service();
      await api.syncMediaWebhook(body.VideoLibraryId,body.VideoGuid);
      return res.status(200).json({received:true});
    } catch { return res.status(503).json({error:"Please retry the callback."}); }
  };
}
export default webhookHandler();
