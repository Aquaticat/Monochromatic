import type { ChunkPair, } from '../chunk-document.ts';
import { settleGateBallots, } from '../consolidate-gate-stage.ts';
import type { SliceSelection, } from '../slice-selection.ts';
import type {
  ArtifactConsolidateSlice,
  ArtifactConsolidation,
} from './artifact-two-lane-consolidate.ts';
import type {
  ArtifactContestSlice,
  ArtifactLaneSelection,
} from './artifact-two-lane-contest.ts';
import type { ArtifactComparisonRow, } from './artifact-two-lane-vocabulary.ts';

//region Front matter standing
// How the page's metadata came to carry what it carries, read off the stage
// that shipped it.
//
// THE CONTEST SETS THE BASELINE AND THE CONSOLIDATION REFINES IT, which is the
// order the stages ran in and the order `consolidate-standing.ts` reads them:
// the consolidation's "standing" text is the contest winner, or the archive as
// a comparison baseline when the contest chose neither, and that baseline may
// ship unchanged only when the contest chose a lane or endorsed the archive
// (`contestStandingMayShip`). So an unendorsed baseline stays unreviewed
// whatever the consolidation did with it, a contest's review of the archive
// survives a consolidation that merely left the standing text alone, and a
// consolidation slate or gate that chose the standing text, or chose a
// candidate carrying the archive's bytes, adds a review of its own.
//
// The Toka_ls relaunch of 2026-09-02 is the case: the translate lane replaced
// the archive's alias by a judged vote, the contest chose the repair lane,
// which carries the archive's metadata untouched, and the consolidation gate
// kept that standing text six ballots to two with reasons. Read off the
// translate lane alone that page is a withdrawn replacement; read off the
// contest and the gate it is a review of the incumbent by two panels.
//
// "THE INCUMBENT SHIPPED" AND "A PANEL CHOSE THE INCUMBENT" STAY APART, as
// `translate-stage-result.ts` keeps them apart for its own decision: a gate
// that settled `neither` ships the standing text too, and a contest whose
// quorum was not met ships the archive too. Only a panel that chose is a review.

/**
 * How the page's metadata came to carry what it carries.
 *
 * @example
 * ```ts
 * const standing: MetadataStanding = { kind: 'judged-keep', voteWeight: 3, };
 * ```
 */
export type MetadataStanding =
  /**
   * The translate lane's judges chose the archive's wording over fresh
   * renderings.
   */
  | {
    readonly kind: 'judged-keep';
    readonly voteWeight: number;
  }
  /**
   * Every heard translator reproduced the archive's wording, so the slate
   * collapsed to the incumbent and shipped unjudged; named by who matched it.
   */
  | {
    readonly kind: 'matched-keep';
    readonly matchedBy: readonly string[];
  }
  /**
   * The lane contest chose the lane carrying the archive's wording, or
   * endorsed the archive outright when it chose neither lane.
   */
  | {
    readonly kind: 'contest-keep';
    readonly usable: number;
  }
  /**
   * The consolidation slate's judges endorsed the archive's wording, standing
   * after the contest, over the third rendering's proposals.
   */
  | { readonly kind: 'slate-keep'; }
  /**
   * The consolidation gate chose the archive's wording with a quorum of its
   * ballots: as the standing text over a consolidated candidate, or as a
   * consolidated candidate carrying the archive's bytes over other standing.
   */
  | {
    readonly kind: 'gate-keep';
    readonly usable: number;
  }
  /**
   * A stage chose a rendering that is not the archive's; whether the document
   * carries it is the assembly's business, and a page still carrying the
   * archive's bytes under this standing had its replacement withdrawn.
   */
  | {
    readonly kind: 'replaced';
    readonly shipped: boolean;
  }
  /**
   * The incumbent shipped because nothing decided otherwise: an indecision, a
   * rejection, an empty slate, a lost voice, an unmet quorum, a contest that
   * settled neither without endorsing the archive, or a sole incumbent nobody
   * matched.
   */
  | {
    readonly kind: 'fallback';
    readonly decision: string;
  }
  /**
   * No metadata slice, or no record of it: the structural check refuses such a
   * page on its own.
   */
  | { readonly kind: 'unrecorded'; };

