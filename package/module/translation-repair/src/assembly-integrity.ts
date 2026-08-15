import { assertReplacementsChange, } from './assembly-invariant.ts';
import { footnoteIdentifiers, } from './footnote-mentions.ts';
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
// The ASSEMBLED DOCUMENT is the authority on what is broken. It is parsed the
// same way any document is, and its footnote findings are diffed against the
// incumbent's, so a defect the archive already carried is never blamed on the
// lane and never repaired by it either.
//
// Attribution, which decides WHICH replacement to withdraw, is a different
// reading and lives in `footnote-mentions.ts`.

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
 * Parse tolerances that mean the document became LESS parseable, rather than
 * that the parser worked around something ordinary.
 *
 * A masked comment and a blanked invisible line are ordinary. An unterminated
 * comment swallows everything after it, and an MDX downgrade means the strict
 * parser refused the document and the loose one accepted it as plain markdown.
 * Both are whole-document effects that a per-slice check cannot see: masking
 * runs over the whole body before parsing, so one slice's stray `<!--` hides
 * markers in slices nobody touched.
 */
const STRUCTURAL_REGRESSION_KINDS: readonly string[] = [
  'unterminated-html-comment',
  'mdx-downgraded',
];

/**
 * Structural parse regressions an assembled document carries beyond its
 * incumbent's.
 *
 * @param incumbentText - translation as it stands
 *
 * @param assembledText - document spliced from the surviving replacements
 *
 * @returns Kinds the assembly carries MORE of, each named once; how many more
 * is deliberately not reported, since one is already enough to withdraw over
 *
 * @example
 * ```ts
 * const worse = introducedStructuralRegressions({ incumbentText, assembledText, },);
 * ```
 */
export function introducedStructuralRegressions(
  {
    incumbentText,
    assembledText,
  }: {
    readonly incumbentText: string;
    readonly assembledText: string;
  },
): readonly string[] {
  return STRUCTURAL_REGRESSION_KINDS.filter(function worsened(kind,): boolean {
    return countParseFindings({
      text: assembledText,
      kind,
    },) > countParseFindings({
      text: incumbentText,
      kind,
    },);
  },);
}

/**
 * Counts one parse-finding kind in a document.
 *
 * @param text - document to parse
 *
 * @param kind - finding kind to count
 *
 * @returns How many the parser reported
 *
 * @example
 * ```ts
 * const count = countParseFindings({ text, kind: 'mdx-downgraded', },);
 * ```
 */
function countParseFindings(
  {
    text,
    kind,
  }: {
    readonly text: string;
    readonly kind: string;
  },
): number {
  return parseDocument({ text, },)
    .parseFindings
    .filter(function isKind(finding,): boolean {
      return finding.kind === kind;
    },)
    .length;
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
      // EITHER role: a defect names an identifier, and both the reference that
      // points at it and the definition that answers it can be what moved.
      return [
        `reference ${identifierKey}`,
        `definition ${identifierKey}`,
      ].some(function moved(key,): boolean {
        return (beforeCounts.get(key,) ?? 0) !== (afterCounts.get(key,) ?? 0);
      },);
    },)
    .map(function toIndex(replacement,): number {
      return replacement.chunkIndex;
    },);
}

