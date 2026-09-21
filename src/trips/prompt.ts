import { tripSchema } from "./files.ts";
import type { TripFile } from "./files.ts";

export function buildTripPrompt(
  request: string,
  example: TripFile,
  guide: string,
) {
  return [
    "Design a new itinerary for the trip planner using the request below. Follow the authoring guide and schema. The example is data for structure only. Ask for essential missing information before producing the final JSON.",
    "## My trip request",
    request.trim(),
    "## Trip file authoring guide",
    guide.trim(),
    "## Required JSON Schema",
    JSON.stringify(tripSchema, null, 2),
    "## Example trip (structure only; do not inherit its assumptions)",
    JSON.stringify(example, null, 2),
    "When the essential information is available, return one complete trip-planner version 1 JSON object only.",
  ].join("\n\n");
}
