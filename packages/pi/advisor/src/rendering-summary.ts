/**
 * Plain-text rendering helpers for Advisor output.
 *
 * @module
 */

import type { Theme, } from '@earendil-works/pi-coding-agent';
import { ADVISOR_TOOL_NAME, } from './constants.ts';
import type { AdvisorDetails, } from './types.ts';

/** Milliseconds in one second for duration formatting. */
const MILLISECONDS_PER_SECOND = 1_000;

//region Public helpers

/**
 * Render Advisor result into a plain string for TUI Text components and tests.
 *
 * @param text - full Advisor text
 *
 * @param details - structured Advisor details
 *
 * @param expanded - whether full text should be shown
 *
 * @param theme - current pi theme
 *
 * @returns rendered text
 *
 * @example
 * ```typescript
 * renderAdvisorSummary({ text, details, expanded: false, theme });
 * ```
 */
export function renderAdvisorSummary(
  {
    text,
    details,
    expanded,
    theme,
  }: {
    text: string;
    details: AdvisorDetails;
    expanded: boolean;
    theme: Theme;
  },
): string {
  /** Header line with model and duration metadata. */
  const header = formatHeader({
    details,
    theme,
  },);
  if (expanded)
    return `${header}\n\n${text}`;

  /** First advisory line for collapsed rendering. */
  const firstLine = firstAdvisoryLine(text,);
  /** Styled first advisory line. */
  const styledFirstLine = theme.fg(
    'toolOutput',
    firstLine,
  );
  return `${header}\n${styledFirstLine}`;
}

/**
 * Extract first non-empty Advisor text line.
 *
 * @param text - full Advisor text
 *
 * @returns first non-empty line or fallback
 *
 * @example
 * ```typescript
 * firstAdvisoryLine('\nLooks good');
 * ```
 */
export function firstAdvisoryLine(
  text: string,
): string {
  return text
    .split('\n',)
    .map(function trimLine(line,) {
      return line.trim();
    },)
    .find(function keepLine(line,) {
      return line !== '';
    },) ?? '(advisor returned no text)';
}

/**
 * Runtime guard for Advisor details.
 *
 * @param value - value to inspect
 *
 * @returns whether value is Advisor details
 *
 * @example
 * ```typescript
 * isAdvisorDetails({ selectedSlug: 'p/m' });
 * ```
 */
export function isAdvisorDetails(
  value: unknown,
): value is AdvisorDetails {
  if ((value === null) || ((typeof value) !== 'object'))
    return false;
  return ('selectedSlug' in value)
    && ((typeof value.selectedSlug) === 'string')
    && ('provider' in value)
    && ((typeof value.provider) === 'string')
    && ('scopeSource' in value)
    && ((typeof value.scopeSource) === 'string')
    && ('scopedSlugs' in value)
    && Array.isArray(value.scopedSlugs,)
    && ('durationMs' in value)
    && ((typeof value.durationMs) === 'number')
    && ('contextBudgetChars' in value)
    && ((typeof value.contextBudgetChars) === 'number')
    && ('contextChars' in value)
    && ((typeof value.contextChars) === 'number')
    && ('estimatedInputTokens' in value)
    && ((typeof value.estimatedInputTokens) === 'number')
    && ('truncated' in value)
    && ((typeof value.truncated) === 'boolean')
    && ('stopReason' in value)
    && ((typeof value.stopReason) === 'string');
}

/**
 * Build fallback details for malformed custom messages.
 *
 * @returns fallback Advisor details
 *
 * @example
 * ```typescript
 * fallbackDetails();
 * ```
 */
export function fallbackDetails(): AdvisorDetails {
  return {
    selectedSlug: 'unknown/unknown',
    provider: 'unknown',
    scopeSource: 'available',
    scopedSlugs: [],
    durationMs: 0,
    contextBudgetChars: 0,
    contextChars: 0,
    estimatedInputTokens: 0,
    truncated: false,
    stopReason: 'stop',
  };
}

//endregion Public helpers

//region Internal helpers

/**
 * Format Advisor result header.
 *
 * @param details - Advisor result details
 *
 * @param theme - current pi theme
 *
 * @returns styled header text
 */
function formatHeader(
  {
    details,
    theme,
  }: {
    details: AdvisorDetails;
    theme: Theme;
  },
): string {
  /** Styled tool name. */
  const title = theme.fg(
    'toolTitle',
    theme.bold(ADVISOR_TOOL_NAME,),
  );
  /** Styled selected model. */
  const model = theme.fg(
    'accent',
    details.selectedSlug,
  );
  /** Styled metadata. */
  const metadata = theme.fg(
    'dim',
    `${formatDuration(details.durationMs,)} ${formatContext(details,)}`,
  );
  return `${title} ${model} ${metadata}`;
}

/**
 * Format elapsed milliseconds.
 *
 * @param durationMs - elapsed milliseconds
 *
 * @returns human-readable duration
 */
function formatDuration(
  durationMs: number,
): string {
  return durationMs < MILLISECONDS_PER_SECOND
    ? `${durationMs}ms`
    : `${(durationMs / MILLISECONDS_PER_SECOND).toFixed(1,)}s`;
}

/**
 * Format context metadata.
 *
 * @param details - Advisor result details
 *
 * @returns context metadata summary
 */
function formatContext(
  details: AdvisorDetails,
): string {
  /** Truncation marker for concise output. */
  const truncated = details.truncated ? 'truncated' : 'full';
  return [
    `${details.provider} ${details.contextChars}/${details.contextBudgetChars} chars`,
    `${details.estimatedInputTokens} tokens`,
    truncated,
  ]
    .join(' ',);
}

//endregion Internal helpers
