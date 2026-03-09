/**
 * Enriched metadata rendering helpers for probe detail overlays.
 *
 * Renders timing, usage, badges, reasoning traces, fix prompts, and config
 * as compact HTML sections within popover overlays.
 *
 * Exceeds 100 lines: badge, pass-meta, collapsible, and config renderers
 * are cohesive metadata helpers that share formatting utilities.
 */
import { micromark, } from 'micromark';

import { $ as h, } from '@monochromatic-dev/module-es/h-html';

import type { ConfigSnapshot, StreamTiming, StreamUsage, } from '../data/viewer-types.ts';
import type { ProbeDetail, } from '../data/viewer-types.ts';

/** Milliseconds per second for display formatting */
const MS_PER_SECOND = 1_000;

/**
 * Formats milliseconds as a human-readable duration.
 * @param ms - milliseconds
 * @returns "1.2s" for >= 1000ms, "123ms" otherwise
 *
 * @example
 * ```ts
 * formatMs(1234); // "1.2s"
 * formatMs(50); // "50ms"
 * ```
 */
function formatMs(ms: number,): string {
  if (ms >= MS_PER_SECOND) {
    return `${(ms / MS_PER_SECOND).toFixed(1)}s`;
  }
  return `${Math.round(ms)}ms`;
}

/**
 * Formats a number with locale-appropriate thousands separators.
 * @param num - number to format
 * @returns formatted string
 *
 * @example
 * ```ts
 * formatNumber(12345); // "12,345"
 * ```
 */
function formatNumber(num: number,): string {
  return num.toLocaleString('en-US');
}

/**
 * Renders status badges for partial/error/finish-reason states.
 * @param detail - probe detail
 * @returns HTML string, empty when no badges apply
 *
 * @example
 * ```ts
 * renderBadges({ partial: true, error: 'timeout', finishReason: 'length' });
 * // '<div class="detail-popover-badges">...'
 * ```
 */
export function renderBadges(detail: ProbeDetail,): string {
  const badges: string[] = [];

  if (detail.partial === true) {
    badges.push(h({ tag: 'span', class: 'run-indicator', attrs: { 'data-severity': 'warning', }, text: 'partial', }));
  }
  if (detail.error !== undefined && detail.error !== '') {
    badges.push(h({ tag: 'span', class: 'run-indicator', attrs: { 'data-severity': 'error', }, text: detail.error, }));
  }
  if (detail.finishReason !== undefined && detail.finishReason !== 'stop') {
    badges.push(h({ tag: 'span', class: 'run-indicator', attrs: { 'data-severity': 'neutral', }, text: detail.finishReason, }));
  }

  if (badges.length === 0) return '';
  return h({ tag: 'div', class: 'detail-popover-badges', children: badges, });
}

/**
 * Renders a compact metadata grid for one pass (initial or fix).
 * Shows timing and token usage as a collapsed `<details>` element.
 * @param options - pass metadata rendering options
 * @param options.label - section label ("Initial pass" or "Fix pass")
 * @param options.timing - streaming timing data
 * @param options.usage - token usage data
 * @param options.finishReason - why generation stopped
 * @returns HTML string, empty when no data is available
 *
 * @example
 * ```ts
 * renderPassMeta({ label: 'Initial pass', timing, usage, finishReason: 'stop' });
 * // '<details class="collapsible-section"><summary>Initial pass</summary><dl ...>...'
 * ```
 */
export function renderPassMeta({ label, timing, usage, finishReason, }: {
  label: string;
  timing: StreamTiming | undefined;
  usage: StreamUsage | undefined;
  finishReason: string | undefined;
}): string {
  const items: string[] = [];

  if (timing !== undefined) {
    items.push(
      h({ tag: 'dt', text: 'TTFC', }),
      h({ tag: 'dd', text: formatMs(timing.timeToFirstChunkMs), }),
      h({ tag: 'dt', text: 'Total time', }),
      h({ tag: 'dd', text: formatMs(timing.totalMs), }),
      h({ tag: 'dt', text: 'Chunks', }),
      h({ tag: 'dd', text: formatNumber(timing.chunkCount), }),
    );
  }

  if (usage !== undefined) {
    items.push(
      h({ tag: 'dt', text: 'Prompt tokens', }),
      h({ tag: 'dd', text: formatNumber(usage.promptTokens), }),
      h({ tag: 'dt', text: 'Completion tokens', }),
      h({ tag: 'dd', text: formatNumber(usage.completionTokens), }),
    );
    if (usage.reasoningTokens !== undefined) {
      items.push(
        h({ tag: 'dt', text: 'Reasoning tokens', }),
        h({ tag: 'dd', text: formatNumber(usage.reasoningTokens), }),
      );
    }
    items.push(
      h({ tag: 'dt', text: 'Total tokens', }),
      h({ tag: 'dd', text: formatNumber(usage.totalTokens), }),
    );
  }

  if (finishReason !== undefined) {
    items.push(
      h({ tag: 'dt', text: 'Finish reason', }),
      h({ tag: 'dd', text: finishReason, }),
    );
  }

  if (items.length === 0) return '';

  return h({
    tag: 'details',
    class: 'collapsible-section',
    children: [
      h({ tag: 'summary', text: label, }),
      h({ tag: 'dl', class: 'metadata-grid', children: items, }),
    ],
  });
}

