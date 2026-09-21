import { useState } from "react";
import {
  Download,
  FolderOpen,
  Plus,
  Sparkles,
  Upload,
  Pencil,
} from "lucide-react";
import { TripWorkspace } from "./TripWorkspace";
import { TripLibrary } from "./components/TripLibrary";
import { TripMetadata } from "./components/TripMetadata";
import { ImportTrip } from "./components/ImportTrip";
import { CreateWithAI } from "./components/CreateWithAI";
import { Dialog } from "./components/Dialog";
import { useTripLibrary } from "./trips/useTripLibrary";
import {
  addTrip,
  duplicateTrip,
  removeTrip,
  uniqueTitle,
} from "./trips/library";
import { createTrip, MAX_FILE_BYTES } from "./trips/model";
import type { TripPlan } from "./trips/model";
import { parseTripFile, serializeTrip, tripFilename } from "./trips/files";
import { downloadText } from "./trips/download";

type OpenDialog =
  | { kind: "new" | "import" | "ai" }
  | { kind: "edit" | "delete"; id: string }
  | null;

export function App() {
  const { library, setLibrary, error, saved, canRetry, retrySave } =
    useTripLibrary();
  const [showLibrary, setShowLibrary] = useState(false);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [actionError, setActionError] = useState("");
  const active = library.trips.find((trip) => trip.id === library.activeTripId);
  const target =
    dialog && "id" in dialog
      ? library.trips.find((trip) => trip.id === dialog.id)
      : undefined;
  const inLibrary = showLibrary || !active;

  function openTrip(id: string) {
    setLibrary((current) => ({ ...current, activeTripId: id }));
    setShowLibrary(false);
    setActionError("");
  }
  function updateActive(updater: (plan: TripPlan) => TripPlan) {
    if (!active) return;
    const plan = updater(active.plan);
    if (new TextEncoder().encode(serializeTrip(plan)).length > MAX_FILE_BYTES) {
      setActionError(
        "This edit would exceed the 1 MiB trip file limit. Shorten the trip’s notes or description.",
      );
      return;
    }
    setActionError("");
    setLibrary((current) => ({
      ...current,
      trips: current.trips.map((trip) =>
        trip.id === active.id
          ? { ...trip, plan, updatedAt: new Date().toISOString() }
          : trip,
      ),
    }));
  }
  function importTrip(plan: TripPlan) {
    setLibrary((current) => addTrip(current, plan));
    setDialog(null);
    setShowLibrary(false);
    setActionError("");
  }
  function exportTrip(id: string) {
    const trip = library.trips.find((trip) => trip.id === id);
    if (!trip) return;
    const source = serializeTrip(trip.plan);
    const validation = parseTripFile(source);
    if (!validation.ok) {
      setActionError(`Before exporting, fix: ${validation.errors.join(" ")}`);
      return;
    }
    downloadText(tripFilename(trip.plan.title), source);
    setActionError("");
  }

  return (
    <main className="app-shell">
      <header className="library-shell-heading">
        <div>
          <p className="eyebrow">Trip planner</p>
          <h1>
            {inLibrary ? "A world of possibilities." : active!.plan.title}
          </h1>
          <p className="header-description">
            {inLibrary
              ? "Keep your ideas together. Take your plans anywhere."
              : active!.plan.description ||
                "Shape your itinerary and make room for what matters."}
          </p>
        </div>
        {!inLibrary && active && (
          <button
            className="secondary-button edit-trip-button"
            onClick={() => setDialog({ kind: "edit", id: active.id })}
          >
            <Pencil size={15} aria-hidden="true" /> Edit trip details
          </button>
        )}
      </header>
      <section className="trip-command-bar" aria-label="Trip library controls">
        <div className="trip-switcher">
          <button
            className={`secondary-button${inLibrary ? " selected-button" : ""}`}
            onClick={() => {
              setShowLibrary(true);
              setActionError("");
            }}
          >
            <FolderOpen size={16} aria-hidden="true" />
            My trips
          </button>
          {!!library.trips.length && (
            <label className="trip-select">
              <span className="visually-hidden">Current trip</span>
              <select
                value={library.activeTripId ?? ""}
                onChange={(event) => openTrip(event.target.value)}
              >
                {library.trips.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.plan.title}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="button-row trip-primary-actions">
          <button
            className="secondary-button"
            onClick={() => setDialog({ kind: "import" })}
          >
            <Upload size={15} aria-hidden="true" />
            Import trip
          </button>
          {active && (
            <button
              className="secondary-button"
              onClick={() => exportTrip(active.id)}
            >
              <Download size={15} aria-hidden="true" />
              Export JSON
            </button>
          )}
          <button
            className="secondary-button ai-button"
            onClick={() => setDialog({ kind: "ai" })}
          >
            <Sparkles size={15} aria-hidden="true" />
            Create with AI
          </button>
          <button
            className="add-button"
            onClick={() => setDialog({ kind: "new" })}
          >
            <Plus size={16} aria-hidden="true" />
            New trip
          </button>
        </div>
      </section>
      <div className="library-save-state" role="status">
        {error
          ? "Not saved to this browser"
          : saved
            ? "Saved in this browser"
            : "Saving…"}
      </div>
      {error && (
        <div className="workspace-notice" role="alert">
          <span>{error}</span>
          {canRetry && (
            <button className="secondary-button" onClick={retrySave}>
              Retry saving
            </button>
          )}
        </div>
      )}
      {actionError && (
        <div className="workspace-notice" role="alert">
          {actionError}
        </div>
      )}
      {inLibrary ? (
        <TripLibrary
          trips={library.trips}
          activeId={library.activeTripId}
          onOpen={openTrip}
          onEdit={(id) => setDialog({ kind: "edit", id })}
          onDelete={(id) => setDialog({ kind: "delete", id })}
          onExport={exportTrip}
          onNew={() => setDialog({ kind: "new" })}
          onImport={() => setDialog({ kind: "import" })}
          onDuplicate={(id) => {
            setLibrary((current) => duplicateTrip(current, id));
            setActionError("");
          }}
        />
      ) : (
        active && (
          <TripWorkspace
            key={active.id}
            plan={active.plan}
            setPlan={updateActive}
          />
        )
      )}
      {dialog?.kind === "import" && (
        <ImportTrip onImport={importTrip} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "ai" && (
        <CreateWithAI trips={library.trips} onClose={() => setDialog(null)} />
      )}
      {(dialog?.kind === "new" || (dialog?.kind === "edit" && target)) && (
        <TripMetadata
          key={target?.id ?? "new"}
          isNew={dialog.kind === "new"}
          title={target?.plan.title}
          description={target?.plan.description}
          onClose={() => setDialog(null)}
          onSave={(title, description) => {
            if (dialog.kind === "new") {
              importTrip({ ...createTrip(title), description });
              return;
            }
            if (!target) return;
            const plan = {
              ...target.plan,
              title: uniqueTitle(
                title,
                library.trips.filter((trip) => trip.id !== target.id),
              ),
              description,
            };
            if (
              new TextEncoder().encode(serializeTrip(plan)).length >
              MAX_FILE_BYTES
            ) {
              setActionError(
                "The trip exceeds the 1 MiB file limit. Shorten its description before saving.",
              );
              setDialog(null);
              return;
            }
            setLibrary((current) => ({
              ...current,
              trips: current.trips.map((trip) =>
                trip.id === target.id
                  ? { ...trip, plan, updatedAt: new Date().toISOString() }
                  : trip,
              ),
            }));
            setDialog(null);
            setActionError("");
          }}
        />
      )}
      {dialog?.kind === "delete" && target && (
        <Dialog
          title={`Delete ${target.plan.title}?`}
          subtitle="This removes the trip from this browser. Export a copy first if you want to keep it."
          eyebrow="Delete trip"
          closeLabel="Cancel deletion"
          onClose={() => setDialog(null)}
        >
          <div className="dialog-body">
            <p>Other trips and previously exported files are unaffected.</p>
          </div>
          <footer className="dialog-footer">
            <div className="dialog-actions">
              <button
                className="secondary-button"
                onClick={() => setDialog(null)}
              >
                Cancel
              </button>
              <button
                className="danger-button"
                onClick={() => {
                  setLibrary((current) => removeTrip(current, target.id));
                  setDialog(null);
                }}
              >
                Delete trip
              </button>
            </div>
          </footer>
        </Dialog>
      )}
    </main>
  );
}
