/**
 * Shared formatting helpers for terminal title entries.
 *
 * @module
 */

import type {
  TenseLabels,
  ToolTitleTense,
} from './types.ts';

//region Lifecycle formatting helpers

/**
 * Joins lifecycle label and value for title text.
 *
 * @param labels - because title voice changes by lifecycle tense
 *
 * @param value - because extracted field value carries display context
 *
 * @param tense - because running and completed titles use different verbs
 *
 * @returns lifecycle title text
 *
 * @example
 * ```ts
 * lifecycleValueTitle({ labels: { pre: 'Reading', post: 'Read' }, value: 'src/index.ts', tense: 'pre' });
 * // 'Reading src/index.ts'
 * ```
 */
function lifecycleValueTitle(
  {
    labels,
    value,
    tense,
  }: Readonly<{
    labels: TenseLabels;
    value: string;
    tense: ToolTitleTense;
  }>,
): string {
  return `${labels[tense]} ${value}`;
}

/**
 * Default fallback labels for entries whose display value is missing.
 *
 * @param labels - because entries normally reuse lifecycle labels
 *
 * @param noun - because fallback text should name the missing object kind
 *
 * @returns fallback labels for missing fields
 *
 * @example
 * ```ts
 * missingValueFallback({ labels: { pre: 'Reading', post: 'Read' }, noun: 'file' });
 * ```
 */
function missingValueFallback(
  {
    labels,
    noun,
  }: Readonly<{
    labels: TenseLabels;
    noun: string;
  }>,
): TenseLabels {
  return {
    pre: `${labels.pre} ${noun}`,
    post: `${labels.post} ${noun}`,
  };
}

//endregion Lifecycle formatting helpers

export {
  lifecycleValueTitle,
  missingValueFallback,
};
