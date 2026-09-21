import { useMemo, useState } from "react";
import { Dialog } from "./Dialog";
import guide from "../trips/authoring-guide.md?raw";
import example from "../trips/portugal.trip.json";
import { planToFile, tripSchema, validateTripFile } from "../trips/files";
import { buildTripPrompt } from "../trips/prompt";
import { downloadText } from "../trips/download";
import type { TripFile } from "../trips/files";
import type { StoredTrip } from "../trips/model";

export function CreateWithAI({
  trips,
  onClose,
}: {
  trips: StoredTrip[];
  onClose: () => void;
}) {
  const [request, setRequest] = useState("");
  const [exampleId, setExampleId] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const file = useMemo(() => {
    const trip = trips.find((trip) => trip.id === exampleId);
    return trip ? planToFile(trip.plan) : (example as TripFile);
  }, [trips, exampleId]);
  const validation = useMemo(() => validateTripFile(file), [file]);
  const prompt = useMemo(
    () => buildTripPrompt(request, file, guide),
    [request, file],
  );
  const ready = !!request.trim() && validation.ok;
  return (
    <Dialog
      title="Create a trip with AI"
      subtitle="Describe your trip, choose an example, and take a complete prompt to any LLM."
      eyebrow="From idea to itinerary"
      closeLabel="Close AI guide"
      wide
      onClose={onClose}
    >
      <div className="dialog-body trip-form">
        <ol className="ai-steps">
          <li>
            <b>1</b> Describe & copy
          </li>
          <li>
            <b>2</b> Ask your LLM
          </li>
          <li>
            <b>3</b> Import its JSON
          </li>
        </ol>
        <div className="form-field">
          <label htmlFor="ai-request">Describe your trip</label>
          <textarea
            id="ai-request"
            rows={4}
            maxLength={10000}
            value={request}
            placeholder="Three weeks in Japan from April 5, 2027, for two adults. We love food, gardens, and trains. Estimate in USD, aiming for $7,000 total…"
            onChange={(event) => {
              setRequest(event.target.value);
              setCopyStatus("");
            }}
          />
        </div>
        <div className="form-field">
          <label htmlFor="ai-example">Example trip</label>
          <select
            id="ai-example"
            value={exampleId}
            onChange={(event) => {
              setExampleId(event.target.value);
              setCopyStatus("");
            }}
          >
            <option value="">Portugal example (illustrative prices)</option>
            {trips.map((trip) => (
              <option key={trip.id} value={trip.id}>
                {trip.plan.title}
              </option>
            ))}
          </select>
        </div>
        <p className="budget-note">
          Include your start date, number of weeks, travelers, currency, budget,
          and interests. The example teaches the file structure; your request
          sets the itinerary.
        </p>
        {!validation.ok && (
          <div className="form-errors" role="alert">
            This example needs fixing before it can guide the model.
            <ul>
              {validation.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}
        <details className="prompt-preview">
          <summary>Preview or manually select the complete prompt</summary>
          <div className="form-field">
            <label htmlFor="ai-prompt">Prepared prompt</label>
            <textarea
              id="ai-prompt"
              className="code-text"
              readOnly
              rows={12}
              value={prompt}
              onFocus={(event) => event.target.select()}
            />
          </div>
        </details>
        <div className="authoring-downloads">
          <span>Reusable authoring materials</span>
          <div className="button-row">
            <button
              className="text-button"
              onClick={() =>
                downloadText("trip-authoring-guide.md", guide, "text/markdown")
              }
            >
              Download guide
            </button>
            <button
              className="text-button"
              onClick={() =>
                downloadText(
                  "trip.schema.json",
                  JSON.stringify(tripSchema, null, 2),
                )
              }
            >
              Download schema
            </button>
            <button
              className="text-button"
              onClick={() =>
                downloadText(
                  "portugal.trip.json",
                  JSON.stringify(example, null, 2),
                )
              }
            >
              Download example
            </button>
          </div>
        </div>
        <p className="budget-note">
          Nothing is sent to an AI provider by this app. Your selected example’s
          description, notes, and prices are included in the prompt you copy.
        </p>
        {copyStatus && (
          <p className="copy-status" role="status">
            {copyStatus}
          </p>
        )}
      </div>
      <footer className="dialog-footer">
        <div className="dialog-actions">
          <button
            className="secondary-button"
            disabled={!ready}
            onClick={() =>
              downloadText("trip-prompt.txt", prompt, "text/plain")
            }
          >
            Download prompt
          </button>
          <button
            className="add-button"
            disabled={!ready}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(prompt);
                setCopyStatus(
                  "Prompt copied. Paste it into your LLM, then use Import trip to load its JSON response.",
                );
              } catch {
                setCopyStatus(
                  "Clipboard access is unavailable. Open the prompt preview to select and copy the text, or download the prompt.",
                );
              }
            }}
          >
            Copy prompt
          </button>
        </div>
      </footer>
    </Dialog>
  );
}
