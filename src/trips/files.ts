import Ajv from "ajv";
import type { ErrorObject } from "ajv";
import schema from "./trip.schema.json" with { type: "json" };
import { COLORS, MAX_FILE_BYTES, MAX_WEEKS, isCalendarDate } from "./model.ts";
import type { TripPlan } from "./model.ts";
import type { Currency } from "../budget.ts";

export { schema as tripSchema };
export type TripFile = {
  format: "trip-planner";
  version: 1;
  trip: {
    title: string;
    description?: string;
    tripStartDate: string;
    currency: Currency;
    destinations: Array<{
      name: string;
      durationWeeks: number;
      notes?: string;
      color?: string;
      costs?: Partial<
        Record<
          "flights" | "lodgingPerNight" | "foodPerDay" | "transport" | "misc",
          number | null
        >
      >;
    }>;
  };
};
export type ValidationResult =
  | { ok: true; file: TripFile }
  | { ok: false; errors: string[] };
const ajv = new Ajv({ allErrors: true, strict: true, multipleOfPrecision: 8 });
ajv.addFormat("date", { type: "string", validate: isCalendarDate });
const validateV1 = ajv.compile<TripFile>(schema);

function describeError(error: ErrorObject) {
  const path = error.instancePath
    .replace(/^\/trip\/?/, "")
    .replace(
      /^destinations\/(\d+)\/?/,
      (_, index) => `Destination ${Number(index) + 1}: `,
    )
    .replace(/\//g, ".");
  const field =
    error.keyword === "additionalProperties"
      ? error.params.additionalProperty
      : error.keyword === "required"
        ? error.params.missingProperty
        : "";
  const message =
    error.keyword === "additionalProperties"
      ? `unknown field "${field}"`
      : error.keyword === "required"
        ? `missing ${field}`
        : error.keyword === "format"
          ? "must be a real date in YYYY-MM-DD format"
          : error.keyword === "type" && error.params.type === "integer"
            ? "must be a whole number"
            : error.keyword === "multipleOf"
              ? "must have at most two decimal places"
              : error.message;
  return `${path || "Trip file"}: ${message}`;
}
export function validateTripFile(value: unknown): ValidationResult {
  if (
    value &&
    typeof value === "object" &&
    "version" in value &&
    value.version !== 1
  ) {
    return {
      ok: false,
      errors: [
        `Unsupported trip file version ${String(value.version)}. This app supports version 1.`,
      ],
    };
  }
  if (!validateV1(value))
    return {
      ok: false,
      errors: (validateV1.errors ?? []).slice(0, 20).map(describeError),
    };
  for (const [index, stop] of value.trip.destinations.entries()) {
    for (const [field, amount] of Object.entries(stop.costs ?? {})) {
      if (typeof amount === "number" && amount !== Number(amount.toFixed(2)))
        return {
          ok: false,
          errors: [
            `Destination ${index + 1}: costs.${field} must have at most two decimal places.`,
          ],
        };
    }
  }
  if (
    value.trip.destinations.reduce((sum, stop) => sum + stop.durationWeeks, 0) >
    MAX_WEEKS
  )
    return {
      ok: false,
      errors: [`Trip duration must not exceed ${MAX_WEEKS} weeks.`],
    };
  return { ok: true, file: value };
}
export function parseTripFile(text: string): ValidationResult {
  if (new TextEncoder().encode(text).length > MAX_FILE_BYTES)
    return { ok: false, errors: ["Trip files must be no larger than 1 MiB."] };
  let source = text.replace(/^\uFEFF/, "").trim();
  const fenced = source.match(/^```(?:json)?\s*\r?\n([\s\S]*?)\r?\n```$/i);
  if (fenced) source = fenced[1];
  try {
    const result = validateTripFile(JSON.parse(source));
    if (
      result.ok &&
      new TextEncoder().encode(serializeTrip(fileToPlan(result.file))).length >
        MAX_FILE_BYTES
    )
      return {
        ok: false,
        errors: [
          "The formatted trip file would exceed 1 MiB. Shorten its notes or description.",
        ],
      };
    return result;
  } catch {
    return {
      ok: false,
      errors: [
        "This is not valid JSON. Paste one complete JSON object; remove comments and trailing commas.",
      ],
    };
  }
}
export function fileToPlan(file: TripFile): TripPlan {
  return {
    ...file.trip,
    description: file.trip.description ?? "",
    destinations: file.trip.destinations.map((stop, index) => ({
      id: crypto.randomUUID(),
      name: stop.name,
      durationWeeks: stop.durationWeeks,
      notes: stop.notes ?? "",
      color: stop.color ?? COLORS[index % COLORS.length],
      costs: {
        flights: stop.costs?.flights ?? null,
        lodging: stop.costs?.lodgingPerNight ?? null,
        food: stop.costs?.foodPerDay ?? null,
        transport: stop.costs?.transport ?? null,
        misc: stop.costs?.misc ?? null,
      },
    })),
  };
}
export function planToFile(plan: TripPlan): TripFile {
  return {
    format: "trip-planner",
    version: 1,
    trip: {
      title: plan.title,
      description: plan.description,
      tripStartDate: plan.tripStartDate,
      currency: plan.currency,
      destinations: plan.destinations.map((stop) => ({
        name: stop.name,
        durationWeeks: stop.durationWeeks,
        notes: stop.notes,
        color: stop.color,
        costs: {
          flights: stop.costs.flights,
          lodgingPerNight: stop.costs.lodging,
          foodPerDay: stop.costs.food,
          transport: stop.costs.transport,
          misc: stop.costs.misc,
        },
      })),
    },
  };
}
export function serializeTrip(plan: TripPlan) {
  return JSON.stringify(planToFile(plan), null, 2) + "\n";
}
export function tripFilename(title: string) {
  const stem = title
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
    .toLowerCase();
  return `${stem || "trip"}.trip.json`;
}
