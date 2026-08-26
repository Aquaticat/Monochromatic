import type { PreparedDocumentPair, } from '../document-preparation.ts';
import { RenderingAuditInvariantError, } from '../rendering-audit-invariant.ts';
import type { ParsedTwoLaneArtifact, } from './artifact-two-lane-read-contract.ts';
import type { ArtifactSliceDelivery, } from './artifact-two-lane-vocabulary.ts';
import {
  pageRelationOf,
  type SettledPageRelation,
} from './rendering-audit-settled-relation.ts';
import {
  type WouldShipReading,
  wouldShipTextPerSlice,
} from './would-ship-text.ts';

//region Settled audit subject
// What ONE settled artifact offers an audit, and nothing about finding it.
//
// SPLIT OUT OF THE INPUT MODULE when the page relation arrived and pushed that
// file past its line budget. The seam was already there: walking an archive,
// checking provenance and reading a file are one job, and turning one lane's
// delivery ledger into subjects is another. Splitting was the remedy rather
// than raising the cap.
//
// EVERY SUBJECT NAMES BOTH QUESTIONS. The lane-scoped fields say what the
// judges really decided, which is what the audit reads; `pageRelation` says
// whether a later stage overruled it. Neither is a default, per the decision
// recorded in `#166`.
/**
 * Declared names and handles a run licensed, or a positive statement that the
 * pair declared none.
 *
 * A TAGGED ABSENCE rather than an optional string, so a reader of a persisted
 * row can tell "this pair declared nothing" from "nobody recorded whether it
 * did". The two mean opposite things when a name-shaped finding turns up.
 *
 * @example
 * ```ts
 * const identity: SettledIdentity = { kind: 'declared', context: '- name: ...', };
 * ```
 */
export type SettledIdentity = {
  /**
   * Front matter declared at least one name, alias or location.
   */
  readonly kind: 'declared';

  /**
   * Block as the producing stages received it.
   */
  readonly context: string;
} | {
  /**
   * Front matter declared nothing to carry.
   */
  readonly kind: 'none';
};

/**
 * One slice put in front of the audit, carrying everything a later reader needs
 * to say which decision it describes.
 *
 * @example
 * ```ts
 * const subject: SettledAuditSubject = { runSet, entryId, sliceIndex, ... };
 * ```
 */
export type SettledAuditSubject = {
  /**
   * Archive subdirectory this came from, which is the only thing separating two
   * runs of one entry: both write a file named for the entry.
   */
  readonly runSet: string;

  /**
   * Corpus entry.
   */
  readonly entryId: string;

  /**
   * Built output that produced the decision, from the artifact rather than from
   * whatever is built now.
   */
  readonly artifactDigest: string;

  /**
   * Corpus commit the pair was read at.
   */
  readonly corpusSha: string;

  /**
   * Global slice index, which every join uses.
   */
  readonly sliceIndex: number;

  /**
   * What the lane's document ended up carrying here.
   */
  readonly deliveryKind: ArtifactSliceDelivery['kind'];

  /**
   * Whether the text under audit is the ARCHIVE's own English rather than a
   * fresh rendering.
   *
   * SEPARATED because the instrument was built for output with no BEFORE text,
   * and a retained slice is the opposite case. Reading both in one denominator
   * would blur the first real measurement it produces.
   */
  readonly auditsArchiveText: boolean;

  /**
   * Original passage, the only standard the audit has.
   */
  readonly sourceText: string;

  /**
   * Rendering under audit, which is what the lane decided on.
   */
  readonly candidateText: string;

  /**
   * Whether any later stage overruled that rendering.
   *
   * ADDED BESIDE the lane-scoped fields rather than replacing them, per the
   * decision recorded in `#166`. The audit still reads what the judges
   * really decided; this says whether a reader of an assembled document
   * would ever meet it.
   */
  readonly pageRelation: SettledPageRelation;

  /**
   * Names the producing run licensed, or a positive statement of none.
   */
  readonly identity: SettledIdentity;
};

/**
 * Names the delivery kind whose text is the archive's own wording.
 *
 * A retained slice ships the incumbent unchanged, so auditing it audits the
 * archive. Anything else ships something the lane produced.
 */
