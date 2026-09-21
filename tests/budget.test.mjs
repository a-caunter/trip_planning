import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateStopBudget,
  calculateTripBudget,
  normalizeCosts,
  normalizeCurrency,
} from "../src/budget.ts";

const stop = (overrides = {}) => ({
  id: "one",
  name: "First stop",
  durationWeeks: 2,
  costs: normalizeCosts(),
  ...overrides,
});

test("existing plans without prices migrate to unknown estimates", () => {
  const result = calculateStopBudget(stop());
  assert.equal(result.total, 0);
  assert.equal(result.entered, 0);
  assert.equal(result.days, 14);
  assert.equal(result.nights, 14);
  assert.equal(normalizeCurrency(undefined), "USD");
  assert.equal(normalizeCurrency("EUR"), "EUR");
});

test("rates scale with duration while one-time costs remain fixed", () => {
  const costs = normalizeCosts({
    flights: 400,
    lodging: 100,
    food: 30,
    transport: 60,
    misc: 25,
  });
  const result = calculateStopBudget(stop({ costs }));
  assert.deepEqual(result.totals, {
    flights: 400,
    lodging: 1400,
    food: 420,
    transport: 60,
    misc: 25,
  });
  assert.equal(result.total, 2305);
  assert.equal(result.entered, 5);
  assert.equal(
    calculateStopBudget(stop({ durationWeeks: 3, costs })).total,
    3215,
  );
});

test("zero is an explicit estimate and missing or invalid values stay unknown", () => {
  const costs = normalizeCosts({
    flights: 0,
    lodging: -1,
    food: Infinity,
    transport: "50",
    misc: NaN,
  });
  assert.deepEqual(costs, {
    flights: 0,
    lodging: null,
    food: null,
    transport: null,
    misc: null,
  });
  assert.equal(calculateStopBudget(stop({ costs })).entered, 1);
  assert.equal(normalizeCosts({ flights: 1_000_000_001 }).flights, null);
});

test("decimal estimates add in cents without floating point drift", () => {
  const result = calculateTripBudget([
    stop({
      costs: normalizeCosts({ flights: 0.1, lodging: 10.01, food: 2.22 }),
    }),
    stop({
      id: "two",
      durationWeeks: 1,
      costs: normalizeCosts({ flights: 0.2, lodging: 10.01 }),
    }),
  ]);
  assert.equal(result.totals.flights, 0.3);
  assert.equal(result.totals.lodging, 210.21);
  assert.equal(result.totals.food, 31.08);
  assert.equal(result.total, 241.59);
});

test("trip totals reflect reordering, removal, and added unestimated stops", () => {
  const a = stop({
    costs: normalizeCosts({
      flights: 400,
      lodging: 100,
      food: 30,
      transport: 60,
      misc: 25,
    }),
  });
  const b = stop({
    id: "two",
    durationWeeks: 1,
    costs: normalizeCosts({ flights: 150 }),
  });
  const total = calculateTripBudget([a, b]);
  assert.equal(total.total, 2455);
  assert.equal(total.days, 21);
  assert.equal(total.completeStops, 1);
  assert.equal(calculateTripBudget([b, a]).total, total.total);
  assert.equal(
    calculateTripBudget([a, b, stop({ id: "three" })]).total,
    total.total,
  );
  assert.equal(calculateTripBudget([b]).total, 150);
  assert.equal(calculateTripBudget([]).total, 0);
});
