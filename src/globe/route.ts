import type { Destination, DestinationLocation } from "../trips/model.ts";

export type GlobeStop = {
  id: string;
  number: number;
  name: string;
  color: string;
  lat: number;
  lng: number;
};
export type GlobeLeg = {
  id: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string;
  label: string;
};

export function isValidLocation(value: unknown): value is DestinationLocation {
  if (!value || typeof value !== "object") return false;
  const { latitude, longitude } = value as DestinationLocation;
  return typeof latitude === "number" && Number.isFinite(latitude) && Math.abs(latitude) <= 90
    && typeof longitude === "number" && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
}

function sameLocation(a: GlobeStop, b: GlobeStop) {
  return a.lat === b.lat && (a.lng === b.lng || Math.abs(a.lng - b.lng) === 360 || Math.abs(a.lat) === 90);
}

export function buildGlobeRoute(destinations: Destination[]) {
  const ordered = destinations.map((stop, index): GlobeStop | null =>
    isValidLocation(stop.location) ? {
      id: stop.id, number: index + 1, name: stop.name || "Untitled destination",
      color: stop.color, lat: stop.location.latitude, lng: stop.location.longitude,
    } : null,
  );
  const stops = ordered.filter((stop): stop is GlobeStop => stop !== null);
  const legs: GlobeLeg[] = [];
  for (let index = 1; index < ordered.length; index++) {
    const from = ordered[index - 1];
    const to = ordered[index];
    if (!from || !to || sameLocation(from, to)) continue;
    legs.push({
      id: `${from.id}:${to.id}`, startLat: from.lat, startLng: from.lng,
      endLat: to.lat, endLng: to.lng, color: from.color,
      label: `${from.number}. ${from.name} → ${to.number}. ${to.name}`,
    });
  }
  return { stops, legs, missing: destinations.length - stops.length };
}
