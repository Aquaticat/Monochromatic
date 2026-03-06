/**
 * Shape legend explaining the point markers used in scatter charts.
 *
 * Circle = pass-1 (initial) score. Diamond = pass-2 (fix) score.
 */

/** HTML for the shape legend, displayed once per chart area */
export const SHAPE_LEGEND = `<div class="chart-legend">
  <span class="legend-item"><span class="color-dot" style="--point-color: #666"></span> initial score</span>
  <span class="legend-item"><span class="color-dot color-dot--fix" style="--point-color: #666"></span> fix score</span>
</div>`;
