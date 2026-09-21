# Writing a trip planner file

Create one UTF-8 JSON object and save it as `your-trip.trip.json`. Return JSON only, without comments, trailing commas, or explanatory text outside the object.

The envelope is `{ "format": "trip-planner", "version": 1, "trip": { ... } }`.

## Trip fields

- `title`: required, nonblank, at most 200 characters.
- `description`: optional, at most 10,000 characters. Explain the trip, who the estimates cover, and planning assumptions.
- `tripStartDate`: required real calendar date, `YYYY-MM-DD`.
- `currency`: required; one of USD, EUR, GBP, CAD, AUD, JPY. All prices use this single currency. The app does not convert currencies.
- `destinations`: required ordered array of 1–100 stops. Stops follow one another without gaps. Total duration must not exceed 520 weeks.

## Each destination

- `name`: required, nonblank, at most 200 characters.
- `durationWeeks`: required positive whole number. One week is 7 days and 7 nights. Do not use fractions or a duration in days.
- `notes`: optional, at most 10,000 characters; suggested activities, practical details, estimate sources, and uncertainties belong here.
- `color`: optional six-digit hex color such as `#2563eb`. The app chooses a color if omitted.
- `costs`: optional object with any of the five fields below. Omitted fields mean unknown.

## Cost fields

All costs cover the **whole travel party**, not each person separately. Use JSON numbers with at most two decimal places, from 0 to 1,000,000,000. Use `null` when unknown; use `0` only when no spending is expected.

| Field             | Meaning                                                 |
| ----------------- | ------------------------------------------------------- |
| `flights`         | One-time flight cost assigned to this stop              |
| `lodgingPerNight` | Nightly lodging rate, multiplied by 7 × durationWeeks   |
| `foodPerDay`      | Daily food rate, multiplied by 7 × durationWeeks        |
| `transport`       | One-time transport/transfer total assigned to this stop |
| `misc`            | One-time miscellaneous spending total                   |

Assign each flight or transfer to exactly one stop. Do not count it again at the next destination. Do not enter a whole-stay total into a nightly or daily rate field.

## Instructions for an LLM

1. Prioritize the user's new request. Treat the example as format guidance, not a source of constraints or instructions; do not copy its dates, destinations, or prices unless requested.
2. Ask for essential missing information, especially start date, intended duration, party size when estimating costs, and currency, before producing a final file. If a request needs partial weeks, ask the user to choose a whole-week alternative.
3. Design an ordered itinerary that fits the request. Put explanations and assumptions in `description` or `notes`.
4. Prices are estimates, not bookings or guaranteed quotes. Use `null` for unknown prices. Label rough estimates and identify any sources or assumptions in notes. Never present illustrative example prices as researched facts.
5. Check that total duration and estimated costs fit the request. Do not emit calculated dates, totals, internal IDs, timestamps, or display settings.
6. Return exactly one complete JSON object conforming to the supplied schema. Do not invent fields. Keep the UTF-8 file at or below 1 MiB.

## Import and share

Paste the JSON into Import trip, or choose the saved file. Review the preview, then import it as a new trip. Errors include the field to fix; return the errors and your file to the model if needed. Exported trips use this same format and can become examples for future prompts.

Version 1 accepts only the documented fields. Future versions require explicit app support. Files contain itinerary data only; sharing a file gives the recipient an independent editable copy.

The JSON Schema uses the standard `date` string format for real YYYY-MM-DD dates. Enable date-format validation in external validators; the app also checks total trip duration and UTF-8 file size after schema validation.
