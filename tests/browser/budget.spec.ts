import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem("trip-planning:trip-plan")) return;
    localStorage.setItem(
      "trip-planning:trip-plan",
      JSON.stringify({
        tripStartDate: "2026-10-01",
        destinations: [
          {
            id: "paris",
            name: "Paris",
            durationWeeks: 2,
            color: "#2563eb",
            notes: "Museum days",
          },
          {
            id: "rome",
            name: "Rome",
            durationWeeks: 1,
            color: "#16a34a",
            notes: "",
          },
        ],
      }),
    );
  });
  await page.goto("/");
});

test("edits, persists, and consolidates estimates across the trip", async ({
  page,
}, testInfo) => {
  await page.getByRole("button", { name: "Cost details for Paris" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("14 days / 14 nights");
  await page.getByLabel("Flights", { exact: false }).fill("400.10");
  await page.getByLabel("Lodging", { exact: false }).fill("100.25");
  await page.getByLabel("Food", { exact: false }).fill("30");
  await page.getByLabel("Transport", { exact: false }).fill("60");
  await page.getByLabel("Miscellaneous", { exact: false }).fill("0");
  await expect(dialog.locator(".stop-total")).toContainText("$2,283.60");
  await page.getByRole("button", { name: "Save estimates" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cost details for Paris" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Budget", exact: true }).click();
  await expect(page.locator("tfoot")).toContainText("$2,283.60");
  await expect(
    page.getByRole("heading", { name: "Where the money goes" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Compare destinations" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Rome", exact: true }).click();
  await dialog.getByLabel("Flights", { exact: false }).fill("150");
  await page.getByRole("button", { name: "Save estimates" }).click();
  await expect(page.locator("tfoot")).toContainText("$2,433.60");
  await page.screenshot({
    path: testInfo.outputPath("budget-desktop.png"),
    fullPage: true,
  });
  await page.reload();
  await page.getByRole("button", { name: "Budget", exact: true }).click();
  await expect(page.locator("tfoot")).toContainText("$2,433.60");
  await expect(page.getByRole("row", { name: /Paris/ })).toContainText(
    "Fully estimated",
  );
  await expect(page.getByRole("row", { name: /Rome/ })).toContainText(
    "1/5 estimated",
  );
  await page.getByLabel("Currency", { exact: true }).selectOption("EUR");
  await expect(page.locator("tfoot")).toContainText("€2,433.60");
});

test("validates prices, cancels drafts, and contains keyboard focus", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Cost details for Paris" }).click();
  await page.getByLabel("Flights", { exact: false }).fill("-10");
  await expect(
    page.getByRole("button", { name: "Save estimates" }),
  ).toBeDisabled();
  await page.getByLabel("Flights", { exact: false }).fill("1.999");
  await expect(
    page.getByRole("button", { name: "Save estimates" }),
  ).toBeDisabled();
  await page.getByLabel("Flights", { exact: false }).fill("100");
  await page.getByRole("button", { name: "Save estimates" }).focus();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Close details" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Cost details for Paris" }).click();
  await expect(page.getByLabel("Flights", { exact: false })).toHaveValue("");
  await page.getByLabel("Flights", { exact: false }).fill("200");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Cost details for Paris" }).click();
  await expect(page.getByLabel("Flights", { exact: false })).toHaveValue("");
});

test("duration changes, reordering, and removal preserve the correct costs", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Cost details for Paris" }).click();
  await page.getByLabel("Flights", { exact: false }).fill("400");
  await page.getByLabel("Lodging", { exact: false }).fill("100");
  await page.getByRole("button", { name: "Save estimates" }).click();
  await page
    .getByRole("textbox", { name: "Weeks", exact: true })
    .first()
    .fill("3");
  await page
    .getByRole("textbox", { name: "Weeks", exact: true })
    .first()
    .blur();
  await expect(page.locator(".budget-shortcut")).toContainText("$2,500.00");
  await page.getByRole("button", { name: "Reorder Paris" }).focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("textbox", { name: "Destination", exact: true }).first(),
  ).toHaveValue("Rome");
  await page.getByRole("button", { name: "Budget", exact: true }).click();
  await expect(page.getByRole("row", { name: /Paris/ })).toContainText(
    "$2,500.00",
  );
  await page.getByRole("button", { name: "Itinerary", exact: true }).click();
  await page.getByRole("button", { name: "Remove Paris", exact: true }).click();
  await expect(page.locator(".budget-shortcut")).toContainText("$0.00");
});

test("budget and editor fit a mobile viewport", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Budget", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Give your trip a budget" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Estimate your first stop" }).click();
  const dialog = page.getByRole("dialog");
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  await page.getByLabel("Lodging", { exact: false }).fill("100");
  await expect(dialog.locator(".stop-total")).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("details-mobile.png") });
  await page.getByRole("button", { name: "Save estimates" }).click();
  await expect(page.locator("tfoot")).toContainText("$1,400.00");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("budget-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 740 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
