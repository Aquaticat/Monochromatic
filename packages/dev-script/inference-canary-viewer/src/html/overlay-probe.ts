/**
 * Probe-specific overlay renderer for run detail popovers.
 *
 * Renders source code (with optional diff), enriched metadata,
 * and collapsible sections for reasoning, responses, and config.
 */
import { join, } from 'node:path';

import { hHtml as h, } from '@monochromatic-dev/module-hyperscript/ts';

import { computeDiff, } from '../data/diff.ts';
import type {
  ProbeDetail,
  ViewerEntry,
} from '../data/viewer-types.ts';

import { renderSideBySideDiff, } from './diff-view.ts';
import { renderCollapsibles, } from './overlay-collapsibles.ts';
import {
  renderBadges,
  renderPassMeta,
} from './overlay-meta.ts';

/**
 * Renders a probe-specific overlay with source code, diff, and enriched metadata.
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
 *
 * @example
 * ```ts
 * const html = await renderProbeOverlay({ id: 'Sonnet-csv-2026', entry, probe: 'csv-rfc4180', detail });
 * // '<div class="detail-popover" popover="auto" id="run-Sonnet-csv-2026">...<\/div>'
 * ```
 */
export async function renderProbeOverlay({
  id,
  entry,
  probe,
  detail,
}: {
  id: string;
  entry: ViewerEntry;
  probe: string;
  detail: ProbeDetail | undefined;
},): Promise<string> {
  const { label, } = entry;
  const score = entry.probeScores[probe] ?? 0;
  const pass2Score = entry.pass2Scores?.[probe];

  // Status badges (partial, error, non-stop finish reason)
  const badges = detail !== undefined ? renderBadges(detail,) : '';

  // Pass metadata sections (timing, usage, finish reason)
  const initialMeta = detail !== undefined
    ? renderPassMeta({
      label: 'Initial pass',
      timing: detail.timing,
      usage: detail.usage,
      finishReason: detail.finishReason,
    },)
    : '';
  const fixMeta = detail !== undefined
      && (detail.fixTiming !== undefined || detail.fixUsage !== undefined)
    ? renderPassMeta({
      label: 'Fix pass',
      timing: detail.fixTiming,
      usage: detail.fixUsage,
      finishReason: detail.fixFinishReason,
    },)
    : '';

  // Source code section (diff or single)
  let sourceSection = detail === undefined
    ? h({
      tag: 'p',
      class: 'detail-popover-empty',
      text: 'Artifacts not available for this run.',
    },)
    : '';
  if (detail?.initialSource !== undefined) {
    if (detail.fixSource !== undefined && detail.fixDir !== undefined) {
      const initialFile = join(
        detail.initialDir,
        'canary.ts',
      );
      const fixFile = join(
        detail.fixDir,
        'canary.ts',
      );
      const diffLines = await computeDiff({
        initialPath: initialFile,
        fixPath: fixFile,
      },);
      sourceSection = h({
        tag: 'details',
        class: 'collapsible-section',
        children: [
          h({
            tag: 'summary',
            text: 'Source diff',
          },),
          renderSideBySideDiff(diffLines,),
        ],
      },);
    }
    else {
      sourceSection = h({
        tag: 'details',
        class: 'collapsible-section',
        children: [
          h({
            tag: 'summary',
            text: 'Source',
          },),
          h({
            tag: 'pre',
            class: 'source-code',
            children: [
              h({
                tag: 'code',
                class: 'language-ts',
                text: detail.initialSource,
              },),
            ],
          },),
        ],
      },);
    }
  }

  // Collapsible detail sections (reasoning, fix prompt, config)
  const collapsibles = detail !== undefined ? renderCollapsibles(detail,) : '';

  const pass2Suffix = pass2Score !== undefined ? ` (fix: ${pass2Score.toFixed(2,)})` : '';
  const title = `${label} - ${probe} - ${
    score.toFixed(2,)
  }${pass2Suffix} - ${entry.timestamp}${entry.failed ? ' (FAILED)' : ''}`;

  return h({
    tag: 'div',
    class: 'detail-popover',
    attrs: {
      popover: 'auto',
      id: `run-${id}`,
      'data-layout': 'centered',
    },
    children: [
      h({
        tag: 'h2',
        class: 'detail-popover-title',
        text: title,
      },),
      badges,
      initialMeta,
      fixMeta,
      sourceSection,
      collapsibles,
    ],
  },);
}
