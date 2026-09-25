export async function request(path, options = {}) {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  headers.set("X-Requested-With", "GCAM-Tracker");
  let response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers,
      credentials: "same-origin",
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error(
      "Could not reach the tracker. Check your connection and try again.",
    );
  }
  const type = response.headers.get("Content-Type") || "";
  if (!response.ok) {
    const data = type.includes("json") ? await response.json() : {};
    throw new Error(
      data.message ||
        data.error ||
        `Request failed (${response.status}). Please try again.`,
    );
  }
  if (!type.includes("json"))
    throw new Error(
      "The server returned an unexpected response. Please refresh.",
    );
  return response.json();
}

export async function download(path, fallbackName) {
  const response = await fetch(`/api${path}`, { credentials: "same-origin" });
  const type = response.headers.get("Content-Type") || "";
  if (!response.ok || type.includes("json") || type.includes("text/html")) {
    const data = type.includes("json") ? await response.json() : {};
    throw new Error(
      data.message || "The download could not be completed. Please try again.",
    );
  }
  const blob = await response.blob();
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = fallbackName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
