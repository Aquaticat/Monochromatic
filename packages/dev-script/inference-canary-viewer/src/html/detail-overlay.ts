/**
 * Run detail overlay using the Popover API (`popover="auto"`).
 *
 * Clicking a scatter point button (`popovertarget="run-{id}"`) opens the
 * corresponding overlay. Light-dismiss is built in — clicking outside or
 * pressing Escape closes the popover. No JavaScript required.
 *
 * Enriched artifacts add reasoning traces, timing, token usage, config,
 * and fix prompts to probe overlays. Missing enrichment degrades gracefully.
 *
 * Exceeds 100 lines: run overlay, probe overlay, and diff rendering are
 * interdependent and share the same entry/detail data flow.
 */
import { join, } from 'node:path';

import { $ as h, } from '@monochromatic-dev/module-es/h-html';

import { highlightTs, } from '../highlight/glow.ts';
import { computeDiff, type DiffLine, } from '../data/diff.ts';
import { probeKey, } from '../data/read-artifacts.ts';

import type { ProbeDetail, ViewerEntry, } from '../data/viewer-types.ts';

import { renderBadges, renderCollapsibles, renderPassMeta, } from './overlay-meta.ts';

/**
 * Renders all run detail overlays for every viewer entry.
 *
 * Each overlay is a `<div popover="auto" id="run-{id}">` opened by `popovertarget` buttons.
 *
 *
 * @param entries - all viewer entries
 *
 * @param probeDetails - per-probe enriched data keyed by composite key
 *
 * @returns HTML string containing all overlay sections
 */
export async function renderAllOverlays({ entries, probeDetails, }: {
  entries: readonly ViewerEntry[];
  probeDetails: ReadonlyMap<string, ProbeDetail>;
}): Promise<string> {
  const overlays = await Promise.all(entries.flatMap(function buildEntryOverlays(entry) {
    const probeNames = Object.keys(entry.probeScores);
    const overallId = `${entry.label}-${entry.timestamp}`;

    return [
      Promise.resolve(renderRunOverlay({ id: overallId, entry, })),
      ...probeNames.map(function buildProbeOverlay(probe) {
        const probeId = `${entry.label}-${probe}-${entry.timestamp}`;
        const key = probeKey(entry.label, probe, entry.timestamp);
        return renderProbeOverlay({ id: probeId, entry, probe, detail: probeDetails.get(key), });
      }),
    ];
  }));

  return overlays.join('\n');
}

/**
 * Renders a simple overlay for an overall run (no source code).
 * Shows a probe grid with clickable cards linking to per-probe overlays.
 *
 *
 * @param id - unique overlay ID
 *
 * @param entry - viewer entry
 *
 * @returns HTML string
 */
function renderRunOverlay({ id, entry, }: {
  id: string;
  entry: ViewerEntry;
}): string {
  const {label} = entry;

  const probeCards = Object.entries(entry.probeScores)
    .map(([name, score]) => {
      const probeOverlayId = `run-${entry.label}-${name}-${entry.timestamp}`;
      return h({
        tag: 'button',
        class: 'probe-card',
        attrs: { popovertarget: probeOverlayId, },
        children: [
          h({ tag: 'span', text: name, }),
          h({
            tag: 'span',
            class: 'score',
            children: [h({ tag: 'strong', text: score.toFixed(2), })],
          }),
        ],
      });
    })
    .join('\n');

  const errorSuffix = entry.error !== undefined ? ` (${entry.error})` : '';
  const title = `${label} - ${entry.overallScore.toFixed(2)} - ${entry.timestamp}${entry.failed ? ` (FAILED${errorSuffix})` : ''}`;

  return h({
    tag: 'div',
    class: 'detail-popover',
    attrs: { popover: 'auto', id: `run-${id}`, },
    children: [
      h({ tag: 'h2', class: 'detail-popover-title', text: title, }),
      h({ tag: 'div', class: 'probe-grid', html: probeCards, }),
    ],
  });
}

/**
 * Renders a probe-specific overlay with source code, diff, and enriched metadata.
 *
 *
 * @param id - unique overlay ID
 *
 * @param entry - viewer entry
 *
 * @param probe - probe name
 *
 * @param detail - enriched probe detail (may be undefined for missing artifacts)
 *
 * @returns HTML string
 */
