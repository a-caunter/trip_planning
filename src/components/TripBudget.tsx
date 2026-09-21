import { CSSProperties } from "react";
import { ArrowUpRight, Wallet } from "lucide-react";
import {
  BudgetStop,
  COST_CATEGORIES,
  CURRENCIES,
  Currency,
  calculateTripBudget,
  formatMoney,
} from "../budget";

export function TripBudget({
  destinations,
  currency,
  onCurrencyChange,
  onEdit,
}: {
  destinations: BudgetStop[];
  currency: Currency;
  onCurrencyChange: (currency: Currency) => void;
  onEdit: (id: string) => void;
}) {
  const budget = calculateTripBudget(destinations);
  const money = (amount: number) => formatMoney(amount, currency);
  let arc = 0;
  const gradient = COST_CATEGORIES.map(({ id, color }) => {
    const start = arc;
    arc += budget.total ? (budget.totals[id] / budget.total) * 100 : 0;
    return `${color} ${start}% ${arc}%`;
  }).join(", ");
  const maxStopTotal = Math.max(...budget.rows.map((row) => row.total), 1);

  return (
    <section className="budget-view" aria-label="Trip budget">
      <div className="section-heading budget-heading">
        <div>
          <h2>Trip budget</h2>
          <p>The big picture, down to every stop.</p>
        </div>
        <div className="currency-control">
          <label htmlFor="trip-currency">Currency</label>
          <select
            id="trip-currency"
            value={currency}
            onChange={(event) =>
              onCurrencyChange(event.target.value as Currency)
            }
          >
            {CURRENCIES.map((code) => (
              <option key={code}>{code}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="budget-note">
        All estimates use {currency} for your whole travel party. Changing
        currency relabels amounts; it does not convert them.
      </p>
      <div className="budget-summary">
        <article className="summary-card primary-summary">
          <span>
            <Wallet size={18} aria-hidden="true" /> Estimated trip total
          </span>
          <strong>{money(budget.total)}</strong>
          <small>Based on the estimates entered so far</small>
        </article>
        <article className="summary-card">
          <span>Average per day</span>
          <strong>{money(budget.days ? budget.total / budget.days : 0)}</strong>
          <small>Across {budget.days} days, including one-time costs</small>
        </article>
        <article className="summary-card">
          <span>Stops fully estimated</span>
          <strong>
            {budget.completeStops}
            <em> / {destinations.length}</em>
          </strong>
          <small>
            All {COST_CATEGORIES.length} categories entered, including zero
            costs
          </small>
        </article>
      </div>
      <section className="budget-panel" aria-labelledby="breakdown-title">
        <div className="section-heading">
          <div>
            <h3 id="breakdown-title">Cost by destination</h3>
            <p>
              Select a destination to edit its estimates. A dash means not
              estimated.
            </p>
          </div>
          <span className="currency-badge">{currency}</span>
        </div>
        <div
          className="budget-table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Destination cost table, scroll horizontally for all columns"
        >
          <table className="budget-table">
            <caption className="visually-hidden">
              Estimated trip costs by destination and category in {currency}
            </caption>
            <thead>
              <tr>
                <th scope="col">Destination</th>
                <th scope="col">Days / nights</th>
                {COST_CATEGORIES.map(({ id, label }) => (
                  <th scope="col" key={id}>
                    {label}
                  </th>
                ))}
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {budget.rows.map((row) => (
                <tr key={row.id}>
                  <th scope="row">
                    <button
                      className="destination-link"
                      onClick={() => onEdit(row.id)}
                    >
                      {row.name || "Untitled destination"}
                      <ArrowUpRight size={14} aria-hidden="true" />
                    </button>
                    <small>
                      {row.entered === COST_CATEGORIES.length
                        ? "Fully estimated"
                        : `${row.entered}/${COST_CATEGORIES.length} estimated`}
                    </small>
                  </th>
                  <td>
                    {row.days} / {row.nights}
                  </td>
                  {COST_CATEGORIES.map(({ id }) => (
                    <td key={id}>
                      {row.costs[id] === null ? (
                        <span aria-label="Not estimated">—</span>
                      ) : (
                        money(row.totals[id])
                      )}
                    </td>
                  ))}
                  <td className="total-cell">{money(row.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Trip total</th>
                <td>
                  {budget.days} / {budget.days}
                </td>
                {COST_CATEGORIES.map(({ id }) => (
                  <td key={id}>{money(budget.totals[id])}</td>
                ))}
                <td>{money(budget.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
      {budget.total > 0 ? (
        <div className="budget-charts">
          <section
            className="budget-panel"
            aria-labelledby="category-chart-title"
          >
            <div className="section-heading">
              <div>
                <h3 id="category-chart-title">Where the money goes</h3>
                <p>Share of total cost by category</p>
              </div>
            </div>
            <div className="category-chart">
              <div
                className="budget-donut"
                role="img"
                aria-label={`Category breakdown. ${COST_CATEGORIES.map(({ id, label }) => `${label}: ${money(budget.totals[id])}`).join(". ")}`}
                style={{ background: `conic-gradient(${gradient})` }}
              >
                <div>
                  <small>Trip total</small>
                  <strong>{money(budget.total)}</strong>
                </div>
              </div>
              <ul className="chart-legend">
                {COST_CATEGORIES.map(({ id, label, color }) => (
                  <li key={id}>
                    <span className="legend-label">
                      <i style={{ background: color }} />
                      {label}
                    </span>
                    <strong>{money(budget.totals[id])}</strong>
                    <small>
                      {((budget.totals[id] / budget.total) * 100).toFixed(1)}%
                    </small>
                  </li>
                ))}
              </ul>
            </div>
          </section>
          <section
            className="budget-panel"
            aria-labelledby="destination-chart-title"
          >
            <div className="section-heading">
              <div>
                <h3 id="destination-chart-title">Compare destinations</h3>
                <p>Each bar shows the category breakdown. Select to edit.</p>
              </div>
            </div>
            <div className="destination-chart">
              {budget.rows.map((row) => (
                <button
                  className="destination-chart-row"
                  key={row.id}
                  onClick={() => onEdit(row.id)}
                  aria-label={`Edit ${row.name || "Untitled destination"}, estimated total ${money(row.total)}`}
                >
                  <span className="chart-row-heading">
                    <span>{row.name || "Untitled destination"}</span>
                    <strong>{money(row.total)}</strong>
                  </span>
                  <span className="stacked-track" aria-hidden="true">
                    <span
                      className="stacked-bar"
                      style={{ width: `${(row.total / maxStopTotal) * 100}%` }}
                    >
                      {COST_CATEGORIES.map(({ id, label, color }) => (
                        <span
                          key={id}
                          title={`${label}: ${money(row.totals[id])}`}
                          style={
                            {
                              background: color,
                              width: `${row.total ? (row.totals[id] / row.total) * 100 : 0}%`,
                            } as CSSProperties
                          }
                        />
                      ))}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <div className="compact-legend">
              {COST_CATEGORIES.map(({ id, label, color }) => (
                <span className="legend-label" key={id}>
                  <i style={{ background: color }} />
                  {label}
                </span>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className="budget-empty">
          <Wallet size={28} aria-hidden="true" />
          <h3>
            {budget.completeStops === destinations.length
              ? "Your estimated trip is cost-free"
              : "Give your trip a budget"}
          </h3>
          <p>Add estimates to see the breakdown by category and destination.</p>
          {destinations[0] && (
            <button
              className="add-button"
              onClick={() => onEdit(destinations[0].id)}
            >
              Estimate your first stop
            </button>
          )}
        </div>
      )}
    </section>
  );
}
