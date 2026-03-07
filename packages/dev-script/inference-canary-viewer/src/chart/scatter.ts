/**
 * HTML+CSS scatter plot renderer.
 *
 * Each data point is a positioned `<button>` element inside a `position: relative`
 * container. Points open run detail popovers via `popovertarget` attributes.
 * Pass-1 points are filled circles; pass-2 points are hollow circles overlaid
 * at the same X position.
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

/** Options controlling scatter chart rendering */
export type ScatterChartOptions = {
  /** When true, omit the backing data table entirely */
  readonly hideTable?: boolean;
  /** Column visibility options forwarded to the data table */
  readonly tableDisplay?: TableDisplayOptions;
};

/**
 * Renders a complete scatter chart: plot area, axes, threshold line, and backing table.
 * @param points - data points to render
 * @param threshold - degradation threshold value (0-1), 0 to hide
 * @param thresholdLabel - label for the threshold line
 * @param caption - accessible caption for the chart and table
 * @param options - chart rendering options
 * @returns HTML string
 */
export function renderScatterChart(
  points: readonly ScatterPoint[],
  threshold: number,
  thresholdLabel: string,
  caption: string,
  options: ScatterChartOptions = {},
): string {
  if (points.length === 0) {
    return h({ tag: 'p', class: 'chart-empty', text: 'No data available.', });
  }

  const totalRuns = points.length;
  /** Percentage multiplier */
  const PERCENT = 100;

  const pointElements = points.map((point) => {
    const left = totalRuns === 1 ? 50 : (point.index / (totalRuns - 1)) * PERCENT;
    const bottom = point.score * PERCENT;

    const iconClass = point.icon !== undefined && point.icon !== '' && !point.failed ? ' chart-point--icon' : '';
    const iconHtml = point.icon !== undefined && point.icon !== '' && !point.failed ? point.icon : '';

    const pass1 = h({
      tag: 'button',
      class: `chart-point${point.failed ? ' chart-point--failed' : ''}${iconClass}`,
      style: {
        left: `${left.toFixed(2)}%`,
        bottom: `${bottom.toFixed(2)}%`,
        '--point-color': point.color,
      },
      attrs: {
        popovertarget: `run-${point.runId}`,
        title: point.title,
        'aria-label': point.title,
      },
      html: iconHtml,
    });

    if (point.pass2Score === undefined) return pass1;

    const pass2Bottom = point.pass2Score * PERCENT;
    const pass2IconClass = point.icon !== undefined && point.icon !== '' ? ' chart-point--icon' : '';
    const pass2IconHtml = point.icon !== undefined && point.icon !== '' ? point.icon : '';
    const pass2 = h({
      tag: 'button',
      class: `chart-point chart-point--pass2${pass2IconClass}`,
      style: {
        left: `${left.toFixed(2)}%`,
        bottom: `${pass2Bottom.toFixed(2)}%`,
        '--point-color': point.color,
      },
      attrs: {
        popovertarget: `run-${point.runId}`,
        title: `fix: ${point.pass2Score.toFixed(2)}`,
        'aria-label': `fix score ${point.pass2Score.toFixed(2)}`,
      },
      html: pass2IconHtml,
    });

    return `${pass1}\n${pass2}`;
  }).join('\n');

  const timestamps = points.map((point) => point.timestamp);

  const tableHtml = options.hideTable === true
    ? ''
    : renderDataTable(
      points.map((point) => point.tableRow),
      caption,
      options.tableDisplay,
    );

  return h({
    tag: 'figure',
    class: 'chart-figure',
    children: [
      h({ tag: 'figcaption', class: 'chart-caption', text: caption, }),
      h({
        tag: 'div',
        class: 'chart-container',
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
