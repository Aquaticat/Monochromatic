import type { SliceSyntax, } from './chunk-document.ts';
import { contributorAuthorityFindings, } from './contributor-translation-guard.ts';
import { EMPTY_SLICE_SKELETON, } from './empty-slice-skeleton.ts';
import { validateFrontMatterTranslation, } from './front-matter-translation.ts';
import { compareLineCounts, } from './line-structure-guard.ts';
import type { ProtectedAtom, } from './protected-atom.ts';
import {
  sourceOnlyBreakFindings,
  substituteBreakFindings,
} from './source-only-breaks.ts';
import { atomFindings, } from './translate-atom-rendering.ts';
import { neutralPronounFindings, } from './translate-neutral-pronoun.ts';
import { definitionLeakFindings, } from './translate-definition-leak.ts';
import { leakedEscapeFindings, } from './translate-escape-leak.ts';
import { sourceCarryFindings, } from './translate-source-carry.ts';
import { sheetLeakFindings, } from './translate-sheet-leak.ts';
import { untranslatedFindings, } from './translate-untranslated.ts';
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
 What comparing a candidate against its original found.
 
 @example
 ```ts
 const validation: SliceValidation = { kind: 'valid', pageGrammar: 'strict', };
 ```
 */
export type SliceValidation =
  | {
    readonly kind: 'valid';

    /**
     Grammar that read the page behind this pass.
     
     ON THE PASS AND NOT THE REFUSAL, because a refusal already names the
     blocks it compared and shows which reading produced them, while a pass
     carries no evidence at all. A pass resting on the relaxed grammar is
     weaker than one resting on the strict grammar, and the repo's parser
     policy is that a downgrade never happens silently.
     */
    readonly pageGrammar: PageGrammar;
  }
  | {
    readonly kind: 'invalid';

    /**
     One sentence per divergence, addressed to the model that wrote the
     candidate.
     */
    readonly findings: readonly string[];
  }
  | {
    readonly kind: 'unknown';

    /**
     Why no comparison was possible.
     */
    readonly detail: string;
  };

/**
 Renders one block for a finding.
 
 @param shape - block to describe
 
 @returns Kind with its distinguishing detail
 
 @example
 ```ts
 const label = describeBlock({ kind: 'heading', detail: 'level 2', },);
 ```
 */
function describeBlock(shape: BlockShape,): string {
  return (shape.detail === '') ? shape.kind : `${shape.kind} (${shape.detail})`;
}

/**
 Renders a block sequence for a finding.
 
 @param blocks - blocks in document order
 
 @returns Comma-separated description, or a word for none
 
 @example
 ```ts
 const label = describeBlocks({ blocks, },);
 ```
 */
function describeBlocks({ blocks, }: { readonly blocks: readonly BlockShape[]; },): string {
  if (blocks.length === 0)
    return 'nothing';
  return blocks.map(describeBlock,)
    .join(', ',);
}