/**
 * The four fields of a comparison row the walk reads, so a test states a row
 * by its texts alone and the walk cannot quietly start reading a fifth.
 *
 * @example
 * ```ts
 * const row: MetadataComparisonRow = { sliceIndex: 0, incumbentText: a, repairText: a, translateText: b, };
 * ```
 */
export type MetadataComparisonRow = Pick<
  ArtifactComparisonRow,
  'sliceIndex' | 'incumbentText' | 'repairText' | 'translateText'
>;

/**
 * Every record the standing is read from, as the settled artifact carries them.
 *
 * NAMED APART FROM THE ARTIFACT so a test can state exactly the four records
 * the walk reads and nothing else, and so the walk cannot quietly start reading
 * a fifth.
 *
 * @example
 * ```ts
 * const evidence: MetadataEvidence = { translateSelections, laneSelection, consolidation, comparison, };
 * ```
 */
export type MetadataEvidence = {
  /**
   * Translate lane's per-slice selections, decision and origin named.
   */
  readonly translateSelections: readonly SliceSelection[];

  /**
   * Which lane ships per contested slice, or that nobody was asked.
   */
  readonly laneSelection: ArtifactLaneSelection;

  /**
   * What the third rendering settled per slice, or that it never ran.
   */
  readonly consolidation: ArtifactConsolidation;

  /**
   * Both lanes' texts per slice beside the archive's, for telling which lane a
   * contest verdict kept.
   */
  readonly comparison: readonly MetadataComparisonRow[];
};

/**
 * Whether a standing is a review of the archive's wording.
 *
 * @param standing - how the metadata slice came to stand
 *
 * @returns Whether the keep is a review
 *
 * @example
 * ```ts
 * isReviewedKeep({ standing: { kind: 'judged-keep', voteWeight: 3, }, },);
 * ```
 */
export function isReviewedKeep(
  { standing, }: { readonly standing: MetadataStanding; },
): boolean {
  return (standing.kind === 'judged-keep')
    || (standing.kind === 'matched-keep')
    || (standing.kind === 'contest-keep')
    || (standing.kind === 'slate-keep')
    || (standing.kind === 'gate-keep');
}

/**
 * Reads the standing off a lane contest record, which is the baseline every
 * later stage worked from.
 *
 * @param slice - contest's record for the metadata slice
 *
 * @param row - both lanes' texts at that slice beside the archive's
 *
 * @returns Standing the contest left
 *
 * @example
 * ```ts
 * contestStanding({ slice, row, },);
 * ```
 */
function contestStanding(
  {
    slice,
    row,
  }: {
    readonly slice: ArtifactContestSlice;
    readonly row: MetadataComparisonRow;
  },
): MetadataStanding {
  /**
   * What the roster settled, and how many ballots were usable.
   */
  const {
    verdict,
    usable,
  } = slice;
  if (verdict.kind === 'quorum-not-met') {
    return {
      kind: 'fallback',
      decision: 'contest-quorum-not-met',
    };
  }
  if (verdict.kind === 'settled-neither') {
    if (verdict.archive === 'endorsed') {
      return {
        kind: 'contest-keep',
        usable,
      };
    }
    return {
      kind: 'fallback',
      decision: 'contest-neither',
    };
  }
  /**
   * Text of the lane the contest chose.
   */
  const wonText = (verdict.lane === 'repair') ? row.repairText : row.translateText;
  if (wonText === row.incumbentText) {
    return {
      kind: 'contest-keep',
      usable,
    };
  }
  return {
    kind: 'replaced',
    shipped: true,
  };
}

