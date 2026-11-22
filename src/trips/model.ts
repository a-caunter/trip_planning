import type { CostEstimates, Currency } from "../budget.ts";
import { normalizeCosts } from "../budget.ts";

export const COLORS = [
  "#2563eb",
  "#16a34a",
  "#e11d48",
  "#d97706",
  "#7c3aed",
  "#0891b2",
];
export const MAX_FILE_BYTES = 1024 * 1024;
export const MAX_DESTINATIONS = 100;
export const DAYS_PER_WEEK = 7;
export const MAX_TRIP_DAYS = 520 * DAYS_PER_WEEK;

export type DestinationLocation = {
  latitude: number;
  longitude: number;
};

export type Destination = {
  id: string;
  name: string;
  durationDays: number;
  schengen: boolean;
  color: string;
  notes: string;
  costs: CostEstimates;
  location?: DestinationLocation;
};
export type TripPlan = {
  title: string;
  description: string;
  tripStartDate: string;
  currency: Currency;
  destinations: Destination[];
};
export type ScheduledDestination = Destination & {
  startDate: Date;
  endDate: Date;
  startDay: number;
};
export type StoredTrip = {
  id: string;
  createdAt: string;
  updatedAt: string;
  plan: TripPlan;
};
export type TripLibrary = {
  version: 1;
  activeTripId: string | null;
  trips: StoredTrip[];
};

export function toIsoDate(date: Date) {
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
}
export function isCalendarDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number(value.slice(0, 4)) > 0 &&
    toIsoDate(parseIsoDate(value)) === value
  );
}
export function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
export function daysBetween(start: Date, end: Date) {
  // Compare calendar dates at UTC midnight so DST cannot change the duration.
  const midnight = (date: Date) =>
    new Date(0).setUTCFullYear(date.getFullYear(), date.getMonth(), date.getDate());
  return (midnight(end) - midnight(start)) / 86_400_000;
}
export function totalDays(plan: TripPlan) {
  return plan.destinations.reduce(
    (sum, destination) => sum + destination.durationDays,
    0,
  );
}
export function scheduleDestinations(plan: TripPlan): ScheduledDestination[] {
  const start = parseIsoDate(plan.tripStartDate);
  let startDay = 0;
  return plan.destinations.map((destination) => {
    const scheduled = {
      ...destination,
      startDate: addDays(start, startDay),
      endDate: addDays(start, startDay + destination.durationDays),
      startDay,
    };
    startDay += destination.durationDays;
    return scheduled;
  });
}
export function createDestination(index: number): Destination {
  return {
    id: crypto.randomUUID(),
    name: `Destination ${index}`,
    durationDays: DAYS_PER_WEEK,
    schengen: false,
    color: COLORS[(index - 1) % COLORS.length],
    notes: "",
    costs: normalizeCosts(),
  };
}
export function createTrip(title = "Untitled trip"): TripPlan {
  return {
    title,
    description: "",
    tripStartDate: toIsoDate(new Date()),
    currency: "USD",
    destinations: [createDestination(1)],
  };
}
export function makeStoredTrip(plan: TripPlan): StoredTrip {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), createdAt: now, updatedAt: now, plan };
}
