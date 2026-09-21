import { useState } from "react";
import {
  BedDouble,
  Bus,
  CircleDollarSign,
  Plane,
  Utensils,
} from "lucide-react";
import {
  BudgetStop,
  COST_CATEGORIES,
  CostCategory,
  CostEstimates,
  Currency,
  MAX_ESTIMATE,
  calculateStopBudget,
  formatMoney,
} from "../budget";
import { Dialog } from "./Dialog";

const ICONS = {
  flights: Plane,
  lodging: BedDouble,
  food: Utensils,
  transport: Bus,
  misc: CircleDollarSign,
};

export function DestinationDetails({
  destination,
  currency,
  dates,
  onSave,
  onClose,
}: {
  destination: BudgetStop;
  currency: Currency;
  dates: string;
  onSave: (costs: CostEstimates) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(
    () =>
      Object.fromEntries(
        COST_CATEGORIES.map(({ id }) => [
          id,
          destination.costs[id]?.toString() ?? "",
        ]),
      ) as Record<CostCategory, string>,
  );
  const costs = Object.fromEntries(
    COST_CATEGORIES.map(({ id }) => [
      id,
      draft[id].trim() === "" ? null : Number(draft[id]),
    ]),
  ) as CostEstimates;
  const invalid = COST_CATEGORIES.filter(
    ({ id }) =>
      costs[id] !== null &&
      (!/^\d+(\.\d{0,2})?$/.test(draft[id]) ||
        !Number.isFinite(costs[id]) ||
        costs[id]! > MAX_ESTIMATE),
  );
  const budget = calculateStopBudget({ ...destination, costs });
  const money = (amount: number) => formatMoney(amount, currency);

  return (
    <Dialog
      title={destination.name || "Untitled destination"}
      subtitle={`${dates} · ${budget.days} days / ${budget.nights} nights`}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!invalid.length) onSave(costs);
        }}
      >
        <div className="dialog-body">
          <div className="section-heading">
            <div>
              <h3>Cost estimates</h3>
              <p>Amounts for your whole travel party, in {currency}.</p>
            </div>
            <span className="currency-badge">{currency}</span>
          </div>
          <div className="cost-fields">
            {COST_CATEGORIES.map(({ id, label, unit, color }) => {
              const Icon = ICONS[id];
              const hasError = invalid.some((category) => category.id === id);
              return (
                <div className="cost-field" key={id}>
                  <div className="cost-field-label">
                    <span className="category-icon" style={{ color }}>
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <label htmlFor={`cost-${id}`}>
                      {label}
                      <small>{unit}</small>
                    </label>
                  </div>
                  <div className="cost-input-wrap">
                    <input
                      id={`cost-${id}`}
                      type="text"
                      inputMode="decimal"
                      placeholder="Not estimated"
                      value={draft[id]}
                      aria-invalid={hasError}
                      aria-describedby={`cost-${id}-help`}
                      autoComplete="off"
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          [id]: event.target.value,
                        }))
                      }
                    />
                    <small
                      id={`cost-${id}-help`}
                      className={hasError ? "field-error" : ""}
                    >
                      {hasError
                        ? "Enter 0–1,000,000,000 with up to 2 decimals."
                        : unit === "one-time"
                          ? "Total for this stop"
                          : `${unit === "per night" ? budget.nights + " nights" : budget.days + " days"} × rate = ${money(budget.totals[id])}`}
                    </small>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="budget-note">
            Lodging uses 7 nights and food uses 7 days per week. These totals
            update when you change the trip duration. Assign each flight or
            transfer to one stop to count it once.
          </p>
          <p className="budget-note">
            Leave unknown amounts blank. Enter 0 for costs you don’t expect.
          </p>
        </div>
        <footer className="dialog-footer">
          <div className="stop-total" aria-live="polite">
            <div>
              <span>Estimated stop total</span>
              <small>
                {budget.entered} of {COST_CATEGORIES.length} categories
                estimated
              </small>
            </div>
            <strong>
              {invalid.length ? "Check amounts" : money(budget.total)}
            </strong>
          </div>
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
              disabled={invalid.length > 0}
            >
              Save estimates
            </button>
          </div>
        </footer>
      </form>
    </Dialog>
  );
}
