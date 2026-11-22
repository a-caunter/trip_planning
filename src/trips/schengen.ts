import type { ScheduledDestination } from "./model.ts";

export const SCHENGEN_WINDOW_DAYS = 180;

export function calculateSchengenSeries(destinations: ScheduledDestination[]) {
  const last = destinations[destinations.length - 1];
  const marked = new Uint8Array(last ? last.startDay + last.durationDays : 0);
  for (const stop of destinations) {
    if (stop.schengen) marked.fill(1, stop.startDay, stop.startDay + stop.durationDays);
  }

  const counts = new Uint8Array(marked.length);
  let rolling = 0;
  let peak = 0;
  let peakEndDay = 0;
  for (let day = 0; day < marked.length; day++) {
    rolling += marked[day] - (marked[day - SCHENGEN_WINDOW_DAYS] ?? 0);
    counts[day] = rolling;
    if (rolling > peak) {
      peak = rolling;
      peakEndDay = day;
    }
  }
  return { counts, peak, peakEndDay };
}
