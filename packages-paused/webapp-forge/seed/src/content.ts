/**
 * Synthetic-content helpers: realistic-looking but deterministic title
 * and body strings.
 */

import {
  rngInt,
  rngPick,
} from './rng.ts';

/**
 * Lorem-style word pool used to compose synthetic bodies.
 */
const WORD_POOL = (
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor '
  + 'incididunt ut labore magna aliqua enim minim veniam quis nostrud exercitation '
    + 'ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in '
    + 'reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint'
)
  .split(' ',);

/**
 * Common bug-tracker title prefixes.
 */
const TITLE_PREFIXES = [
  'Bug:',
  'Feature:',
  'Question:',
  'Docs:',
  'Refactor:',
  'Perf:',
] as const;

/**
 * Builds a deterministic title.
 *
 * @param seed - rng seed
 *
 * @returns synthetic title
 *
 * @example
 * ```ts
 * const title = synthesizeTitle(42);
 * ```
 */
export function synthesizeTitle(seed: number,): string {
  /**
   * Title prefix sampled from the bug-tracker palette, defaulted when picking fails.
   */
  const prefix = rngPick({
    seed,
    items: TITLE_PREFIXES,
  },)
    ?? 'Issue:';
  /**
   * Title word count drawn from the seed; bounds the per-word picking loop.
   */
  const wordCount = rngInt({
    seed: seed + 1,
    lo: 4,
    hi: 10,
  },);
  /**
   * Collected title words assembled into the returned string.
   */
  const words: string[] = [];
  for (let i = 0; i < wordCount; i += 1) {
    /**
     * Per-word pick from the lorem pool; defaulted when picking fails.
     */
    const picked = rngPick({
      seed: seed + 2
        + i,
      items: WORD_POOL,
    },)
      ?? 'item';
    words.push(picked,);
  }
  return `${prefix} ${words.join(' ',)}`;
}

/**
 * Builds a deterministic multi-paragraph body of approximately the
 * requested word count.
 *
 * @param row - rng seed and target word count
 *
 * @returns synthetic body string
 *
 * @example
 * ```ts
 * const body = synthesizeBody({ seed: 42, targetWordCount: 50 });
 * ```
 */
export function synthesizeBody(row: {
  seed: number;
  targetWordCount: number;
},): string {
  /**
   * Recursively assembles paragraph strings until the running word total
   * reaches the requested target. Threads the rolling seed cursor through
   * the call chain so neither piece of state needs a function-root let.
   *
   * @param state - remaining word budget and the rolling seed cursor
   *
   * @returns paragraph strings collected in chronological order
   *
   * @example
   * ```ts
   * buildParagraphs({ remaining: 50, cursor: 42 }); // ['lorem ipsum dolor sit amet.', 'consectetur ...']
   * ```
   */
  function buildParagraphs(state: {
    remaining: number;
    cursor: number;
  },): readonly string[] {
    if (state.remaining
      <= 0)
      return [];
    /**
     * Paragraph length capped by remaining so the body never overshoots the target.
     */
    const paragraphLength = Math.min(
      state.remaining,
      rngInt({
        seed: state.cursor,
        lo: 8,
        hi: 60,
      },),
    );
    /**
     * Collected paragraph words assembled before joining onto the paragraph list.
     */
    const words: string[] = [];
    for (let i = 0; i < paragraphLength; i += 1) {
      /**
       * Per-word pick from the lorem pool; defaulted when picking fails.
       */
      const picked = rngPick({
        seed: state.cursor
          + 1
          + i,
        items: WORD_POOL,
      },)
        ?? 'item';
      words.push(picked,);
    }
    return [
      `${words.join(' ',)}.`,
      ...buildParagraphs({
        remaining: state.remaining
          - paragraphLength,
        cursor: state.cursor
          + paragraphLength
          + 1,
      },),
    ];
  }
  /**
   * Collected paragraph strings joined with blank lines for the returned body.
   */
  const paragraphs = buildParagraphs({
    remaining: row.targetWordCount,
    cursor: row.seed,
  },);
  return paragraphs.join('\n\n',);
}
