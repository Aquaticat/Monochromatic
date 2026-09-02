import type { SliceSyntax, } from './chunk-document.ts';
import { contributorAuthorityFindings, } from './contributor-translation-guard.ts';
import { EMPTY_SLICE_SKELETON, } from './empty-slice-skeleton.ts';
import { validateFrontMatterTranslation, } from './front-matter-translation.ts';
import { compareLineCounts, } from './line-structure-guard.ts';
import type { ProtectedAtom, } from './protected-atom.ts';
import {
  describeAtom,
  mergeAtoms,
} from './translate-atom-floor.ts';
import {
  type BlockShape,
  readSliceSkeleton,
  type SliceSkeleton,
} from './translate-skeleton.ts';
import {
  type PageGrammar,
  readPageSkeleton,
} from './translate-skeleton-page.ts';

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
 * const validation: SliceValidation = { kind: 'valid', pageGrammar: 'strict', };
 * ```
 */
export type SliceValidation =
  | {
    readonly kind: 'valid';

    /**
     * Grammar that read the page behind this pass.
     *
     * ON THE PASS AND NOT THE REFUSAL, because a refusal already names the
     * blocks it compared and shows which reading produced them, while a pass
     * carries no evidence at all. A pass resting on the relaxed grammar is
     * weaker than one resting on the strict grammar, and the repo's parser
     * policy is that a downgrade never happens silently.
     */
    readonly pageGrammar: PageGrammar;
  }
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
 * @param syntax - explicit syntax role, absent for ordinary Markdown
 *
 * @param lineStructured - whether the line-structure rule governs this slice,
 * which makes merging its lines a fault. Defaults to false, so a caller that
 * cannot say leaves the check off rather than guessing at it from the slice
 * alone: the decision is a union over the slice AND its enclosing chunk, and
 * the slice half alone covers 55 slices where the union covers 211
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
    syntax,
    lineStructured = false,
  }: {
    readonly sourceText: string;
    readonly candidateText: string;
    readonly pageText?: string;
    readonly syntax?: SliceSyntax;
    readonly lineStructured?: boolean;
  },
): SliceValidation {
  if (syntax === 'front-matter') {
    return validateFrontMatterTranslation({
      sourceText,
      pageText,
      candidateText,
    },);
  }
  /**
   * Contributor authority floor applies even when source grammar is unreadable.
   */
  const contributorFindings = contributorAuthorityFindings({
    texts: Array.of(
      pageText,
      candidateText,
    ),
  },);
  if (contributorFindings.length > 0) {
    return {
      kind: 'invalid',
      findings: contributorFindings,
    };
  }
  /**
   * JSON escapes that leaked into the text, refused before any shape is read.
   */
  const escapeFindings = leakedEscapeFindings({
    sourceText,
    pageText,
    candidateText,
  },);
  if (escapeFindings.length > 0) {
    return {
      kind: 'invalid',
      findings: escapeFindings,
    };
  }
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
  const {
    read: replaced,
    grammar: pageGrammar,
  } = readPageSkeleton({ text: pageText, },);

  /**
   * Page's shape, empty only where there is no page or NEITHER grammar reads
   * it.
   *
   * A PAGE THE STRICT GRAMMAR REFUSES IS NOT A CANDIDATE'S FAULT, and an archive
   * written before this grammar existed can be one, so {@link readPageSkeleton}
   * downgrades the page to plain markdown rather than refusing the candidate.
   *
   * IT NO LONGER FALLS BACK TO THE ORIGINAL ALONE, which was a check answering
   * yes to a question it had never evaluated. Measured on the sixth
   * consolidation bed: a slice boundary between an opening details tag and its
   * closing tag made the page unparseable, the floor lost its block list, and a
   * 164-character rendering passed against a 3875-character page.
   */
  const page: SliceSkeleton = (replaced.kind === 'read')
    ? replaced.skeleton
    : EMPTY_SLICE_SKELETON;

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
    ...compareLineCounts({
      lineStructured,
      sourceText,
      candidateText,
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
    return {
      kind: 'valid',
      pageGrammar,
    };
  return {
    kind: 'invalid',
    findings,
  };
}

/**
 * A backslash before a double quotation mark, which is how a JSON string
 * escapes the mark and never how a page writes one.
 */
const LEAKED_ESCAPE = String.raw`\"`;

/**
 * Findings for JSON escapes that leaked into a candidate as text.
 *
 * WHY. A model answering in JSON sometimes escapes the quotation marks inside
 * its string twice, and the decoded text then carries a literal backslash
 * before each mark. The Carena0442 page published on 2026-09-02 shipped
 * `so-called \"common sense.\"` that way: the consolidation producer's text
 * carried it, every structural guard passed it, and the polish kept it. The
 * pinned corpus carries no such sequence in any page, so a candidate carrying
 * one where neither the original nor the page does is a leak, not a rendering.
 *
 * @param sourceText - original slice
 *
 * @param pageText - page slice the candidate would replace
 *
 * @param candidateText - candidate under validation
 *
 * @returns One finding when the candidate alone carries the sequence
 *
 * @example
 * ```ts
 * leakedEscapeFindings({ sourceText: '“常识”', pageText: '“common sense”', candidateText: '\\"common sense\\"', },);
 * ```
 */
export function leakedEscapeFindings(
  {
    sourceText,
    pageText,
    candidateText,
  }: {
    readonly sourceText: string;
    readonly pageText: string;
    readonly candidateText: string;
  },
): readonly string[] {
  if (!candidateText.includes(LEAKED_ESCAPE,))
    return [];
  if (sourceText.includes(LEAKED_ESCAPE,) || pageText.includes(LEAKED_ESCAPE,))
    return [];
  return [
    `Your translation carries a backslash before a quotation mark (${LEAKED_ESCAPE}), which is a JSON `
    + 'escape leaked into the text; write the quotation marks themselves, with nothing before them.',
  ];
}

//endregion Translate validation
