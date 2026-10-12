import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function documentationScreenshot(page: Page, name: string) {
  const maps = page.locator(".network-map");
  const count = await maps.count();
  const previous: string[] = [];
  for (let index = 0; index < count; index++) {
    const map = maps.nth(index);
    await map.getByRole("button", { name: "Map options", exact: true }).click();
    const background = map.getByLabel("Map background");
    previous.push(await background.inputValue());
    await background.selectOption("satellite");
    await map.getByRole("button", { name: "Close map options" }).click();
  }
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll(".map-canvas")).every(element =>
      element.querySelector("canvas") !== null,
    ),
  );
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `../docs/screenshots/${name}.png`, fullPage: true });
  for (let index = 0; index < count; index++) {
    const map = maps.nth(index);
    await map.getByRole("button", { name: "Map options", exact: true }).click();
    await map.getByLabel("Map background").selectOption(previous[index]);
    await map.getByRole("button", { name: "Close map options" }).click();
  }
}

test.describe.configure({ mode: "serial" });
test.beforeAll(async ({ request }) => {
  expect(
    (
      await request.post("/api/simulation/control", {
        data: { action: "reset" },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await request.post("/api/simulation/control", {
        data: { action: "pause" },
      })
    ).ok(),
  ).toBeTruthy();
});
test.afterAll(async ({ request }) => {
  await request.post("/api/simulation/control", { data: { action: "reset" } });
});

test("all thirteen pages load API data without browser errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const [path, title, endpoint] of [
    ["/", "Overview", "/overview"],
    ["/map", "Network Map", "/sites/14"],
    ["/noc", "NOC Monitoring", "/sites"],
    ["/incidents", "Alarms & Incidents", "/alarms"],
    ["/sites", "LTE Sites", "/sites"],
    ["/inventory", "Network Inventory", "/inventory"],
    ["/devices", "Connected Devices", "/devices"],
    ["/applications", "Industrial Applications", "/applications"],
    ["/adoption", "LTE Adoption", "/adoption"],
    ["/analytics", "Analytics", "/analytics"],
    ["/simulation", "Simulation Center", "/simulation"],
    ["/settings", "Settings", "/settings"],
    ["/about", "About MineOps", "/overview"],
  ]) {
    const responsePromise = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api" + endpoint,
    );
    await page.goto(path);
    expect((await responsePromise).ok()).toBeTruthy();
    await expect(
      page.getByRole("heading", { name: title, exact: true, level: 1 }),
    ).toBeVisible();
    await expect(page.locator(".error")).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test("map simulates 42/3/1 impact, opens incident and recovers", async ({
  page,
  request,
}) => {
  await page.goto("/map");
  await expect(
    page.locator(".impact-counts").getByText("0", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await expect(page.locator(".map-error")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Simulate backhaul failure", exact: true })
    .click();
  await expect(
    page.locator(".impact-counts").getByText("42", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".impact-counts").getByText("3", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".impact-counts").getByText("1", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".app-impact")).toHaveCount(3);
  await documentationScreenshot(page, "impact-analysis");
  await page.getByRole("link", { name: "Alarms & Incidents" }).click();
  const row = page
    .getByRole("row")
    .filter({ hasText: "Backhaul Down" })
    .first();
  await row.getByRole("button", { name: "Acknowledge", exact: true }).click();
  await expect(row).toContainText("Acknowledged");
  await row.getByRole("button", { name: "Create incident" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create incident", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Incident management" }).click();
  await page
    .getByRole("row")
    .filter({ hasText: "Backhaul Down" })
    .first()
    .click();
  await page.getByRole("button", { name: "Move to Investigating" }).click();
  await expect(
    page.getByRole("dialog").getByText("Investigating", { exact: true }),
  ).toBeVisible();
  const incidents = await (
    await request.get("/api/incidents?status=Investigating")
  ).json();
  const id = incidents.items.find(
    (i: { site_id: number }) => i.site_id === 14,
  ).id;
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("link", { name: "Network Map", exact: true }).click();
  await page.getByRole("button", { name: "Recover site", exact: true }).click();
  await expect(
    page.locator(".impact-counts").getByText("0", { exact: true }).first(),
  ).toBeVisible();
  expect(
    (await (await request.get(`/api/incidents/${id}`)).json()).status,
  ).toBe("Investigating");
  await page.getByRole("link", { name: "Alarms & Incidents" }).click();
  await page.getByRole("button", { name: "Incident management" }).click();
  await page
    .getByRole("row")
    .filter({ hasText: "Backhaul Down" })
    .first()
    .click();
  await page.getByRole("button", { name: "Move to Resolved" }).click();
  await page.getByRole("button", { name: "Move to Closed" }).click();
  await expect(
    page.getByRole("dialog").getByText("Closed", { exact: true }),
  ).toBeVisible();
});

test("expansion request activates a site visible on the map", async ({
  page,
  request,
}) => {
  await page.goto("/adoption");
  await page.getByRole("button", { name: "New connectivity request" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Request title").fill("E2E Synthetic North Pit");
  await dialog
    .getByLabel("Business justification")
    .fill("Original fictional equipment connectivity");
  await dialog
    .getByRole("button", { name: "Create connectivity request" })
    .click();
  await expect(dialog).toHaveCount(0);
  const row = page
    .getByRole("row")
    .filter({ hasText: "E2E Synthetic North Pit" });
  for (let stage = 0; stage < 7; stage++) {
    await row.getByRole("button", { name: "Advance stage" }).click();
    await expect(row).toContainText(
      [
        "Initial Assessment",
        "Coverage Analysis",
        "Technical Design",
        "Planning",
        "Deployment",
        "Validation",
        "Operational Handover",
      ][stage],
    );
  }
  await row.getByRole("button", { name: "Activate site" }).click();
  await expect(
    row.getByRole("button", { name: "Open new site" }),
  ).toBeVisible();
  const sites = await (await request.get("/api/sites")).json();
  expect(sites.total).toBe(25);
  await page.getByRole("link", { name: "Network Map", exact: true }).click();
  await page.getByLabel("Inspect site", { exact: true }).selectOption("25");
  await expect(page.locator(".panel-site")).toContainText("SITE-LTE-025");
  await expect(page.locator(".panel-site")).toContainText("operational");
  await documentationScreenshot(page, "expansion");
});

test("overview renders charts, theme toggle and tablet layout", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".kpi").first()).toContainText(
    "Network availability",
  );
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await documentationScreenshot(page, "overview");
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(page.locator(".app")).toHaveClass("app light");
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/map");
  await expect(page.locator(".impact-panel")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});

test("mine map supports antenna selection, sector inspection and expanded view", async ({
  page,
  request,
}) => {
  await page.goto("/map");
  const geography = await (await request.get("/api/coverage")).json();
  const cells = await (await request.get("/api/cells")).json();
  expect(
    geography.features.filter(
      (f: { properties: { kind: string } }) => f.properties.kind === "coverage",
    ),
  ).toHaveLength(cells.length * 3);
  await page.getByRole("button", { name: "Map options", exact: true }).click();
  await page.getByLabel("Show legends").check();
  await page.getByRole("button", { name: "Close map options" }).click();
  await expect(
    page.getByText("Directional LTE · 3 sectors / site"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Inspect SITE-LTE-007", exact: true })
    .click();
  await expect(page.locator(".panel-site")).toContainText("SITE-LTE-007");
  await page.getByRole("button", { name: "Signal probe", exact: true }).click();
  await page
    .getByRole("button", { name: "Inspect SITE-LTE-007", exact: true })
    .click();
  await expect(page.locator(".probe-value")).toContainText("-80 dBm");
  await page.getByRole("button", { name: "Close signal probe" }).click();
  await page.getByRole("button", { name: /^Sector 2/ }).click();
  await expect(page.getByRole("button", { name: /^Sector 2/ })).toHaveClass(
    "active",
  );
  await page.getByRole("button", { name: "Focus selected site" }).click();
  await page.getByRole("button", { name: "Expand map", exact: true }).click();
  await expect(page.locator(".network-map")).toHaveClass(/expanded/);
  await page.keyboard.press("Escape");
  await expect(page.locator(".network-map")).not.toHaveClass(/expanded/);
  await page.getByRole("button", { name: "All sectors", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "All sectors", exact: true }),
  ).toHaveClass("active");
  await expect(page.locator(".map-error")).toHaveCount(0);
  await documentationScreenshot(page, "directional-map");
});

test("all towers fit the mine viewport and satellite imagery loads", async ({
  page,
  request,
}) => {
  await page.goto("/map");
  const count = (await (await request.get("/api/sites")).json()).total;
  await expect(page.locator(".site-pin")).toHaveCount(count);
  await page.getByRole("button", { name: /^Fit all towers/ }).click();
  const allInside = () =>
    page.evaluate(() => {
      const canvas = document
        .querySelector(".map-canvas")!
        .getBoundingClientRect();
      return Array.from(document.querySelectorAll(".site-pin")).every(
        (element) => {
          const rect = element.getBoundingClientRect();
          return (
            rect.left >= canvas.left &&
            rect.right <= canvas.right &&
            rect.top >= canvas.top &&
            rect.bottom <= canvas.bottom
          );
        },
      );
    });
  await expect.poll(allInside).toBe(true);
  await page.getByRole("button", { name: "Expand map", exact: true }).click();
  await expect.poll(allInside).toBe(true);
  await page.keyboard.press("Escape");
  await expect.poll(allInside).toBe(true);
  const tile = page.waitForResponse(
    (response) =>
      response.url().includes("World_Imagery/MapServer/tile/") && response.ok(),
  );
  await page.getByRole("button", { name: "Map options", exact: true }).click();
  await page.getByLabel("Map background").selectOption("satellite");
  expect((await tile).headers()["content-type"]).toMatch(/image/);
  await expect(page.locator(".maplibregl-ctrl-attrib")).toContainText("Esri");
  await expect(page.locator(".map-error")).toHaveCount(0);
  await page.getByRole("button", { name: "Close map options" }).click();
  await documentationScreenshot(page, "satellite-map");
  await page.getByRole("button", { name: "Map options", exact: true }).click();
  await page.getByLabel("Map background").selectOption("mine");
  await page.getByRole("button", { name: "Close map options" }).click();
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect.poll(allInside).toBe(true);
  await documentationScreenshot(page, "distributed-sites");
});

test("map menu closes, backgrounds and layers can be hidden, whole map can collapse", async ({
  page,
}) => {
  await page.goto("/map");
  await expect(page.locator(".map-options-panel")).toHaveCount(0);
  await expect(page.locator(".signal-legend")).toHaveCount(0);
  await page.getByRole("button", { name: "Map options", exact: true }).click();
  await page.getByLabel("Map background").selectOption("none");
  await page
    .getByRole("button", { name: "Hide all layers", exact: true })
    .click();
  await expect(page.locator(".site-pin")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator(".map-options-panel")).toHaveCount(0);
  await page.getByRole("button", { name: "Hide map", exact: true }).click();
  await expect(page.locator(".map-canvas")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Show operational map", exact: true })
    .click();
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await page.getByRole("button", { name: "Map options", exact: true }).click();
  await page.getByLabel("Map background").selectOption("mine");
  await page
    .getByRole("button", { name: "Close map options", exact: true })
    .click();
  await expect(page.locator(".map-options-panel")).toHaveCount(0);
});