/**
 * Refines a contest baseline by what the consolidation did with it.
 *
 * A BASELINE THE CONTEST DID NOT REVIEW STAYS UNREVIEWED: the consolidation
 * compares against it but cannot approve it (`contestStandingMayShip`), so its
 * standing passes through untouched. A reviewed baseline survives every
 * terminal that merely left the standing text alone, and gains a review where
 * the slate endorsed it or the gate chose it, or where the gate chose a
 * candidate carrying the archive's bytes.
 *
 * @param baseline - standing the contest left
 *
 * @param slice - consolidation's record for the metadata slice
 *
 * @param archiveText - archive's metadata bytes, which a consolidated candidate
 * may carry
 *
 * @returns Standing after the consolidation
 *
 * @example
 * ```ts
 * consolidationStanding({ baseline, slice, archiveText, },);
 * ```
 */
function consolidationStanding(
  {
    baseline,
    slice,
    archiveText,
  }: {
    readonly baseline: MetadataStanding;
    readonly slice: ArtifactConsolidateSlice;
    readonly archiveText: string;
  },
): MetadataStanding {
  if ((baseline.kind !== 'contest-keep') && (baseline.kind !== 'replaced'))
    return baseline;

  /**
   * How the slice left the stage, what shipped, and the gate's ballots when one
   * was asked.
   */
  const {
    terminal,
    shipped,
    gate,
  } = slice;
  if (terminal === 'consolidated') {
    // A consolidated candidate that carries the archive's bytes was chosen by
    // the gate over other standing, which is a review of the archive whatever
    // the contest had settled.
    if ((shipped.kind === 'consolidated')
      && (shipped.text === archiveText)
      && (gate.kind === 'asked')) {
      return {
        kind: 'gate-keep',
        usable: gate.usable,
      };
    }
    return {
      kind: 'replaced',
      shipped: true,
    };
  }
  if (baseline.kind === 'replaced')
    return baseline;
  if (terminal === 'gate-kept-standing') {
    // A gate that settled `neither` ships the standing text too, under the
    // same terminal; re-settling its ballots with the stage's own rule is what
    // tells a quorum-backed keep from an undecided one, which leaves the
    // contest's review as it was.
    if (gate.kind !== 'asked') {
      return {
        kind: 'fallback',
        decision: 'gate-not-asked',
      };
    }
    /**
     * What the ballots settle to under the stage's own rule.
     */
    const choice = settleGateBallots({ ballots: gate.ballots, },);
    if (choice === 'standing') {
      return {
        kind: 'gate-keep',
        usable: gate.usable,
      };
    }
    if (choice === 'consolidated') {
      return {
        kind: 'fallback',
        decision: 'gate-ballots-contradict-terminal',
      };
    }
    return baseline;
  }
  if (terminal === 'slate-endorsed-standing')
    return { kind: 'slate-keep', };
  return baseline;
}

/**
 * Reads the standing off the translate lane's own selection.
 *
 * @param selection - translate lane's selection for the metadata slice
 *
 * @returns Standing the translate lane left
 *
 * @example
 * ```ts
 * translateStanding({ selection, },);
 * ```
 */
function translateStanding(
  { selection, }: { readonly selection: SliceSelection; },
): MetadataStanding {
  /**
   * The decision, who produced the winner and whether it was the archive's.
   */
  const {
    decision,
    origin,
    producer,
    voteWeight,
    shipped,
  } = selection;
  if (origin === 'fresh') {
    return {
      kind: 'replaced',
      shipped,
    };
  }
  if (decision === 'judged') {
    return {
      kind: 'judged-keep',
      voteWeight,
    };
  }
  if (decision === 'sole-candidate') {
    // The incumbent is offered whenever it has text, so a slate of one is
    // either every heard translator reproducing it or nobody proposing at all;
    // the producer's matched list is what tells those apart.
    if (producer.kind === 'incumbent') {
      /**
       * Translators whose proposal was the incumbent's text.
       */
      const { matched, } = producer;
      if (matched.length > 0) {
        return {
          kind: 'matched-keep',
          matchedBy: matched,
        };
      }
    }
    return {
      kind: 'fallback',
      decision: 'sole-candidate-unmatched',
    };
  }
  return {
    kind: 'fallback',
    decision,
  };
}

