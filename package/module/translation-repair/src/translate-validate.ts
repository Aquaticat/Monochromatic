import type { ProtectedAtom, } from './protected-atom.ts';
import {
  type BlockShape,
  readSliceSkeleton,
  type SliceSkeleton,
} from './translate-skeleton.ts';

//region Translate validation
// Compares a candidate translation against its ORIGINAL on everything that
// survives translation: the block skeleton, and the references and code inside
// it.
//
// This exists because the deterministic apply gate cannot serve here. Every
// policy in that gate is anchored to an EDIT bounded by an envelope some
// accepted issue named, and a whole-slice replacement has no envelope. Faking
// one that spans the slice fails in both directions: with no licensed quotes
// the preservation rule rejects nearly every legitimate translation, and
// licensing the whole envelope makes it vacuous.
//
// FINDINGS ARE WRITTEN FOR THE MODEL THAT WROTE THE CANDIDATE, not for a log.
// By user decision of 2026-08-14 an invalid candidate is not dropped: it goes
// back to its own author with these sentences, and that model answers with a
// revision, an inability, or a defence of what it produced. So each finding
// names what the original has, what the candidate has, and nothing else.

/**
 * What comparing a candidate against its original found.
 *
 * @example
 * ```ts
 * const validation: SliceValidation = { kind: 'valid', };
 * ```
 */
export type SliceValidation =
  | { readonly kind: 'valid'; }
  | {
    readonly kind: 'invalid';

    /**
     * One sentence per divergence, addressed to the model that wrote the
     * candidate.
     */
    readonly findings: readonly string[];
  }
  | {
    readonly kind: 'unknown';

    /**
     * Why no comparison was possible.
     */
    readonly detail: string;
  };

/**
 * Renders one block for a finding.
 *
 * @param shape - block to describe
 *
 * @returns Kind with its distinguishing detail
 *
 * @example
 * ```ts
 * const label = describeBlock({ kind: 'heading', detail: 'level 2', },);
 * ```
 */
function describeBlock(shape: BlockShape,): string {
  return (shape.detail === '') ? shape.kind : `${shape.kind} (${shape.detail})`;
}

/**
 * Renders a block sequence for a finding.
 *
 * @param blocks - blocks in document order
 *
 * @returns Comma-separated description, or a word for none
 *
 * @example
 * ```ts
 * const label = describeBlocks({ blocks, },);
 * ```
 */
function describeBlocks({ blocks, }: { readonly blocks: readonly BlockShape[]; },): string {
  if (blocks.length === 0)
    return 'nothing';
  return blocks.map(describeBlock,)
    .join(', ',);
}

/**
 * Renders one atom for a finding.
 *
 * @param atom - atom to describe
 *
 * @returns Kind and value
 *
 * @example
 * ```ts
 * const label = describeAtom({ kind: 'footnote', value: '1', },);
 * ```
 */
function describeAtom(atom: ProtectedAtom,): string {
  return `${atom.kind} ${atom.value}`;
}

/**
 * Findings for atoms one side carries and the other does not.
 *
 * Compared as a MULTISET rather than in order, because a translation reorders
 * clauses legitimately and a link moving within a sentence is not damage. What
 * is damage is a reference that stopped existing or one that appeared from
 * nowhere, and both survive reordering.
 *
 * @param source - atoms the original carries
 *
 * @param candidate - atoms the candidate carries
 *
 * @param referenceName - what the findings call the side being matched
 *
 * @returns One finding per missing or invented atom
 *
 * @example
 * ```ts
 * const findings = compareAtoms({ source, candidate, referenceName, },);
 * ```
 */
function compareAtoms(
  {
    source,
    candidate,
    referenceName,
  }: {
    readonly source: readonly ProtectedAtom[];
    readonly candidate: readonly ProtectedAtom[];
    readonly referenceName: string;
  },
): readonly string[] {
  /**
   * How many times the candidate carries each atom.
   */
  const remaining = new Map<string, number>();
  for (const atom of candidate) {
    /**
     * Key identifying this atom exactly.
     */
    const key = describeAtom(atom,);
    remaining.set(
      key,
      (remaining.get(key,) ?? 0) + 1,
    );
  }

  /**
   * Atoms the original has that the candidate did not carry through.
   */
  const missing: string[] = [];
  for (const atom of source) {
    /**
     * Key identifying this atom exactly.
     */
    const key = describeAtom(atom,);

    /**
     * Copies still unaccounted for on the candidate side.
     */
    const left = remaining.get(key,) ?? 0;
    if (left === 0) {
      missing.push(
        `The ${referenceName} carries ${key} and your translation does not.`,
      );
      continue;
    }
    remaining.set(
      key,
      left - 1,
    );
  }

  return [
    ...missing,
    ...[...remaining.entries(),]
      .filter(function isSurplus([, count,],): boolean {
        return count > 0;
      },)
      .map(function toFinding([key, count,],): string {
        return `Your translation carries ${key}${
          count === 1 ? '' : ` ${String(count,)} times`
        } and the ${referenceName} does not.`;
      },),
  ];
}

