import { test, expect, type Page } from "@playwright/test";
import example from "../../src/trips/portugal.trip.json" with { type: "json" };

async function seed(page: Page, locations: Array<{ name: string; latitude?: number; longitude?: number }> = [
  { name: "Lisbon", latitude: 38.7223, longitude: -9.1393 },
  { name: "Porto", latitude: 41.1579, longitude: -8.6291 },
  { name: "Tokyo", latitude: 35.6762, longitude: 139.6503 },
]) {
  await page.addInitScript((stops) => {
    if (localStorage.getItem("trip-planning:library")) return;
    const plan = { title: "Globe test", description: "", tripStartDate: "2027-05-03", currency: "USD",
      destinations: stops.map((s, i) => ({ id: String(i), name: s.name, durationWeeks: 1,
        color: ["#2563eb", "#16a34a", "#e11d48"][i % 3], notes: "",
        costs: { flights: null, lodging: null, food: null, transport: null, misc: null },
        ...(s.latitude === undefined ? {} : { location: { latitude: s.latitude, longitude: s.longitude } }),
      })),
    };
    localStorage.setItem("trip-planning:library", JSON.stringify({ version: 1, activeTripId: "test", trips: [
      { id: "test", createdAt: "2026-09-20T00:00:00Z", updatedAt: "2026-09-20T00:00:00Z", plan },
      { id: "other", createdAt: "2026-09-20T00:00:00Z", updatedAt: "2026-09-20T00:00:00Z", plan: { ...plan, title: "Other trip", destinations: [plan.destinations[0]] } },
    ] }));
  }, locations);
  await page.goto("/");
}
async function openGlobe(page: Page) {
  await page.getByRole("button", { name: "Globe", exact: true }).click();
  const globe = page.getByRole("region", { name: "Interactive trip globe" });
  await expect(globe).toHaveAttribute("data-ready", "true", { timeout: 20000 });
  return globe;
}

