import { test, expect } from "@playwright/test";

const scenarios = [
  {
    id: "a",
    scenario_name: "Baseline 2050",
    personal_scenario_name: "Reference",
    project_name: "Energy futures",
    person: "Alex",
    input_count: 2,
    submitted: "2026-09-15T10:00:00-04:00",
    finished: "2026-09-15T12:00:00-04:00",
    config_file_id: "drive-a",
    description: "Reference pathway",
  },
  {
    id: "b",
    scenario_name: "Net zero policy",
    project_name: "Energy futures",
    person: "Sam",
    input_count: 1,
    submitted: "2026-09-16T10:00:00-04:00",
    errors: "Yes",
    config_file_id: "drive-b",
  },
  {
    id: "c",
    scenario_name: "Land use sensitivity",
    project_name: "Land systems",
    person: "Alex",
    input_count: 0,
    upload_date: "2026-09-14",
  },
];
const inputs = [
  {
    id: "1",
    file_name: "energy.xml",
    folder_location: "base/energy",
    regions_modified: "USA, China",
    years_modified: "2020–2050",
    sectors_modified: "electricity",
    scenario_count: 2,
  },
  {
    id: "2",
    file_name: "policy.xml",
    folder_location: "policy",
    regions_modified: "All",
    years_modified: "2050",
    scenario_count: 1,
  },
];
const data = {
  scenarios,
  input_files: inputs,
  projects: ["Energy futures", "Land systems"],
};

async function mockAPI(page) {
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    let body = data;
    if (url.pathname.startsWith("/api/scenarios/")) {
      const scenario = scenarios.find(
        (row) => row.id === url.pathname.split("/")[3],
      );
      body = {
        scenario,
        input_files: scenario?.id === "a" ? inputs : inputs.slice(0, 1),
      };
    } else if (url.pathname.startsWith("/api/inputs/"))
      body = { input_file: inputs[0], scenarios: scenarios.slice(0, 2) };
    else if (url.pathname === "/api/comparisons")
      body = {
        scenarios: scenarios
          .slice(0, 2)
          .map((scenario, index) => ({
            scenario,
            input_files: index ? inputs.slice(0, 1) : inputs,
          })),
      };
    return route.fulfill({ json: body });
  });
}
test.beforeEach(async ({ page }) => {
  await mockAPI(page);
});