/**
 * Findings for a block skeleton that does not match the original's.
 *
 * @param source - original's blocks
 *
 * @param candidate - candidate's blocks
 *
 * @param referenceName - what the findings call the side being matched
 *
 * @returns One finding when the sequences differ, none when they match
 *
 * @example
 * ```ts
 * const findings = compareBlocks({ source, candidate, referenceName, },);
 * ```
 */
function compareBlocks(
  {
    source,
    candidate,
    referenceName,
  }: {
    readonly source: readonly BlockShape[];
    readonly candidate: readonly BlockShape[];
    readonly referenceName: string;
  },
): readonly string[] {
  /**
   * Whether both sides describe the same sequence.
   */
  const matches = (source.length === candidate.length)
    && source.every(function samePosition(
      shape,
      index,
    ): boolean {
      /**
       * Candidate's block at the same position.
       */
      const other = candidate[index];
      return (other !== undefined)
        && (other.kind === shape.kind)
        && (other.detail === shape.detail);
    },);
  if (matches)
    return [];
  return [
    `The ${referenceName} is ${String(source.length,)} block${
      source.length === 1 ? '' : 's'
    } (${describeBlocks({ blocks: source, },)}) and your translation is ${
      String(candidate.length,)
    } (${describeBlocks({ blocks: candidate, },)}). Match it block for `
      + 'block, of the same kinds, in the same order.',
  ];
}

/**
 * Checks one candidate translation against the original it renders.
 *
 * @param sourceText - original slice
 *
 * @param candidateText - proposed translation of it
 *
 * @param referenceName - what the findings call `sourceText`, since a caller
 * may be matching a candidate against the page as it stands rather than against
 * the original. Naming it wrongly tells the model that wrote the candidate
 * something untrue about the text it is being asked to match
 *
 * @returns Verdict, with findings written for the model that wrote it
 *
 * @example
 * ```ts
 * const validation = validateTranslatedSlice({ sourceText, candidateText, },);
 * ```
 */
export function validateTranslatedSlice(
  {
    sourceText,
    candidateText,
    referenceName = 'ORIGINAL',
  }: {
    readonly sourceText: string;
    readonly candidateText: string;
    readonly referenceName?: string;
  },
): SliceValidation {
  /**
   * Shape the original carries.
   */
  const source = readSliceSkeleton({ text: sourceText, },);

  // An original the strict grammar refuses is not a candidate's fault, and
  // there is nothing to compare against. Document parsing has a plain-markdown
  // fallback for exactly this, so a slice can reach here that no skeleton can
  // be read from, and inventing a comparison across two grammars would
  // manufacture findings rather than find any.
  if (source.kind === 'unparseable')
    return {
      kind: 'unknown',
      detail: `${referenceName.toLowerCase()} could not be read: ${source.detail}`,
    };

  /**
   * Shape the candidate carries.
   */
  const candidate = readSliceSkeleton({ text: candidateText, },);
  if (candidate.kind === 'unparseable')
    return {
      kind: 'invalid',
      findings: [
        `Your translation could not be parsed as Markdown: ${candidate.detail}`,
      ],
    };

  /**
   * Original's shape, now known readable.
   */
  const expected: SliceSkeleton = source.skeleton;

  /**
   * Candidate's shape, now known readable.
   */
  const actual: SliceSkeleton = candidate.skeleton;

  /**
   * Every divergence, structure first because a reference finding reads
   * differently once the blocks it sits in are known to differ.
   */
  const findings = [
    ...compareBlocks({
      source: expected.blocks,
      candidate: actual.blocks,
      referenceName,
    },),
    ...compareAtoms({
      source: expected.atoms,
      candidate: actual.atoms,
      referenceName,
    },),
  ];
  if (findings.length === 0)
    return { kind: 'valid', };
  return {
    kind: 'invalid',
    findings,
  };
}

//endregion Translate validation