async function renderProbeOverlay({ id, entry, probe, detail, }: {
  id: string;
  entry: ViewerEntry;
  probe: string;
  detail: ProbeDetail | undefined;
}): Promise<string> {
  const {label} = entry;
  const score = entry.probeScores[probe] ?? 0;
  const pass2Score = entry.pass2Scores?.[probe];

  // Status badges (partial, error, non-stop finish reason)
  const badges = detail !== undefined ? renderBadges(detail) : '';

  // Pass metadata sections (timing, usage, finish reason)
  const initialMeta = detail !== undefined
    ? renderPassMeta({ label: 'Initial pass', timing: detail.timing, usage: detail.usage, finishReason: detail.finishReason, })
    : '';
  const fixMeta = detail !== undefined && (detail.fixTiming !== undefined || detail.fixUsage !== undefined)
    ? renderPassMeta({ label: 'Fix pass', timing: detail.fixTiming, usage: detail.fixUsage, finishReason: detail.fixFinishReason, })
    : '';

  // Source code section (diff or single)
  let sourceSection = detail === undefined
    ? h({ tag: 'p', class: 'detail-popover-empty', text: 'Artifacts not available for this run.', })
    : '';
  if (detail?.initialSource !== undefined) {
    const initialHighlighted = highlightTs(detail.initialSource);

    if (detail.fixSource !== undefined && detail.fixDir !== undefined) {
      const initialFile = join(detail.initialDir, 'canary.ts');
      const fixFile = join(detail.fixDir, 'canary.ts');
      const diffLines = await computeDiff({ initialPath: initialFile, fixPath: fixFile, });
      sourceSection = h({
        tag: 'details',
        class: 'collapsible-section',
        children: [
          h({ tag: 'summary', text: 'Source diff', }),
          renderSideBySideDiff(diffLines),
        ],
      });
    } else {
      sourceSection = h({
        tag: 'details',
        class: 'collapsible-section',
        children: [
          h({ tag: 'summary', text: 'Source', }),
          h({ tag: 'pre', class: 'glow', html: initialHighlighted, }),
        ],
      });
    }
  }

  // Collapsible detail sections (reasoning, fix prompt, config)
  const collapsibles = detail !== undefined ? renderCollapsibles(detail) : '';

  const pass2Suffix = pass2Score !== undefined ? ` (fix: ${pass2Score.toFixed(2)})` : '';
  const title = `${label} - ${probe} - ${score.toFixed(2)}${pass2Suffix} - ${entry.timestamp}${entry.failed ? ' (FAILED)' : ''}`;

  return h({
    tag: 'div',
    class: 'detail-popover',
    attrs: { popover: 'auto', id: `run-${id}`, 'data-layout': 'centered', },
    children: [
      h({ tag: 'h2', class: 'detail-popover-title', text: title, }),
      badges,
      initialMeta,
      fixMeta,
      sourceSection,
      collapsibles,
    ],
  });
}

/**
 * Renders a side-by-side diff view with syntax highlighting.
 *
 * Left column: initial pass (removed lines highlighted).
 * Right column: fix pass (added lines highlighted).
 * Unchanged lines appear in both columns.
 *
 * @param diffLines - computed diff lines
 *
 * @returns HTML string for the diff view
 */
function renderSideBySideDiff(
  diffLines: readonly DiffLine[],
): string {
  const leftLines: string[] = [];
  const rightLines: string[] = [];

  for (const line of diffLines) {
    switch (line.type) {
      case 'removed': {
        leftLines.push(h({ tag: 'span', class: 'diff-removed', text: line.content, }));
        rightLines.push(h({ tag: 'span', class: 'diff-spacer', }));
        break;
      }
      case 'added': {
        leftLines.push(h({ tag: 'span', class: 'diff-spacer', }));
        rightLines.push(h({ tag: 'span', class: 'diff-added', text: line.content, }));
        break;
      }
      case 'unchanged': {
        leftLines.push(h({ tag: 'span', text: line.content, }));
        rightLines.push(h({ tag: 'span', text: line.content, }));
        break;
      }
    }
  }

  return h({
    tag: 'div',
    class: 'diff-container',
    children: [
      h({
        tag: 'div',
        class: 'diff-column',
        children: [
          h({ tag: 'h3', text: 'Initial pass', }),
          h({
            tag: 'pre',
            class: 'glow diff-pre',
            children: [h({ tag: 'code', html: leftLines.join('\n'), })],
          }),
        ],
      }),
      h({
        tag: 'div',
        class: 'diff-column',
        children: [
          h({ tag: 'h3', text: 'Fix pass', }),
          h({
            tag: 'pre',
            class: 'glow diff-pre',
            children: [h({ tag: 'code', html: rightLines.join('\n'), })],
          }),
        ],
      }),
    ],
  });
}
