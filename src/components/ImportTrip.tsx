import { useRef, useState } from "react";
import { Dialog } from "./Dialog";
import { calculateTripBudget, formatMoney } from "../budget";
import { fileToPlan, parseTripFile } from "../trips/files";
import {
  MAX_FILE_BYTES,
  addWeeks,
  parseIsoDate,
  toIsoDate,
  totalWeeks,
} from "../trips/model";
import type { TripPlan } from "../trips/model";

export function ImportTrip({
  onImport,
  onClose,
}: {
  onImport: (plan: TripPlan) => void;
  onClose: () => void;
}) {
  const [source, setSource] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<TripPlan | null>(null);
  const [reading, setReading] = useState(false);
  const readSequence = useRef(0);
  const budget = preview ? calculateTripBudget(preview.destinations) : null;
  function review() {
    const result = parseTripFile(source);
    if (!result.ok) {
      setErrors(result.errors);
      setPreview(null);
      return;
    }
    setErrors([]);
    setPreview(fileToPlan(result.file));
  }
  return (
    <Dialog
      title="Import a trip"
      subtitle="Choose a trip file or paste an LLM’s JSON. Review it before adding an independent copy to your library."
      eyebrow="Your trip library"
      closeLabel="Close import"
      wide
      onClose={onClose}
    >
      <div className="dialog-body trip-form">
        <label className="file-picker">
          Choose trip file
          <input
            type="file"
            accept=".json,application/json"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const sequence = ++readSequence.current;
              setPreview(null);
              setErrors([]);
              setSource("");
              if (file.size > MAX_FILE_BYTES) {
                setReading(false);
                setErrors(["Trip files must be no larger than 1 MiB."]);
                return;
              }
              setReading(true);
              try {
                const text = await file.text();
                if (sequence === readSequence.current) setSource(text);
              } catch {
                if (sequence === readSequence.current)
                  setErrors([
                    "The file could not be read. Try another file or paste its JSON.",
                  ]);
              } finally {
                if (sequence === readSequence.current) setReading(false);
              }
            }}
          />
        </label>
        <div className="form-field">
          <label htmlFor="trip-json">Trip JSON</label>
          <textarea
            id="trip-json"
            className="code-text"
            rows={8}
            spellCheck={false}
            value={source}
            placeholder='Paste { "format": "trip-planner", "version": 1, "trip": ... }'
            onChange={(event) => {
              ++readSequence.current;
              setReading(false);
              setSource(event.target.value);
              setErrors([]);
              setPreview(null);
            }}
          />
        </div>
        <p className="budget-note">
          JSON or one JSON code block · up to 1 MiB · 100 stops · 520 weeks
        </p>
        {reading && <p role="status">Reading file…</p>}
        {errors.length > 0 && (
          <div className="form-errors" role="alert">
            <strong>Check the trip file</strong>
            <ul>
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}
        {preview && budget && (
          <section className="import-preview" aria-label="Import preview">
            <p className="eyebrow">Ready to import</p>
            <h3>{preview.title}</h3>
            <p>{preview.description || "No description provided."}</p>
            <dl className="preview-facts">
              <div>
                <dt>Dates</dt>
                <dd>
                  {preview.tripStartDate} →{" "}
                  {toIsoDate(
                    addWeeks(
                      parseIsoDate(preview.tripStartDate),
                      totalWeeks(preview),
                    ),
                  )}
                </dd>
              </div>
              <div>
                <dt>Duration</dt>
                <dd>
                  {totalWeeks(preview)} weeks · {budget.days} days / nights
                </dd>
              </div>
              <div>
                <dt>Estimated budget</dt>
                <dd>
                  {formatMoney(budget.total, preview.currency)}{" "}
                  {preview.currency}
                </dd>
              </div>
              <div>
                <dt>Missing estimates</dt>
                <dd>
                  {budget.rows.reduce((sum, row) => sum + 5 - row.entered, 0)}{" "}
                  categories across {budget.rows.length} stops
                </dd>
              </div>
            </dl>
            <ol className="preview-stops">
              {preview.destinations.map((stop) => (
                <li key={stop.id}>
                  <span>{stop.name}</span>
                  <span>{stop.durationWeeks}w</span>
                </li>
              ))}
            </ol>
            <p className="budget-note">
              Your existing trips stay in the library. A numbered title is added
              if this name already exists.
            </p>
          </section>
        )}
      </div>
      <footer className="dialog-footer">
        <div className="dialog-actions">
          <button className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          {preview ? (
            <button className="add-button" onClick={() => onImport(preview)}>
              Import as new trip
            </button>
          ) : (
            <button
              className="add-button"
              disabled={!source.trim() || reading}
              onClick={review}
            >
              Review trip
            </button>
          )}
        </div>
      </footer>
    </Dialog>
  );
}
