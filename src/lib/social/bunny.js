import crypto from "crypto";
import { fail } from "./validation";

export function bunnyConfig(env = process.env) {
  const config = { libraryId: env.BUNNY_STREAM_LIBRARY_ID, apiKey: env.BUNNY_STREAM_API_KEY,
    tokenKey: env.BUNNY_STREAM_TOKEN_KEY, hostname: env.BUNNY_STREAM_CDN_HOSTNAME };
  if (!/^\d+$/.test(config.libraryId || "") || !config.apiKey || !config.tokenKey ||
    !/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/i.test(config.hostname || "")) {
    fail(503,"Media uploads aren't configured yet. You can still save your rhythm without media.");
  }
  return config;
}
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const videoId = (value) => {
  if (!/^[a-f0-9-]{36}$/i.test(value || "")) fail(502,"The media service returned an invalid recording.");
  return value;
};
export function uploadCredentials(config, id, now = new Date()) {
  const expires = Math.floor(now.getTime()/1000) + 3600;
  return { endpoint:"https://video.bunnycdn.com/tusupload", headers: {
    AuthorizationSignature: sha256(`${config.libraryId}${config.apiKey}${expires}${videoId(id)}`),
    AuthorizationExpire: String(expires), LibraryId: String(config.libraryId), VideoId: id,
  } };
}
export function embedUrl(config, id, now = new Date()) {
  const expires = Math.floor(now.getTime()/1000) + 3600;
  const token = sha256(`${config.tokenKey}${videoId(id)}${expires}`);
  return `https://player.mediadelivery.net/embed/${config.libraryId}/${id}?token=${token}&expires=${expires}&autoplay=false&preload=false&responsive=true`;
}
export function thumbnailUrl(config, id, filename = "thumbnail.jpg", now = new Date()) {
  if (!/^[a-z0-9_.-]+\.(jpg|jpeg|png|webp)$/i.test(filename)) filename = "thumbnail.jpg";
  const path = `/${videoId(id)}/${filename}`, expires = Math.floor(now.getTime()/1000) + 600;
  const token = "HS256-" + crypto.createHmac("sha256",config.tokenKey).update(`${path}${expires}`).digest("base64url");
  return `https://${config.hostname}${path}?token=${token}&expires=${expires}`;
}
export function verifyBunnyWebhook(raw, headers, secret) {
  const signature = headers["x-bunnystream-signature"];
  if (!secret || headers["x-bunnystream-signature-version"] !== "v1" || headers["x-bunnystream-signature-algorithm"] !== "hmac-sha256" ||
    typeof signature !== "string" || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = crypto.createHmac("sha256",secret).update(raw).digest();
  return crypto.timingSafeEqual(expected,Buffer.from(signature,"hex"));
}
export function createBunnyClient({ config = bunnyConfig, request = fetch } = {}) {
  async function call(method, id, body) {
    const settings = config();
    let response;
    try {
      response = await request(`https://video.bunnycdn.com/library/${settings.libraryId}/videos${id ? `/${videoId(id)}` : ""}`,{
        method, headers: { AccessKey:settings.apiKey, Accept:"application/json", ...(body ? {"Content-Type":"application/json"} : {}) },
        ...(body ? { body:JSON.stringify(body) } : {}), signal:AbortSignal.timeout(15000), redirect:"error",
      });
    } catch { fail(502,"Couldn't reach the media service. Please try again."); }
    if (method === "DELETE" && response.status === 404) return {};
    if (!response.ok) fail(502,"The media service couldn't complete this request. Please try again.");
    if (response.status === 204) return {};
    return response.json();
  }
  return {
    config,
    async create(title) { const result = await call("POST",null,{title}); videoId(result.guid); return result; },
    get: (id) => call("GET",id), remove: (id) => call("DELETE",id),
    credentials: (id,now) => uploadCredentials(config(),id,now),
    embed: (id,now) => embedUrl(config(),id,now),
    thumbnail: (id,filename,now) => thumbnailUrl(config(),id,filename,now),
  };
}
