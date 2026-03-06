/**
 * Run detail overlay shown via `:target` CSS pseudo-class.
 *
 * Clicking a scatter point navigates to `#run-{id}`, making the corresponding
 * `<section>` visible as a fixed overlay. Contains source code with syntax
 * highlighting, side-by-side diff, and lint diagnostics.
 */
import { escapeHtml, } from '../chart/data-table.ts';
import { highlightTs, } from '../highlight/glow.ts';
import { computeDiff, } from '../data/diff.ts';
import type { DiffLine, } from '../data/diff.ts';
import { join, } from 'node:path';

import type { HistoryEntry, } from '../data/read-history.ts';
import type { ArtifactPair, } from '../data/read-artifacts.ts';
import { artifactKey, } from '../data/read-artifacts.ts';

/**
 * Renders all run detail overlays for every history entry.
 *
 * Each overlay is a `<section id="run-{id}">` that becomes visible via `:target`.
 * @param entries - all history entries
 * @param artifacts - available artifact pairs
 * @param modelLabels - display labels per model
 * @returns HTML string containing all overlay sections
 */
export async function renderAllOverlays(
  entries: readonly HistoryEntry[],
  artifacts: ReadonlyMap<string, ArtifactPair>,
  modelLabels: ReadonlyMap<string, string>,
): Promise<string> {
  /** Collect all unique run IDs to generate overlays for */
  const overlays: string[] = [];

  for (const entry of entries) {
    const probeNames = Object.keys(entry.probeScores);

    // Overall run overlay
    const overallId = `${entry.model}-${entry.timestamp}`;
    overlays.push(renderRunOverlay(
      overallId, entry, 'overall', undefined, modelLabels,
    ));

    // Per-probe overlays
    for (const probe of probeNames) {
      const probeId = `${entry.model}-${probe}-${entry.timestamp}`;
      const key = `${entry.model}::${probe}::${entry.timestamp}`;
      const pair = artifacts.get(key);
      overlays.push(await renderProbeOverlay(probeId, entry, probe, pair, modelLabels));
    }
  }

  return overlays.join('\n');
}

/**
 * Renders a simple overlay for an overall run (no source code).
 * @param id - unique overlay ID
 * @param entry - history entry
 * @param probe - probe name (always "overall" for this function)
 * @param pair - artifact pair (unused for overall)
 * @param modelLabels - display labels
 * @returns HTML string
 */
function renderRunOverlay(
  id: string,
  entry: HistoryEntry,
  probe: string,
  pair: ArtifactPair | undefined,
  modelLabels: ReadonlyMap<string, string>,
): string {
  const label = modelLabels.get(entry.model) ?? entry.model;

  void pair;

  const probeRows = Object.entries(entry.probeScores)
    .map(([name, score]) => {
      const probeOverlayId = `run-${escapeHtml(entry.model)}-${escapeHtml(name)}-${escapeHtml(entry.timestamp)}`;
      return `<tr><td><a href="#${probeOverlayId}">${escapeHtml(name)}</a></td><td>${score.toFixed(2)}</td></tr>`;
    })
    .join('\n');

  return `<section id="run-${escapeHtml(id)}" class="overlay">
  <div class="overlay-panel">
    <header class="overlay-header">
      <h2>${escapeHtml(label)} - ${escapeHtml(probe)}</h2>
      <p class="overlay-meta">
        <time>${escapeHtml(entry.timestamp)}</time>
        &middot; overall: <strong>${entry.overallScore.toFixed(2)}</strong>
        ${entry.failed ? '&middot; <span class="status--failed">FAILED</span>' : ''}
      </p>
      <a href="#" class="overlay-close" aria-label="Close detail view">Close</a>
    </header>
    <table class="overlay-scores">
      <thead><tr><th>Probe</th><th>Score</th></tr></thead>
      <tbody>${probeRows}</tbody>
    </table>
  </div>
</section>`;
}

/**
 * Renders a probe-specific overlay with source code and diff.
 * @param id - unique overlay ID
 * @param entry - history entry
 * @param probe - probe name
 * @param pair - artifact pair (may be undefined if artifacts not available)
 * @param modelLabels - display labels
 * @returns HTML string
 */
async function renderProbeOverlay(
  id: string,
  entry: HistoryEntry,
  probe: string,
  pair: ArtifactPair | undefined,
  modelLabels: ReadonlyMap<string, string>,
): Promise<string> {
  const label = modelLabels.get(entry.model) ?? entry.model;
  const score = entry.probeScores[probe] ?? 0;

  let sourceSection = '<p class="overlay-no-artifacts">Artifacts not available for this run.</p>';

  if (pair?.initial !== undefined) {
    const initialHighlighted = highlightTs(pair.initial.source);

    if (pair.fix !== undefined) {
      const initialFile = join(pair.initial.dir, 'canary.ts');
      const fixFile = join(pair.fix.dir, 'canary.ts');
      const diffLines = await computeDiff(initialFile, fixFile);
      const diffHtml = renderSideBySideDiff(diffLines);
      sourceSection = diffHtml;
    } else {
      sourceSection = `<div class="source-single">
  <h3>Initial pass</h3>
  <pre class="glow">${initialHighlighted}</pre>
</div>`;
    }
  }

  return `<section id="run-${escapeHtml(id)}" class="overlay">
  <div class="overlay-panel">
    <header class="overlay-header">
      <h2>${escapeHtml(label)} - ${escapeHtml(probe)}</h2>
      <p class="overlay-meta">
        <time>${escapeHtml(entry.timestamp)}</time>
        &middot; score: <strong>${score.toFixed(2)}</strong>
        ${entry.failed ? '&middot; <span class="status--failed">FAILED</span>' : ''}
      </p>
      <a href="#" class="overlay-close" aria-label="Close detail view">Close</a>
    </header>
    ${sourceSection}
  </div>
</section>`;
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
