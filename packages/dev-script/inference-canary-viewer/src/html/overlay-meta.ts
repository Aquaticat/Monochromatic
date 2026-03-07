/**
 * Enriched metadata rendering helpers for probe detail overlays.
 *
 * Renders timing, usage, badges, reasoning traces, fix prompts, and config
 * as compact HTML sections within popover overlays.
 */
import { escapeHtml, } from '../chart/data-table.ts';

import type { ConfigSnapshot, StreamTiming, StreamUsage, } from '../data/viewer-types.ts';
import type { ProbeDetail, } from '../data/viewer-types.ts';

/** Milliseconds per second for display formatting */
const MS_PER_SECOND = 1000;

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
function formatMs(ms: number): string {
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
function formatNumber(num: number): string {
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
 * // '<div class="overlay-badges">...'
 * ```
 */
export function renderBadges(detail: ProbeDetail): string {
  const badges: string[] = [];

  if (detail.partial === true) {
    badges.push('<span class="badge badge--partial">partial</span>');
  }
  if (detail.error !== undefined && detail.error !== '') {
    badges.push(`<span class="badge badge--error">${escapeHtml(detail.error)}</span>`);
  }
  if (detail.finishReason !== undefined && detail.finishReason !== 'stop') {
    badges.push(`<span class="badge badge--finish">${escapeHtml(detail.finishReason)}</span>`);
  }

  if (badges.length === 0) return '';
  return `<div class="overlay-badges">${badges.join('\n')}</div>`;
}

/**
 * Renders a compact metadata grid for one pass (initial or fix).
 * Shows timing and token usage as a collapsed `<details>` element.
 * @param label - section label ("Initial pass" or "Fix pass")
 * @param timing - streaming timing data
 * @param usage - token usage data
 * @param finishReason - why generation stopped
 * @returns HTML string, empty when no data is available
 *
 * @example
 * ```ts
 * renderPassMeta('Initial pass', timing, usage, 'stop');
 * // '<details class="overlay-details"><summary>Initial pass</summary><dl ...>...'
 * ```
 */
export function renderPassMeta(
  label: string,
  timing: StreamTiming | undefined,
  usage: StreamUsage | undefined,
  finishReason: string | undefined,
): string {
  const items: string[] = [];

  if (timing !== undefined) {
    items.push(`<dt>TTFC</dt><dd>${formatMs(timing.timeToFirstChunkMs)}</dd>`);
    items.push(`<dt>Total time</dt><dd>${formatMs(timing.totalMs)}</dd>`);
    items.push(`<dt>Chunks</dt><dd>${formatNumber(timing.chunkCount)}</dd>`);
  }

  if (usage !== undefined) {
    items.push(`<dt>Prompt tokens</dt><dd>${formatNumber(usage.promptTokens)}</dd>`);
    items.push(`<dt>Completion tokens</dt><dd>${formatNumber(usage.completionTokens)}</dd>`);
    if (usage.reasoningTokens !== undefined) {
      items.push(`<dt>Reasoning tokens</dt><dd>${formatNumber(usage.reasoningTokens)}</dd>`);
    }
    items.push(`<dt>Total tokens</dt><dd>${formatNumber(usage.totalTokens)}</dd>`);
  }

  if (finishReason !== undefined) {
    items.push(`<dt>Finish reason</dt><dd>${escapeHtml(finishReason)}</dd>`);
  }

  if (items.length === 0) return '';

  return `<details class="overlay-details">
  <summary>${escapeHtml(label)}</summary>
  <dl class="overlay-meta">${items.join('\n')}</dl>
</details>`;
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
 * // '<details class="overlay-details">...'
 * ```
 */
export function renderCollapsibles(detail: ProbeDetail): string {
  const sections: string[] = [];

  if (detail.reasoning !== undefined && detail.reasoning !== '') {
    sections.push(`<details class="overlay-details">
  <summary>Thinking (${formatNumber(detail.reasoning.length)} chars)</summary>
  <pre class="overlay-pre">${escapeHtml(detail.reasoning)}</pre>
</details>`);
  }

  if (detail.initialResponse !== undefined && detail.initialResponse !== '') {
    sections.push(`<details class="overlay-details">
  <summary>Response (${formatNumber(detail.initialResponse.length)} chars)</summary>
  <pre class="overlay-pre">${escapeHtml(detail.initialResponse)}</pre>
</details>`);
  }

  if (detail.fixReasoning !== undefined && detail.fixReasoning !== '') {
    sections.push(`<details class="overlay-details">
  <summary>Fix thinking (${formatNumber(detail.fixReasoning.length)} chars)</summary>
  <pre class="overlay-pre">${escapeHtml(detail.fixReasoning)}</pre>
</details>`);
  }

  if (detail.fixResponse !== undefined && detail.fixResponse !== '') {
    sections.push(`<details class="overlay-details">
  <summary>Fix response (${formatNumber(detail.fixResponse.length)} chars)</summary>
  <pre class="overlay-pre">${escapeHtml(detail.fixResponse)}</pre>
</details>`);
  }

  if (detail.fixPrompt !== undefined && detail.fixPrompt !== '') {
    sections.push(`<details class="overlay-details">
  <summary>Fix prompt</summary>
  <pre class="overlay-pre">${escapeHtml(detail.fixPrompt)}</pre>
</details>`);
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
function renderConfig(config: ConfigSnapshot): string {
  return `<details class="overlay-details">
  <summary>Config</summary>
  <dl class="overlay-meta">
    <dt>Verbosity</dt><dd>${escapeHtml(config.verbosity)}</dd>
    <dt>Reasoning</dt><dd>${String(config.reasoning)}</dd>
    <dt>Max tokens</dt><dd>${formatNumber(config.maxTokens)}</dd>
    <dt>Consistency runs</dt><dd>${String(config.consistencyRuns)}</dd>
  </dl>
</details>`;
}
