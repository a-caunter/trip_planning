export const COST_CATEGORIES = [
  { id: "flights", label: "Flights", unit: "one-time", color: "#2563eb" },
  { id: "lodging", label: "Lodging", unit: "per night", color: "#7c3aed" },
  { id: "food", label: "Food", unit: "per day", color: "#0d9488" },
  { id: "transport", label: "Transport", unit: "one-time", color: "#d97706" },
  { id: "misc", label: "Miscellaneous", unit: "one-time", color: "#db2777" },
] as const;

export type CostCategory = (typeof COST_CATEGORIES)[number]["id"];
export type CostEstimates = Record<CostCategory, number | null>;
export type CostTotals = Record<CostCategory, number>;
export const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"] as const;
export type Currency = (typeof CURRENCIES)[number];
export const MAX_ESTIMATE = 1_000_000_000;

export function normalizeCosts(value?: unknown): CostEstimates {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return Object.fromEntries(
    COST_CATEGORIES.map(({ id }) => {
      const amount = source[id];
      return [
        id,
        typeof amount === "number" &&
        Number.isFinite(amount) &&
        amount >= 0 &&
        amount <= MAX_ESTIMATE
          ? Math.round((amount + Number.EPSILON) * 100) / 100
          : null,
      ];
    }),
  ) as CostEstimates;
}

export function normalizeCurrency(value: unknown): Currency {
  return CURRENCIES.includes(value as Currency) ? (value as Currency) : "USD";
}

export function formatMoney(amount: number, currency: Currency) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export type BudgetStop = {
  id: string;
  name: string;
  durationWeeks: number;
  costs: CostEstimates;
};

export function calculateStopBudget(stop: BudgetStop) {
  const days = Math.max(1, Math.round(stop.durationWeeks * 7));
  const costs = normalizeCosts(stop.costs);
  // Add integer cents so the table, charts, and editor always agree.
  const cents = Object.fromEntries(
    COST_CATEGORIES.map(({ id, unit }) => [
      id,
      Math.round((costs[id] ?? 0) * 100) * (unit === "one-time" ? 1 : days),
    ]),
  ) as CostTotals;
  const totals = Object.fromEntries(
    COST_CATEGORIES.map(({ id }) => [id, cents[id] / 100]),
  ) as CostTotals;
  const entered = COST_CATEGORIES.filter(({ id }) => costs[id] !== null).length;
  return {
    days,
    nights: days,
    totals,
    total: Object.values(cents).reduce((a, b) => a + b, 0) / 100,
    entered,
  };
}

export function calculateTripBudget(stops: BudgetStop[]) {
  const rows = stops.map((stop) => ({ ...stop, ...calculateStopBudget(stop) }));
  const totals = Object.fromEntries(
    COST_CATEGORIES.map(({ id }) => [
      id,
      rows.reduce((sum, row) => sum + Math.round(row.totals[id] * 100), 0) /
        100,
    ]),
  ) as CostTotals;
  const total =
    COST_CATEGORIES.reduce(
      (sum, { id }) => sum + Math.round(totals[id] * 100),
      0,
    ) / 100;
  const days = rows.reduce((sum, row) => sum + row.days, 0);
  return {
    rows,
    totals,
    total,
    days,
    completeStops: rows.filter((row) => row.entered === COST_CATEGORIES.length)
      .length,
  };
}
