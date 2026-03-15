/**
 * Color legend builder for the per-probe view.
 *
 * Generates a legend mapping vendor colors and icons to model labels,
 * used alongside probe scatter charts.
 */
import { $ as h, } from '@monochromatic-dev/module-es/h-html';

import { vendorColor, } from '../data/model-colors.ts';
import { iconDot, } from '../data/model-icons.ts';

import type { ViewerEntry, } from '../data/viewer-types.ts';

/**
 * Renders a color legend mapping model colors to labels.
 *
 * @param entries - history entries (to extract unique models)
 *
 * @returns HTML string for the legend
 */
export function buildProbeLegend(
  entries: readonly ViewerEntry[],
): string {
  /** Deduplicate by label, keeping first occurrence for model ID */
  const seen = new Map<string, string>();
  for (const entry of entries) {
    if (!seen.has(entry.label,))
      seen.set(entry.label, entry.model,);
  }

  const items = [...seen.entries(),]
    .map(function buildItem([label, openrouterId,],): string {
      const color = vendorColor(openrouterId,);
      return h({
        tag: 'span',
        class: 'item',
        children: [iconDot(openrouterId, color,), ' ',
          h({ tag: 'span', text: label, },),],
      },);
    },)
    .join('\n',);

  return h({ tag: 'div', class: 'chart-legend', html: items, },);
}
