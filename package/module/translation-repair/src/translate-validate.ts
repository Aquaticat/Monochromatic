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
 * Whether one block sequence appears inside another, in order.
 *
 * MATCHED BY KIND AND DETAIL, so a heading of another level does not stand in
 * for the one the page carries.
 *
 * @param floor - sequence that has to appear
 *
 * @param candidate - sequence to look for it in
 *
 * @returns Whether every block of `floor` was found, in order
 *
 * @example
 * ```ts
 * const held = appearsInOrder({ floor, candidate, },);
 * ```
 */
function appearsInOrder(
  {
    floor,
    candidate,
  }: {
    readonly floor: readonly BlockShape[];
    readonly candidate: readonly BlockShape[];
  },
): boolean {
  /**
   * How far into `floor` the candidate got.
   */
  const matched = candidate.reduce(
    function advance(
      cursor: number,
      shape: BlockShape,
    ): number {
      /**
       * Block the floor wants next, absent once the whole floor is matched.
       */
      const wanted = floor[cursor];

      /**
       * Whether this block is the one the floor wants next.
       */
      const wantedMatches = (wanted !== undefined)
        && (wanted.kind === shape.kind)
        && (wanted.detail === shape.detail);
      return wantedMatches ? cursor + 1 : cursor;
    },
    0,
  );
  return matched >= floor.length;
}

/**
 * Findings for a block skeleton that does not carry the floor's.
 *
 * THE PAGE IS A FLOOR, NOT A CEILING, and two references are why. Measured over
 * 68 settled slice records, the archive and the Chinese carry the same block
 * sequence at 48, the archive carries more at 11 and fewer at 7, and those
 * seven are two different things: an archive that MERGED Chinese paragraphs
 * into a better shape, and an archive simply MISSING blocks the Chinese
 * carries. Anchoring to either alone breaks the other case, so a candidate has
 * to carry the floor's blocks and may add one only where the Chinese has more.
 *
 * WITH THE ORIGINAL AS THE FLOOR THIS IS TODAY'S EXACT MATCH. A floor of the
 * original with a ceiling of the original's own length admits one sequence, the
 * original's.
 *
 * @param floor - blocks the candidate has to carry, the page's where there is
 * one and the original's where there is not
 *
 * @param floorName - what a finding calls that sequence
 *
 * @param source - original's blocks, which set the ceiling with the floor
 *
 * @param candidate - candidate's blocks
 *
 * @returns One finding per rule the candidate's shape breaks
 *
 * @example
 * ```ts
 * const findings = compareBlocks({ floor, floorName, source, candidate, },);
 * ```
 */
function compareBlocks(
  {
    floor,
    floorName,
    source,
    candidate,
  }: {
    readonly floor: readonly BlockShape[];
    readonly floorName: string;
    readonly source: readonly BlockShape[];
    readonly candidate: readonly BlockShape[];
  },
): readonly string[] {
  /**
   * Most blocks any reference asks for.
   */
  const ceiling = Math.max(
    floor.length,
    source.length,
  );

  /**
   * Finding for a candidate the floor is not inside.
   */
  const missing = appearsInOrder({
      floor,
      candidate,
    },)
    ? []
    : [
      `The ${floorName} is ${String(floor.length,)} block${
        floor.length === 1 ? '' : 's'
      } (${describeBlocks({ blocks: floor, },)}) and your translation is ${
        String(candidate.length,)
      } (${describeBlocks({ blocks: candidate, },)}). Every block of the ${floorName} `
        + 'has to appear in your translation, of the same kind and in the same order.',
    ];

  /**
   * Finding for a candidate carrying more blocks than anything asks for.
   */
  const surplus = (candidate.length <= ceiling)
    ? []
    : [
      `Your translation is ${String(candidate.length,)} blocks (${
        describeBlocks({ blocks: candidate, },)
      }) and the ${floorName} is ${String(floor.length,)}. Add a block only to `
        + 'carry something the ORIGINAL has and the text you are replacing left out.',
    ];

  return [
    ...missing,
    ...surplus,
  ];
}

/**
 * One atom and how many copies of it a side carries.
 *
 * @example
 * ```ts
 * const tally: AtomTally = { atom, count: 2, };
 * ```
 */
type AtomTally = {
  /**
   * Atom itself, kept so a finding can describe it.
   */
  readonly atom: ProtectedAtom;

  /**
   * Copies carried.
   */
  readonly count: number;
};

/**
 * How many times each atom appears, keyed by its exact description.
 *
 * @param atoms - atoms one side carries
 *
 * @returns One entry per distinct atom, carrying it and its count
 *
 * @example
 * ```ts
 * const counted = countAtoms({ atoms, },);
 * ```
 */
function countAtoms(
  { atoms, }: { readonly atoms: readonly ProtectedAtom[]; },
): ReadonlyMap<string, AtomTally> {
  return atoms.reduce(
    function tally(
      seen: Map<string, AtomTally>,
      atom: ProtectedAtom,
    ): Map<string, AtomTally> {
      /**
       * Key identifying this atom exactly.
       */
      const key = describeAtom(atom,);

      /**
       * What this atom has been counted at so far.
       */
      const counted = seen.get(key,);

      /**
       * Copies before this one.
       */
      const before = (counted === undefined) ? 0 : counted.count;
      seen.set(
        key,
        {
          atom,
          count: before + 1,
        },
      );
      return seen;
    },
    new Map<string, AtomTally>(),
  );
}

