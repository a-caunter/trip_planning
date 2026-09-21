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
  await page.getByRole("textbox", { name: "Weeks", exact: true }).fill("3");
  await page.getByRole("button", { name: "My trips", exact: true }).click();
  await expect(
    page.getByRole("article", { name: "Japan in spring", exact: true }),
  ).toContainText("3 weeks");
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
    page.getByRole("textbox", { name: "Weeks", exact: true }),
  ).toHaveValue("3");
  await page.getByRole("textbox", { name: "Weeks", exact: true }).fill("9999");
  await expect(page.getByRole("alert")).toContainText("520 weeks");
  await page
    .getByRole("combobox", { name: "Current trip" })
    .selectOption({ label: "Untitled trip" });
  await expect(
    page.getByRole("textbox", { name: "Weeks", exact: true }),
  ).toHaveValue("1");
  await page
    .getByRole("combobox", { name: "Current trip" })
    .selectOption({ label: "Japan in spring" });
  await expect(
    page.getByRole("textbox", { name: "Weeks", exact: true }),
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
  ).toContainText("2 weeks");
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
    /"version": 1/,
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
  invalid.trip.destinations[1].durationWeeks = 1.5;
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