test("globe loads on demand, rotates, zooms, resets, and selects stops", async ({ page }, testInfo) => {
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
  const requests: string[] = []; page.on("request", (request) => requests.push(request.url()));
  await seed(page);
  expect(requests.some((url) => url.includes("react-globe_gl") || url.includes("GlobeSurface"))).toBe(false);
  const globe = await openGlobe(page);
  await expect(globe).toHaveAttribute("data-stops", "3");
  await expect(globe).toHaveAttribute("data-legs", "2");
  await expect.poll(async () => Number(await globe.getAttribute("data-altitude"))).toBeCloseTo(2.5, 1);
  const initial = Number(await globe.getAttribute("data-longitude"));
  const box = (await globe.boundingBox())!;
  await page.mouse.move(box.x + box.width * .4, box.y + box.height * .4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .6, box.y + box.height * .45, { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => Math.abs(Number(await globe.getAttribute("data-longitude")) - initial)).toBeGreaterThan(5);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect.poll(async () => Number(await globe.getAttribute("data-longitude"))).toBeCloseTo(initial, 0);
  await page.getByRole("button", { name: "Rotate right", exact: true }).click();
  await expect.poll(async () => Math.abs(Number(await globe.getAttribute("data-longitude")) - initial)).toBeGreaterThan(10);
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect.poll(async () => Number(await globe.getAttribute("data-altitude"))).toBeLessThan(2);
  await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  await expect.poll(async () => Number(await globe.getAttribute("data-altitude"))).toBeGreaterThan(2);
  await page.getByRole("button", { name: /^Tokyo 1 week/ }).click();
  await expect(page.locator(".globe-selection")).toContainText("3. Tokyo");
  await expect.poll(async () => Number(await globe.getAttribute("data-longitude"))).toBeCloseTo(139.6503, 0);
  await expect(page.getByRole("button", { name: "Show stop 3: Tokyo", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect.poll(async () => Number(await globe.getAttribute("data-altitude"))).toBeCloseTo(2.5, 1);
  await page.getByRole("button", { name: "Show stop 1: Lisbon", exact: true }).click();
  await expect(page.locator(".globe-selection")).toContainText("1. Lisbon");
  await page.screenshot({ path: testInfo.outputPath("globe-desktop.png"), fullPage: true });
  expect(errors).toEqual([]);
});

test("location editor validates, cancels, saves, clears, and survives reload", async ({ page }) => {
  await seed(page, [{ name: "Lisbon", latitude: 38.7223, longitude: -9.1393 }, { name: "Porto" }, { name: "Tokyo", latitude: 35.6762, longitude: 139.6503 }]);
  let globe = await openGlobe(page);
  await expect(globe).toHaveAttribute("data-legs", "0");
  await page.getByRole("button", { name: "Edit location for Porto", exact: true }).click();
  await page.getByRole("button", { name: "Save location", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Enter both coordinates");
  await page.getByLabel("Latitude", { exact: true }).fill("91");
  await page.getByLabel("Longitude", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Save location", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(globe).toHaveAttribute("data-stops", "2");
  await page.getByRole("button", { name: "Edit location for Porto", exact: true }).click();
  await page.getByLabel("Latitude", { exact: true }).fill("41.1579");
  await page.getByLabel("Longitude", { exact: true }).fill("-8.6291");
  await page.getByRole("button", { name: "Save location", exact: true }).click();
  await expect(globe).toHaveAttribute("data-legs", "2");
  await page.reload(); globe = await openGlobe(page);
  await expect(globe).toHaveAttribute("data-stops", "3");
  await page.getByRole("button", { name: "Edit location for Porto", exact: true }).click();
  await expect(page.getByLabel("Latitude", { exact: true })).toHaveValue("41.1579");
  await page.getByLabel("Latitude", { exact: true }).fill("0");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Edit location for Porto", exact: true }).click();
  await expect(page.getByLabel("Latitude", { exact: true })).toHaveValue("41.1579");
  await page.getByRole("button", { name: "Clear location", exact: true }).click();
  await expect(globe).toHaveAttribute("data-legs", "0");
  await page.reload(); globe = await openGlobe(page);
  await expect(globe).toHaveAttribute("data-stops", "2");
  await expect(page.locator(".globe-stop-list")).toContainText("Location needed");
});

test("reordering, switching trips, and repeated tab visits update the globe", async ({ page }) => {
  await seed(page);
  await openGlobe(page);
  await page.getByRole("button", { name: "Itinerary", exact: true }).click();
  await expect(page.locator(".globe-canvas canvas")).toHaveCount(0);
  await page.getByRole("button", { name: "Reorder Lisbon" }).focus();
  await page.keyboard.press("Space"); await page.keyboard.press("ArrowDown"); await page.keyboard.press("Space");
  await expect(page.getByRole("textbox", { name: "Destination", exact: true }).first()).toHaveValue("Porto");
  await openGlobe(page);
  await expect(page.locator(".globe-stop-list li").first()).toContainText("Porto");
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Budget", exact: true }).click(); await openGlobe(page);
    await expect(page.locator(".globe-canvas canvas")).toHaveCount(1);
  }
  await page.getByLabel("Current trip", { exact: true }).selectOption("other");
  await expect(page.getByRole("button", { name: "Itinerary", exact: true })).toHaveAttribute("aria-current", "page");
  const globe = await openGlobe(page);
  await expect(globe).toHaveAttribute("data-stops", "1");
  await expect(globe).toHaveAttribute("data-legs", "0");
  await expect(page.locator(".globe-selection")).not.toContainText("Tokyo");
});

test("WebGL failure preserves the route list and editor", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind: string, ...args: unknown[]) {
      if (kind === "webgl2" || kind === "webgl" || kind === "experimental-webgl") return null;
      return original.call(this, kind as "2d", ...args);
    } as typeof original;
  });
  await seed(page);
  await page.getByRole("button", { name: "Globe", exact: true }).click();
  await expect(page.getByRole("heading", { name: "The 3D globe is unavailable" })).toBeVisible();
  await page.getByRole("button", { name: "Edit location for Lisbon", exact: true }).click();
  await page.getByLabel("Latitude", { exact: true }).fill("0");
  await page.getByLabel("Longitude", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Save location", exact: true }).click();
  await expect(page.locator(".globe-stop-list li").first()).toContainText("0.0000, 0.0000");
});

test("mobile and reduced-motion layout supports nearby stops and location editing", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seed(page, example.trip.destinations.map((s) => ({ name: s.name, ...s.location })));
  const globe = await openGlobe(page);
  await page.getByRole("button", { name: /^Porto 1 week/ }).click();
  await expect(globe).toHaveAttribute("data-legs", "1");
  await page.screenshot({ path: testInfo.outputPath("globe-mobile.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Edit location for Porto", exact: true }).click();
  const dialog = page.getByRole("dialog");
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("date-line connections render and destination names remain literal text", async ({ page }, testInfo) => {
  await seed(page, [{ name: "Fiji <img src=x onerror=alert(1)>", latitude: -18.1416, longitude: 178.4419 }, { name: "Samoa", latitude: -13.8507, longitude: -171.7514 }]);
  const globe = await openGlobe(page);
  await expect(globe).toHaveAttribute("data-legs", "1");
  await expect(page.locator(".globe-stop-list img")).toHaveCount(0);
  await expect(page.locator(".globe-marker").first()).toHaveAttribute("title", "1. Fiji <img src=x onerror=alert(1)>");
  await page.screenshot({ path: testInfo.outputPath("globe-date-line.png"), fullPage: true });
});

test("100-stop route renders within the existing trip limit", async ({ page }, testInfo) => {
  await seed(page, Array.from({ length: 100 }, (_, i) => ({ name: `Stop ${i + 1}`, latitude: (i % 12) * 10 - 50, longitude: (i * 31 % 350) - 175 })));
  const globe = await openGlobe(page);
  await expect(globe).toHaveAttribute("data-stops", "100");
  await expect(globe).toHaveAttribute("data-legs", "99");
  await expect(page.locator(".globe-stop-list li")).toHaveCount(100);
  await page.screenshot({ path: testInfo.outputPath("globe-100-stops.png"), fullPage: true });
});
