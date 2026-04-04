/**
 * HTML+CSS scatter plot renderer.
 *
 * Each data point is a positioned `<button>` element inside a `position: relative`
 * container. Points open run detail popovers via `popovertarget` attributes.
 * Pass-1 points are filled circles; pass-2 points are hollow circles overlaid
 * at the same X position.
 */
import { hHtml as h, } from '@monochromatic-dev/module-hyperscript/ts';

import {
  renderXAxis,
  renderYAxis,
} from './axis.ts';
import {
  renderDataTable,
  type TableDisplayOptions,
  type TableRow,
} from './data-table.ts';
import { renderPointElements, } from './scatter-point.ts';
import { renderThresholdLine, } from './threshold-line.ts';

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
 *
 * @param points - data points to render
 *
 * @param threshold - degradation threshold value (0-1), 0 to hide
 *
 * @param thresholdLabel - label for the threshold line
 *
 * @param caption - accessible caption for the chart and table
 *
 * @param hideTable - when true, omit the backing data table entirely
 *
 * @param tableDisplay - column visibility options forwarded to the data table
 *
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
},): string {
  if (points.length === 0) {
    return h({
      tag: 'p',
      class: 'chart-empty-state',
      text: 'No data available.',
    },);
  }

  const pointElements = renderPointElements(points,);

  const timestamps = points.map(function getTimestamp(point,) {
    return point.timestamp;
  },);

  const tableHtml = hideTable === true
    ? ''
    : renderDataTable(
      points.map(function getTableRow(point,) {
        return point.tableRow;
      },),
      caption,
      tableDisplay,
    );

  return h({
    tag: 'figure',
    class: 'chart-figure',
    children: [
      h({
        tag: 'figcaption',
        text: caption,
      },),
      h({
        tag: 'div',
        class: 'chart-area',
        attrs: {
          role: 'img',
          'aria-label': caption,
        },
        children: [
          h({
            tag: 'div',
            class: 'chart-y-axis',
            html: renderYAxis(),
          },),
          h({
            tag: 'div',
            class: 'chart-plot',
            children: [
              renderThresholdLine(threshold, thresholdLabel,),
              pointElements,
            ],
          },),
          h({
            tag: 'div',
            class: 'chart-x-axis',
            html: renderXAxis(timestamps,),
          },),
        ],
      },),
      tableHtml,
    ],
  },);
}
