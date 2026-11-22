import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, toIsoDate } from "../trips/model";
import type { ScheduledDestination } from "../trips/model";
import { calculateSchengenSeries, SCHENGEN_WINDOW_DAYS } from "../trips/schengen";
import "../schengen.css";

const PLOT_LEFT = 44;
const PLOT_TOP = 55;
const PLOT_BOTTOM = 292;
const CHART_HEIGHT = 324;
const fullDate = new Intl.DateTimeFormat("en", { dateStyle: "medium" });
const shortDate = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
const shortDateWithYear = new Intl.DateTimeFormat("en", {
  month: "short", day: "numeric", year: "2-digit",
});
const dayCount = (days: number) => `${days} ${days === 1 ? "day" : "days"}`;

function placeStayLabels(
  destinations: ScheduledDestination[],
  x: (day: number) => number,
  plotRight: number,
) {
  const laneEnds = [PLOT_LEFT, PLOT_LEFT];
  return destinations.filter((stop) => stop.schengen).map((stop) => {
    const name = stop.name.trim() || "Untitled destination";
    const start = x(stop.startDay);
    const end = x(stop.startDay + stop.durationDays);
    const center = (start + end) / 2;
    const width = name.length * 9 + 12;
    const left = Math.max(PLOT_LEFT, Math.min(center - width / 2, plotRight - width));
    const lane = laneEnds.findIndex((laneEnd) => left >= laneEnd);
    if (lane === -1 || width > plotRight - PLOT_LEFT) {
      return { stop, name, start, end, center, label: null };
    }

    laneEnds[lane] = left + width + 6;
    return { stop, name, start, end, center, label: { left, width, top: 5 + lane * 23 } };
  });
}

