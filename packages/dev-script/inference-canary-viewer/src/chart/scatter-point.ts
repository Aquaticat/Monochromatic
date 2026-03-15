/**
 * Renders individual scatter point HTML elements.
 *
 * Each data point becomes a positioned `<button>` element.
 * Pass-1 points are filled circles; pass-2 points are hollow circles
 * overlaid at the same X position.
 */
import { $ as h, } from '@monochromatic-dev/module-es/h-html';

import type { ScatterPoint, } from './scatter.ts';

/** Percentage multiplier */
const PERCENT = 100;

/**
 * Renders all scatter point button elements as a single HTML string.
 *
 * Positions each point absolutely within the chart plot area using
 * percentage-based `left` and `bottom` CSS values.
 *
 * @param points - data points to render as positioned buttons
 *
 * @returns concatenated HTML string of all point elements
 *
 * @example
 * ```ts
 * const html = renderPointElements(points);
 * // '<button class="chart-point" ...>...</button>\n<button ...'
 * ```
 */
export function renderPointElements(points: readonly ScatterPoint[],): string {
  const totalRuns = points.length;

  return points
    .map(function renderPoint(point,) {
      const left = totalRuns === 1 ? 50 : (point.index / (totalRuns - 1)) * PERCENT;
      const bottom = point.score * PERCENT;

      const hasIcon = point.icon !== undefined && point.icon !== '' && !point.failed;
      const iconHtml = hasIcon ? point.icon : '';

      const pass1 = h({
        tag: 'button',
        class: 'chart-point',
        style: {
          left: `${left.toFixed(2,)}%`,
          bottom: `${bottom.toFixed(2,)}%`,
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
      },);

      if (point.pass2Score === undefined)
        return pass1;

      const pass2Bottom = point.pass2Score * PERCENT;
      const pass2HasIcon = point.icon !== undefined && point.icon !== '';
      const pass2IconHtml = pass2HasIcon ? point.icon : '';
      const pass2 = h({
        tag: 'button',
        class: 'chart-point',
        style: {
          left: `${left.toFixed(2,)}%`,
          bottom: `${pass2Bottom.toFixed(2,)}%`,
          '--point-color': point.color,
        },
        attrs: {
          popovertarget: `run-${point.runId}`,
          title: `fix: ${point.pass2Score.toFixed(2,)}`,
          'aria-label': `fix score ${point.pass2Score.toFixed(2,)}`,
          'data-pass': 'fix',
          ...(pass2HasIcon ? { 'data-shape': 'icon', } : {}),
        },
        html: pass2IconHtml,
      },);

      return `${pass1}\n${pass2}`;
    },)
    .join('\n',);
}