/**
 * Renders collapsible detail sections for reasoning, fix prompt, and config.
 * Sections with no data are omitted entirely.
 * @param detail - probe detail
 * @returns HTML string with `<details>` elements
 *
 * @example
 * ```ts
 * renderCollapsibles(detail);
 * // '<details class="collapsible-section">...'
 * ```
 */
export function renderCollapsibles(detail: ProbeDetail,): string {
  const sections: string[] = [];

  if (detail.reasoning !== undefined && detail.reasoning !== '') {
    sections.push(h({
      tag: 'details',
      class: 'collapsible-section',
      children: [
        h({ tag: 'summary', text: `Thinking (${formatNumber(detail.reasoning.length)} chars)`, }),
        h({ tag: 'div', class: 'rendered-markdown', html: micromark(detail.reasoning), }),
      ],
    }));
  }

  if (detail.initialResponse !== undefined && detail.initialResponse !== '') {
    sections.push(h({
      tag: 'details',
      class: 'collapsible-section',
      children: [
        h({ tag: 'summary', text: `Response (${formatNumber(detail.initialResponse.length)} chars)`, }),
        h({ tag: 'div', class: 'rendered-markdown', html: micromark(detail.initialResponse), }),
      ],
    }));
  }

  if (detail.fixReasoning !== undefined && detail.fixReasoning !== '') {
    sections.push(h({
      tag: 'details',
      class: 'collapsible-section',
      children: [
        h({ tag: 'summary', text: `Fix thinking (${formatNumber(detail.fixReasoning.length)} chars)`, }),
        h({ tag: 'div', class: 'rendered-markdown', html: micromark(detail.fixReasoning), }),
      ],
    }));
  }

  if (detail.fixResponse !== undefined && detail.fixResponse !== '') {
    sections.push(h({
      tag: 'details',
      class: 'collapsible-section',
      children: [
        h({ tag: 'summary', text: `Fix response (${formatNumber(detail.fixResponse.length)} chars)`, }),
        h({ tag: 'div', class: 'rendered-markdown', html: micromark(detail.fixResponse), }),
      ],
    }));
  }

  if (detail.fixPrompt !== undefined && detail.fixPrompt !== '') {
    sections.push(h({
      tag: 'details',
      class: 'collapsible-section',
      children: [
        h({ tag: 'summary', text: 'Fix prompt', }),
        h({ tag: 'div', class: 'rendered-markdown', html: micromark(detail.fixPrompt), }),
      ],
    }));
  }

  if (detail.config !== undefined) {
    sections.push(renderConfig(detail.config));
  }

  return sections.join('\n');
}

/**
 * Renders a collapsible config snapshot section.
 * @param config - runner configuration snapshot
 * @returns HTML `<details>` element
 */
function renderConfig(config: ConfigSnapshot,): string {
  return h({
    tag: 'details',
    class: 'collapsible-section',
    children: [
      h({ tag: 'summary', text: 'Config', }),
      h({
        tag: 'dl',
        class: 'metadata-grid',
        children: [
          h({ tag: 'dt', text: 'Verbosity', }),
          h({ tag: 'dd', text: config.verbosity, }),
          h({ tag: 'dt', text: 'Reasoning', }),
          h({ tag: 'dd', text: String(config.reasoning), }),
          h({ tag: 'dt', text: 'Max tokens', }),
          h({ tag: 'dd', text: formatNumber(config.maxTokens), }),
          h({ tag: 'dt', text: 'Consistency runs', }),
          h({ tag: 'dd', text: String(config.consistencyRuns), }),
        ],
      }),
    ],
  });
}
