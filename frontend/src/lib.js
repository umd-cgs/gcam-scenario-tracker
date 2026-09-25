export const asText = (value) => (value == null ? "" : String(value));
export const hasErrors = (value) =>
  ["yes", "true", "1"].includes(asText(value).trim().toLowerCase());
export function statusOf(scenario) {
  if (hasErrors(scenario.errors)) return "Needs review";
  if (scenario.finished) return "Finished";
  if (scenario.submitted) return "In progress";
  return "Tracked";
}
export function timestamp(value) {
  let text = asText(value)
    .trim()
    .replace(" ", "T")
    .replace(/(\.\d{3})\d+/, "$1");
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) text += "T00:00:00";
  const result = Date.parse(text);
  return Number.isNaN(result) ? 0 : result;
}
export function formatDate(value, includeTime = false) {
  if (!value) return "—";
  const parsed = timestamp(value);
  if (!parsed) return asText(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(parsed);
}
export const recency = (row) =>
  timestamp(row.submitted || row.date_run || row.upload_date);
export function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
export function matchesSearch(row, query) {
  const blob = Object.values(row).map(asText).join(" ").toLowerCase();
  return query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .every((word) => blob.includes(word));
}
