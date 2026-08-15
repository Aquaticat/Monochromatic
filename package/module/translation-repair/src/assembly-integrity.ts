import {
  scanFullwidthMarkers,
  scanGfmReferenceLiterals,
} from './footnote-graph.ts';
import type { FootnoteGraphFinding, } from './footnote-model.ts';
import { parseDocument, } from './parse-document.ts';
import type { ChunkPair, } from './chunk-document.ts';
import {
  type SliceReplacement,
  spliceSlices,
} from './splice-slices.ts';

//region Assembly integrity
// The check no per-slice decision can make: a footnote is a relation BETWEEN
// slices. One slice carries `body text[^1]` and another carries `[^1]: the
// note`, and selection settles each on its own, so a candidate that drops,
// renames or invents a marker validates perfectly inside its slice and breaks
// the document.
//
// TWO DIFFERENT READINGS, deliberately:
//
// The ASSEMBLED DOCUMENT is the authority on what is broken. It is parsed the
// same way any document is, and its footnote findings are diffed against the
// incumbent's, so a defect the archive already carried is never blamed on the
// lane and never repaired by it either.
//
// The PER-SLICE IDENTIFIER COUNT is attribution only, and is role-blind on
// purpose: a definition line mentions its own label, so counting mentions in
// either role answers "which slice changed its relationship to this
// identifier" without needing the fragment to parse as a document. A fragment
// does not reliably parse as one: a slice opening on a thematic break reads as
// front matter, and an HTML comment spanning a slice boundary masks
// differently at fragment scale.

/**
 * How many identifiers a scan may report before the text is refused as
 * pathological rather than counted.
 *
 * A slice is a paragraph or two of prose. Thousands of markers in one means
 * generated or adversarial text, and the guard exists to keep such text OUT of
 * the document rather than to attribute it.
 */
const MAX_SLICE_IDENTIFIERS = 4_096;

/**
 * What the guard settled on for one document.
 *
 * @example
 * ```ts
 * const guarded: GuardedAssembly = { assembledText, replacements, revertedChunkIndices: [], findings: [], };
 * ```
 */
export type GuardedAssembly = {
  /**
   * Document as it now stands, spliced from the replacements that survived.
   */
  readonly assembledText: string;

  /**
   * Replacements that survived, in the order they were given.
   */
  readonly replacements: readonly SliceReplacement[];

  /**
   * Slices whose replacement was withdrawn, in the order they were withdrawn.
   */
  readonly revertedChunkIndices: readonly number[];

  /**
   * What the guard did, in scorecard-stable wording.
   */
  readonly findings: readonly string[];
};

/**
 * Counts every footnote identifier a text mentions, in either role.
 *
 * Role-blind by design: a definition line mentions its own label, and a slice
 * that stops mentioning an identifier is a suspect however it mentioned it.
 *
 * @param text - slice text or whole document
 *
 * @returns Mentions keyed as `convention identifier`
 *
 * @throws {@link Error} when a text mentions more identifiers than
 * {@link MAX_SLICE_IDENTIFIERS}, which no prose slice does
 *
 * @example
 * ```ts
 * const counts = footnoteIdentifiers({ text: 'A nap[^1].', },);
 * ```
 */
export function footnoteIdentifiers(
  { text, }: { readonly text: string; },
): ReadonlyMap<string, number> {
  /**
   * Mentions accumulated across both conventions.
   */
  const counts = new Map<string, number>();
  for (const [convention, hits,] of [
    [
      'gfm',
      scanGfmReferenceLiterals({ slice: text, },),
    ],
    [
      'fullwidth-bracket',
      scanFullwidthMarkers({ slice: text, },),
    ],
  ] as const) {
    if (hits.length > MAX_SLICE_IDENTIFIERS) {
      throw new Error(
        `${String(hits.length,)} ${convention} footnote markers in one text, `
          + `over the ${String(MAX_SLICE_IDENTIFIERS,)} this guard counts`,
      );
    }
    for (const hit of hits) {
      /**
       * Key naming the convention this identifier belongs to, since the two
       * conventions number independently.
       */
      const key = `${convention} ${hit.identifier}`;
      counts.set(
        key,
        (counts.get(key,) ?? 0) + 1,
      );
    }
  }
  return counts;
}

