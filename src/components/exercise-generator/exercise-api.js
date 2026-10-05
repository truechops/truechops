import { normalizeExerciseConfig } from "../../lib/exercise-config";

// Saved configurations live with the signed-in user; signed-out visitors keep
// them in this browser.
const LOCAL_KEY = "truechops-exercise-configs";

function readLocal() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LOCAL_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.map(normalizeExerciseConfig) : [];
  } catch (error) {
    return [];
  }
}

function writeLocal(configs) {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(configs));
  } catch (error) {
    // Storage can be unavailable (private browsing); saving then lasts for this visit only.
  }
}

async function request(url, options) {
  const response = await fetch(url, { cache: "no-store", ...options });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

export async function loadSavedConfigs() {
  const { response, payload } = await request("/api/exercise-configs");
  if (response.status === 401) return { configs: readLocal(), signedIn: false };
  if (!response.ok) throw new Error(payload.error || "Could not load saved configurations.");
  return { configs: payload.configs || [], signedIn: true };
}

export async function saveConfig(config, signedIn) {
  if (!signedIn) {
    const saved = normalizeExerciseConfig({ ...config, id: config.id || `local-${Date.now()}` });
    writeLocal([saved, ...readLocal().filter((existing) => existing.id !== saved.id)]);
    return saved;
  }
  const { response, payload } = await request("/api/exercise-configs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config }),
  });
  if (!response.ok) throw new Error(payload.error || "Could not save the configuration.");
  return payload.config;
}

export async function deleteConfig(id, signedIn) {
  if (!signedIn) {
    writeLocal(readLocal().filter((existing) => existing.id !== id));
    return;
  }
  const { response, payload } = await request(`/api/exercise-configs?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok) throw new Error(payload.error || "Could not delete the configuration.");
}

export async function generateMeasures(config, count, start = 0) {
  const { response, payload } = await request("/api/exercise-generator", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config, count, start }),
  });
  if (!response.ok) throw new Error(payload.error || "Could not generate exercises.");
  return payload;
}
