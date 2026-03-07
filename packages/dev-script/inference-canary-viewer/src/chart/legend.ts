/**
 * Shape legend explaining the point markers used in scatter charts.
 *
 * Circle = pass-1 (initial) score. Diamond = pass-2 (fix) score.
 */
import { $ as h, } from '@monochromatic-dev/module-es/h-html';

/** HTML for the shape legend, displayed once per chart area */
export const SHAPE_LEGEND = h({
  tag: 'div',
  class: 'chart-legend',
  children: [
    h({
      tag: 'span',
      class: 'legend-item',
      children: [
        h({ tag: 'span', class: 'color-dot', style: { '--point-color': '#666', }, }),
        ' initial score',
      ],
    }),
    h({
      tag: 'span',
      class: 'legend-item',
      children: [
        h({ tag: 'span', class: 'color-dot color-dot--fix', style: { '--point-color': '#666', }, }),
        ' fix score',
      ],
    }),
  ],
});
