export async function socialRequest(path, { method = "GET", body, signal } = {}) {
  const response = await fetch(`/api/social/${path}`, { method, signal, cache: "no-store", credentials: "same-origin",
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  let payload;
  try { payload = await response.json(); } catch { throw new Error("Couldn't reach the community. Please try again."); }
  if (!response.ok) throw new Error(payload.error || "Please try again.");
  return payload;
}
