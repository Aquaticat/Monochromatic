/**
 * Top-level dashboard layout with three view sections.
 *
 * Uses `<details>` elements for view switching. CSS `:has()` on the parent
 * hides non-open siblings so only one view is visible at a time.
 */
import { $ as h, } from '@monochromatic-dev/module-es/h-html';

/**
 * Wraps three view sections into the dashboard layout.
 * @param options - dashboard rendering options
 * @param options.overviewHtml - overview section content
 * @param options.byModelHtml - per-model section content
 * @param options.byProbeHtml - per-probe section content
 * @param options.overlaysHtml - all run detail overlays (rendered outside the views)
 * @returns dashboard HTML string
 */
export function renderDashboard({ overviewHtml, byModelHtml, byProbeHtml, overlaysHtml, }: {
  overviewHtml: string;
  byModelHtml: string;
  byProbeHtml: string;
  overlaysHtml: string;
}): string {
  return h({
    tag: 'nav',
    class: 'view-switcher',
    children: [
      h({
        tag: 'details',
        class: 'view-section',
        attrs: { open: '', },
        children: [
          h({ tag: 'summary', text: 'Overview', }),
          h({ tag: 'div', class: 'pane', html: overviewHtml, }),
        ],
      }),
      h({
        tag: 'details',
        class: 'view-section',
        children: [
          h({ tag: 'summary', text: 'By model', }),
          h({ tag: 'div', class: 'pane', html: byModelHtml, }),
        ],
      }),
      h({
        tag: 'details',
        class: 'view-section',
        children: [
          h({ tag: 'summary', text: 'By probe', }),
          h({ tag: 'div', class: 'pane', html: byProbeHtml, }),
        ],
      }),
    ],
  }) + '\n' + overlaysHtml;
}