/**
 * Key identifying a footnote defect across two documents.
 *
 * Deliberately drops the node id: block indices move when a slice changes
 * length, so keeping it would report every surviving defect as a new one.
 *
 * @param finding - defect from a parsed document's footnote graph
 *
 * @returns Stable key
 *
 * @example
 * ```ts
 * const key = findingKey({ finding, },);
 * ```
 */
function findingKey(
  { finding, }: { readonly finding: FootnoteGraphFinding; },
): string {
  return `${finding.kind} ${finding.convention} ${finding.identifier}`;
}

/**
 * Footnote defects present in an assembled document that its incumbent did not
 * already carry.
 *
 * Counted rather than set-differenced, so a second duplicate definition of an
 * identifier the archive already duplicated is still reported.
 *
 * @param incumbentText - translation as it stands
 *
 * @param assembledText - document spliced from the surviving replacements
 *
 * @returns Defects the assembly introduced
 *
 * @example
 * ```ts
 * const introduced = introducedFootnoteFindings({ incumbentText, assembledText, },);
 * ```
 */
export function introducedFootnoteFindings(
  {
    incumbentText,
    assembledText,
  }: {
    readonly incumbentText: string;
    readonly assembledText: string;
  },
): readonly FootnoteGraphFinding[] {
  /**
   * Defects the archive already carried, counted by key.
   */
  const inherited = new Map<string, number>();
  for (const finding of parseDocument({ text: incumbentText, },)
    .footnoteGraph
    .findings) {
    /**
     * Key of one inherited defect.
     */
    const key = findingKey({ finding, },);
    inherited.set(
      key,
      (inherited.get(key,) ?? 0) + 1,
    );
  }

  /**
   * Defects with no inherited counterpart left to account for them.
   */
  const introduced: FootnoteGraphFinding[] = [];
  for (const finding of parseDocument({ text: assembledText, },)
    .footnoteGraph
    .findings) {
    /**
     * Key of one assembled defect.
     */
    const key = findingKey({ finding, },);

    /**
     * Inherited defects of this key still unaccounted for.
     */
    const remaining = inherited.get(key,) ?? 0;
    if (remaining > 0) {
      inherited.set(
        key,
        remaining - 1,
      );
      continue;
    }
    introduced.push(finding,);
  }
  return introduced;
}

/**
 * Replacements whose slice changed how often it mentions an identifier.
 *
 * @param identifierKey - `convention identifier` at fault
 *
 * @param replacements - replacements still standing
 *
 * @param incumbentBySlice - incumbent text of every slice, by chunk index
 *
 * @returns Chunk indices to withdraw
 *
 * @example
 * ```ts
 * const culprits = suspectsFor({ identifierKey, replacements, incumbentBySlice, },);
 * ```
 */
function suspectsFor(
  {
    identifierKey,
    replacements,
    incumbentBySlice,
  }: {
    readonly identifierKey: string;
    readonly replacements: readonly SliceReplacement[];
    readonly incumbentBySlice: ReadonlyMap<string, string>;
  },
): readonly number[] {
  return replacements
    .filter(function changedIt(replacement,): boolean {
      /**
       * Mentions counted in the archive's own text for this slice.
       */
      const beforeCounts = footnoteIdentifiers({
        text: incumbentBySlice.get(String(replacement.chunkIndex,),) ?? '',
      },);

      /**
       * Mentions counted in the accepted text.
       */
      const afterCounts = footnoteIdentifiers({
        text: replacement.replacementText,
      },);
      return (beforeCounts.get(identifierKey,) ?? 0)
        !== (afterCounts.get(identifierKey,) ?? 0);
    },)
    .map(function toIndex(replacement,): number {
      return replacement.chunkIndex;
    },);
}

