import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CalendarDays,
  CalendarRange,
  Columns3,
  GripVertical,
  Globe2,
  Plus,
  Settings2,
  SlidersHorizontal,
  Trash2,
  Wallet,
} from "lucide-react";
import { CSSProperties, useEffect, useMemo, useState } from "react";
import {
  Currency,
  calculateStopBudget,
  calculateTripBudget,
  formatMoney,
} from "./budget";
import { DestinationDetails } from "./components/DestinationDetails";
import { TripBudget } from "./components/TripBudget";
import { TripGlobe } from "./components/TripGlobe";
import { TripSchengen } from "./components/TripSchengen";

import type { Destination, ScheduledDestination, TripPlan } from "./trips/model";
import {
  addDays,
  daysBetween,
  DAYS_PER_WEEK,
  parseIsoDate,
  createDestination,
  MAX_DESTINATIONS,
  MAX_TRIP_DAYS,
  scheduleDestinations,
  toIsoDate,
  totalDays,
  isCalendarDate,
} from "./trips/model";

type MetadataColumnId = "duration" | "start" | "end" | "color" | "notes";

type VisibleColumns = Record<MetadataColumnId, boolean>;

type PlannerSettings = {
  visibleColumns: VisibleColumns;
  weekWidth: number;
};

const SETTINGS_KEY = "trip-planning:planner-settings";
const DEFAULT_VISIBLE_COLUMNS: VisibleColumns = {
  duration: true,
  start: true,
  end: true,
  color: true,
  notes: true,
};
const COLUMN_DEFINITIONS: Array<{
  id: MetadataColumnId;
  label: string;
  width: number;
}> = [
  { id: "duration", label: "Days", width: 74 },
  { id: "start", label: "Start", width: 92 },
  { id: "end", label: "End", width: 138 },
  { id: "color", label: "Color", width: 62 },
  { id: "notes", label: "Notes", width: 260 },
];
const STATIC_METADATA_COLUMNS = [
  { id: "handle", label: "", width: 36 },
  { id: "destination", label: "Destination", width: 220 },
  { id: "actions", label: "", width: 36 },
];
const METADATA_GAP = 8;
const METADATA_PADDING = 24;

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function readPlannerSettings(): PlannerSettings {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(SETTINGS_KEY);
  } catch {
    /* Use default display settings. */
  }

  if (!saved) {
    return {
      visibleColumns: DEFAULT_VISIBLE_COLUMNS,
      weekWidth: 112,
    };
  }

  try {
    const parsed = JSON.parse(saved) as Partial<PlannerSettings>;

    return {
      visibleColumns: {
        ...DEFAULT_VISIBLE_COLUMNS,
        ...(parsed.visibleColumns || {}),
      },
      weekWidth: Math.min(180, Math.max(48, Number(parsed.weekWidth) || 112)),
    };
  } catch {
    return {
      visibleColumns: DEFAULT_VISIBLE_COLUMNS,
      weekWidth: 112,
    };
  }
}