export function TripSchengen({ destinations }: { destinations: ScheduledDestination[] }) {
  const { counts, peak, peakEndDay } = useMemo(
    () => calculateSchengenSeries(destinations), [destinations],
  );
  const [inspectedDay, setInspectedDay] = useState<number | null>(null);
  const plot = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(960);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(plot.current!);
    return () => observer.disconnect();
  }, []);

  const startDate = destinations[0].startDate;
  const lastDay = counts.length - 1;
  const day = Math.min(inspectedDay ?? peakEndDay, lastDay);
  const selectedDate = addDays(startDate, day);
  const selectedCount = counts[day];
  const plotWidth = Math.max(1, width - PLOT_LEFT - 20);
  const plotRight = PLOT_LEFT + plotWidth;
  const x = (offset: number) => PLOT_LEFT + (offset / counts.length) * plotWidth;
  const interval = [1, 2, 5, 10, 20, 30, 45].find((size) => size * 4 >= peak) ?? 45;
  const y = (count: number) => PLOT_BOTTOM - (count / (interval * 4)) * (PLOT_BOTTOM - PLOT_TOP);
  const yTicks = [0, interval, interval * 2, interval * 3, interval * 4];
  const tickCount = Math.min(counts.length, Math.max(2, Math.floor(plotWidth / 94)));
  const xTicks = Array.from({ length: tickCount }, (_, i) =>
    Math.round(lastDay * i / Math.max(1, tickCount - 1)),
  );
  const tickDate = startDate.getFullYear() === addDays(startDate, lastDay).getFullYear()
    ? shortDate : shortDateWithYear;
  const stays = placeStayLabels(destinations, x, plotRight);
  const unplacedStays = stays.filter((stay) => !stay.label);
  const selectedStay = stays.find(({ stop }) => day >= stop.startDay && day < stop.startDay + stop.durationDays);

  let line = `M ${PLOT_LEFT} ${y(counts[0])}`;
  for (let i = 1; i < counts.length; i++) {
    if (counts[i] !== counts[i - 1]) line += ` H ${x(i)} V ${y(counts[i])}`;
  }
  line += ` H ${plotRight}`;

  function inspectAt(clientX: number, svg: SVGSVGElement) {
    const bounds = svg.getBoundingClientRect();
    const offset = (clientX - bounds.left) * width / bounds.width - PLOT_LEFT;
    const index = Math.floor(offset / plotWidth * counts.length);
    setInspectedDay(Math.max(0, Math.min(index, lastDay)));
  }

  return (
    <section className="budget-view" aria-label="Schengen Zone tracker">
      <div className="section-heading schengen-heading">
        <div>
          <h2>Schengen Zone</h2>
          <p>Mark stops in destination details to include their days on the chart.</p>
        </div>
        <article className="summary-card primary-summary">
          <span>Most days in any {SCHENGEN_WINDOW_DAYS}-day window</span>
          <strong>{dayCount(peak)}</strong>
          {peak > 0 && <small>Window ending {fullDate.format(addDays(startDate, peakEndDay))}</small>}
        </article>
      </div>

      <figure className="budget-panel schengen-chart" aria-labelledby="schengen-chart-title">
        <figcaption className="section-heading schengen-chart-heading">
          <div>
            <h3 id="schengen-chart-title">Rolling Schengen days</h3>
            <p>Each date includes that day and the preceding {SCHENGEN_WINDOW_DAYS - 1} days.</p>
          </div>
          <div className="schengen-chart-reading" aria-hidden="true">
            <time dateTime={toIsoDate(selectedDate)}>{fullDate.format(selectedDate)}</time>
            <strong>{dayCount(selectedCount)} in the last {SCHENGEN_WINDOW_DAYS} days</strong>
            {selectedStay && <small>{selectedStay.name}</small>}
          </div>
        </figcaption>

        <div className="schengen-chart-plot" ref={plot}>
          <svg
            viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
            tabIndex={0}
            role="slider"
            aria-label="Inspect date on Schengen chart"
            aria-valuemin={0}
            aria-valuemax={lastDay}
            aria-valuenow={day}
            aria-valuetext={`${fullDate.format(selectedDate)}, ${dayCount(selectedCount)} in the last ${SCHENGEN_WINDOW_DAYS} days${selectedStay ? `, ${selectedStay.name}` : ""}`}
            onPointerMove={(event) => {
              if (event.pointerType !== "touch") inspectAt(event.clientX, event.currentTarget);
            }}
            onClick={(event) => {
              if (event.detail > 0) inspectAt(event.clientX, event.currentTarget);
            }}
            onKeyDown={(event) => {
              let next = day;
              switch (event.key) {
                case "ArrowLeft": case "ArrowDown": next--; break;
                case "ArrowRight": case "ArrowUp": next++; break;
                case "Home": next = 0; break;
                case "End": next = lastDay; break;
                default: return;
              }
              event.preventDefault();
              setInspectedDay(Math.max(0, Math.min(next, lastDay)));
            }}
          >
            {stays.map(({ stop, name, start, end }) => (
              <g className="schengen-stay" key={stop.id}>
                <title>{name} · {fullDate.format(stop.startDate)} – {fullDate.format(addDays(stop.endDate, -1))}</title>
                <rect x={start} y={PLOT_TOP} width={end - start} height={PLOT_BOTTOM - PLOT_TOP} />
                <rect className="schengen-stay-edge" x={start} y={PLOT_BOTTOM - 5} width={end - start} height={5} />
              </g>
            ))}

            <text x={PLOT_LEFT - 8} y={PLOT_TOP - 10} textAnchor="end">Days</text>
            {yTicks.map((count) => (
              <g key={count}>
                <line className="schengen-chart-grid" x1={PLOT_LEFT} x2={plotRight} y1={y(count)} y2={y(count)} />
                <text x={PLOT_LEFT - 8} y={y(count)} dy="0.35em" textAnchor="end">{count}</text>
              </g>
            ))}
            {xTicks.map((offset) => {
              const center = x(offset + 0.5);
              const anchor = center < PLOT_LEFT + 18 ? "start" : center > plotRight - 18 ? "end" : "middle";
              return (
                <g key={offset}>
                  <line className="schengen-chart-grid" x1={center} x2={center} y1={PLOT_BOTTOM} y2={PLOT_BOTTOM + 4} />
                  <text x={center} y={PLOT_BOTTOM + 20} textAnchor={anchor}>
                    {tickDate.format(addDays(startDate, offset))}
                  </text>
                </g>
              );
            })}

            <path className="schengen-chart-line" d={line} />
            <line className="schengen-chart-cursor" x1={x(day + 0.5)} x2={x(day + 0.5)} y1={PLOT_TOP} y2={PLOT_BOTTOM} />
            <circle className="schengen-chart-point" cx={x(day + 0.5)} cy={y(selectedCount)} r={4.5} />

            {stays.map(({ stop, center, label }) => label && (
              <line className="schengen-stay-leader" key={stop.id} x1={center} x2={center} y1={label.top + 18} y2={PLOT_TOP} />
            ))}
            {stays.map(({ stop, name, label }) => label && (
              <g className="schengen-stay-label" key={stop.id}>
                <rect x={label.left} y={label.top} width={label.width} height={18} rx={4} />
                <text x={label.left + label.width / 2} y={label.top + 13} textAnchor="middle">{name}</text>
              </g>
            ))}
          </svg>
        </div>

        <div className="schengen-chart-footer">
          <span className="schengen-chart-legend"><i aria-hidden="true" /> Schengen stay</span>
          <span>Point, tap, or use the arrow keys on the chart to inspect a date.</span>
        </div>
        {unplacedStays.length > 0 && (
          <ul className="schengen-chart-stays" aria-label="Additional Schengen stay labels">
            {unplacedStays.map(({ stop, name }) => (
              <li key={stop.id}>
                <button type="button" onClick={() => setInspectedDay(stop.startDay)}>
                  <strong>{name}</strong>
                  <span>{fullDate.format(stop.startDate)} – {fullDate.format(addDays(stop.endDate, -1))}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </figure>
    </section>
  );
}