/**
 * Splices replacements into a document and withdraws any that break its
 * footnote graph, repeating until the graph is no worse than the archive's.
 *
 * ITERATES TO A FIXPOINT rather than checking once. Withdrawing a replacement
 * can orphan an identifier a DIFFERENT replacement introduced alongside it:
 * one slice renumbers `[^1]` to `[^2]` while another supplies the `[^2]`
 * definition, so withdrawing the first leaves the second's definition with
 * nothing pointing at it. Each round withdraws at least one replacement, so the
 * loop is bounded by their count.
 *
 * The guard runs at ASSEMBLY, after per-slice records were settled and cached,
 * so a withdrawn slice's record still says it changed while the document ships
 * the archive's text. That is deliberate: the record says what the judges
 * chose, and this says what the document could carry. Every caller derives its
 * shipped counts from {@link GuardedAssembly.replacements} rather than from the
 * records. The guard is deterministic, so a resumed run withdraws the same
 * slices without asking anyone again.
 *
 * @param targetText - translation as it stands, which is also the fallback
 *
 * @param slices - prepared slice pairs in document order
 *
 * @param replacements - accepted replacement per changed slice
 *
 * @returns Assembled document, surviving replacements, and what was withdrawn
 *
 * @throws {@link Error} when the loop cannot settle, which its own bound makes
 * unreachable and which must never be reported as a clean assembly
 *
 * @example
 * ```ts
 * const guarded = guardFootnoteAssembly({ targetText, slices, replacements, },);
 * ```
 */
export function guardFootnoteAssembly(
  {
    targetText,
    slices,
    replacements,
  }: {
    readonly targetText: string;
    readonly slices: readonly ChunkPair[];
    readonly replacements: readonly SliceReplacement[];
  },
): GuardedAssembly {
  /**
   * Archive text of every slice, keyed by chunk index as a string so the map
   * is JSON-shaped like everything else that crosses this module.
   */
  const incumbentBySlice = new Map(slices.map(function toEntry(slice,) {
    return [
      String(slice.target
        .chunkIndex,),
      slice.target
        .text,
    ] as const;
  },),);

  /**
   * Chunk indices withdrawn so far, in withdrawal order.
   */
  const withdrawn: number[] = [];

  /**
   * What the guard did, accumulated across rounds.
   */
  const findings: string[] = [];

  /**
   * Assembly once no round has anything left to withdraw.
   */
  const settled = (function settle(): {
    readonly assembledText: string;
    readonly surviving: readonly SliceReplacement[];
  } {
    /**
     * Replacements still standing at the start of a round.
     */
    let surviving = replacements;
    for (let round = 0; round <= replacements.length; round += 1) {
      /**
       * This round's replacements under a name nothing reassigns, so every
       * closure below reads the round it was made in rather than the cursor.
       */
      const standing = surviving;

      /**
       * Document as the surviving replacements make it.
       */
      const assembledText = spliceSlices({
        targetText,
        slices,
        replacements: standing,
      },);

      /**
       * Footnote defects this assembly introduced.
       */
      const introduced = introducedFootnoteFindings({
        incumbentText: targetText,
        assembledText,
      },);
      if (introduced.length === 0) {
        return {
          assembledText,
          surviving: standing,
        };
      }

      /**
       * Slices to withdraw this round, each blamed by its own identifier.
       */
      const culprits = new Set(introduced.flatMap(function toCulprits(finding,) {
        return suspectsFor({
          identifierKey: `${finding.convention} ${finding.identifier}`,
          replacements: standing,
          incumbentBySlice,
        },);
      },),);
      if (culprits.size === 0) {
        // Nothing changed its mention of the identifier at fault, so the defect
        // came from how the replacements MEET rather than from what any of them
        // says: a replacement whose tail runs into the next block can stop an
        // untouched definition line being read as one. Withdrawing an
        // unattributable slice would be a guess, so this ships and says so
        // loudly rather than quietly.
        findings.push(...introduced.map(function toFinding(finding,): string {
          return `assembly-footnote-unattributable ${finding.kind} `
            + `${finding.convention} ${finding.identifier}`;
        },),);
        return {
          assembledText,
          surviving: standing,
        };
      }
      for (const finding of introduced) {
        findings.push(
          `assembly-footnote-reverted ${finding.kind} ${finding.convention} `
            + `${finding.identifier} (round ${String(round + 1,)})`,
        );
      }
      withdrawn.push(...culprits,);
      surviving = standing.filter(function stands(replacement,): boolean {
        return !culprits.has(replacement.chunkIndex,);
      },);
    }
    throw new Error(
      `footnote assembly guard ran ${String(replacements.length + 1,)} rounds `
        + 'without settling, which its own bound makes impossible: every round '
        + 'withdraws at least one replacement',
    );
  })();

  return {
    assembledText: settled.assembledText,
    replacements: settled.surviving,
    revertedChunkIndices: withdrawn,
    findings,
  };
}

//endregion Assembly integrity