export function TripWorkspace({
  plan,
  setPlan,
}: {
  plan: TripPlan;
  setPlan: (updater: (current: TripPlan) => TripPlan) => void;
}) {
  const [editError, setEditError] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [activeView, setActiveView] = useState<
    "itinerary" | "budget" | "globe" | "schengen"
  >("itinerary");
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [settings, setSettings] = useState<PlannerSettings>(() =>
    readPlannerSettings(),
  );
  const scheduledDestinations = useMemo(
    () => scheduleDestinations(plan),
    [plan],
  );
  const tripBudget = useMemo(
    () => calculateTripBudget(plan.destinations),
    [plan.destinations],
  );
  const selectedDestination = scheduledDestinations.find(
    (destination) => destination.id === detailsId,
  );
  const tripDays = totalDays(plan);
  const timelineWeeks = useMemo(() => {
    const start = parseIsoDate(plan.tripStartDate);
    return Array.from({ length: Math.ceil(tripDays / DAYS_PER_WEEK) }, (_, index) =>
      addDays(start, index * DAYS_PER_WEEK),
    );
  }, [plan.tripStartDate, tripDays]);
  const metadataLayout = useMemo(
    () => getMetadataLayout(settings.visibleColumns),
    [settings.visibleColumns],
  );
  const timelineWidth = timelineWeeks.length * settings.weekWidth;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      setSettingsError("");
    } catch {
      setSettingsError(
        "Display preferences could not be saved in this browser.",
      );
    }
  }, [settings]);

  function updateDestination(id: string, updates: Partial<Destination>) {
    setPlan((current) => ({
      ...current,
      destinations: current.destinations.map((destination) =>
        destination.id === id ? { ...destination, ...updates } : destination,
      ),
    }));
  }

  function addDestination() {
    if (
      plan.destinations.length >= MAX_DESTINATIONS ||
      tripDays >= MAX_TRIP_DAYS
    ) {
      setEditError(`Trips support up to ${MAX_DESTINATIONS} destinations and ${MAX_TRIP_DAYS} total days.`);
      return;
    }
    setEditError("");
    setPlan((current) => {
      const destination = createDestination(current.destinations.length + 1);
      destination.durationDays = Math.min(destination.durationDays, MAX_TRIP_DAYS - totalDays(current));
      return { ...current, destinations: [...current.destinations, destination] };
    });
  }

  function removeDestination(id: string) {
    setPlan((current) => ({
      ...current,
      destinations:
        current.destinations.length === 1
          ? current.destinations
          : current.destinations.filter((destination) => destination.id !== id),
    }));
  }

  function updateDuration(destination: ScheduledDestination, days: number) {
    if (
      !Number.isInteger(days) ||
      days < 1 ||
      tripDays - destination.durationDays + days > MAX_TRIP_DAYS
    ) {
      setEditError(
        `Use whole days of at least 1. Total trip duration cannot exceed ${MAX_TRIP_DAYS} days.`,
      );
      return false;
    }
    setEditError("");
    updateDestination(destination.id, { durationDays: days });
    return true;
  }

  function updateEndDate(destination: ScheduledDestination, value: string) {
    if (!isCalendarDate(value)) return false;
    const days = daysBetween(destination.startDate, parseIsoDate(value));
    if (days < 1) {
      setEditError("A destination must end after its start date.");
      return false;
    }
    return updateDuration(destination, days);
  }

  function toggleColumn(id: MetadataColumnId) {
    setSettings((current) => ({
      ...current,
      visibleColumns: {
        ...current.visibleColumns,
        [id]: !current.visibleColumns[id],
      },
    }));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setPlan((current) => {
      const oldIndex = current.destinations.findIndex(
        (destination) => destination.id === active.id,
      );
      const newIndex = current.destinations.findIndex(
        (destination) => destination.id === over.id,
      );

      if (oldIndex < 0 || newIndex < 0) {
        return current;
      }

      return {
        ...current,
        destinations: arrayMove(current.destinations, oldIndex, newIndex),
      };
    });
  }

  return (
    <div className="trip-workspace">
      {editError && (
        <p className="workspace-notice" role="alert">
          {editError}
        </p>
      )}
      {settingsError && (
        <p className="workspace-notice" role="status">
          {settingsError}
        </p>
      )}
      <section className="planner-header" aria-label="Trip controls">
        <label className="date-control">
          <CalendarDays aria-hidden="true" size={18} />
          <span>Trip start</span>
          <input
            type="date"
            value={plan.tripStartDate}
            onChange={(event) => {
              if (!isCalendarDate(event.target.value)) {
                return;
              }

              setPlan((current) => ({
                ...current,
                tripStartDate: event.target.value,
              }));
            }}
          />
        </label>
      </section>

      <div className="workspace-navigation">
        <nav className="view-switcher" aria-label="Trip views">
          <button
            type="button"
            aria-current={activeView === "itinerary" ? "page" : undefined}
            onClick={() => setActiveView("itinerary")}
          >
            <CalendarDays size={17} aria-hidden="true" />
            Itinerary
          </button>
          <button
            type="button"
            aria-current={activeView === "budget" ? "page" : undefined}
            onClick={() => setActiveView("budget")}
          >
            <Wallet size={17} aria-hidden="true" />
            Budget
          </button>
          <button
            type="button"
            aria-current={activeView === "schengen" ? "page" : undefined}
            onClick={() => setActiveView("schengen")}
          >
            <CalendarRange size={17} aria-hidden="true" />
            Schengen Zone
          </button>
          <button
            type="button"
            aria-current={activeView === "globe" ? "page" : undefined}
            onClick={() => setActiveView("globe")}
          >
            <Globe2 size={17} aria-hidden="true" />
            Globe
          </button>
        </nav>
        <button
          className="budget-shortcut"
          onClick={() => setActiveView("budget")}
        >
          <span>Estimated trip cost</span>
          <strong>{formatMoney(tripBudget.total, plan.currency)}</strong>
        </button>
      </div>

      {activeView === "itinerary" ? (
        <>
          <section
            className="planner-toolbar"
            aria-label="Planner display controls"
          >
            <div className="scale-control">
              <SlidersHorizontal aria-hidden="true" size={17} />
              <label htmlFor="week-scale">Week width</label>
              <input
                id="week-scale"
                max={180}
                min={48}
                step={4}
                type="range"
                value={settings.weekWidth}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    weekWidth: Number(event.target.value),
                  }))
                }
              />
              <output>{settings.weekWidth}px</output>
            </div>

            <div className="column-controls" aria-label="Visible columns">
              <Columns3 aria-hidden="true" size={17} />
              {COLUMN_DEFINITIONS.map((column) => (
                <label className="column-toggle" key={column.id}>
                  <input
                    checked={settings.visibleColumns[column.id]}
                    type="checkbox"
                    onChange={() => toggleColumn(column.id)}
                  />
                  <span>{column.label}</span>
                </label>
              ))}
            </div>
          </section>

          <section
            className="planner"
            aria-label="Destination timeline planner"
          >
            <div
              className="planner-grid planner-grid-header"
              style={
                {
                  "--metadata-width": `${metadataLayout.width}px`,
                  "--timeline-width": `${timelineWidth}px`,
                } as CSSProperties
              }
            >
              <div className="metadata-heading metadata-area">
                <div
                  className="metadata-fields metadata-header-fields"
                  style={
                    {
                      "--metadata-template": metadataLayout.template,
                    } as CSSProperties
                  }
                >
                  <span />
                  <span>Destination</span>
                  {COLUMN_DEFINITIONS.map((column) =>
                    settings.visibleColumns[column.id] ? (
                      <span key={column.id}>{column.label}</span>
                    ) : null,
                  )}
                  <span />
                </div>
              </div>
              <div
                className="timeline-heading"
                style={
                  {
                    "--week-count": timelineWeeks.length,
                    "--week-width": `${settings.weekWidth}px`,
                    "--timeline-width": `${timelineWidth}px`,
                  } as CSSProperties
                }
              >
                {timelineWeeks.map((date, index) => (
                  <div className="week-heading" key={index}>
                    <span>Week {index + 1}</span>
                    <small>{formatShortDate(date)}</small>
                  </div>
                ))}
              </div>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={plan.destinations.map((destination) => destination.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="planner-rows">
                  {scheduledDestinations.map((destination) => (
                    <SortableDestinationRow
                      destination={destination}
                      key={destination.id}
                      metadataLayout={metadataLayout}
                      visibleColumns={settings.visibleColumns}
                      timelineWidth={timelineWidth}
                      weekWidth={settings.weekWidth}
                      onChange={updateDestination}
                      onDurationChange={updateDuration}
                      onEndDateChange={updateEndDate}
                      maxDuration={MAX_TRIP_DAYS - tripDays + destination.durationDays}
                      onRemove={removeDestination}
                      canRemove={plan.destinations.length > 1}
                      onDetails={setDetailsId}
                      currency={plan.currency}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <div className="planner-footer">
              <button
                className="add-button"
                type="button"
                onClick={addDestination}
                disabled={
                  plan.destinations.length >= MAX_DESTINATIONS ||
                  tripDays >= MAX_TRIP_DAYS
                }
              >
                <Plus aria-hidden="true" size={18} />
                Add destination
              </button>
            </div>
          </section>
          <p className="itinerary-hint">
            The end date is the first day of the next stop. Open destination
            settings to edit costs and Schengen status.
          </p>
        </>
      ) : activeView === "globe" ? (
        <TripGlobe destinations={scheduledDestinations}
          onLocationChange={(id, location) => updateDestination(id, { location })} />
      ) : activeView === "schengen" ? (
        <TripSchengen destinations={scheduledDestinations} />
      ) : (
        <TripBudget
          destinations={plan.destinations}
          currency={plan.currency}
          onCurrencyChange={(currency) =>
            setPlan((current) => ({ ...current, currency }))
          }
          onEdit={setDetailsId}
        />
      )}
      {selectedDestination && (
        <DestinationDetails
          key={selectedDestination.id}
          destination={selectedDestination}
          currency={plan.currency}
          dates={`${formatShortDate(selectedDestination.startDate)} – ${formatShortDate(selectedDestination.endDate)}`}
          onClose={() => setDetailsId(null)}
          onSave={(updates) => {
            updateDestination(selectedDestination.id, updates);
            setDetailsId(null);
          }}
        />
      )}
    </div>
  );
}

type SortableDestinationRowProps = {
  destination: ScheduledDestination;
  metadataLayout: MetadataLayout;
  visibleColumns: VisibleColumns;
  timelineWidth: number;
  weekWidth: number;
  onChange: (id: string, updates: Partial<Destination>) => void;
  onDurationChange: (destination: ScheduledDestination, days: number) => boolean;
  onEndDateChange: (destination: ScheduledDestination, value: string) => boolean;
  maxDuration: number;
  onRemove: (id: string) => void;
  canRemove: boolean;
  onDetails: (id: string) => void;
  currency: Currency;
};

function SortableDestinationRow({
  destination,
  metadataLayout,
  visibleColumns,
  timelineWidth,
  weekWidth,
  onChange,
  onDurationChange,
  onEndDateChange,
  maxDuration,
  onRemove,
  canRemove,
  onDetails,
  currency,
}: SortableDestinationRowProps) {
  const [durationDraft, setDurationDraft] = useState<string | null>(null);
  const [endDateDraft, setEndDateDraft] = useState<string | null>(null);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: destination.id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      className={`planner-grid planner-row${isDragging ? " is-dragging" : ""}`}
      ref={setNodeRef}
      style={
        {
          ...style,
          "--metadata-width": `${metadataLayout.width}px`,
          "--timeline-width": `${timelineWidth}px`,
        } as CSSProperties
      }
    >
      <div className="metadata-area destination-cell">
        <div
          className="metadata-fields"
          style={
            {
              "--metadata-template": metadataLayout.template,
            } as CSSProperties
          }
        >
          <button
            className="icon-button drag-handle"
            type="button"
            aria-label={`Reorder ${destination.name}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical aria-hidden="true" size={18} />
          </button>

          <div className="destination-name-and-details">
            <label className="field compact-field destination-field">
              <span className="visually-hidden">Destination</span>
              <input
                maxLength={200}
                value={destination.name}
                onChange={(event) =>
                  onChange(destination.id, { name: event.target.value })
                }
              />
            </label>
            <button
              className="icon-button details-button"
              type="button"
              aria-label={`Details for ${destination.name}`}
              title={`Destination details · ${formatMoney(calculateStopBudget(destination).total, currency)}`}
              onClick={() => onDetails(destination.id)}
            >
              <Settings2 size={17} aria-hidden="true" />
            </button>
          </div>

          {visibleColumns.duration ? (
            <label className="field compact-field">
              <span className="visually-hidden">Days</span>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                type="text"
                aria-invalid={durationDraft !== null}
                value={durationDraft ?? String(destination.durationDays)}
                onBlur={() => setDurationDraft(null)}
                onChange={(event) => {
                  const value = event.target.value;
                  const days = /^\d+$/.test(value) ? Number(value) : NaN;
                  setDurationDraft(onDurationChange(destination, days) ? null : value);
                }}
              />
            </label>
          ) : null}

          {visibleColumns.start ? (
            <div className="date-cell">
              {formatShortDate(destination.startDate)}
            </div>
          ) : null}

          {visibleColumns.end ? (
            <label className="field compact-field">
              <span className="visually-hidden">End date for {destination.name}</span>
              <input
                type="date"
                aria-invalid={endDateDraft !== null}
                min={toIsoDate(addDays(destination.startDate, 1))}
                max={toIsoDate(addDays(destination.startDate, maxDuration))}
                value={endDateDraft ?? toIsoDate(destination.endDate)}
                onBlur={() => setEndDateDraft(null)}
                onChange={(event) => {
                  const value = event.target.value;
                  setEndDateDraft(onEndDateChange(destination, value) ? null : value);
                }}
              />
            </label>
          ) : null}

          {visibleColumns.color ? (
            <label className="field color-field">
              <span className="visually-hidden">Color</span>
              <input
                aria-label={`Color for ${destination.name}`}
                type="color"
                value={destination.color}
                onChange={(event) =>
                  onChange(destination.id, { color: event.target.value })
                }
              />
            </label>
          ) : null}

          {visibleColumns.notes ? (
            <label className="field compact-field notes-field">
              <span className="visually-hidden">Notes</span>
              <input
                maxLength={10000}
                value={destination.notes}
                onChange={(event) =>
                  onChange(destination.id, { notes: event.target.value })
                }
              />
            </label>
          ) : null}

          <button
            className="icon-button"
            type="button"
            aria-label={`Remove ${destination.name}`}
            disabled={!canRemove}
            onClick={() => onRemove(destination.id)}
          >
            <Trash2 aria-hidden="true" size={17} />
          </button>
        </div>
      </div>

      <div
        className="timeline-cell"
        style={
          {
            "--week-width": `${weekWidth}px`,
            "--timeline-width": `${timelineWidth}px`,
          } as CSSProperties
        }
      >
        <div
          className="duration-bar"
          style={
            {
              "--bar-color": destination.color,
              "--bar-start": `${(destination.startDay * weekWidth) / DAYS_PER_WEEK}px`,
              "--bar-width": `${(destination.durationDays * weekWidth) / DAYS_PER_WEEK}px`,
            } as CSSProperties
          }
        >
          <span>{destination.durationDays}d</span>
        </div>
      </div>
    </div>
  );
}

type MetadataLayout = {
  template: string;
  width: number;
};

function getMetadataLayout(visibleColumns: VisibleColumns): MetadataLayout {
  const activeColumns = [
    STATIC_METADATA_COLUMNS[0],
    STATIC_METADATA_COLUMNS[1],
    ...COLUMN_DEFINITIONS.filter((column) => visibleColumns[column.id]),
    STATIC_METADATA_COLUMNS[2],
  ];
  const width =
    activeColumns.reduce((total, column) => total + column.width, 0) +
    (activeColumns.length - 1) * METADATA_GAP +
    METADATA_PADDING;

  return {
    template: activeColumns.map((column) => `${column.width}px`).join(" "),
    width,
  };
}