const ARCHIVE_TEXT_DELIVERY: ArtifactSliceDelivery['kind'] = 'incumbent-retained';

/**
 * Reads the identity block a preparation produced into a tagged answer.
 *
 * Empty counts as none, matching what `buildCriticMessages` does with it: a
 * zero-length block is rendered as no block at all, so recording it as declared
 * would claim the stages saw something they did not.
 *
 * @param prepared - preparation recomputed from the corpus
 *
 * @returns Declared block, or a positive none
 *
 * @example
 * ```ts
 * const identity = identityOf({ prepared, },);
 * ```
 */
export function identityOf({ prepared, }: { readonly prepared: PreparedDocumentPair; },): SettledIdentity {
  /**
   * Block as the preparation produced it, absent when neither side declared.
   */
  const context = prepared.identityContext;

  if (context === undefined)
    return { kind: 'none', };
  if (context.length === 0)
    return { kind: 'none', };
  return {
    kind: 'declared',
    context,
  };
}

/**
 * Turns one artifact's translate-lane delivery into audit subjects.
 *
 * @param artifact - parsed artifact
 *
 * @param runSet - archive subdirectory it came from
 *
 * @param identity - names its producing run licensed
 *
 * @returns One subject per decided slice
 *
 * @throws {@link Error} when a row that passed the decided filter is not
 * decided, which cannot happen and is never swallowed if it does
 *
 * @example
 * ```ts
 * const subjects = subjectsOf({ artifact, runSet, identity, },);
 * ```
 */
export function subjectsOf(
  {
    artifact,
    runSet,
    identity,
  }: {
    readonly artifact: ParsedTwoLaneArtifact;
    readonly runSet: string;
    readonly identity: SettledIdentity;
  },
): readonly SettledAuditSubject[] {
  /**
   * Rows the translate lane's document was assembled from.
   */
  const { delivery, } = artifact.lanes
    .translate;

  /**
   * What would stand at each slice, by the index every stage names it by.
   *
   * DERIVED ONCE PER ARTIFACT rather than once per subject, since the reader
   * walks every comparison row to answer any single one of them.
   */
  const readings = new Map(
    wouldShipTextPerSlice({ artifact, },)
      .map(function pair(slice,): readonly [
        number,
        WouldShipReading,
      ] {
        return [
          slice.sliceIndex,
          slice.reading,
        ];
      },),
  );

  return delivery
    .filter(function wasDecided(row,): boolean {
      /**
       * What the lane did at this slice.
       */
      const { outcome, } = row;

      // A slice the lane never reached has no rendering to audit.
      return outcome.kind === 'decided';
    },)
    .map(function asSubject(row,): SettledAuditSubject {
      /**
       * What the lane did, and what its document carries.
       */
      const {
        outcome,
        delivery: shipped,
      } = row;

      if (outcome.kind !== 'decided')
        throw new RenderingAuditInvariantError({
          invariant: `slice ${String(row.sliceIndex,)} passed the decided filter and is not decided`,
        },);

      /**
       * What would stand at this slice.
       *
       * THROWN ON RATHER THAN SKIPPED. The comparison is derived from the same
       * slicing the lane delivered, so a delivered slice no comparison row
       * names is a contradiction inside one artifact. Dropping it would
       * shrink the audited population for a reason nobody would see.
       */
      const reading = readings.get(row.sliceIndex,);
      if (reading === undefined)
        throw new RenderingAuditInvariantError({
          invariant: `slice ${
            String(row.sliceIndex,)
          } was delivered by the translate lane and named by no comparison row`,
        },);

      return {
        runSet,
        entryId: artifact.id,
        artifactDigest: artifact.pipelineDigest,
        corpusSha: artifact.corpusSha,
        sliceIndex: row.sliceIndex,
        deliveryKind: shipped.kind,
        auditsArchiveText: shipped.kind === ARCHIVE_TEXT_DELIVERY,
        sourceText: row.sourceText,
        candidateText: outcome.acceptedText,
        pageRelation: pageRelationOf({
          laneSelection: artifact.laneSelection,
          reading,
          candidateText: outcome.acceptedText,
        },),
        identity,
      };
    },);
}

//endregion Settled audit subject
