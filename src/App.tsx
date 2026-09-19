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
  Plus,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { CSSProperties, useEffect, useMemo, useState } from "react";

export type Destination = {
  id: string;
  name: string;
  durationWeeks: number;
  color: string;
  notes: string;
};

export type TripPlan = {
  tripStartDate: string;
  destinations: Destination[];
};

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

const STORAGE_KEY = "trip-planning:trip-plan";
const SETTINGS_KEY = "trip-planning:planner-settings";
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const COLORS = ["#2563eb", "#16a34a", "#e11d48", "#d97706", "#7c3aed", "#0891b2"];
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

function isoToday() {
  return toIsoDate(new Date());
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addWeeks(date: Date, weeks: number) {
  return new Date(date.getTime() + weeks * WEEK_MS);
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function createDestination(index: number): Destination {
  return {
    id: crypto.randomUUID(),
    name: `Destination ${index}`,
    durationWeeks: 1,
    color: COLORS[(index - 1) % COLORS.length],
    notes: "",
  };
}

const defaultTrip: TripPlan = {
  tripStartDate: isoToday(),
  destinations: [
    {
      id: crypto.randomUUID(),
      name: "First stop",
      durationWeeks: 2,
      color: COLORS[0],
      notes: "Add lodging, activities, or reminders.",
    },
  ],
};

function readSavedTrip(): TripPlan {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    return defaultTrip;
  }

  try {
    const parsed = JSON.parse(saved) as TripPlan;
    if (!parsed.tripStartDate || !Array.isArray(parsed.destinations)) {
      return defaultTrip;
    }

    if (parsed.destinations.length === 0) {
      return defaultTrip;
    }

    return {
      tripStartDate: parsed.tripStartDate,
      destinations: parsed.destinations.map((destination, index) => ({
        id: destination.id || crypto.randomUUID(),
        name: destination.name || `Destination ${index + 1}`,
        durationWeeks: Math.max(1, Number(destination.durationWeeks) || 1),
        color: destination.color || COLORS[index % COLORS.length],
        notes: destination.notes || "",
      })),
    };
  } catch {
    return defaultTrip;
  }
}

function readPlannerSettings(): PlannerSettings {
  const saved = localStorage.getItem(SETTINGS_KEY);

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

  return plan.destinations.map((destination) => {
    const startDate = cursor;
    const endDate = addWeeks(startDate, destination.durationWeeks);
    const scheduled = {
      ...destination,
      startDate,
      endDate,
      startWeek: Math.round(
        (startDate.getTime() - parseIsoDate(plan.tripStartDate).getTime()) / WEEK_MS,
      ),
    };

    cursor = endDate;
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

export function App() {
  const [plan, setPlan] = useState<TripPlan>(() => readSavedTrip());
  const [settings, setSettings] = useState<PlannerSettings>(() =>
    readPlannerSettings(),
  );
  const [durationDrafts, setDurationDrafts] = useState<Record<string, string>>({});
  const scheduledDestinations = useMemo(() => scheduleDestinations(plan), [plan]);
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  }, [plan]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
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

    if (/^\d+$/.test(value)) {
      updateDestination(id, {
        durationWeeks: Math.max(1, Number(value)),
      });
    }
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
    <main className="app-shell">
      <section className="planner-header" aria-label="Trip controls">
        <div>
          <p className="eyebrow">Trip planner</p>
          <h1>Weekly itinerary timeline</h1>
        </div>
        <label className="date-control">
          <CalendarDays aria-hidden="true" size={18} />
          <span>Trip start</span>
          <input
            type="date"
            value={plan.tripStartDate}
            onChange={(event) => {
              if (!event.target.value) {
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

      <section className="planner-toolbar" aria-label="Planner display controls">
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

      <section className="planner" aria-label="Destination timeline planner">
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
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div className="planner-footer">
          <button className="add-button" type="button" onClick={addDestination}>
            <Plus aria-hidden="true" size={18} />
            Add destination
          </button>
        </div>
      </section>
    </main>
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

          <label className="field compact-field destination-field">
            <span className="visually-hidden">Destination</span>
            <input
              value={destination.name}
              onChange={(event) =>
                onChange(destination.id, { name: event.target.value })
              }
            />
          </label>

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
            <div className="date-cell">{formatShortDate(destination.startDate)}</div>
          ) : null}

          {visibleColumns.end ? (
            <div className="date-cell">{formatShortDate(destination.endDate)}</div>
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
