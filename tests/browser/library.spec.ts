import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import example from "../../src/trips/portugal.trip.json" with { type: "json" };

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("creates, switches, edits, duplicates, deletes, and reloads a library", async ({
  page,
}, testInfo) => {
  await expect(
    page.getByText("Saved in this browser", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "New trip", exact: true }).click();
  await page.getByLabel("Trip title", { exact: true }).fill("Japan in spring");
  await page
    .getByLabel("Trip description", { exact: true })
    .fill("Gardens and food for two travelers.");
  await page.getByRole("button", { name: "Create trip", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Japan in spring",
  );
  await page
    .getByRole("textbox", { name: "Destination", exact: true })
    .fill("Tokyo");
  await page.getByRole("textbox", { name: "Days", exact: true }).fill("3");
  await page.getByRole("button", { name: "My trips", exact: true }).click();
  await expect(
    page.getByRole("article", { name: "Japan in spring", exact: true }),
  ).toContainText("3 days");
  await page
    .getByRole("button", { name: "Duplicate Japan in spring", exact: true })
    .click();
  await expect(
    page.getByRole("article", { name: "Japan in spring (copy)", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Rename Japan in spring (copy)", exact: true })
    .click();
  await page
    .getByLabel("Trip title", { exact: true })
    .fill("Japan alternative");
  await page.getByRole("button", { name: "Save trip details" }).click();
  await page.screenshot({
    path: testInfo.outputPath("library-desktop.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Delete Japan alternative", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("article", { name: "Japan alternative", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete Japan alternative", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete trip", exact: true }).click();
  await expect(
    page.getByRole("article", { name: "Japan alternative", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Current trip" })
    .selectOption({ label: "Japan in spring" });
  await expect(
    page.getByRole("textbox", { name: "Days", exact: true }),
  ).toHaveValue("3");
  await page.getByRole("textbox", { name: "Days", exact: true }).fill("9999");
  await expect(page.getByRole("alert")).toContainText("3640 days");
  await page
    .getByRole("combobox", { name: "Current trip" })
    .selectOption({ label: "Untitled trip" });
  await expect(
    page.getByRole("textbox", { name: "Days", exact: true }),
  ).toHaveValue("7");
  await page
    .getByRole("combobox", { name: "Current trip" })
    .selectOption({ label: "Japan in spring" });
  await expect(
    page.getByRole("textbox", { name: "Days", exact: true }),
  ).toHaveValue("3");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Japan in spring",
  );
  await expect(
    page.getByRole("textbox", { name: "Destination", exact: true }),
  ).toHaveValue("Tokyo");
});

test("pastes fenced JSON, previews without mutation, imports, downloads, and imports the file again", async ({
  page,
}, testInfo) => {
  await page.getByRole("button", { name: "Import trip", exact: true }).click();
  await page
    .getByLabel("Trip JSON", { exact: true })
    .fill("```json\n" + JSON.stringify(example) + "\n```");
  await page.getByRole("button", { name: "Review trip" }).click();
  await expect(
    page.getByRole("region", { name: "Import preview" }),
  ).toContainText("14 days");
  await expect(
    page.getByRole("region", { name: "Import preview" }),
  ).toContainText("$2,495.00");
  await page.screenshot({ path: testInfo.outputPath("import-desktop.png") });
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Current trip" }).locator("option"),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Import trip", exact: true }).click();
  await page
    .getByLabel("Trip JSON", { exact: true })
    .fill(JSON.stringify(example));
  await page.getByRole("button", { name: "Review trip" }).click();
  await page.getByRole("button", { name: "Import as new trip" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    example.trip.title,
  );
  await page.getByRole("button", { name: "Budget", exact: true }).click();
  await expect(page.locator("tfoot")).toContainText("$2,495.00");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON", exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe(
    "two-weeks-exploring-portugal.trip.json",
  );
  const path = await download.path();
  const exported = JSON.parse(await readFile(path!, "utf8"));
  expect(exported.trip.destinations[0].costs.lodgingPerNight).toBe(120);
  expect(exported.trip.destinations[0].id).toBeUndefined();
  await page.getByRole("button", { name: "Import trip", exact: true }).click();
  await page
    .getByLabel("Choose trip file", { exact: true })
    .setInputFiles(path!);
  await expect(page.getByLabel("Trip JSON", { exact: true })).toHaveValue(
    /"version": 3/,
  );
  await page.getByRole("button", { name: "Review trip" }).click();
  await page.getByRole("button", { name: "Import as new trip" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Two weeks exploring Portugal (2)",
  );
  await expect(
    page.getByRole("combobox", { name: "Current trip" }).locator("option"),
  ).toHaveCount(3);
});

test("invalid imports report fields and do not change the library", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Import trip", exact: true }).click();
  const invalid = structuredClone(example);
  invalid.trip.destinations[1].durationDays = 1.5;
  await page
    .getByLabel("Trip JSON", { exact: true })
    .fill(JSON.stringify(invalid));
  await page.getByRole("button", { name: "Review trip" }).click();
  await expect(page.getByRole("alert")).toContainText("Destination 2");
  await expect(page.getByRole("alert")).toContainText("whole number");
  await expect(
    page.getByRole("button", { name: "Import as new trip" }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("combobox", { name: "Current trip" }).locator("option"),
  ).toHaveCount(1);
});

test("end dates and durations stay in sync and Schengen counts survive export and reload", async ({ page }, testInfo) => {
  await page.getByLabel("Trip start", { exact: true }).fill("2026-01-01");
  const durations = page.getByRole("textbox", { name: "Days", exact: true });
  const endDate = (index: number) => page.getByLabel(`End date for Destination ${index}`, { exact: true });

  await expect(endDate(1)).toHaveValue("2026-01-08");
  await page.getByRole("button", { name: "Add destination" }).click();
  await durations.nth(0).fill("2");
  await expect(endDate(1)).toHaveValue("2026-01-03");
  await expect(endDate(2)).toHaveValue("2026-01-10");
  await endDate(1).fill("2026-01-01");
  await expect(page.getByRole("alert")).toContainText("end after its start date");
  await endDate(1).blur();
  await expect(endDate(1)).toHaveValue("2026-01-03");
  await endDate(1).fill("2026-01-04");
  await expect(durations.nth(0)).toHaveValue("3");
  await expect(endDate(2)).toHaveValue("2026-01-11");
  await endDate(2).fill("2026-06-30");
  await page.getByRole("button", { name: "Add destination" }).click();
  await durations.nth(2).fill("1");
  await expect(endDate(3)).toHaveValue("2026-07-01");
  await page.getByRole("button", { name: "Add destination" }).click();
  await durations.nth(3).fill("1");

  for (const index of [1, 3]) {
    await page.getByRole("button", { name: `Details for Destination ${index}`, exact: true }).click();
    await page.getByRole("checkbox", { name: "Count this stop in the Schengen Zone tracker" }).check();
    await page.getByRole("button", { name: "Save details" }).click();
  }

  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const download = await downloadEvent;
  const exported = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(exported.version).toBe(3);
  expect(exported.trip.destinations.map(({ durationDays, schengen }) => [durationDays, schengen]))
    .toEqual([[3, true], [177, false], [1, true], [1, false]]);

  await page.reload();
  await expect(endDate(2)).toHaveValue("2026-06-30");
  await page.getByRole("button", { name: "Schengen Zone", exact: true }).click();
  const tracker = page.getByRole("region", { name: "Schengen Zone tracker" });
  await expect(tracker.getByRole("article")).toContainText("3 days");
  await expect(tracker.getByRole("article")).toContainText("Window ending Jan 3, 2026");
  const chart = tracker.getByRole("slider", { name: "Inspect date on Schengen chart" });
  const stays = chart.locator(".schengen-stay");
  await expect(stays).toHaveCount(2);
  await expect(chart.locator(".schengen-stay-label")).toHaveText(["Destination 1", "Destination 3"]);
  await stays.first().locator("rect").first().hover();
  await expect(chart).toHaveAttribute("aria-valuetext", "Jan 2, 2026, 2 days in the last 180 days, Destination 1");
  await chart.press("End");
  await expect(chart).toHaveAttribute("aria-valuetext", "Jul 1, 2026, 2 days in the last 180 days");
  await chart.press("ArrowLeft");
  await expect(chart).toHaveAttribute("aria-valuetext", "Jun 30, 2026, 3 days in the last 180 days, Destination 3");
  await tracker.screenshot({ path: testInfo.outputPath("schengen-chart-desktop.png") });

  await page.getByRole("button", { name: "Itinerary", exact: true }).click();
  await page.getByRole("button", { name: "Details for Destination 3", exact: true }).click();
  await page.getByRole("checkbox", { name: "Count this stop in the Schengen Zone tracker" }).uncheck();
  await page.getByRole("button", { name: "Save details" }).click();
  await page.getByRole("button", { name: "Schengen Zone", exact: true }).click();
  await expect(stays).toHaveCount(1);
  await chart.press("End");
  await expect(chart).toHaveAttribute("aria-valuetext", "Jul 1, 2026, 1 day in the last 180 days");
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await tracker.screenshot({ path: testInfo.outputPath("schengen-chart-mobile.png") });
});

test("AI workflow includes selected trip, prompt download, clipboard fallback, and materials", async ({
  page,
}, testInfo) => {
  await page
    .getByRole("button", { name: "Create with AI", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Copy prompt", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Describe your trip", { exact: true })
    .fill(
      "Three weeks in Japan starting 2027-04-05, two adults, USD, gardens and food.",
    );
  await page
    .getByLabel("Example trip", { exact: true })
    .selectOption({ label: "Untitled trip" });
  await page
    .getByText("Preview or manually select the complete prompt", {
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Prepared prompt", { exact: true })).toHaveValue(
    /Three weeks in Japan/,
  );
  await expect(page.getByLabel("Prepared prompt", { exact: true })).toHaveValue(
    /"title": "Untitled trip"/,
  );
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download prompt", exact: true })
    .click();
  const download = await downloadEvent;
  const promptText = await readFile((await download.path())!, "utf8");
  expect(promptText).toContain("## Required JSON Schema");
  expect(promptText).toContain("# Writing a trip planner file");
  await page.evaluate(() =>
    Object.defineProperty(navigator.clipboard, "writeText", {
      value: async (text: string) => {
        (window as any).copiedTripPrompt = text;
      },
      configurable: true,
    }),
  );
  await page.getByRole("button", { name: "Copy prompt", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "Prompt copied",
  );
  expect(await page.evaluate(() => (window as any).copiedTripPrompt)).toBe(
    promptText,
  );
  await page.evaluate(() =>
    Object.defineProperty(navigator.clipboard, "writeText", {
      value: async () => {
        throw new Error("Permission denied");
      },
      configurable: true,
    }),
  );
  await page.getByRole("button", { name: "Copy prompt", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "Clipboard access is unavailable",
  );
  for (const [button, filename] of [
    ["Download guide", "trip-authoring-guide.md"],
    ["Download schema", "trip.schema.json"],
    ["Download example", "portugal.trip.json"],
  ]) {
    const event = page.waitForEvent("download");
    await page.getByRole("button", { name: button, exact: true }).click();
    expect((await event).suggestedFilename()).toBe(filename);
  }
  await page
    .getByRole("button", { name: "Close AI guide", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "My trips", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("library-mobile.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Create with AI", exact: true })
    .click();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("ai-mobile.png") });
  await page
    .getByRole("button", { name: "Close AI guide", exact: true })
    .focus();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "Download example", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("storage failure keeps edits available and can retry without losing them", async ({
  page,
}) => {
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    (window as any).restoreTripStorage = () => {
      Storage.prototype.setItem = original;
    };
    Storage.prototype.setItem = function (key, value) {
      if (key === "trip-planning:library")
        throw new DOMException("Full", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page
    .getByRole("textbox", { name: "Destination", exact: true })
    .fill("Not lost");
  await expect(page.getByRole("alert")).toContainText("only in memory");
  await expect(
    page.getByText("Saved in this browser", { exact: true }),
  ).toHaveCount(0);
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON", exact: true }).click();
  const download = await event;
  const exported = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(exported.trip.destinations[0].name).toBe("Not lost");
  await page.evaluate(() => (window as any).restoreTripStorage());
  await page.getByRole("button", { name: "Retry saving", exact: true }).click();
  await expect(
    page.getByText("Saved in this browser", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Destination", exact: true }),
  ).toHaveValue("Not lost");
});
