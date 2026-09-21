import { useState } from "react";
import { Dialog } from "./Dialog";

export function TripMetadata({
  title = "",
  description = "",
  isNew,
  onSave,
  onClose,
}: {
  title?: string;
  description?: string;
  isNew: boolean;
  onSave: (title: string, description: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(title);
  const [notes, setNotes] = useState(description);
  return (
    <Dialog
      title={isNew ? "Start a new trip" : "Edit trip details"}
      subtitle="Give this itinerary a name and describe what you have in mind."
      eyebrow="Your trip library"
      closeLabel="Close trip details"
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) onSave(name.trim(), notes);
        }}
      >
        <div className="dialog-body trip-form">
          <div className="form-field">
            <label htmlFor="trip-title">Trip title</label>
            <input
              id="trip-title"
              required
              maxLength={200}
              value={name}
              placeholder="A summer in Europe"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="trip-description">Trip description</label>
            <textarea
              id="trip-description"
              rows={4}
              maxLength={10000}
              value={notes}
              placeholder="Where you want to go, who’s joining, and what matters to you…"
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </div>
        <footer className="dialog-footer">
          <div className="dialog-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="add-button"
              type="submit"
              disabled={!name.trim()}
            >
              {isNew ? "Create trip" : "Save trip details"}
            </button>
          </div>
        </footer>
      </form>
    </Dialog>
  );
}
