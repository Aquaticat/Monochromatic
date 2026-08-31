// PROTOTYPE ONLY: Candidate I target-derived separator compilation.

import {
  type ImmutableShell,
  MAX_COMPILED_DOCUMENT_CHARACTERS,
  type SlotDocumentResponse,
} from './prototype-slot-model.ts';
import {
  assertTargetBoundariesBindShell,
  type CandidateBallotCompilation,
  type CandidateTargetBoundary,
  type ResolvedCandidateTargetBoundary,
} from './prototype-target-boundary.ts';

/**
 * Characters attaching to prior inline syntax without English space.
 */
const LEADING_PUNCTUATION = '.,;:!?，。！？；：、)]}»”’';

/**
 * Characters attaching to following inline syntax without English space.
 */
const TRAILING_PUNCTUATION = '([{«“‘';

/**
 * Resolves English separator from sanitized target text and syntax role.
 *
 * @returns Exact candidate-specific separator
 */
function resolvedSeparator({
  boundary,
  targetText,
}: {
  readonly boundary: CandidateTargetBoundary;
  readonly targetText: string;
}): ResolvedCandidateTargetBoundary['separator'] {
  /**
   * Sanitized target text without model-authored outer whitespace.
   */
  const trimmed = targetText.trim();
  if (boundary.edge === 'before') {
    /**
     * First target character deciding punctuation attachment.
     */
    const first = trimmed.charAt(0,);
    return (first !== '') && LEADING_PUNCTUATION.includes(first,) ? '' : ' ';
  }
  if (boundary.syntaxRole === 'footnote')
    return '';
  /**
   * Final target character deciding opening-syntax attachment.
   */
  const final = trimmed.at(-1,);
  return (final !== undefined) && TRAILING_PUNCTUATION.includes(final,) ? '' : ' ';
}

/**
 * Escapes model prose while retaining exact character sequence.
 *
 * @returns Markdown-safe model text
 */
function escapeCandidateText({ text, }: { readonly text: string }): string {
  /**
   * Markdown controls requiring literal escaping in text slot.
   */
  const controls = new Set([
    '\\',
    '`',
    '*',
    '_',
    '{',
    '}',
    '[',
    ']',
    '<',
    '>',
  ],);
  /**
   * Trimmed target text.
   */
  const trimmed = text.trim();
  return (function scan(): string {
    /**
     * Escaped output fragments.
     */
    const output: string[] = [];
    /**
     * UTF-16 cursor, exact because controls are ASCII.
     */
    let cursor = 0;
    while (cursor < trimmed.length) {
      /**
       * Current UTF-16 unit.
       */
      const character = trimmed[cursor] ?? '';
      if ((character === '\n') || (character === '\r'))
        output.push(' ',);
      else {
        if (controls.has(character,))
          output.push('\\',);
        output.push(character,);
      }
      cursor += 1;
    }
    return output.join('');
  })();
}

/**
 * Compiles raw slots with target-derived separators before candidate hashing.
 *
 * @returns Complete document, compiled anchor slots, and exact resolutions
 *
 * @example
 * ```ts
 * const compiled = compileCandidateBallotCandidate({ shell, response, boundaries, });
 * ```
 */
export function compileCandidateBallotCandidate({
  shell,
  response,
  boundaries,
}: {
  readonly shell: ImmutableShell;
  readonly response: SlotDocumentResponse;
  readonly boundaries: readonly CandidateTargetBoundary[];
}): CandidateBallotCompilation {
  assertTargetBoundariesBindShell({
    shell,
    boundaries,
  });
  /**
   * Exact candidate-specific separator resolutions.
   */
  const resolvedBoundaries = boundaries.map(function resolve(
    boundary,
  ): ResolvedCandidateTargetBoundary {
    /**
     * Raw target slot used only for deterministic punctuation decision.
     */
    const targetText = response.slots[boundary.slotKey];
    if (targetText === undefined)
      throw new Error(`candidate target boundary slot ${boundary.slotKey} is absent`);
    return {
      ...boundary,
      separator: resolvedSeparator({
        boundary,
        targetText,
      }),
    };
  },);
  /**
   * Runtime-owned compiled text for every anchorable slot.
   */
  const slots = Object.fromEntries(shell.slots
    .map(function compiled(slot,) {
    /**
     * Raw model text.
     */
    const value = response.slots[slot.key];
    if (value === undefined)
      throw new Error(`candidate ballot slot ${slot.key} is absent`);
    /**
     * Runtime separator before escaped target.
     */
    const before = resolvedBoundaries.find(function relation(boundary,) {
      return (boundary.slotKey === slot.key) && (boundary.edge === 'before');
    },)
      ?.separator
      ?? '';
    /**
     * Runtime separator after escaped target.
     */
    const after = resolvedBoundaries.find(function relation(boundary,) {
      return (boundary.slotKey === slot.key) && (boundary.edge === 'after');
    },)
      ?.separator
      ?? '';
    /**
     * Markdown-safe target text.
     */
    const escaped = escapeCandidateText({ text: value, });
    if (escaped === '')
      throw new Error(`candidate ballot slot ${slot.key} is empty`);
    return [
      slot.key,
      `${before}${escaped}${after}`,
    ];
  },),);
  /**
   * Body with compiled slot segments inserted in reverse source order.
   */
  const body = shell.slots
    .toReversed()
    .reduce(
      function replace(
        current,
        slot,
      ) {
    /**
     * Runtime-owned complete segment for current slot.
     */
    const value = slots[slot.key];
    if (value === undefined)
      throw new Error(`candidate ballot compiled slot ${slot.key} is absent`);
    return `${current.slice(
      0,
      slot.startOffset
    )}${value}${current.slice(slot.endOffset)}`;
  },
      shell.body,
    );
  /**
   * Complete publication candidate.
   */
  const document = `${shell.frontMatter}${body}`;
  if (document.length > MAX_COMPILED_DOCUMENT_CHARACTERS)
    throw new Error('candidate ballot compiled document exceeds envelope');
  return {
    document,
    slots,
    resolvedBoundaries,
  };
}

/**
 * Compiles complete post-boundary document for direct consumer probes.
 *
 * @returns Complete publication candidate
 *
 * @example
 * ```ts
 * const document = compileCandidateBallotDocument({ shell, response, boundaries, });
 * ```
 */
export function compileCandidateBallotDocument({
  shell,
  response,
  boundaries,
}: {
  readonly shell: ImmutableShell;
  readonly response: SlotDocumentResponse;
  readonly boundaries: readonly CandidateTargetBoundary[];
}): string {
  return compileCandidateBallotCandidate({
    shell,
    response,
    boundaries,
  })
    .document;
}
