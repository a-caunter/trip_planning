import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parseTripFile,
  validateTripFile,
  fileToPlan,
  planToFile,
  serializeTrip,
  tripFilename,
} from "../src/trips/files.ts";
import {
  LIBRARY_KEY,
  LEGACY_KEY,
  loadLibrary,
  saveLibrary,
  addTrip,
  duplicateTrip,
  removeTrip,
  uniqueTitle,
} from "../src/trips/library.ts";
import {
  addWeeks,
  parseIsoDate,
  toIsoDate,
  isCalendarDate,
  MAX_FILE_BYTES,
} from "../src/trips/model.ts";
import { buildTripPrompt } from "../src/trips/prompt.ts";
import { calculateTripBudget } from "../src/budget.ts";

const exampleText = readFileSync(
  new URL("../src/trips/portugal.trip.json", import.meta.url),
  "utf8",
);
const guide = readFileSync(
  new URL("../src/trips/authoring-guide.md", import.meta.url),
  "utf8",
);
const example = () => JSON.parse(exampleText);
const memory = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    values,
  };
};
const fresh = () => fileToPlan(example());
const empty = () => ({ version: 1, activeTripId: null, trips: [] });

test("example validates without mutation and exports round-trip with new IDs", () => {
  const file = example();
  const before = structuredClone(file);
  assert.equal(validateTripFile(file).ok, true);
  assert.deepEqual(file, before);
  const first = fileToPlan(file);
  const serialized = serializeTrip(first);
  const parsed = parseTripFile(serialized);
  assert.equal(parsed.ok, true);
  const second = fileToPlan(parsed.file);
  assert.deepEqual(planToFile(first), planToFile(second));
  assert.notEqual(first.destinations[0].id, second.destinations[0].id);
  assert.deepEqual(
    calculateTripBudget(first.destinations).totals,
    calculateTripBudget(second.destinations).totals,
  );
  assert.equal(serialized.includes('"id"'), false);
  assert.equal(serialized.includes('"total"'), false);
  assert.equal(tripFilename("Portugal / Spring?"), "portugal-spring.trip.json");
});

test("optional defaults distinguish missing estimates and zero", () => {
  const file = example();
  delete file.trip.description;
  file.trip.destinations = [
    { name: "One stop", durationWeeks: 1, costs: { flights: 0 } },
  ];
  const result = parseTripFile(JSON.stringify(file));
  assert.equal(result.ok, true);
  const plan = fileToPlan(result.file);
  assert.equal(plan.description, "");
  assert.equal(plan.destinations[0].notes, "");
  assert.match(plan.destinations[0].color, /^#[a-f0-9]{6}$/);
  assert.equal(plan.destinations[0].costs.flights, 0);
  assert.equal(plan.destinations[0].costs.lodging, null);
  assert.equal(calculateTripBudget(plan.destinations).rows[0].entered, 1);
});

test("JSON fences, BOM, and plain JSON are accepted; prose and trailing commas are not", () => {
  for (const text of [
    exampleText,
    `\uFEFF${exampleText}`,
    `\n\x60\x60\x60json\n${exampleText}\n\x60\x60\x60\n`,
  ])
    assert.equal(parseTripFile(text).ok, true);
  for (const text of [
    `Here you go: ${exampleText}`,
    '{"format":"trip-planner",}',
    `\x60\x60\x60json\n${exampleText}\n\x60\x60\x60\nMore text`,
  ])
    assert.equal(parseTripFile(text).ok, false);
});

test("unknown fields, missing fields, currencies, and unsupported versions produce errors", () => {
  const cases = [
    [
      (file) => {
        delete file.trip.title;
      },
      /title/,
    ],
    [
      (file) => {
        file.trip.title = "  ";
      },
      /title/,
    ],
    [
      (file) => {
        file.trip.currency = "XYZ";
      },
      /currency/,
    ],
    [
      (file) => {
        file.trip.destinations[0].costs.lodging = 100;
      },
      /unknown field "lodging"/,
    ],
    [
      (file) => {
        file.version = 2;
      },
      /Unsupported trip file version 2/,
    ],
    [
      (file) => {
        file.trip.destinations[1].durationWeeks = 1.5;
      },
      /Destination 2.*whole number/,
    ],
  ];
  for (const [change, message] of cases) {
    const file = example();
    change(file);
    const result = validateTripFile(file);
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), message);
  }
});

