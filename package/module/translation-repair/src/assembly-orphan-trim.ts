import { scanGfmReferenceLiterals, } from './footnote-graph.ts';
import type { FootnoteGraphFinding, } from './footnote-model.ts';
import type { SliceReplacement, } from './splice-slices.ts';

//region Orphan definition trim
// AN ORPHAN DEFINITION TAKES ONLY ITS OWN BLOCK. The nineteenth `hakureico`
// pass of 2026-09-09 rendered the source's two footnote definitions as one
// insertion behind the sealed letter; the seal keeps the archive's letter,
// which never carried the second marker, so the second definition was an
// orphan, and the assembly guard withdrew the whole insertion, the first
// definition with it, leaving the body's `[^1]` with no note. A replacement
// that is nothing but definition blocks can lose the orphan's block alone and
// keep the rest, which is what the page needed. The twenty-first class.
//
// ONLY DEFINITIONS-ONLY REPLACEMENTS ARE TRIMMED. Prose that carries a
// definition among its paragraphs is a judged rendering, and cutting a block
// out of it would ship a text nobody judged; that replacement is withdrawn
// whole, as before.

/**
 * Replacements after the trim, and what the trim did.
 *
 * @example
 * ```ts
 * const trimmed: TrimmedReplacements = trimOrphanDefinitions({ findings, replacements, },);
 * ```
 */
export type TrimmedReplacements = {
  /**
   * Replacements with the orphan blocks cut out of definitions-only texts.
   */
  readonly replacements: readonly SliceReplacement[];

  /**
   * Slices whose trimmed text repeats their incumbent, withdrawn instead of
   * shipped as a change the document does not carry.
   */
  readonly withdrawn: readonly number[];

  /**
   * One finding per trimmed block, and one per withdrawn slice.
   */
  readonly findings: readonly string[];

  /**
   * Whether any replacement changed.
   */
  readonly trimmed: boolean;
};

/**
 * Separator between blocks in a replacement text.
 */
const BLOCK_GAP = '\n\n';

/**
 * What follows a marker that opens a definition.
 */
const DEFINITION_SEPARATOR = ':';

/**
 * Convention whose definitions open a block with `[^id]:`.
 */
const GFM = 'gfm';

/**
 * Characters of the marker frame around an identifier.
 */
const MARKER_FRAME_LENGTH = '[^]'.length;

/**
 * Label a block opens a definition with, empty when the block is anything
 * else (prose, a heading, a definition continued from an earlier block).
 *
 * @param block - one blank-line-separated block of a replacement
 *
 * @returns The label alone, or the empty string
 *
 * @example
 * ```ts
 * definitionLabelOfBlock({ block: '[^2]: the note', },);
 * // => '2'
 * ```
 */
function definitionLabelOfBlock({ block, }: { readonly block: string; },): string {
  /**
   * The first marker literal, the opener when it sits at offset zero.
   */
  const [first,] = scanGfmReferenceLiterals({ slice: block, },);
  if ((first === undefined) || (first.localOffset !== 0))
    return '';
  /**
   * Characters of the identifier between the brackets.
   */
  const identifierLength = first.identifier
    .length;
  /**
   * Offset just past the closing bracket, since the marker opens the block.
   */
  const after = MARKER_FRAME_LENGTH + identifierLength;
  if (block.slice(
    after,
    after + DEFINITION_SEPARATOR.length,
  ) !== DEFINITION_SEPARATOR)
    return '';
  return first.identifier;
}

/**
 * One block of a replacement beside the definition label it opens with.
 *
 * @example
 * ```ts
 * const labelled: LabelledBlock = { block: '[^2]: the note', label: '2', };
 * ```
 */
type LabelledBlock = {
  /**
   * The block's text.
   */
  readonly block: string;

  /**
   * Label the block defines, empty when it defines none.
   */
  readonly label: string;
};

/**
 * Blocks of a replacement text, each beside its definition label.
 *
 * @param text - replacement text
 *
 * @returns Labelled blocks in order
 *
 * @example
 * ```ts
 * labelledBlocksOf({ text: '[^1]: one\n\n[^2]: two\n', },);
 * ```
 */
function labelledBlocksOf({ text, }: { readonly text: string; },): readonly LabelledBlock[] {
  return blocksOf({ text, },)
    .map(function toLabelled(block,): LabelledBlock {
      return {
        block,
        label: definitionLabelOfBlock({ block, },),
      };
    },);
}

/**
 * Non-empty blocks of a replacement text.
 *
 * @param text - replacement text
 *
 * @returns Blocks, blank ones left out
 *
 * @example
 * ```ts
 * blocksOf({ text: '[^1]: one\n\n[^2]: two\n', },);
 * // => ['[^1]: one', '[^2]: two\n']
 * ```
 */