/**
 Whether one block sequence appears inside another, in order.
 
 MATCHED BY KIND AND DETAIL, so a heading of another level does not stand in
 for the one the page carries.
 
 @param floor - sequence that has to appear
 
 @param candidate - sequence to look for it in
 
 @returns Whether every block of `floor` was found, in order
 
 @example
 ```ts
 const held = appearsInOrder({ floor, candidate, },);
 ```
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
   How far into `floor` the candidate got.
   */
  const matched = candidate.reduce(
    function advance(
      cursor: number,
      shape: BlockShape,
    ): number {
      /**
       Block the floor wants next, absent once the whole floor is matched.
       */
      const wanted = floor[cursor];

      /**
       Whether this block is the one the floor wants next.
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
 Whether two block sequences are the same shape, kind for kind and detail
 for detail.
 
 @param left - one sequence
 
 @param right - other sequence
 
 @returns Whether every block matches its counterpart
 
 @example
 ```ts
 sameShape({ left: source, right: candidate, },);
 ```
 */
function sameShape(
  {
    left,
    right,
  }: {
    readonly left: readonly BlockShape[];
    readonly right: readonly BlockShape[];
  },
): boolean {
  return (left.length === right.length)
    && left.every(function matches(
      block,
      index,
    ): boolean {
      /**
       Counterpart block in the other sequence.
       */
      const other = right[index];
      return (other !== undefined)
        && (other.kind === block.kind)
        && (other.detail === block.detail);
    },);
}

/**
 Whether the floor's blocks are all of kinds the original has, so any surplus
 is a split of the original's blocks rather than something added.
 
 @param floor - blocks the candidate is asked to carry
 
 @param source - original's blocks
 
 @returns Whether every floor block has a kind and detail the original has
 
 @example
 ```ts
 splitOnly({ floor: page.blocks, source: expected.blocks, },);
 ```
 */
function splitOnly(
  {
    floor,
    source,
  }: {
    readonly floor: readonly BlockShape[];
    readonly source: readonly BlockShape[];
  },
): boolean {
  return floor.every(function hasKind(block,): boolean {
    return source.some(function sameKind(candidate,): boolean {
      return (candidate.kind === block.kind)
        && (candidate.detail === block.detail);
    },);
  },);
}

/**
 Findings for a block skeleton that does not carry the floor's.
 
 THE PAGE IS A FLOOR, NOT A CEILING, and two references are why. Measured over
 68 settled slice records, the archive and the Chinese carry the same block
 sequence at 48, the archive carries more at 11 and fewer at 7, and those
 seven are two different things: an archive that MERGED Chinese paragraphs
 into a better shape, and an archive simply MISSING blocks the Chinese
 carries. Anchoring to either alone breaks the other case, so a candidate has
 to carry the floor's blocks and may add one only where the Chinese has more.
 
 WITH THE ORIGINAL AS THE FLOOR THIS IS TODAY'S EXACT MATCH. A floor of the
 original with a ceiling of the original's own length admits one sequence, the
 original's.
 EITHER RENDERING, the owner's decision of 2026-09-07
 (`doc/decision/translation-repair-block-floor.md`): a candidate shaped
 exactly as the original is a faithful rendering of it whatever shape the
 archive chose, so it passes beside one shaped as the page. The Huasheng poem
 is two `<br/>` paragraphs in the source and five paragraphs in the archive,
 every producer followed the source, and the entry stopped with nothing
 valid; 34 of the 92 archives carry more top-level blocks than their source.
 What stays refused is a shape that is neither reference's, which is what a
 dropped passage looks like. THE ORIGINAL'S SHAPE COUNTS ONLY WHERE THE PAGE'S
 SURPLUS IS MORE BLOCKS OF THE ORIGINAL'S OWN KINDS, a split: a page whose
 extra blocks are of a kind the original lacks (the sixth consolidation bed's
 html and blockquote against one paragraph, an archive's blockquote that says
 a passage was left by someone) is carrying something a split cannot explain,
 and a candidate shaped as the original would drop it.
 
 THE PAGE'S SUBSTITUTE AND THE ORIGINAL'S OWN KIND (class thirty-two,
 2026-09-16): Mio's archive ends with a farewell paragraph where the original
 ends with a poem in a block quote, the pairing set the two against each
 other, and a ceiling of max(page, original) left room for one block. The
 consolidation sheet asks a producer to add a block to carry what the
 original has and the archive left out, and the quote is exactly that, so
 the ceiling also admits the page's blocks plus every original block of a
 kind the page has no block of. What the page rendered in a kind of its own
 is kept; what it has no block of the kind for may follow.
 
 @param floor - blocks the candidate has to carry, the page's where there is
 one and the original's where there is not
 
 @param floorName - what a finding calls that sequence
 
 @param source - original's blocks, which set the ceiling with the floor
 
 @param candidate - candidate's blocks
 
 @returns One finding per rule the candidate's shape breaks
 
 @example
 ```ts
 const findings = compareBlocks({ floor, floorName, source, candidate, },);
 ```
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
  if (
    splitOnly({
      floor,
      source,
    },)
    && sameShape({
      left: source,
      right: candidate,
    },)
  )
    return [];

  /**
   Original blocks of a kind the floor has no block of, which the page
   rendered as nothing of their kind and a candidate may carry beside the
   page's blocks.
   */
  const substituted = source.filter(function unrenderedKind(block,): boolean {
    return !floor.some(function sameKind(carried,): boolean {
      return (carried.kind === block.kind)
        && (carried.detail === block.detail);
    },);
  },);

  /**
   Most blocks any reference asks for: the page's, the original's, or the
   page's with the original blocks it has no kind for.
   */
  const ceiling = Math.max(
    floor.length,
    source.length,
    floor.length + substituted.length,
  );

  /**
   Sentence telling the author what may follow the floor's blocks, empty
   where the page has a block of every original kind.
   */
  const allowance = (substituted.length === 0)
    ? ''
    : ` The ORIGINAL's ${describeBlocks({ blocks: substituted, },)} has no block of its kind on the ${
      floorName
    }, so carry the ${floorName}'s blocks and add it after them in the ORIGINAL's own kind.`;

  /**
   Finding for a candidate the floor is not inside.
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
      } (${describeBlocks({ blocks: candidate, },)}). Every block of the ${floorName} has `
        + `to appear in your translation, of the same kind and in the same order.${allowance}`,
    ];

  /**
   Finding for a candidate carrying more blocks than anything asks for.
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
 Checks one candidate translation against the original and the page it
 replaces.
 
 @param sourceText - original slice
 
 @param candidateText - proposed translation of it
 
 @param pageText - text this candidate would replace, empty where the slice
 has none. Its shape is a floor the candidate carries rather than a ceiling,
 so a rendering restoring what the page left out stays valid
 
 @param syntax - explicit syntax role, absent for ordinary Markdown
 
 @param lineStructured - whether the line-structure rule governs this slice,
 which makes merging its lines a fault. Defaults to false, so a caller that
 cannot say leaves the check off rather than guessing at it from the slice
 alone: the decision is a union over the slice AND its enclosing chunk, and
 the slice half alone covers 55 slices where the union covers 211
 
 @returns Verdict, with findings written for the model that wrote it
 
 @example
 ```ts
 const validation = validateTranslatedSlice({ sourceText, candidateText, },);
 ```
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
   Contributor authority floor applies even when source grammar is unreadable.
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
   JSON escapes that leaked into the text, refused before any shape is read.
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
   Sheet evidence blocks copied into the candidate (class forty-four), refused
   before any shape is read.
   */
  const leakFindings = sheetLeakFindings({
    sourceText,
    pageText,
    candidateText,
  },);
  if (leakFindings.length > 0) {
    return {
      kind: 'invalid',
      findings: leakFindings,
    };
  }

  /**
   A footnote the candidate defines though the original passage only refers
   to it (class forty-nine), refused before the assembly can find it twice.
   */
  const definitionFindings = definitionLeakFindings({
    sourceText,
    pageText,
    candidateText,
  },);
  if (definitionFindings.length > 0) {
    return {
      kind: 'invalid',
      findings: definitionFindings,
    };
  }
  /**
   What the original carries that the candidate must carry too: its footnote
   markers (class ninety-two), its second-person address (class
   ninety-seven) and its bracketed work titles in English (class
   ninety-eight).
   */
  const carryFindings = sourceCarryFindings({
    sourceText,
    candidateText,
    pageText,
  },);
  if (carryFindings.length > 0) {
    return {
      kind: 'invalid',
      findings: carryFindings,
    };
  }
  /**
   Shape the original carries.
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
   Shape the candidate carries.
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
   Reading of the text this candidate would replace.
   */
  const {
    read: replaced,
    grammar: pageGrammar,
  } = readPageSkeleton({ text: pageText, },);

  /**
   Page's shape, empty only where there is no page or NEITHER grammar reads
   it.
   
   A PAGE THE STRICT GRAMMAR REFUSES IS NOT A CANDIDATE'S FAULT, and an archive
   written before this grammar existed can be one, so {@link readPageSkeleton}
   downgrades the page to plain markdown rather than refusing the candidate.
   
   IT NO LONGER FALLS BACK TO THE ORIGINAL ALONE, which was a check answering
   yes to a question it had never evaluated. Measured on the sixth
   consolidation bed: a slice boundary between an opening details tag and its
   closing tag made the page unparseable, the floor lost its block list, and a
   164-character rendering passed against a 3875-character page.
   */
  const page: SliceSkeleton = (replaced.kind === 'read')
    ? replaced.skeleton
    : EMPTY_SLICE_SKELETON;

  /**
   Page's blocks, named so the emptiness check is one step rather than three.
   */
  const pageBlocks = page.blocks;

  /**
   Whether there is a page shape to stand on.
   */
  const hasPage = (pageBlocks.length > 0);

  /**
   Original's shape, now known readable.
   */
  const expected: SliceSkeleton = source.skeleton;

  /**
   Candidate's shape, now known readable.
   */
  const actual: SliceSkeleton = candidate.skeleton;

  /**
   Sequence the candidate has to carry.
   */
  const floor = hasPage ? pageBlocks : expected.blocks;

  /**
   What a finding calls that sequence.
   */
  const floorName = hasPage ? 'PAGE AS IT STANDS' : 'ORIGINAL';

  /**
   What a finding calls the side an atom came from.
   */
  const atomSource = hasPage ? 'ORIGINAL or the PAGE AS IT STANDS' : 'ORIGINAL';

  /**
   Every divergence, structure first because a reference finding reads
   differently once the blocks it sits in are known to differ.
   */
  const findings = [
    ...compareBlocks({
      floor,
      floorName,
      source: expected.blocks,
      candidate: actual.blocks,
    },),
    ...sourceOnlyBreakFindings({
      pageText,
      source: expected.explicitBreaks,
      candidate: actual.explicitBreaks,
    },),
    // CLASS FORTY-TWO: a kind the page never rendered owes the original's
    // breaks even though the page has text for the slice.
    ...(hasPage
      ? substituteBreakFindings({
        pageBlocks,
        sourceBlocks: expected.blocks,
        sourceBreaks: expected.explicitBreaks,
        candidateBlocks: actual.blocks,
        candidateBreaks: actual.explicitBreaks,
      },)
      : []),
    ...untranslatedFindings({
      sourceText,
      candidateText,
    },),
    ...compareLineCounts({
      lineStructured,
      sourceText,
      candidateText,
      pageText,
    },),
    ...atomFindings({
      page: page.atoms,
      source: expected.atoms,
      candidate: actual.atoms,
      referenceName: atomSource,
    },),
    ...neutralPronounFindings({ candidateText, },),
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

//endregion Translate validation
