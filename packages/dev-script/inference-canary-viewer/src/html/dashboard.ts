/**
 * Top-level dashboard layout with three view sections.
 *
 * Uses `<details>` elements for view switching. CSS `:has()` on the parent
 * hides non-open siblings so only one view is visible at a time.
 */

/**
 * Wraps three view sections into the dashboard layout.
 * @param overviewHtml - overview section content
 * @param byModelHtml - per-model section content
 * @param byProbeHtml - per-probe section content
 * @param overlaysHtml - all run detail overlays (rendered outside the views)
 * @returns dashboard HTML string
 */
export function renderDashboard(
  overviewHtml: string,
  byModelHtml: string,
  byProbeHtml: string,
  overlaysHtml: string,
): string {
  return `<nav class="view-switcher">
  <details class="view-section" open>
    <summary class="view-tab">Overview</summary>
    <div class="view-content">
      ${overviewHtml}
    </div>
  </details>
  <details class="view-section">
    <summary class="view-tab">By model</summary>
    <div class="view-content">
      ${byModelHtml}
    </div>
  </details>
  <details class="view-section">
    <summary class="view-tab">By probe</summary>
    <div class="view-content">
      ${byProbeHtml}
    </div>
  </details>
</nav>
${overlaysHtml}`;
}
