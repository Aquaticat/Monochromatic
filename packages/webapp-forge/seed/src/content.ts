/**
 * Synthetic-content helpers: realistic-looking but deterministic title
 * and body strings.
 */

import {
  rngInt,
  rngPick,
} from './rng.ts';

/** Lorem-style word pool used to compose synthetic bodies. */
const WORD_POOL = (
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor '
  + 'incididunt ut labore magna aliqua enim minim veniam quis nostrud exercitation '
  + 'ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in '
  + 'reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint'
).split(' ',);

/** Common bug-tracker title prefixes. */
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
  const prefix = rngPick({
    seed,
    items: TITLE_PREFIXES,
  },) ?? 'Issue:';
  const wordCount = rngInt({
    seed: seed + 1,
    lo: 4,
    hi: 10,
  },);
  const words: string[] = [];
  for (let i = 0; i < wordCount; i += 1) {
    const picked = rngPick({
      seed: seed + 2 + i,
      items: WORD_POOL,
    },) ?? 'item';
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
  const paragraphs: string[] = [];
  let writtenWords = 0;
  let cursor = row.seed;
  while (writtenWords < row.targetWordCount) {
    const remaining = row.targetWordCount - writtenWords;
    const paragraphLength = Math.min(
      remaining,
      rngInt({
        seed: cursor,
        lo: 8,
        hi: 60,
      },),
    );
    const words: string[] = [];
    for (let i = 0; i < paragraphLength; i += 1) {
      const picked = rngPick({
        seed: cursor + 1 + i,
        items: WORD_POOL,
      },) ?? 'item';
      words.push(picked,);
    }
    paragraphs.push(`${words.join(' ',)}.`,);
    writtenWords += paragraphLength;
    cursor += paragraphLength + 1;
  }
  return paragraphs.join('\n\n',);
}
