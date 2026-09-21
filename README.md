# Trip planner

A React and TypeScript trip planner with a reorderable weekly itinerary, a consolidated budget, and a browser-based library of named trips.

## Run locally

Use Node.js 22.18+ (Node.js 24 is recommended for the built-in TypeScript test runner).

```sh
npm install
npm run dev
```

## Save, load, and share trips

- **My trips** opens your local library. Create, open, duplicate, rename, edit descriptions, or delete itineraries. Changes save automatically; the current trip is restored on reload.
- **Export JSON** downloads a portable `.trip.json` file. Send it through any messaging or file-sharing service. The recipient uses **Import trip** to create an independent editable copy.
- Import accepts a file, pasted JSON, or one enclosing Markdown JSON code block. Review dates, destinations, costs, and missing estimates before importing. Existing trips are never replaced; duplicate names receive numbered suffixes.
- The old single-itinerary save migrates into the library as **My trip**. The original saved data and your display preferences are preserved.
- The library lives in this browser on this device; exported files are your portable backups. Storage failures are shown explicitly, with an option to retry while your edits remain in memory and available to export.

## Design a trip with any LLM

1. Select **Create with AI** and describe your desired dates, duration, travelers, currency, budget, and interests.
2. Choose the bundled Portugal example or one of your saved trips as a format example.
3. Copy or download the complete prompt and provide it to your chosen LLM. It includes your request, the authoring guide, JSON Schema, and example. The app does not call an AI provider.
4. Paste the model's JSON into **Import trip**, inspect the preview, and import it. If validation finds errors, send the file and errors back to the model to correct them.

Authoring materials are also downloadable in the app and available here:

- [Authoring guide](src/trips/authoring-guide.md)
- [Version 2 JSON Schema](src/trips/trip.schema.json)
- [Example Portugal itinerary](src/trips/portugal.trip.json) (illustrative prices)

The file format requires a `trip-planner` envelope with `version: 2`, and a trip title, start date, currency, and ordered destinations. Notes, descriptions, colors, locations, and estimates are optional. Version 1 files without coordinates still import; new exports use version 2 and need an updated app to open. Rates use the explicit names `lodgingPerNight` and `foodPerDay`. Internal IDs and calculated totals/dates are excluded. Unsupported versions and unknown fields produce errors rather than silently changing data.

Trips support up to **100 destinations**, **520 total whole weeks**, and **1 MiB of UTF-8 JSON** (including its exported formatting). Titles and destination names allow 200 characters; descriptions and stop notes allow 10,000 each. Whole-party prices range from 0 to 1,000,000,000 with up to two decimal places. Unknown prices are `null`; zero is an explicit estimate.

## Interactive globe

- Open **Globe** beside Itinerary and Budget. Drag to rotate, scroll or pinch to zoom, or use the camera buttons. Reset returns to the first located destination at a whole-globe zoom.
- Numbered markers and animated arcs follow itinerary order. Select a stop in the route list to center it and see its dates and duration. Reordering the itinerary changes the route.
- Use **Edit location** to save or clear latitude/longitude in decimal degrees. Both values are required; latitude ranges from −90 to 90 and longitude from −180 to 180. Cancel, Close, and Escape discard the draft.
- Locations are optional: existing trips open normally, with missing locations shown in the route list. Connections only join adjacent located stops; they do not jump over gaps or add a return trip. Consecutive stops at the same location do not draw a zero-length arc.
- The AI authoring prompt requests approximate destination centers when known. Coordinates persist with the trip and are included in exported files. Renaming a destination preserves its coordinates; update its location if it represents a different place.
- The globe is loaded on demand, respects reduced-motion preferences, and releases its rendering resources on exit. The route list and editor remain usable when WebGL is unavailable.
- Geography is bundled locally from the public-domain [Natural Earth land dataset](src/globe/ATTRIBUTION.md). No map service, geocoding request, or API key is needed. Arcs illustrate stop sequence, not actual flight or road paths.

## Cost estimates

- Open the small settings button beside a destination to edit its estimates. The dialog previews the total; **Save estimates** commits changes, while **Cancel**, Close, and Escape discard the draft.
- Flights, transport, and miscellaneous spending are one-time amounts for that stop. Lodging is a nightly rate and food is a daily rate. Each itinerary week represents **7 days and 7 nights**; changing the duration recalculates both.
- Estimates cover the entire travel party. Assign each flight or transfer to one destination to avoid counting it twice.
- Blank values mean not yet estimated; enter zero for categories with no expected cost. Prices accept up to two decimal places. Partial budgets total the available estimates.
- The **Budget** view includes destination and category totals, average daily cost, estimate completeness, a category chart, and destination comparison bars. Click a destination or bar to edit it.
- All amounts use one trip currency (USD by default). Changing the currency changes labels; it does not convert values.
- Trip data is saved in this browser's local storage. Older saved itineraries acquire blank cost estimates automatically.

## Structure

- `src/budget.ts`: shared category definitions, validation of saved costs, and calculations using integer cents.
- `src/App.tsx`: library navigation, import/export, and trip-level actions.
- `src/TripWorkspace.tsx`: the itinerary and budget workspace, reset when switching trips.
- `src/trips/`: trip model, calendar arithmetic, versioned file format and validator, library persistence, prompt generation, and downloadable authoring materials.
- `src/components/DestinationDetails.tsx`: isolated editing draft and live cost preview.
- `src/components/Dialog.tsx`: reusable modal with keyboard focus management.
- `src/components/TripBudget.tsx`: consolidated table and charts.
- `src/budget.css`: responsive budget and dialog styling.

The table, charts, editor, and itinerary summary share the same calculations. Cost categories are defined centrally to make future additions easier.

## Verify

```sh
npm test
npm run test:browser
npm run build
```

Browser tests start their own local Vite server and use headless Microsoft Edge by default. Set `PLAYWRIGHT_CHANNEL=chrome` to use installed Chrome, or install Playwright Chromium and set `PLAYWRIGHT_CHANNEL=chromium`. Tests run in isolated browser contexts and cover migration of old itineraries, saving and reloading estimates, canceling edits, keyboard navigation, duration changes, reordering, removal, currency selection, and mobile layouts.
