/**
 * Run detail overlay using the Popover API (`popover="auto"`).
 *
 * Clicking a scatter point button (`popovertarget="run-{id}"`) opens the
 * corresponding overlay. Light-dismiss is built in — clicking outside or
 * pressing Escape closes the popover. No JavaScript required.
 */
import { hHtml as h, } from '@monochromatic-dev/module-hyperscript/ts';

import { probeKey, } from '../data/read-artifacts.ts';

import type {
  ProbeDetail,
  ViewerEntry,
} from '../data/viewer-types.ts';

import { renderProbeOverlay, } from './overlay-probe.ts';

/**
 * Renders all run detail overlays for every viewer entry.
 *
 * Each overlay is a `<div popover="auto" id="run-{id}">` opened by `popovertarget` buttons.
 *
 * @param entries - all viewer entries
 *
 * @param probeDetails - per-probe enriched data keyed by composite key
 *
 * @returns HTML string containing all overlay sections
 *
 * @example
 * ```ts
 * const html = await renderAllOverlays({ entries, probeDetails });
 * // '<div class="detail-popover" popover="auto" ...>...<\/div>\n...'
 * ```
 */
export async function renderAllOverlays({
  entries,
  probeDetails,
}: {
  entries: readonly ViewerEntry[];
  probeDetails: ReadonlyMap<string, ProbeDetail>;
},): Promise<string> {
  const overlays = await Promise.all(entries.flatMap(function buildEntryOverlays(entry,) {
    const probeNames = Object.keys(entry.probeScores,);
    const overallId = `${entry.label}-${entry.timestamp}`;

    return [
      Promise.resolve(renderRunOverlay({
        id: overallId,
        entry,
      },),),
      ...probeNames.map(function buildProbeOverlay(probe,) {
        const probeId = `${entry.label}-${probe}-${entry.timestamp}`;
        const key = probeKey(
          entry.label,
          probe,
          entry.timestamp,
        );
        return renderProbeOverlay({
          id: probeId,
          entry,
          probe,
          detail: probeDetails.get(key,),
        },);
      },),
    ];
  },),);

  return overlays.join('\n',);
}

/**
 * Renders a simple overlay for an overall run (no source code).
 * Shows a probe grid with clickable cards linking to per-probe overlays.
 *
 * @param id - unique overlay ID
 *
 * @param entry - viewer entry
 *
 * @returns HTML string
 */
function renderRunOverlay({
  id,
  entry,
}: {
  id: string;
  entry: ViewerEntry;
},): string {
  const { label, } = entry;

  const probeCards = Object
    .entries(entry.probeScores,)
    .map(function renderProbeCard([name, score,],) {
      const probeOverlayId = `run-${entry.label}-${name}-${entry.timestamp}`;
      return h({
        tag: 'button',
        class: 'probe-card',
        attrs: { popovertarget: probeOverlayId, },
        children: [
          h({
            tag: 'span',
            text: name,
          },),
          h({
            tag: 'span',
            class: 'score',
            children: [h({
              tag: 'strong',
              text: score.toFixed(2,),
            },),],
          },),
        ],
      },);
    },)
    .join('\n',);

  const errorSuffix = entry.error !== undefined ? ` (${entry.error})` : '';
  const title = `${label} - ${entry.overallScore.toFixed(2,)} - ${entry.timestamp}${
    entry.failed ? ` (FAILED${errorSuffix})` : ''
  }`;

  return h({
    tag: 'div',
    class: 'detail-popover',
    attrs: {
      popover: 'auto',
      id: `run-${id}`,
    },
    children: [
      h({
        tag: 'h2',
        class: 'detail-popover-title',
        text: title,
      },),
      h({
        tag: 'div',
        class: 'probe-grid',
        html: probeCards,
      },),
    ],
  },);
}
