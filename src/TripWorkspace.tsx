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

import type { Destination, TripPlan } from "./trips/model";
import {
  addWeeks,
  parseIsoDate,
  createDestination,
  MAX_DESTINATIONS,
  MAX_WEEKS,
  totalWeeks,
  isCalendarDate,
} from "./trips/model";

type ScheduledDestination = Destination & {
  startDate: Date;
  endDate: Date;
  startWeek: number;
};

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
  { id: "duration", label: "Weeks", width: 74 },
  { id: "start", label: "Start", width: 92 },
  { id: "end", label: "End", width: 92 },
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

function scheduleDestinations(plan: TripPlan): ScheduledDestination[] {
  let cursor = parseIsoDate(plan.tripStartDate);
  let startWeek = 0;

  return plan.destinations.map((destination) => {
    const startDate = cursor;
    const endDate = addWeeks(startDate, destination.durationWeeks);
    const scheduled = {
      ...destination,
      startDate,
      endDate,
      startWeek,
    };

    cursor = endDate;
    startWeek += destination.durationWeeks;
    return scheduled;
  });
}

function getTimelineWeeks(plan: TripPlan) {
  const totalWeeks = Math.max(
    1,
    plan.destinations.reduce(
      (total, destination) => total + Math.max(1, destination.durationWeeks),
      0,
    ),
  );
  const start = parseIsoDate(plan.tripStartDate);

  return Array.from({ length: totalWeeks }, (_, index) => ({
    index,
    startDate: addWeeks(start, index),
    endDate: addWeeks(start, index + 1),
  }));
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
  const [activeView, setActiveView] = useState<"itinerary" | "budget" | "globe">(
    "itinerary",
  );
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [settings, setSettings] = useState<PlannerSettings>(() =>
    readPlannerSettings(),
  );
  const [durationDrafts, setDurationDrafts] = useState<Record<string, string>>(
    {},
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
  const timelineWeeks = useMemo(() => getTimelineWeeks(plan), [plan]);
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

  useEffect(() => {
    setDurationDrafts((current) =>
      Object.fromEntries(
        plan.destinations.map((destination) => [
          destination.id,
          current[destination.id] ?? String(destination.durationWeeks),
        ]),
      ),
    );
  }, [plan.destinations]);

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
      totalWeeks(plan) >= MAX_WEEKS
    ) {
      setEditError("Trips support up to 100 destinations and 520 total weeks.");
      return;
    }
    setEditError("");
    setPlan((current) => ({
      ...current,
      destinations: [
        ...current.destinations,
        createDestination(current.destinations.length + 1),
      ],
    }));
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

  function updateDurationDraft(id: string, value: string) {
    setDurationDrafts((current) => ({
      ...current,
      [id]: value,
    }));

    const destination = plan.destinations.find((stop) => stop.id === id);
    const weeks = Number(value);
    if (
      !/^\d+$/.test(value) ||
      !Number.isInteger(weeks) ||
      weeks < 1 ||
      !destination ||
      totalWeeks(plan) - destination.durationWeeks + weeks > MAX_WEEKS
    ) {
      setEditError(
        "Use whole weeks of at least 1. Total trip duration cannot exceed 520 weeks.",
      );
      return;
    }
    setEditError("");
    updateDestination(id, { durationWeeks: weeks });
  }

  function commitDurationDraft(id: string) {
    const destination = plan.destinations.find((item) => item.id === id);

    if (!destination) {
      return;
    }

    setDurationDrafts((current) => ({
      ...current,
      [id]: String(destination.durationWeeks),
    }));
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
                {timelineWeeks.map((week) => (
                  <div className="week-heading" key={week.index}>
                    <span>Week {week.index + 1}</span>
                    <small>{formatShortDate(week.startDate)}</small>
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
                      timelineWeeks={timelineWeeks.length}
                      timelineWidth={timelineWidth}
                      weekWidth={settings.weekWidth}
                      durationDraft={durationDrafts[destination.id]}
                      onChange={updateDestination}
                      onDurationBlur={commitDurationDraft}
                      onDurationChange={updateDurationDraft}
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
                  totalWeeks(plan) >= MAX_WEEKS
                }
              >
                <Plus aria-hidden="true" size={18} />
                Add destination
              </button>
            </div>
          </section>
          <p className="itinerary-hint">
            Open the settings beside a destination to add cost estimates. Drag
            the handle to reorder your stops.
          </p>
        </>
      ) : activeView === "globe" ? (
        <TripGlobe destinations={scheduledDestinations}
          onLocationChange={(id, location) => updateDestination(id, { location })} />
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
          onSave={(costs) => {
            updateDestination(selectedDestination.id, { costs });
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
  timelineWeeks: number;
  timelineWidth: number;
  weekWidth: number;
  durationDraft?: string;
  onChange: (id: string, updates: Partial<Destination>) => void;
  onDurationBlur: (id: string) => void;
  onDurationChange: (id: string, value: string) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
  onDetails: (id: string) => void;
  currency: Currency;
};

function SortableDestinationRow({
  destination,
  metadataLayout,
  visibleColumns,
  timelineWeeks,
  timelineWidth,
  weekWidth,
  durationDraft,
  onChange,
  onDurationBlur,
  onDurationChange,
  onRemove,
  canRemove,
  onDetails,
  currency,
}: SortableDestinationRowProps) {
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
              aria-label={`Cost details for ${destination.name}`}
              title={`Cost details · ${formatMoney(calculateStopBudget(destination).total, currency)}`}
              onClick={() => onDetails(destination.id)}
            >
              <Settings2 size={17} aria-hidden="true" />
            </button>
          </div>

          {visibleColumns.duration ? (
            <label className="field compact-field">
              <span className="visually-hidden">Weeks</span>
              <input
                inputMode="numeric"
                min={1}
                pattern="[0-9]*"
                type="text"
                value={durationDraft ?? String(destination.durationWeeks)}
                onBlur={() => onDurationBlur(destination.id)}
                onChange={(event) =>
                  onDurationChange(destination.id, event.target.value)
                }
              />
            </label>
          ) : null}

          {visibleColumns.start ? (
            <div className="date-cell">
              {formatShortDate(destination.startDate)}
            </div>
          ) : null}

          {visibleColumns.end ? (
            <div className="date-cell">
              {formatShortDate(destination.endDate)}
            </div>
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
            "--week-count": timelineWeeks,
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
              "--start-week": destination.startWeek + 1,
              "--duration-weeks": destination.durationWeeks,
            } as CSSProperties
          }
        >
          <span>{destination.durationWeeks}w</span>
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