function blocksOf({ text, }: { readonly text: string; },): readonly string[] {
  return text
    .split(BLOCK_GAP,)
    .filter(function isNotBlank(block,): boolean {
      return block.trim() !== '';
    },);
}

/**
 * Count of definition blocks across every replacement, the most trims the
 * assembly guard can make.
 *
 * @param replacements - replacements the guard walks
 *
 * @returns Definition blocks in all of them
 *
 * @example
 * ```ts
 * definitionBlockCount({ replacements, },);
 * ```
 */
export function definitionBlockCount(
  { replacements, }: { readonly replacements: readonly SliceReplacement[]; },
): number {
  return replacements.reduce(
    function add(
      count,
      replacement,
    ): number {
      /**
       * Definition blocks in this replacement.
       */
      const definitions = labelledBlocksOf({ text: replacement.replacementText, },)
        .filter(function isDefinition(entry,): boolean {
          return entry.label !== '';
        },);
      return count + definitions.length;
    },
    0,
  );
}

/**
 * Cuts the orphan definitions' blocks out of every replacement that is
 * nothing but definition blocks, leaving any other replacement for the
 * guard to withdraw whole.
 *
 * @param findings - footnote findings the assembly introduced
 *
 * @param replacements - replacements standing this round
 *
 * @param incumbentBySlice - archive text of every slice, by chunk index as a
 * string, so a trim that lands on the incumbent is withdrawn rather than shipped
 *
 * @returns Replacements after the trim
 *
 * @example
 * ```ts
 * const trimmed = trimOrphanDefinitions({ findings: introduced, replacements: standing, incumbentBySlice, },);
 * if (trimmed.trimmed) surviving = trimmed.replacements;
 * ```
 */
export function trimOrphanDefinitions(
  {
    findings,
    replacements,
    incumbentBySlice,
  }: {
    readonly findings: readonly FootnoteGraphFinding[];
    readonly replacements: readonly SliceReplacement[];
    readonly incumbentBySlice: ReadonlyMap<string, string>;
  },
): TrimmedReplacements {
  /**
   * Labels of the orphaned GFM definitions.
   */
  const orphans = new Set(
    findings
      .filter(function isOrphan(finding,): boolean {
        return (finding.kind === 'orphan-definition') && (finding.convention === GFM);
      },)
      .map(function toIdentifier(finding,): string {
        return finding.identifier;
      },),
  );
  if (orphans.size === 0)
    return {
      replacements,
      withdrawn: [],
      findings: [],
      trimmed: false,
    };
  /**
   * Findings for each block cut.
   */
  const cuts: string[] = [];
  /**
   * Replacements with the orphan blocks cut.
   */
  const trimmed = replacements.map(function trim(replacement,): SliceReplacement {
    /**
     * The replacement's blocks, each beside its label.
     */
    const blocks = labelledBlocksOf({ text: replacement.replacementText, },);
    if (blocks.some(function isProse(entry,): boolean {
      return entry.label === '';
    },))
      return replacement;
    /**
     * Blocks whose label is not an orphan.
     */
    const kept = blocks.filter(function keeps(entry,): boolean {
      return !orphans.has(entry.label,);
    },);
    if ((kept.length === blocks.length) || (kept.length === 0))
      return replacement;
    for (const entry of blocks) {
      if (!kept.includes(entry,))
        cuts.push(
          `assembly-footnote-trimmed orphan-definition ${GFM} ${entry.label} (slice ${
            String(replacement.sliceIndex,)
          })`,
        );
    }
    /**
     * Whether the text ended with a line break to keep.
     */
    const endsWithBreak = replacement.replacementText
      .endsWith('\n',);
    /**
     * The kept blocks, the last one's trailing break dropped before the join.
     */
    const joined = kept
      .map(function trimEnd(entry,): string {
        return entry.block
          .trimEnd();
      },)
      .join(BLOCK_GAP,);
    return {
      sliceIndex: replacement.sliceIndex,
      replacementText: endsWithBreak ? `${joined}\n` : joined,
    };
  },);
  /**
   * Trimmed replacements that now repeat their incumbent.
   */
  const emptied = trimmed.filter(function repeatsIncumbent(replacement,): boolean {
    return replacement.replacementText === incumbentBySlice.get(String(replacement.sliceIndex,),);
  },);
  for (const replacement of emptied) {
    cuts.push(
      `assembly-footnote-trimmed-to-incumbent (slice ${String(replacement.sliceIndex,)})`,
    );
  }
  return {
    replacements: trimmed.filter(function stands(replacement,): boolean {
      return !emptied.includes(replacement,);
    },),
    withdrawn: emptied.map(function toIndex(replacement,): number {
      return replacement.sliceIndex;
    },),
    findings: cuts,
    trimmed: cuts.length > 0,
  };
}

//endregion Orphan definition trim