test("dashboard search, project/status filters, column visibility and selection", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Scenarios", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Baseline 2050", exact: true }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Search scenarios" }).fill("sam net");
  await expect(
    page.getByRole("link", { name: "Baseline 2050", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Net zero policy", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await page.getByLabel("Filter by project").selectOption("Land systems");
  await expect(
    page.getByRole("link", { name: "Land use sensitivity", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Baseline 2050", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Reset filters" }).click();
  await page.getByLabel("Filter by status").selectOption("Needs review");
  await expect(
    page.getByRole("link", { name: "Net zero policy", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset filters" }).click();
  await page.getByLabel("Select Baseline 2050", { exact: true }).check();
  await page.getByLabel("Select Net zero policy", { exact: true }).check();
  await expect(
    page.getByRole("link", { name: "Compare scenarios" }),
  ).toBeVisible();
  await page.getByText("Columns", { exact: true }).click();
  await page.getByLabel("Other name", { exact: true }).check();
  await expect(
    page.getByRole("button", { name: "Other name", exact: true }),
  ).toBeVisible();
  await page.getByText("Columns", { exact: true }).click();
  await page
    .getByRole("button", { name: "Column filters", exact: true })
    .click();
  await page.getByLabel("Filter Scenario", { exact: true }).fill("Baseline");
  await expect(
    page.getByRole("link", { name: "Net zero policy", exact: true }),
  ).toHaveCount(0);
});

test("edit uses PATCH and sends only changed metadata; Sonner confirms success", async ({
  page,
}) => {
  let payload;
  await page.route("**/api/scenarios/a", async (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    payload = route.request().postDataJSON();
    expect(route.request().headers()["x-requested-with"]).toBe("GCAM-Tracker");
    await route.fulfill({ json: { status: "success" } });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Edit Baseline 2050", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("textbox", { name: "Description", exact: true })
    .fill("Updated research notes");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Changes saved.", { exact: true })).toBeVisible();
  expect(payload).toEqual({ description: "Updated research notes" });
});

test("failed edits remain open and preserve typed input", async ({ page }) => {
  await page.route("**/api/scenarios/a", (route) =>
    route.fulfill({
      status: 502,
      json: { message: "Google is temporarily unavailable" },
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Edit Baseline 2050", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("textbox", { name: "Description", exact: true })
    .fill("Keep these notes");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Google is temporarily unavailable",
  );
  await expect(
    page
      .getByRole("dialog")
      .getByRole("textbox", { name: "Description", exact: true }),
  ).toHaveValue("Keep these notes");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("upload validates XML extension and sends multipart form", async ({
  page,
}) => {
  let uploaded = false;
  await page.route("**/api/uploads/configuration", (route) => {
    expect(route.request().headers()["content-type"]).toContain(
      "multipart/form-data",
    );
    expect(route.request().postData()).toContain('name="config_file"');
    uploaded = true;
    return route.fulfill({
      status: 201,
      json: {
        status: "success",
        id: "new",
        message: "Uploaded configuration.",
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Upload XML" }).click();
  await page
    .getByLabel("XML file")
    .setInputFiles({
      name: "wrong.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("test"),
    });
  await expect(page.getByRole("alert")).toContainText(
    "Please choose an XML file",
  );
  await page
    .getByLabel("XML file")
    .setInputFiles({
      name: "configuration.xml",
      mimeType: "application/xml",
      buffer: Buffer.from("<Configuration/>"),
    });
  await page.getByRole("button", { name: "Upload file", exact: true }).click();
  await expect(
    page.getByText("Uploaded configuration.", { exact: true }),
  ).toBeVisible();
  expect(uploaded).toBe(true);
});

test("deep links render details and related inputs", async ({ page }) => {
  await page.goto("/scenarios/a");
  await expect(
    page.getByRole("heading", { name: "Baseline 2050", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "energy.xml", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Baseline 2050", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "energy.xml", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "energy.xml", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Used in scenarios" }),
  ).toBeVisible();
});

test("comparison shows differences and exports Excel", async ({ page }) => {
  await page.route("**/api/comparisons/export?*", (route) =>
    route.fulfill({
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      body: Buffer.from("fixture-workbook"),
    }),
  );
  await page.goto("/compare?ids=a,b");
  await expect(
    page.getByRole("heading", { name: "Compare scenarios", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "policy.xml", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "energy.xml", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Show differences only").uncheck();
  await expect(
    page.getByRole("cell", { name: "energy.xml", exact: true }),
  ).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Excel" }).click();
  expect((await downloadEvent).suggestedFilename()).toBe(
    "scenario_comparison.xlsx",
  );
});

test("deletion requires confirmation and cancellation does not mutate", async ({
  page,
}) => {
  let deleted = false;
  await page.route("**/api/scenarios/a", (route) => {
    if (route.request().method() === "DELETE") {
      deleted = true;
      return route.fulfill({ json: { success: true } });
    }
    return route.fallback();
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Delete Baseline 2050", exact: true })
    .click();
  await page.getByRole("button", { name: "Keep scenario" }).click();
  expect(deleted).toBe(false);
  await page
    .getByRole("button", { name: "Delete Baseline 2050", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete scenario", exact: true })
    .click();
  await expect(
    page.getByText("Scenario deleted.", { exact: true }),
  ).toBeVisible();
  expect(deleted).toBe(true);
});

test("connection error is actionable and retry restores dashboard", async ({
  page,
}) => {
  let failed = true;
  await page.route("**/api/data*", (route) =>
    failed
      ? route.fulfill({
          status: 503,
          json: { message: "Google Sheets is unavailable." },
        })
      : route.fulfill({ json: data }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "Google Sheets is unavailable",
  );
  failed = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("link", { name: "Baseline 2050", exact: true }),
  ).toBeVisible();
});

test("table pagination and sorting use TanStack state", async ({ page }) => {
  const many = Array.from({ length: 32 }, (_, index) => ({
    ...scenarios[0],
    id: `run-${index}`,
    scenario_name: `Scenario ${index + 1}`,
  }));
  await page.route("**/api/data*", (route) =>
    route.fulfill({ json: { ...data, scenarios: many } }),
  );
  await page.goto("/");
  await expect(page.getByText("1–25 of 32")).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText("26–32 of 32")).toBeVisible();
  await page.getByRole("button", { name: "Previous page" }).click();
  await page.getByRole("button", { name: "Scenario", exact: true }).click();
  await expect(page.locator("tbody tr").first()).toContainText("Scenario 1");
  await page.getByRole("button", { name: "Scenario", exact: true }).click();
  await expect(page.locator("tbody tr").first()).toContainText("Scenario 32");
});

test("responsive layouts keep page within viewport and have no runtime errors", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Baseline 2050", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true,
  });
  const overflow = await page.evaluate(() => ({
    width: innerWidth,
    actual: document.documentElement.scrollWidth,
    elements: [...document.querySelectorAll("body *")]
      .filter(
        (element) =>
          element.getBoundingClientRect().right > innerWidth &&
          !element.closest(".table-scroll"),
      )
      .map((element) => `${element.tagName}.${element.className}`)
      .slice(0, 12),
  }));
  expect(overflow.actual, JSON.stringify(overflow)).toBeLessThanOrEqual(
    overflow.width,
  );
  expect(errors).toEqual([]);
});