/**
 * Splices replacements into a document and settles what it can carry, repeating
 * until nothing is left to take back.
 *
 * THREE OUTCOMES, and the name only says the first. A replacement that breaks
 * the footnote graph is withdrawn, blamed by the identifier it moved. A
 * STRUCTURAL parse regression is withdrawn too, and since it names no
 * identifier, an unattributable one takes every replacement with it. An
 * assembly that reassembles to the archive text is CANONICALIZED rather than
 * withdrawn for fault: nobody did anything wrong, and the document simply says
 * so. Any reader of `revertedChunkIndices` is reading all three.
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
 * @throws AssemblyContractError when a replacement names an unknown slice or
 * repeats its own incumbent, checked HERE rather than left to each caller: a
 * no-op replacement reassembles to the archive text, so the net-zero
 * canonicalization would otherwise adopt it as a legitimate outcome and return
 * an empty surviving set, which nothing downstream can tell from an honest one
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
  // FIRST, before anything is spliced. Every lane already runs this check, and
  // running it here too is what makes the guard sound for a caller that does
  // not: a replacement repeating its own incumbent is indistinguishable, once
  // spliced, from a slice nobody touched, and the net-zero branch below would
  // canonicalize it into an empty surviving set that reads as an honest run.
  assertReplacementsChange({
    slices,
    replacements,
  },);

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

      // A NET NO-OP, which is a real outcome rather than a contradiction. Every
      // standing replacement differs from its own incumbent, and together they
      // reassemble to the archive text anyway: moving a line break across a
      // join is enough. Left alone, this round would return the archive text
      // beside a non-empty surviving set, and every caller would name those
      // slices as ones the document carries a change for while carrying none.
      //
      // Canonicalized rather than asserted against, because nobody did anything
      // wrong. The decisions survive in each lane's per-slice wordings; what
      // changes is only the document-level claim, which becomes the true one.
      if ((standing.length > 0) && (assembledText === targetText)) {
        findings.push(
          `assembly-net-zero-canonicalized (${
            String(standing.length,)
          } slices), since their replacements reassemble to the archive text`,
        );
        withdrawn.push(...standing.map(function toIndex(replacement,): number {
          return replacement.chunkIndex;
        },),);
        return {
          assembledText: targetText,
          surviving: [],
        };
      }

      /**
       * Footnote defects this assembly introduced.
       */
      const introduced = introducedFootnoteFindings({
        incumbentText: targetText,
        assembledText,
      },);

      /**
       * Parse regressions this assembly introduced, which no identifier names:
       * a stray comment opener masks markers document-wide, and a downgrade
       * means the strict parser refused what the archive accepted.
       */
      const regressions = introducedStructuralRegressions({
        incumbentText: targetText,
        assembledText,
      },);
      if ((introduced.length === 0) && (regressions.length === 0)) {
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
        // Nothing changed its mention of the identifier at fault, or the defect
        // names no identifier at all: it came from how the replacements MEET
        // rather than from what any one of them says. A slice's stray comment
        // opener masks markers document-wide, and a replacement whose tail runs
        // into the next block can stop an untouched definition line being read
        // as one.
        //
        // Choosing a slice to withdraw here would be a guess, and shipping a
        // document the lane knowingly broke is worse. So every replacement is
        // withdrawn: the archive's own text is the one thing certain to parse
        // as it did before, and the per-slice records still hold every decision
        // the judges made.
        for (const finding of introduced) {
          findings.push(
            `assembly-footnote-unattributable ${finding.kind} `
              + `${finding.convention} ${finding.identifier}`,
          );
        }
        for (const kind of regressions)
          findings.push(`assembly-structure-unattributable ${kind}`,);
        findings.push(
          `assembly-withdrew-every-replacement (${
            String(standing.length,)
          } slices), since no slice could be blamed for the defect`,
        );
        withdrawn.push(...standing.map(function toIndex(replacement,): number {
          return replacement.chunkIndex;
        },),);
        return {
          assembledText: targetText,
          surviving: [],
        };
      }
      for (const finding of introduced) {
        findings.push(
          `assembly-footnote-reverted ${finding.kind} ${finding.convention} `
            + `${finding.identifier} (round ${String(round + 1,)})`,
        );
      }
      // Recorded in the SAME round the withdrawal happens, not left to the next
      // one. A regression the withdrawal happens to fix as well never reaches
      // another round, so without this the document reports only the footnote
      // it was blamed for and the parse damage disappears from the findings.
      // Attribution is by the identifier, so these name no slice: what is
      // certain is that this round's withdrawal is what answered them.
      for (const kind of regressions) {
        findings.push(
          `assembly-structure-reverted ${kind} (round ${String(round + 1,)})`,
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
