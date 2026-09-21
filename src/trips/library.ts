import { normalizeCosts, normalizeCurrency } from "../budget.ts";
import { COLORS, createTrip, makeStoredTrip } from "./model.ts";
import type { StoredTrip, TripLibrary, TripPlan } from "./model.ts";
import { planToFile, validateTripFile } from "./files.ts";

export const LIBRARY_KEY = "trip-planning:library";
export const LEGACY_KEY = "trip-planning:trip-plan";
type StorageAccess = Pick<Storage, "getItem" | "setItem">;
export type LoadedLibrary = {
  library: TripLibrary;
  error: string | null;
  blocked: boolean;
};
const emptyLibrary = (): TripLibrary => ({
  version: 1,
  activeTripId: null,
  trips: [],
});

export function uniqueTitle(title: string, trips: StoredTrip[]) {
  const base = title.trim() || "Untitled trip";
  const titles = new Set(
    trips.map((trip) => trip.plan.title.toLocaleLowerCase()),
  );
  let candidate = base;
  let index = 2;
  while (titles.has(candidate.toLocaleLowerCase()))
    candidate = `${base.slice(0, 190)} (${index++})`;
  return candidate;
}
export function addTrip(library: TripLibrary, plan: TripPlan): TripLibrary {
  const record = makeStoredTrip({
    ...plan,
    title: uniqueTitle(plan.title, library.trips),
  });
  return {
    ...library,
    activeTripId: record.id,
    trips: [...library.trips, record],
  };
}
export function duplicateTrip(library: TripLibrary, id: string) {
  const source = library.trips.find((trip) => trip.id === id);
  if (!source) return library;
  return addTrip(library, {
    ...source.plan,
    title: `${source.plan.title.slice(0, 190)} (copy)`,
    destinations: source.plan.destinations.map((stop) => ({
      ...stop,
      id: crypto.randomUUID(),
      costs: { ...stop.costs },
    })),
  });
}
export function removeTrip(library: TripLibrary, id: string): TripLibrary {
  const trips = library.trips.filter((trip) => trip.id !== id);
  return {
    ...library,
    trips,
    activeTripId:
      library.activeTripId === id
        ? (trips[0]?.id ?? null)
        : library.activeTripId,
  };
}

function validateStoredLibrary(value: unknown): TripLibrary {
  const library = value as TripLibrary;
  if (!library || library.version !== 1 || !Array.isArray(library.trips))
    throw new Error("Unsupported library");
  const ids = new Set<string>();
  for (const record of library.trips) {
    if (
      !record ||
      typeof record.id !== "string" ||
      !record.id ||
      ids.has(record.id) ||
      !Number.isFinite(Date.parse(record.createdAt)) ||
      !Number.isFinite(Date.parse(record.updatedAt))
    )
      throw new Error("Invalid trip record");
    ids.add(record.id);
    const file = planToFile(record.plan);
    // A destination name may have been saved mid-edit. Preserve that draft.
    file.trip.destinations = file.trip.destinations.map((stop) => ({
      ...stop,
      name:
        typeof stop.name === "string" && !stop.name.trim()
          ? "Untitled destination"
          : stop.name,
    }));
    if (!validateTripFile(file).ok) throw new Error("Invalid saved trip");
    const stopIds = record.plan.destinations.map((stop) => stop.id);
    if (
      stopIds.some((id) => typeof id !== "string" || !id) ||
      new Set(stopIds).size !== stopIds.length
    )
      throw new Error("Invalid destination IDs");
  }
  if (library.activeTripId !== null && !ids.has(library.activeTripId))
    throw new Error("Invalid active trip");
  return library;
}

export function loadLibrary(storage: StorageAccess): LoadedLibrary {
  try {
    const saved = storage.getItem(LIBRARY_KEY);
    if (saved !== null)
      return {
        library: validateStoredLibrary(JSON.parse(saved)),
        error: null,
        blocked: false,
      };
    const legacy = storage.getItem(LEGACY_KEY);
    if (legacy !== null) {
      const old = JSON.parse(legacy);
      if (!old || !Array.isArray(old.destinations) || !old.destinations.length)
        throw new Error("Invalid legacy trip");
      const plan: TripPlan = {
        title: "My trip",
        description: "",
        tripStartDate: old.tripStartDate,
        currency: normalizeCurrency(old.currency),
        destinations: old.destinations.map(
          (stop: Partial<TripPlan["destinations"][number]>, index: number) => ({
            id: stop.id || crypto.randomUUID(),
            name: stop.name || `Destination ${index + 1}`,
            durationWeeks: Math.max(1, Number(stop.durationWeeks) || 1),
            color: stop.color || COLORS[index % COLORS.length],
            notes: stop.notes || "",
            costs: normalizeCosts(stop.costs),
          }),
        ),
      };
      const library = addTrip(emptyLibrary(), plan);
      validateStoredLibrary(library);
      return { library, error: null, blocked: false };
    }
    return {
      library: addTrip(emptyLibrary(), createTrip()),
      error: null,
      blocked: false,
    };
  } catch {
    return {
      library: emptyLibrary(),
      error:
        "The saved library could not be read. Existing browser data has not been overwritten. You can work with new or imported trips and export them as files; reload to try reading your library again.",
      blocked: true,
    };
  }
}

export function saveLibrary(
  storage: StorageAccess,
  library: TripLibrary,
): string | null {
  try {
    storage.setItem(LIBRARY_KEY, JSON.stringify(library));
    return null;
  } catch {
    return "Changes are only in memory: browser storage is unavailable or full. Export your trips before closing this page, or retry saving.";
  }
}
