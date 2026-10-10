export async function practiceRequest(path, method = "GET", body, signal) {
  const response = await fetch(`/api/${path}`, {
    method, cache: "no-store", signal,
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Please try again.");
  return result;
}
