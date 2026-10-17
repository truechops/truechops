const HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "www.youtu.be", "youtube-nocookie.com", "www.youtube-nocookie.com"]);

// Parse locally: never fetch an arbitrary URL or embed user-supplied HTML.
export function parseYouTubeUrl(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 2048) return null;
  try {
    const input = value.trim();
    const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    if (!HOSTS.has(url.hostname) || !["https:", "http:"].includes(url.protocol) || url.username || url.password || url.port) return null;
    const segments = url.pathname.split("/").filter(Boolean);
    const short = url.hostname === "youtu.be" || url.hostname === "www.youtu.be";
    const id = short && segments.length === 1 ? segments[0] :
      segments.length === 1 && segments[0] === "watch" ? url.searchParams.get("v") :
        segments.length === 2 && ["shorts", "live", "embed"].includes(segments[0]) ? segments[1] : null;
    if (!/^[\w-]{11}$/.test(id || "")) return null;
    const timestamp = url.searchParams.get("t") || url.searchParams.get("start") || new URLSearchParams(url.hash.slice(1)).get("t") || "0";
    const units = timestamp.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    const start = /^\d+$/.test(timestamp) ? Number(timestamp) : units ? Number(units[1] || 0) * 3600 + Number(units[2] || 0) * 60 + Number(units[3] || 0) : NaN;
    if (!Number.isSafeInteger(start) || start < 0) return null;
    return {
      id, start, provider: "youtube", kind: "video", status: "ready",
      url: `https://www.youtube.com/watch?v=${id}${start ? `&t=${start}s` : ""}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}?playsinline=1${start ? `&start=${start}` : ""}`,
    };
  } catch { return null; }
}

export function videoForRhythm(rhythm) {
  return parseYouTubeUrl(rhythm?.youtubeUrl) || rhythm?.media?.find((item) => item.kind === "video" && item.status === "ready");
}
