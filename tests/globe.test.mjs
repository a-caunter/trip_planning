import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildGlobeRoute, isValidLocation } from "../src/globe/route.ts";
import { fileToPlan, planToFile, validateTripFile, parseTripFile, serializeTrip } from "../src/trips/files.ts";
import { addTrip, duplicateTrip, loadLibrary, saveLibrary } from "../src/trips/library.ts";
const example = () => JSON.parse(readFileSync(new URL("../src/trips/portugal.trip.json", import.meta.url), "utf8"));
const stop = (id, latitude, longitude) => ({ id, name: id, durationWeeks: 1, color: "#2563eb", ...(latitude === undefined ? {} : { location: { latitude, longitude } }) });

test("coordinates accept zero and boundaries, reject incomplete and nonfinite values", () => {
  for (const location of [{ latitude: 0, longitude: 0 }, { latitude: -90, longitude: 180 }, { latitude: 90, longitude: -180 }]) {
    assert.equal(isValidLocation(location), true);
    const file = example();
    file.trip.destinations[0].location = location;
    assert.equal(validateTripFile(file).ok, true);
  }
  for (const location of [null, {}, { latitude: 10 }, { latitude: "0", longitude: 0 }, { latitude: NaN, longitude: 0 }, { latitude: Infinity, longitude: 0 }, { latitude: 91, longitude: 0 }, { latitude: 0, longitude: -181 }]) {
    assert.equal(isValidLocation(location), false);
    const file = example(); file.trip.destinations[0].location = location;
    assert.equal(validateTripFile(file).ok, false);
  }
  const file = example(); file.trip.destinations[0].location.accuracy = 5;
  assert.equal(validateTripFile(file).ok, false);
});

test("v1 imports without locations; v2 retains locations across export, storage and duplication", () => {
  const old = example(); old.version = 1;
  old.trip.destinations.forEach((s) => delete s.location);
  assert.equal(validateTripFile(old).ok, true);
  const legacy = fileToPlan(old);
  assert.equal(legacy.destinations[0].location, undefined);
  assert.equal(planToFile(legacy).version, 2);
  old.trip.destinations[0].location = { latitude: 0, longitude: 0 };
  assert.equal(validateTripFile(old).ok, false);

  const plan = fileToPlan(example());
  const parsed = parseTripFile(serializeTrip(plan));
  assert.equal(parsed.ok, true);
  assert.deepEqual(fileToPlan(parsed.file).destinations[0].location, plan.destinations[0].location);
  let library = addTrip({ version: 1, activeTripId: null, trips: [] }, plan);
  library = duplicateTrip(library, library.activeTripId);
  assert.deepEqual(library.trips[1].plan.destinations[0].location, plan.destinations[0].location);
  assert.notEqual(library.trips[1].plan.destinations[0].location, plan.destinations[0].location);
  let data;
  const storage = { getItem: () => data ?? null, setItem: (_key, value) => { data = value; } };
  assert.equal(saveLibrary(storage, library), null);
  assert.deepEqual(loadLibrary(storage).library, library);
  library.trips.forEach((trip) => trip.plan.destinations.forEach((s) => delete s.location));
  saveLibrary(storage, library);
  assert.equal(loadLibrary(storage).error, null);
});

test("route follows adjacency and reordering, preserving numbers across gaps", () => {
  const a = stop("a", 10, 20), b = stop("b", 30, 40), c = stop("c", 50, 60);
  const route = buildGlobeRoute([a, b, c]);
  assert.deepEqual(route.legs.map((leg) => leg.id), ["a:b", "b:c"]);
  assert.deepEqual(buildGlobeRoute([c, a, b]).legs.map((leg) => leg.id), ["c:a", "a:b"]);
  const gap = buildGlobeRoute([a, stop("missing"), c, b]);
  assert.deepEqual(gap.stops.map((s) => s.number), [1, 3, 4]);
  assert.deepEqual(gap.legs.map((leg) => leg.id), ["c:b"]);
  assert.equal(gap.missing, 1);
  assert.equal(buildGlobeRoute([a]).legs.length, 0);
  assert.equal(buildGlobeRoute([stop("missing")]).stops.length, 0);
});

test("coincident stops have no arc, while date-line and return legs retain direction", () => {
  assert.equal(buildGlobeRoute([stop("a", 10, 20), stop("b", 10, 20)]).legs.length, 0);
  assert.equal(buildGlobeRoute([stop("a", 0, 180), stop("b", 0, -180)]).legs.length, 0);
  assert.equal(buildGlobeRoute([stop("a", 90, 50), stop("b", 90, -90)]).legs.length, 0);
  const route = buildGlobeRoute([stop("a", -18, 178), stop("b", -14, -171), stop("c", -18, 178)]);
  assert.equal(route.stops.length, 3);
  assert.equal(route.legs.length, 2);
  assert.equal(route.legs[0].startLng, 178);
  assert.equal(route.legs[0].endLng, -171);
});

test("100 stops form exactly 99 legs without mutation", () => {
  const stops = Array.from({ length: 100 }, (_, i) => stop(String(i), i % 80, i * 3 - 150));
  const before = structuredClone(stops);
  const route = buildGlobeRoute(stops);
  assert.equal(route.stops.length, 100);
  assert.equal(route.legs.length, 99);
  assert.deepEqual(stops, before);
});
