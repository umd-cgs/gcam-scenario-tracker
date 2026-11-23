import test from "node:test";
import assert from "node:assert/strict";
import {
  statusOf,
  recency,
  safeUrl,
  matchesSearch,
  timestamp,
  hasErrors,
} from "./lib.js";

test("run statuses distinguish tracked, running, finished, and errors", () => {
  assert.equal(statusOf({}), "Tracked");
  assert.equal(statusOf({ submitted: "2026-01-01" }), "In progress");
  assert.equal(statusOf({ finished: "2026-01-02" }), "Finished");
  assert.equal(
    statusOf({ finished: "2026-01-02", errors: "Yes" }),
    "Needs review",
  );
  assert.equal(hasErrors("No"), false);
});
test("timestamps preserve offsets and parse Python fractional precision", () => {
  assert.equal(
    timestamp("2026-01-01T10:00:00-04:00"),
    timestamp("2026-01-01T14:00:00Z"),
  );
  assert.equal(
    timestamp("2026-01-01 14:00:00.123456"),
    timestamp("2026-01-01T14:00:00.123"),
  );
  assert.equal(timestamp("bad"), 0);
});
test("recency uses submission, run date, then upload date", () => {
  assert.equal(
    recency({ submitted: "2026-01-02", upload_date: "2026-01-04" }),
    timestamp("2026-01-02"),
  );
  assert.equal(recency({ date_run: "2026-01-03" }), timestamp("2026-01-03"));
  assert.equal(recency({ upload_date: "2026-01-04" }), timestamp("2026-01-04"));
});
test("search uses all words across metadata and links reject unsafe schemes", () => {
  assert.equal(
    matchesSearch({ name: "Policy A", person: "Alex" }, "alex policy"),
    true,
  );
  assert.equal(matchesSearch({ name: "Policy A" }, "missing"), false);
  assert.equal(safeUrl("javascript:alert(1)"), null);
  assert.equal(safeUrl("https://example.org"), "https://example.org/");
});
