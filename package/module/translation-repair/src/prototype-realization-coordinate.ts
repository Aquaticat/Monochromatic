// PROTOTYPE ONLY: Candidate G UTF-16 coordinate construction.

import { hashContent, } from './document-node.ts';
import type { RealizationSourceSpan, } from './prototype-realization-model.ts';

//region Coordinate normalization

/**
 * Source punctuation ending one clause obligation.
 */
export const CLAUSE_TERMINALS: ReadonlySet<string> = new Set([
  '。',
  '！',
  '？',
  '；',
  '\n',
],);

/**
 * Normalizes CRLF and CR without regex or repeated accumulator rebuilding.
 */
export function normalizeRealizationLineEndings({ text, }: { readonly text: string; }): string {
  const output: string[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const character = text[cursor];
    if (character !== '\r') {
      if (character !== undefined)
        output.push(character,);
      cursor += 1;
      continue;
    }
    output.push('\n',);
    cursor += text[cursor + 1] === '\n' ? 2 : 1;
  }
  return output.join('',);
}

/**
 * Returns first non-whitespace UTF-16 position inside range.
 */
export function trimStart({
  text,
  startOffset,
  endOffset,
}: {
  readonly text: string;
  readonly startOffset: number;
  readonly endOffset: number;
}): number {
  let cursor = startOffset;
  while ((cursor < endOffset) && (text[cursor]
    ?.trim()
    === ''))
    cursor += 1;
  return cursor;
}

/**
 * Returns position after final non-whitespace UTF-16 unit inside range.
 */
export function trimEnd({
  text,
  startOffset,
  endOffset,
}: {
  readonly text: string;
  readonly startOffset: number;
  readonly endOffset: number;
}): number {
  let cursor = endOffset;
  while ((cursor > startOffset) && (text[cursor - 1]
    ?.trim()
    === ''))
    cursor -= 1;
  return cursor;
}

/**
 * Produces fixed-width stable identity within one obligation kind.
 */
export function numberedId({
  kind,
  index,
}: {
  readonly kind: 'clause' | 'relation';
  readonly index: number
}): string {
  return `${kind}-${String(index,)
    .padStart(
      3,
      '0',
    )}`;
}

/**
 * Creates source span whose digest binds exact normalized substring.
 */
export function sourceSpan({
  namespace,
  text,
  startOffset,
  endOffset,
}: {
  readonly namespace: RealizationSourceSpan['namespace'];
  readonly text: string;
  readonly startOffset: number;
  readonly endOffset: number;
}): RealizationSourceSpan {
  return {
    namespace,
    startOffset,
    endOffset,
    digest: hashContent({ content: text.slice(
      startOffset,
      endOffset,
    ), }),
  };
}

//endregion Coordinate normalization