test("only real calendar dates are accepted and weeks follow the local calendar across DST", () => {
  for (const date of [
    "2027-02-29",
    "2027-04-31",
    "2027-13-01",
    "0000-01-01",
    "not-a-date",
  ])
    assert.equal(isCalendarDate(date), false);
  assert.equal(isCalendarDate("2028-02-29"), true);
  assert.equal(isCalendarDate("0099-01-01"), true);
  const previous = process.env.TZ;
  process.env.TZ = "America/New_York";
  try {
    for (const [start, end] of [
      ["2026-03-02", "2026-03-09"],
      ["2026-10-26", "2026-11-02"],
    ]) {
      const result = addWeeks(parseIsoDate(start), 1);
      assert.equal(toIsoDate(result), end);
      assert.equal(result.getHours(), 0);
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
  const file = example();
  file.trip.tripStartDate = "2027-02-29";
  assert.equal(validateTripFile(file).ok, false);
});

test("invalid prices and excessive files, stops, and total duration are rejected", () => {
  for (const amount of [
    -1,
    1.999,
    0.00000000001,
    Infinity,
    NaN,
    "12.50",
    1000000001,
  ]) {
    const file = example();
    file.trip.destinations[0].costs.flights = amount;
    assert.equal(validateTripFile(file).ok, false, String(amount));
  }
  for (const amount of [0, 0.29, 999999999.99, 1000000000, null]) {
    const file = example();
    file.trip.destinations[0].costs.flights = amount;
    assert.equal(validateTripFile(file).ok, true, String(amount));
  }
  assert.equal(parseTripFile(" ".repeat(MAX_FILE_BYTES + 1)).ok, false);
  const many = example();
  many.trip.destinations = Array.from({ length: 101 }, () => ({
    name: "Stop",
    durationWeeks: 1,
  }));
  assert.equal(validateTripFile(many).ok, false);
  const long = example();
  long.trip.destinations[0].durationWeeks = 520;
  assert.equal(validateTripFile(long).ok, false);
});

test("legacy migration preserves original data, IDs, prices, and settings", () => {
  const storage = memory();
  const plan = fresh();
  const legacy = JSON.stringify({
    tripStartDate: plan.tripStartDate,
    currency: plan.currency,
    destinations: plan.destinations,
  });
  storage.setItem(LEGACY_KEY, legacy);
  storage.setItem("trip-planning:planner-settings", '{"weekWidth":100}');
  const loaded = loadLibrary(storage);
  assert.equal(loaded.error, null);
  assert.equal(loaded.library.trips[0].plan.title, "My trip");
  assert.deepEqual(
    loaded.library.trips[0].plan.destinations,
    plan.destinations,
  );
  assert.equal(saveLibrary(storage, loaded.library), null);
  assert.equal(storage.getItem(LEGACY_KEY), legacy);
  assert.equal(
    storage.getItem("trip-planning:planner-settings"),
    '{"weekWidth":100}',
  );
  assert.deepEqual(loadLibrary(storage).library, loaded.library);
});

test("libraries preserve independent trips through duplicate, rename, removal, and reload", () => {
  const storage = memory();
  let library = addTrip(empty(), fresh());
  const firstId = library.activeTripId;
  library = addTrip(library, fresh());
  assert.equal(library.trips[1].plan.title, "Two weeks exploring Portugal (2)");
  library = duplicateTrip(library, firstId);
  assert.notEqual(
    library.trips[0].plan.destinations[0].id,
    library.trips[2].plan.destinations[0].id,
  );
  assert.notEqual(
    library.trips[0].plan.destinations[0].costs,
    library.trips[2].plan.destinations[0].costs,
  );
  assert.equal(
    uniqueTitle("two weeks exploring portugal", library.trips),
    "two weeks exploring portugal (3)",
  );
  library.trips[2].plan.title = "Renamed trip";
  assert.equal(saveLibrary(storage, library), null);
  assert.deepEqual(loadLibrary(storage).library, library);
  for (const trip of [...library.trips]) library = removeTrip(library, trip.id);
  assert.deepEqual(library, empty());
  assert.equal(saveLibrary(storage, library), null);
  assert.equal(loadLibrary(storage).library.trips.length, 0);
});

test("corrupted reads preserve data; write failures preserve the in-memory library", () => {
  const storage = memory();
  storage.setItem(LIBRARY_KEY, "broken data");
  assert.equal(loadLibrary(storage).blocked, true);
  assert.equal(storage.getItem(LIBRARY_KEY), "broken data");
  const library = addTrip(empty(), fresh());
  const before = structuredClone(library);
  const failure = saveLibrary(
    {
      ...storage,
      setItem() {
        throw new Error("QuotaExceededError");
      },
    },
    library,
  );
  assert.match(failure, /only in memory/);
  assert.deepEqual(library, before);
});

test("a temporarily blank destination name does not prevent loading the saved library", () => {
  const storage = memory();
  const plan = fresh();
  plan.destinations[0].name = "  ";
  const library = addTrip(empty(), plan);
  assert.equal(saveLibrary(storage, library), null);
  const loaded = loadLibrary(storage);
  assert.equal(loaded.error, null);
  assert.equal(loaded.library.trips[0].plan.destinations[0].name, "  ");
  assert.equal(parseTripFile(serializeTrip(plan)).ok, false);
});

test("AI prompt includes request, authoring rules, schema, and selected example", () => {
  const prompt = buildTripPrompt(
    "Four weeks in Japan for two adults",
    example(),
    guide,
  );
  for (const text of [
    "Four weeks in Japan",
    "# Writing a trip planner file",
    '"$schema"',
    '"title": "Two weeks exploring Portugal"',
    "essential missing information",
    "structure only",
  ])
    assert.ok(prompt.includes(text), text);
});
