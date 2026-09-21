import { Copy, Download, Pencil, Trash2, Map } from "lucide-react";
import { calculateTripBudget, formatMoney } from "../budget";
import { totalWeeks } from "../trips/model";
import type { StoredTrip } from "../trips/model";

export function TripLibrary({
  trips,
  activeId,
  onOpen,
  onEdit,
  onDuplicate,
  onDelete,
  onExport,
  onNew,
  onImport,
}: {
  trips: StoredTrip[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string) => void;
  onNew: () => void;
  onImport: () => void;
}) {
  return (
    <section className="trip-library" aria-label="Saved trips">
      <div className="section-heading">
        <div>
          <h2>My trips</h2>
          <p>
            {trips.length} {trips.length === 1 ? "itinerary" : "itineraries"},
            saved in this browser. Export a file to back up or share a trip.
          </p>
        </div>
      </div>
      {trips.length ? (
        <div className="library-grid">
          {[...trips]
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .map((trip) => {
              const budget = calculateTripBudget(trip.plan.destinations);
              return (
                <article
                  className="trip-card"
                  key={trip.id}
                  aria-label={trip.plan.title}
                >
                  <div className="trip-card-top">
                    <span className="trip-card-icon">
                      <Map size={21} />
                    </span>
                    {activeId === trip.id && (
                      <span className="currency-badge">Current trip</span>
                    )}
                  </div>
                  <h3>
                    <button
                      className="trip-title-button"
                      onClick={() => onOpen(trip.id)}
                    >
                      {trip.plan.title}
                    </button>
                  </h3>
                  <p className="trip-card-description">
                    {trip.plan.description ||
                      "Add a description to capture the idea behind this trip."}
                  </p>
                  <dl className="trip-card-facts">
                    <div>
                      <dt>Starts</dt>
                      <dd>{trip.plan.tripStartDate}</dd>
                    </div>
                    <div>
                      <dt>Itinerary</dt>
                      <dd>
                        {totalWeeks(trip.plan)}{" "}
                        {totalWeeks(trip.plan) === 1 ? "week" : "weeks"} ·{" "}
                        {trip.plan.destinations.length}{" "}
                        {trip.plan.destinations.length === 1 ? "stop" : "stops"}
                      </dd>
                    </div>
                    <div>
                      <dt>Estimated cost</dt>
                      <dd>
                        {formatMoney(budget.total, trip.plan.currency)}{" "}
                        {trip.plan.currency}
                      </dd>
                    </div>
                  </dl>
                  <small className="trip-updated">
                    Edited {new Date(trip.updatedAt).toLocaleString()}
                  </small>
                  <div className="trip-card-actions">
                    <button
                      className="secondary-button"
                      onClick={() => onOpen(trip.id)}
                    >
                      Open trip
                    </button>
                    <div className="button-row">
                      <button
                        className="icon-button"
                        aria-label={`Rename ${trip.plan.title}`}
                        title="Rename or edit description"
                        onClick={() => onEdit(trip.id)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Duplicate ${trip.plan.title}`}
                        title="Duplicate trip"
                        onClick={() => onDuplicate(trip.id)}
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Export ${trip.plan.title}`}
                        title="Export JSON"
                        onClick={() => onExport(trip.id)}
                      >
                        <Download size={16} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Delete ${trip.plan.title}`}
                        title="Delete trip"
                        onClick={() => onDelete(trip.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
        </div>
      ) : (
        <div className="library-empty">
          <Map size={32} />
          <h3>Your next trip starts here</h3>
          <p>Create an itinerary or import a file from a friend or an LLM.</p>
          <div className="button-row">
            <button className="add-button" onClick={onNew}>
              New trip
            </button>
            <button className="secondary-button" onClick={onImport}>
              Import trip
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
