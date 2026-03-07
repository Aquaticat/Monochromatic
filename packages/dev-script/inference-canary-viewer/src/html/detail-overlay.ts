/**
 * Run detail overlay using the Popover API (`popover="auto"`).
 *
 * Clicking a scatter point button (`popovertarget="run-{id}"`) opens the
 * corresponding overlay. Light-dismiss is built in — clicking outside or
 * pressing Escape closes the popover. No JavaScript required.
 *
 * Enriched artifacts add reasoning traces, timing, token usage, config,
 * and fix prompts to probe overlays. Missing enrichment degrades gracefully.
 */
import { join, } from 'node:path';

import { escapeHtml, } from '../chart/data-table.ts';
import { highlightTs, } from '../highlight/glow.ts';
import { computeDiff, } from '../data/diff.ts';
import type { DiffLine, } from '../data/diff.ts';
import type { ProbeDetail, ViewerEntry, } from '../data/viewer-types.ts';
import { probeKey, } from '../data/read-artifacts.ts';

import { renderBadges, renderCollapsibles, renderPassMeta, } from './overlay-meta.ts';

/**
 * Renders all run detail overlays for every viewer entry.
 *
 * Each overlay is a `<div popover="auto" id="run-{id}">` opened by `popovertarget` buttons.
 * @param entries - all viewer entries
 * @param probeDetails - per-probe enriched data keyed by composite key
 * @param modelLabels - display labels per model
 * @returns HTML string containing all overlay sections
 */
export async function renderAllOverlays(
  entries: readonly ViewerEntry[],
  probeDetails: ReadonlyMap<string, ProbeDetail>,
  modelLabels: ReadonlyMap<string, string>,
): Promise<string> {
  const overlays: string[] = [];

  for (const entry of entries) {
    const probeNames = Object.keys(entry.probeScores);

    // Overall run overlay
    const overallId = `${entry.model}-${entry.timestamp}`;
    overlays.push(renderRunOverlay(overallId, entry, modelLabels));

    // Per-probe overlays
    for (const probe of probeNames) {
      const probeId = `${entry.model}-${probe}-${entry.timestamp}`;
      const key = probeKey(entry.model, probe, entry.timestamp);
      const detail = probeDetails.get(key);
      overlays.push(await renderProbeOverlay(probeId, entry, probe, detail, modelLabels));
    }
  }

  return overlays.join('\n');
}

/**
 * Renders a simple overlay for an overall run (no source code).
 * Shows a probe grid with clickable cards linking to per-probe overlays.
 * @param id - unique overlay ID
 * @param entry - viewer entry
 * @param modelLabels - display labels
 * @returns HTML string
 */
function renderRunOverlay(
  id: string,
  entry: ViewerEntry,
  modelLabels: ReadonlyMap<string, string>,
): string {
  const label = modelLabels.get(entry.model) ?? entry.model;

  const probeCards = Object.entries(entry.probeScores)
    .map(([name, score]) => {
      const probeOverlayId = `run-${escapeHtml(entry.model)}-${escapeHtml(name)}-${escapeHtml(entry.timestamp)}`;
      return `<button popovertarget="${probeOverlayId}" class="probe-card">
  <span>${escapeHtml(name)}</span>
  <span class="probe-card-score"><strong>${score.toFixed(2)}</strong></span>
</button>`;
    })
    .join('\n');

  const errorSuffix = entry.error !== undefined ? ` (${escapeHtml(entry.error)})` : '';
  const title = `${escapeHtml(label)} - ${entry.overallScore.toFixed(2)} - ${escapeHtml(entry.timestamp)}${entry.failed ? ` (FAILED${errorSuffix})` : ''}`;

  return `<div popover="auto" id="run-${escapeHtml(id)}" class="overlay">
  <h2 class="overlay-title">${title}</h2>
  <div class="probe-grid">${probeCards}</div>
</div>`;
}

/**
 * Renders a probe-specific overlay with source code, diff, and enriched metadata.
 * @param id - unique overlay ID
 * @param entry - viewer entry
 * @param probe - probe name
 * @param detail - enriched probe detail (may be undefined for missing artifacts)
 * @param modelLabels - display labels
 * @returns HTML string
 */
