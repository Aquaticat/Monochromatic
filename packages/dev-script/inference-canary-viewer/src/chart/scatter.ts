/**
 * HTML+CSS scatter plot renderer.
 *
 * Each data point is a positioned `<button>` element inside a `position: relative`
 * container. Points open run detail popovers via `popovertarget` attributes.
 * Pass-1 points are filled circles; pass-2 points are hollow circles overlaid
 * at the same X position.
 *
 * Exceeds 100 lines: point element generation, axis wiring, and table
 * integration form a single rendering pipeline.
 */
import { $ as h, } from '@monochromatic-dev/module-es/h-html';

import { renderYAxis, renderXAxis, } from './axis.ts';
import { renderThresholdLine, } from './threshold-line.ts';
import { renderDataTable, } from './data-table.ts';

import type { TableRow, TableDisplayOptions, } from './data-table.ts';

/** Single data point for the scatter plot */
export type ScatterPoint = {
  /** Unique identifier for the run (used in fragment link) */
  readonly runId: string;
  /** 0-based index on the X axis */
  readonly index: number;
  /** ISO timestamp for X axis label */
  readonly timestamp: string;
  /** Score value (0-1) for Y axis */
  readonly score: number;
  /** Optional pass-2 (fix) score overlaid at same X */
  readonly pass2Score?: number | undefined;
  /** CSS color for this point */
  readonly color: string;
  /** Tooltip text */
  readonly title: string;
  /** Whether this run failed */
  readonly failed: boolean;
  /** Raw SVG icon to render inside the chart point (when available) */
  readonly icon?: string | undefined;
  /** Metadata for the backing table */
  readonly tableRow: TableRow;
};

/**
 * Renders a complete scatter chart: plot area, axes, threshold line, and backing table.
 * @param options - chart rendering options
 * @param options.points - data points to render
 * @param options.threshold - degradation threshold value (0-1), 0 to hide
 * @param options.thresholdLabel - label for the threshold line
 * @param options.caption - accessible caption for the chart and table
 * @param options.hideTable - when true, omit the backing data table entirely
 * @param options.tableDisplay - column visibility options forwarded to the data table
 * @returns HTML string
 */
export function renderScatterChart({
  points,
  threshold,
  thresholdLabel,
  caption,
  hideTable,
  tableDisplay,
}: {
  points: readonly ScatterPoint[];
  threshold: number;
  thresholdLabel: string;
  caption: string;
  hideTable?: boolean;
  tableDisplay?: TableDisplayOptions;
}): string {
  if (points.length === 0) {
    return h({ tag: 'p', class: 'chart-empty-state', text: 'No data available.', });
  }

  const totalRuns = points.length;
  /** Percentage multiplier */
  const PERCENT = 100;

  const pointElements = points.map((point) => {
    const left = totalRuns === 1 ? 50 : (point.index / (totalRuns - 1)) * PERCENT;
    const bottom = point.score * PERCENT;

    const hasIcon = point.icon !== undefined && point.icon !== '' && !point.failed;
    const iconHtml = hasIcon ? point.icon : '';

    const pass1 = h({
      tag: 'button',
      class: 'chart-point',
      style: {
        left: `${left.toFixed(2)}%`,
        bottom: `${bottom.toFixed(2)}%`,
        '--point-color': point.color,
      },
      attrs: {
        popovertarget: `run-${point.runId}`,
        title: point.title,
        'aria-label': point.title,
        ...(point.failed ? { 'data-status': 'failed', } : {}),
        ...(hasIcon ? { 'data-shape': 'icon', } : {}),
      },
      html: iconHtml,
    });

    if (point.pass2Score === undefined) return pass1;

    const pass2Bottom = point.pass2Score * PERCENT;
    const pass2HasIcon = point.icon !== undefined && point.icon !== '';
    const pass2IconHtml = pass2HasIcon ? point.icon : '';
    const pass2 = h({
      tag: 'button',
      class: 'chart-point',
      style: {
        left: `${left.toFixed(2)}%`,
        bottom: `${pass2Bottom.toFixed(2)}%`,
        '--point-color': point.color,
      },
      attrs: {
        popovertarget: `run-${point.runId}`,
        title: `fix: ${point.pass2Score.toFixed(2)}`,
        'aria-label': `fix score ${point.pass2Score.toFixed(2)}`,
        'data-pass': 'fix',
        ...(pass2HasIcon ? { 'data-shape': 'icon', } : {}),
      },
      html: pass2IconHtml,
    });

    return `${pass1}\n${pass2}`;
  }).join('\n');

  const timestamps = points.map((point) => point.timestamp);

  const tableHtml = hideTable === true
    ? ''
    : renderDataTable(
      points.map((point) => point.tableRow),
      caption,
      tableDisplay,
    );

  return h({
    tag: 'figure',
    class: 'chart-figure',
    children: [
      h({ tag: 'figcaption', text: caption, }),
      h({
        tag: 'div',
        class: 'chart-area',
        attrs: { role: 'img', 'aria-label': caption, },
        children: [
          h({ tag: 'div', class: 'chart-y-axis', html: renderYAxis(), }),
          h({
            tag: 'div',
            class: 'chart-plot',
            children: [renderThresholdLine(threshold, thresholdLabel), pointElements],
          }),
          h({ tag: 'div', class: 'chart-x-axis', html: renderXAxis(timestamps), }),
        ],
      }),
      tableHtml,
    ],
  });
}
