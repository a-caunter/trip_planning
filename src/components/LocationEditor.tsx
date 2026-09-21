import { useState } from "react";
import type { Destination, DestinationLocation } from "../trips/model";
import { isValidLocation } from "../globe/route";
import { Dialog } from "./Dialog";

export function LocationEditor({ destination, onSave, onClose }: {
  destination: Destination;
  onSave: (location: DestinationLocation | undefined) => void;
  onClose: () => void;
}) {
  const [latitude, setLatitude] = useState(destination.location?.latitude.toString() ?? "");
  const [longitude, setLongitude] = useState(destination.location?.longitude.toString() ?? "");
  const [error, setError] = useState("");
  return <Dialog title={`Location for ${destination.name || "Untitled destination"}`}
    subtitle="Enter the approximate destination center in decimal degrees."
    eyebrow="Globe location" onClose={onClose} closeLabel="Close location editor">
    <form noValidate onSubmit={(event) => {
      event.preventDefault();
      const location = { latitude: Number(latitude), longitude: Number(longitude) };
      if (!latitude.trim() || !longitude.trim() || !isValidLocation(location)) {
        setError("Enter both coordinates: latitude from −90 to 90 and longitude from −180 to 180.");
        return;
      }
      onSave(location);
    }}>
      <div className="dialog-body trip-form">
        <div className="form-field">
          <label htmlFor="location-latitude">Latitude</label>
          <input id="location-latitude" type="number" step="any" min="-90" max="90"
            value={latitude} onChange={(event) => setLatitude(event.target.value)}
            aria-describedby={error ? "location-error" : undefined} aria-invalid={!!error} />
        </div>
        <div className="form-field">
          <label htmlFor="location-longitude">Longitude</label>
          <input id="location-longitude" type="number" step="any" min="-180" max="180"
            value={longitude} onChange={(event) => setLongitude(event.target.value)}
            aria-describedby={error ? "location-error" : undefined} aria-invalid={!!error} />
        </div>
        <p className="budget-note">Use negative values for south and west. For example, Lisbon is 38.7223, −9.1393.</p>
        {error && <p id="location-error" className="form-errors" role="alert">{error}</p>}
      </div>
      <footer className="dialog-footer">
        <button type="button" className="text-button" disabled={!destination.location}
          onClick={() => onSave(undefined)}>Clear location</button>
        <div className="dialog-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button type="submit" className="add-button">Save location</button>
        </div>
      </footer>
    </form>
  </Dialog>;
}