/**
 * Atoms a candidate owes, taking whichever reference asks for more of each.
 *
 * WHY THE LARGER DEMAND WINS. A footnote the archive added and the Chinese
 * never had is accurate detail a reader benefits from, and one the archive
 * dropped is exactly what this pipeline exists to restore. Taking the union
 * keeps both without letting either side alone forbid the other.
 *
 * @param page - atoms the text being replaced carries, empty where none
 *
 * @param source - atoms the original carries
 *
 * @returns Atoms with the higher of the two demands, one entry per copy
 *
 * @example
 * ```ts
 * const owed = mergeAtoms({ page, source, },);
 * ```
 */
function mergeAtoms(
  {
    page,
    source,
  }: {
    readonly page: readonly ProtectedAtom[];
    readonly source: readonly ProtectedAtom[];
  },
): readonly ProtectedAtom[] {
  /**
   * What the page asks for.
   */
  const fromPage = countAtoms({ atoms: page, },);

  /**
   * What the original asks for.
   */
  const fromSource = countAtoms({ atoms: source, },);

  /**
   * Every atom either side names, once each.
   */
  const keys = [
    ...new Set([
      ...fromPage.keys(),
      ...fromSource.keys(),
    ],),
  ];

  return keys.flatMap(function expand(key: string,): readonly ProtectedAtom[] {
    /**
     * Either side's record of this atom, the original's preferred so a finding
     * quotes the text being translated wherever both carry it.
     */
    const byPage = fromPage.get(key,);

    /**
     * Original's record of this atom, absent where only the page carries it.
     */
    const bySource = fromSource.get(key,);

    /**
     * Record a finding can describe this atom from.
     */
    const held = bySource ?? byPage;
    if (held === undefined)
      throw new Error(`atom key belonging to neither side: ${key}`,);

    /**
     * Copies the page asks for.
     */
    const wantedByPage = (byPage === undefined) ? 0 : byPage.count;

    /**
     * Copies the original asks for.
     */
    const wantedBySource = (bySource === undefined) ? 0 : bySource.count;

    /**
     * Copies the fuller reference asks for.
     */
    const owed = Math.max(
      wantedByPage,
      wantedBySource,
    );
    return Array.from(
      { length: owed, },
      function copy(): ProtectedAtom {
        return held.atom;
      },
    );
  },);
}

/**
 * Shape standing in for a slice with no readable page.
 */
const NO_PAGE: SliceSkeleton = {
  blocks: [],
  atoms: [],
};

/**
 * Checks one candidate translation against the original and the page it
 * replaces.
 *
 * @param sourceText - original slice
 *
 * @param candidateText - proposed translation of it
 *
 * @param pageText - text this candidate would replace, empty where the slice
 * has none. Its shape is a floor the candidate carries rather than a ceiling,
 * so a rendering restoring what the page left out stays valid
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
    pageText = '',
  }: {
    readonly sourceText: string;
    readonly candidateText: string;
    readonly pageText?: string;
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
      detail: `original could not be read: ${source.detail}`,
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
   * Reading of the text this candidate would replace.
   */
  const replaced = readSliceSkeleton({ text: pageText, },);

  /**
   * Page's shape, empty where there is none or the grammar refuses it.
   *
   * A PAGE THE STRICT GRAMMAR REFUSES IS NOT A CANDIDATE'S FAULT EITHER, and an
   * archive written before this grammar existed can be one, so the check falls
   * back to the original alone rather than refusing the candidate.
   */
  const page: SliceSkeleton = (replaced.kind === 'read')
    ? replaced.skeleton
    : NO_PAGE;

  /**
   * Page's blocks, named so the emptiness check is one step rather than three.
   */
  const pageBlocks = page.blocks;

  /**
   * Whether there is a page shape to stand on.
   */
  const hasPage = (pageBlocks.length > 0);

  /**
   * Original's shape, now known readable.
   */
  const expected: SliceSkeleton = source.skeleton;

  /**
   * Candidate's shape, now known readable.
   */
  const actual: SliceSkeleton = candidate.skeleton;

  /**
   * Sequence the candidate has to carry.
   */
  const floor = hasPage ? pageBlocks : expected.blocks;

  /**
   * What a finding calls that sequence.
   */
  const floorName = hasPage ? 'PAGE AS IT STANDS' : 'ORIGINAL';

  /**
   * What a finding calls the side an atom came from.
   */
  const atomSource = hasPage ? 'ORIGINAL or the PAGE AS IT STANDS' : 'ORIGINAL';

  /**
   * Every divergence, structure first because a reference finding reads
   * differently once the blocks it sits in are known to differ.
   */
  const findings = [
    ...compareBlocks({
      floor,
      floorName,
      source: expected.blocks,
      candidate: actual.blocks,
    },),
    ...compareAtoms({
      source: mergeAtoms({
        page: page.atoms,
        source: expected.atoms,
      },),
      candidate: actual.atoms,
      referenceName: atomSource,
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
