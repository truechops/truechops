// Shared admission limits. Bunny validates and encodes the actual file contents.
export const MEDIA_TYPES = {
  video: { label: "Video", maxBytes: 500 * 1024 * 1024, accept: ".mp4,.mov,.webm", extensions: { mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm" } },
  audio: { label: "Audio", maxBytes: 100 * 1024 * 1024, accept: ".mp3,.wav,.ogg", extensions: { mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg" } },
};
export function mediaFileInfo(kind, file) {
  const spec = MEDIA_TYPES[kind];
  if (!spec) throw new Error("Choose audio or video.");
  const name = typeof file?.name === "string" ? file.name.trim() : "";
  const extension = name.split(".").pop().toLowerCase(), mime = spec.extensions[extension];
  if (!name || name.length > 180 || /[\x00-\x1f/\\]/.test(name) || !mime) throw new Error(`Choose a ${spec.label.toLowerCase()} file: ${spec.accept}.`);
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > spec.maxBytes) throw new Error(`${spec.label} must be between 1 byte and ${spec.maxBytes / 1024 / 1024} MB.`);
  return { kind, name, size: file.size, mime };
}
