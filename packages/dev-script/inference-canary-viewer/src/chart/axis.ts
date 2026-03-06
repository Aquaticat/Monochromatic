/**
 * Axis tick generation and label placement for scatter plots.
 *
 * Y axis uses fixed score ticks (0, 0.25, 0.5, 0.75, 1.0).
 * X axis uses timestamps, showing dates at evenly spaced intervals.
 */
import { escapeHtml, } from '../chart/data-table.ts';

/** Fixed Y axis tick values for score plots (0 to 1) */
export const Y_TICKS: readonly number[] = [0, 0.25, 0.5, 0.75, 1.0];

/**
 * Generates HTML for Y axis tick labels positioned absolutely within a chart container.
 * Each tick is a `<span>` positioned at the corresponding bottom percentage.
 * @returns HTML string for Y axis ticks
 */
export function renderYAxis(): string {
  /** Percentage multiplier to convert 0-1 score to 0-100% CSS bottom offset */
  const PERCENT = 100;
  return Y_TICKS.map((tick) => {
    const bottom = tick * PERCENT;
    return `<span class="chart-y-tick" style="bottom: ${String(bottom)}%">${tick.toFixed(2)}</span>`;
  }).join('\n');
}

/**
 * Generates HTML for X axis tick labels using timestamps.
 * Shows date labels at evenly spaced intervals to avoid overcrowding.
 * @param timestamps - ordered array of ISO timestamp strings corresponding to data points
 * @returns HTML string for X axis ticks
 */
export function renderXAxis(timestamps: readonly string[]): string {
  if (timestamps.length === 0) return '';

  /** Maximum number of X axis labels to show before skipping */
  const MAX_LABELS = 12;
  const step = Math.max(1, Math.ceil(timestamps.length / MAX_LABELS));

  /** Percentage multiplier */
  const PERCENT = 100;
  const ticks: string[] = [];
  for (let i = 0; i < timestamps.length; i += step) {
    const left = timestamps.length === 1 ? 50 : (i / (timestamps.length - 1)) * PERCENT;
    const dateLabel = formatTimestampShort(timestamps[i] ?? '');
    ticks.push(
      `<span class="chart-x-tick" style="left: ${left.toFixed(2)}%" title="${escapeHtml(timestamps[i] ?? '')}">${escapeHtml(dateLabel)}</span>`,
    );
  }
  return ticks.join('\n');
}

/**
 * Formats an ISO timestamp into a short date label for axis display.
 * Shows month-day for dates within the current year, or year-month-day otherwise.
 * @param timestamp - ISO 8601 timestamp string
 * @returns short date string like "03-01" or "2025-12-15"
 *
 * @example
 * ```ts
 * formatTimestampShort('2026-03-01T01:12:43.219Z'); // "03-01"
 * ```
 */
function formatTimestampShort(timestamp: string): string {
  if (timestamp.length < 10) return timestamp;
  /** Extract YYYY-MM-DD from the ISO string */
  const datePart = timestamp.slice(0, 10);
  const currentYear = new Date().getFullYear().toString();
  if (datePart.startsWith(currentYear)) {
    // Same year: show MM-DD only
    return datePart.slice(5);
  }
  return datePart;
}
