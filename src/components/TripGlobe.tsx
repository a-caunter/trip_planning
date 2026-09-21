import { Component, lazy, Suspense, useCallback, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Globe2, MapPin } from "lucide-react";
import type { Destination, DestinationLocation } from "../trips/model";
import { buildGlobeRoute } from "../globe/route";
import { LocationEditor } from "./LocationEditor";
import "../globe.css";

const GlobeSurface = lazy(() => import("./GlobeSurface"));
type ScheduledStop = Destination & { startDate: Date; endDate: Date };
const formatDate = (date: Date) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);

function GlobeUnavailable() {
  return <div className="globe-placeholder" role="status"><Globe2 size={42} aria-hidden="true" />
    <h3>The 3D globe is unavailable</h3><p>Your route and location editor are still available below. Try reopening this view in a browser with WebGL enabled.</p></div>;
}
class GlobeBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <GlobeUnavailable /> : this.props.children; }
}

export function TripGlobe({ destinations, onLocationChange }: {
  destinations: ScheduledStop[];
  onLocationChange: (id: string, location: DestinationLocation | undefined) => void;
}) {
  const route = useMemo(() => buildGlobeRoute(destinations), [destinations]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ id: string; sequence: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const list = useRef<HTMLOListElement>(null);
  const selected = destinations.find((stop) => stop.id === selectedId);
  const editing = destinations.find((stop) => stop.id === editingId);
  const onFailure = useCallback(() => setFailed(true), []);
  const selectMarker = useCallback((id: string) => {
    setSelectedId(id);
    const item = Array.from(list.current?.children ?? []).find((element) => (element as HTMLElement).dataset.stopId === id);
    item?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, []);
  return <section className="trip-globe" aria-label="Trip route">
    <div className="globe-heading">
      <div><p className="eyebrow">Your journey, connected</p><h2>Around the globe</h2>
        <p>Follow your stops in itinerary order.</p></div>
      <span className="globe-count"><MapPin size={16} aria-hidden="true" />{route.stops.length} of {destinations.length} stops located</span>
    </div>
    <div className="globe-layout">
      <div className="globe-map-panel">
        {failed ? <GlobeUnavailable /> : <GlobeBoundary>
          <Suspense fallback={<div className="globe-placeholder" role="status">Loading your globe…</div>}>
            <GlobeSurface stops={route.stops} legs={route.legs} selectedId={selectedId}
              focusRequest={focusRequest} onSelect={selectMarker} onFailure={onFailure} />
          </Suspense>
        </GlobeBoundary>}
        <div className="globe-selection" aria-live="polite">
          {selected ? <><strong>{destinations.indexOf(selected) + 1}. {selected.name || "Untitled destination"}</strong>
            <span>{formatDate(selected.startDate)} – {formatDate(selected.endDate)} · {selected.durationWeeks} {selected.durationWeeks === 1 ? "week" : "weeks"}</span>
            {!selected.location && <span>Location needed — choose Edit location to place this stop.</span>}</>
            : <><strong>Every stop has a place.</strong><span>Select a stop to explore your route.</span></>}
        </div>
      </div>
      <aside className="globe-route-panel" aria-label="Ordered destinations">
        <div className="globe-route-heading"><h3>Your route</h3><span>{destinations.length} stops</span></div>
        {!!route.missing && <p className="globe-missing" role="status">{route.missing} {route.missing === 1 ? "stop needs a location" : "stops need locations"}. Add coordinates to complete the connections.</p>}
        <ol className="globe-stop-list" ref={list}>
          {destinations.map((stop, index) => <li key={stop.id} data-stop-id={stop.id}
            className={selectedId === stop.id ? "is-selected" : undefined}
            style={{ "--stop-color": stop.color } as CSSProperties}>
            <span className="globe-stop-number" aria-hidden="true">{index + 1}</span>
            <div className="globe-stop-content">
              <button type="button" className="globe-stop-select" aria-pressed={selectedId === stop.id}
                onClick={() => { setSelectedId(stop.id); setFocusRequest((current) => ({ id: stop.id, sequence: (current?.sequence ?? 0) + 1 })); }}>
                <strong>{stop.name || "Untitled destination"}</strong>
                <span>{stop.durationWeeks} {stop.durationWeeks === 1 ? "week" : "weeks"} · {formatDate(stop.startDate)}</span>
              </button>
              <span className={`globe-location${stop.location ? "" : " is-missing"}`}>
                {stop.location ? `${stop.location.latitude.toFixed(4)}, ${stop.location.longitude.toFixed(4)}` : "Location needed"}
              </span>
              <button type="button" className="text-button" aria-label={`Edit location for ${stop.name || "Untitled destination"}`}
                onClick={() => setEditingId(stop.id)}>Edit location</button>
            </div>
          </li>)}
        </ol>
      </aside>
    </div>
    <p className="globe-caption">Connections show itinerary sequence, not flight or road paths. <span>Made with Natural Earth.</span></p>
    {editing && <LocationEditor key={editing.id} destination={editing} onClose={() => setEditingId(null)}
      onSave={(location) => { onLocationChange(editing.id, location); setEditingId(null); }} />}
  </section>;
}