async function renderProbeOverlay(
  id: string,
  entry: ViewerEntry,
  probe: string,
  detail: ProbeDetail | undefined,
  modelLabels: ReadonlyMap<string, string>,
): Promise<string> {
  const label = modelLabels.get(entry.model) ?? entry.model;
  const score = entry.probeScores[probe] ?? 0;
  const pass2Score = entry.pass2Scores?.[probe];

  // Status badges (partial, error, non-stop finish reason)
  const badges = detail !== undefined ? renderBadges(detail) : '';

  // Pass metadata sections (timing, usage, finish reason)
  const initialMeta = detail !== undefined
    ? renderPassMeta('Initial pass', detail.timing, detail.usage, detail.finishReason)
    : '';
  const fixMeta = detail !== undefined && (detail.fixTiming !== undefined || detail.fixUsage !== undefined)
    ? renderPassMeta('Fix pass', detail.fixTiming, detail.fixUsage, detail.fixFinishReason)
    : '';

  // Source code section (diff or single)
  let sourceSection = detail === undefined
    ? '<p class="overlay-no-artifacts">Artifacts not available for this run.</p>'
    : '';
  if (detail?.initialSource !== undefined) {
    const initialHighlighted = highlightTs(detail.initialSource);

    if (detail.fixSource !== undefined && detail.fixDir !== undefined) {
      const initialFile = join(detail.initialDir, 'canary.ts');
      const fixFile = join(detail.fixDir, 'canary.ts');
      const diffLines = await computeDiff(initialFile, fixFile);
      sourceSection = `<details class="overlay-details">
  <summary>Source diff</summary>
  ${renderSideBySideDiff(diffLines)}
</details>`;
    } else {
      sourceSection = `<details class="overlay-details">
  <summary>Source</summary>
  <pre class="glow">${initialHighlighted}</pre>
</details>`;
    }
  }

  // Collapsible detail sections (reasoning, fix prompt, config)
  const collapsibles = detail !== undefined ? renderCollapsibles(detail) : '';

  const pass2Suffix = pass2Score !== undefined ? ` (fix: ${pass2Score.toFixed(2)})` : '';
  const title = `${escapeHtml(label)} - ${escapeHtml(probe)} - ${score.toFixed(2)}${pass2Suffix} - ${escapeHtml(entry.timestamp)}${entry.failed ? ' (FAILED)' : ''}`;

  return `<div popover="auto" id="run-${escapeHtml(id)}" class="overlay overlay--source">
  <h2 class="overlay-title">${title}</h2>
  ${badges}
  ${initialMeta}
  ${fixMeta}
  ${sourceSection}
  ${collapsibles}
</div>`;
}

/**
 * Renders a side-by-side diff view with syntax highlighting.
 *
 * Left column: initial pass (removed lines highlighted).
 * Right column: fix pass (added lines highlighted).
 * Unchanged lines appear in both columns.
 * @param diffLines - computed diff lines
 * @returns HTML string for the diff view
 */
function renderSideBySideDiff(
  diffLines: readonly DiffLine[],
): string {
  const leftLines: string[] = [];
  const rightLines: string[] = [];

  for (const line of diffLines) {
    const escaped = escapeHtml(line.content);
    switch (line.type) {
      case 'removed': {
        leftLines.push(`<span class="diff-removed">${escaped}</span>`);
        rightLines.push('<span class="diff-spacer"></span>');
        break;
      }
      case 'added': {
        leftLines.push('<span class="diff-spacer"></span>');
        rightLines.push(`<span class="diff-added">${escaped}</span>`);
        break;
      }
      case 'unchanged': {
        leftLines.push(`<span>${escaped}</span>`);
        rightLines.push(`<span>${escaped}</span>`);
        break;
      }
    }
  }

  return `<div class="diff-container">
  <div class="diff-column">
    <h3>Initial pass</h3>
    <pre class="glow diff-pre"><code>${leftLines.join('\n')}</code></pre>
  </div>
  <div class="diff-column">
    <h3>Fix pass</h3>
    <pre class="glow diff-pre"><code>${rightLines.join('\n')}</code></pre>
  </div>
</div>`;
}
