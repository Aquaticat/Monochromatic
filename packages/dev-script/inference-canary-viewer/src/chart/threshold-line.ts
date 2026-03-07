/**
 * Threshold line overlay for scatter plots.
 *
 * Renders a dashed horizontal line at the computed degradation threshold
 * (mean - 2*stddev), with a label showing the threshold value.
 */
import { $ as h, } from '@monochromatic-dev/module-es/h-html';

/**
 * Renders a threshold line as a positioned `<div>` inside a chart container.
 * @param threshold - score threshold value (0-1)
 * @param label - descriptive label (e.g. "threshold: 0.42")
 * @returns HTML string for the threshold line, or empty string if threshold is 0
 */
export function renderThresholdLine(threshold: number, label: string,): string {
  if (threshold <= 0) return '';
  /** Percentage multiplier */
  const PERCENT = 100;
  const bottom = threshold * PERCENT;
  return h({
    tag: 'div',
    class: 'chart-threshold',
    style: { bottom: `${String(bottom)}%`, },
    attrs: { title: label, },
    children: [
      h({ tag: 'span', class: 'label', text: label, }),
    ],
  });
}