/**
 * Reads how the metadata slice's wording came to stand, off the stage that
 * shipped it.
 *
 * @param slices - preparation carrying explicit syntax role
 *
 * @param evidence - the settled records the walk reads
 *
 * @returns How the metadata slice's wording came to stand
 *
 * @example
 * ```ts
 * const standing = metadataStandingOf({ slices, evidence: { translateSelections, laneSelection, consolidation, comparison, }, },);
 * ```
 */
export function metadataStandingOf(
  {
    slices,
    evidence,
  }: {
    readonly slices: readonly ChunkPair[];
    readonly evidence: MetadataEvidence;
  },
): MetadataStanding {
  /**
   * Metadata slice, when the preparation produced one.
   */
  const metadataSlice = slices.find(function isFrontMatter(slice,): boolean {
    return slice.syntax === 'front-matter';
  },);
  if (metadataSlice === undefined)
    return { kind: 'unrecorded', };

  /**
   * Global index of the metadata slice, which every record names it by.
   */
  const metadataIndex = metadataSlice.source
    .sliceIndex;

  /**
   * The four records, destructured once.
   */
  const {
    translateSelections,
    laneSelection,
    consolidation,
    comparison,
  } = evidence;

  /**
   * Contest's record for the metadata slice, absent where the lanes agreed or
   * nobody was asked.
   */
  const contested = (laneSelection.kind === 'contested')
    ? laneSelection.slices
      .find(function namesIt(candidate,): boolean {
        return candidate.sliceIndex === metadataIndex;
      },)
    : undefined;
  if (contested === undefined) {
    /**
     * What the translate lane decided about that slice.
     */
    const selection = translateSelections.find(function namesIt(candidate,): boolean {
      return candidate.sliceIndex === metadataIndex;
    },);
    if (selection === undefined)
      return { kind: 'unrecorded', };
    return translateStanding({ selection, },);
  }

  /**
   * Both lanes' texts at that slice.
   */
  const row = comparison.find(function namesIt(candidate,): boolean {
    return candidate.sliceIndex === metadataIndex;
  },);
  if (row === undefined) {
    return {
      kind: 'fallback',
      decision: 'contest-row-missing',
    };
  }

  /**
   * Standing the contest left, which every later stage worked from.
   */
  const baseline = contestStanding({
    slice: contested,
    row,
  },);
  if (consolidation.kind !== 'settled')
    return baseline;

  /**
   * Consolidation's record for the metadata slice, absent where it never
   * reached it.
   */
  const settled = consolidation.slices
    .find(function namesIt(candidate,): boolean {
      return candidate.sliceIndex === metadataIndex;
    },);
  if (settled === undefined)
    return baseline;
  return consolidationStanding({
    baseline,
    slice: settled,
    archiveText: metadataSlice.target
      .text,
  },);
}

/**
 * Names why a kept incumbent is not a review.
 *
 * @param standing - how the metadata slice came to stand, not a reviewed keep
 *
 * @returns Decision that left the incumbent standing
 *
 * @throws {@link RangeError} on a reviewed keep, which has no fallback to name
 *
 * @example
 * ```ts
 * fallbackDetailOf({ standing: { kind: 'fallback', decision: 'declined-indecision', }, },);
 * ```
 */
export function fallbackDetailOf(
  { standing, }: { readonly standing: MetadataStanding; },
): string {
  if (standing.kind === 'fallback')
    return standing.decision;
  if (standing.kind === 'replaced')
    return standing.shipped ? 'replacement-not-carried' : 'replacement-withdrawn';
  if (standing.kind === 'unrecorded')
    return 'unrecorded';
  throw new RangeError(`a ${standing.kind} is a review of the incumbent and names no fallback`,);
}

//endregion Front matter standing
