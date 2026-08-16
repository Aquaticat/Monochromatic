import type { SliceLaneComparison, } from '../lane-comparison.ts';
import type { LaneSliceOutcome, } from '../lane-slice-text.ts';
import type {
  SliceDelivery,
  SliceDeliveryRecord,
} from '../slice-delivery.ts';
import type {
  ArtifactComparisonRowV2,
  ArtifactDecisionComparisonV2,
  ArtifactDeliveryRowV2,
  ArtifactSliceDeliveryV2,
  ArtifactSliceOutcomeV2,
} from './artifact-v2-vocabulary.ts';

//region Artifact version 2 projection
// Live pipeline values rebuilt, field by field, as the values version 2 writes.
//
// WHY NOT JUST ASSIGN THEM. The frozen vocabulary was introduced with the claim
// that the compiler enforces it, because the builder assigns live values into
// the frozen types. Half of that is true and the false half is exactly the
// silent expansion the freeze exists to stop:
//
//  -   A live union that GAINS A MEMBER does fail to assign, since the new
//      member is not assignable to the snapshot.
//  -   A live record that GAINS A FIELD does NOT fail. Excess property checking
//      applies to object LITERALS, not to values flowing through a variable, so
//      the wider object assigns cleanly and `JSON.stringify` then writes the new
//      field into every artifact. The version 2 parser rejects unknown keys in
//      schema-owned records, so the writer would emit artifacts its own reader
//      refuses.
//
// Rebuilding through literals closes that: what is serialized is the field set
// this schema describes rather than whatever the runtime object happens to
// carry. The member-growth half is kept, and made explicit rather than
// incidental, by the `never` binding each projection ends on: a live union that
// grows leaves a member unhandled, that binding stops being `never`, and the
// file stops compiling. The next person meets the version question as a build
// error either way, which is what the vocabulary file promises.

/**
 * Reports a live union member no version 2 projection describes.
 *
 * Unreachable while the projections stay exhaustive, which the `never` binding
 * at each of their tails is what guarantees: this runs only if someone widens a
 * live union and silences that binding with an assertion.
 *
 * @param what - which union was being projected, for the message
 *
 * @param member - unhandled value, typed `never` so a widened union fails to
 * compile at the call site rather than throwing here
 *
 * @throws {@link Error} always
 *
 * @example
 * ```ts
 * return refuseUnknownMember({ what: 'lane outcome', member: outcome, },);
 * ```
 */
function refuseUnknownMember(
  {
    what,
    member,
  }: {
    readonly what: string;
    readonly member: never;
  },
): never {
  throw new Error(
    `unreachable: ${what} carries a member version 2 does not describe: ${JSON.stringify(member,)}`,
  );
}

/**
 * Rebuilds one lane outcome as version 2 records it.
 *
 * @param outcome - what the lane did, in the live vocabulary
 *
 * @returns Same outcome carrying only fields this schema describes
 *
 * @example
 * ```ts
 * const outcome = toArtifactOutcomeV2({ outcome: record.outcome, },);
 * ```
 */
export function toArtifactOutcomeV2(
  { outcome, }: { readonly outcome: LaneSliceOutcome; },
): ArtifactSliceOutcomeV2 {
  if (outcome.kind === 'decided') {
    return {
      kind: 'decided',
      acceptedText: outcome.acceptedText,
    };
  }
  if (outcome.kind === 'not-evaluated')
    return { kind: 'not-evaluated', };
  if (outcome.kind === 'unfilled')
    return { kind: 'unfilled', };
  if (outcome.kind === 'incumbent-fallback')
    return { kind: 'incumbent-fallback', };
  if (outcome.kind === 'not-applicable')
    return { kind: 'not-applicable', };
  return refuseUnknownMember({
    what: 'lane outcome',
    member: outcome,
  },);
}

/**
 * Rebuilds one delivery as version 2 records it.
 *
 * @param delivery - how a document came to carry what it carries, live
 *
 * @returns Same delivery carrying only fields this schema describes
 *
 * @example
 * ```ts
 * const delivery = toArtifactDeliveryV2({ delivery: record.delivery, },);
 * ```
 */
export function toArtifactDeliveryV2(
  { delivery, }: { readonly delivery: SliceDelivery; },
): ArtifactSliceDeliveryV2 {
  if (delivery.kind === 'replacement-shipped')
    return { kind: 'replacement-shipped', };
  if (delivery.kind === 'replacement-withdrawn') {
    return {
      kind: 'replacement-withdrawn',
      reason: delivery.reason,
    };
  }
  if (delivery.kind === 'incumbent-retained')
    return { kind: 'incumbent-retained', };
  if (delivery.kind === 'gap-remains')
    return { kind: 'gap-remains', };
  return refuseUnknownMember({
    what: 'slice delivery',
    member: delivery,
  },);
}

/**
 * Rebuilds one decision comparison as version 2 records it.
 *
 * @param decisionComparison - how the two lanes' own decisions relate, live
 *
 * @returns Same reading carrying only fields this schema describes
 *
 * @example
 * ```ts
 * const decisions = toArtifactDecisionsV2({ decisionComparison: row.decisionComparison, },);
 * ```
 */
export function toArtifactDecisionsV2(
  { decisionComparison, }: { readonly decisionComparison: SliceLaneComparison['decisionComparison']; },
): ArtifactDecisionComparisonV2 {
  if (decisionComparison.kind === 'comparable') {
    return {
      kind: 'comparable',
      verdict: decisionComparison.verdict,
    };
  }
  if (decisionComparison.kind === 'not-comparable') {
    return {
      kind: 'not-comparable',

      // COPIED rather than aliased, because the artifact outlives the run: a
      // reader mutating what it read would otherwise reach into the comparison
      // the builder returned.
      undecidedLanes: [...decisionComparison.undecidedLanes,],
    };
  }
  return refuseUnknownMember({
    what: 'decision comparison',
    member: decisionComparison,
  },);
}

/**
 * Rebuilds one delivery ledger row as version 2 records it.
 *
 * @param record - row one lane's ledger builder produced
 *
 * @returns Same row carrying only fields this schema describes
 *
 * @example
 * ```ts
 * const rows = records.map(function project(record,) { return toArtifactRowV2({ record, },); },);
 * ```
 */
export function toArtifactRowV2(
  { record, }: { readonly record: SliceDeliveryRecord; },
): ArtifactDeliveryRowV2 {
  return {
    chunkIndex: record.chunkIndex,
    sourceText: record.sourceText,
    incumbentKind: record.incumbentKind,
    incumbentText: record.incumbentText,
    outcome: toArtifactOutcomeV2({ outcome: record.outcome, },),
    shippedText: record.shippedText,
    delivery: toArtifactDeliveryV2({ delivery: record.delivery, },),
  };
}

/**
 * Rebuilds one comparison row as version 2 records it.
 *
 * @param row - row `compareDocumentLanes` produced
 *
 * @returns Same row carrying only fields this schema describes
 *
 * @example
 * ```ts
 * const rows = comparison.slices
 *   .map(function project(row,) { return toArtifactComparisonRowV2({ row, },); },);
 * ```
 */
export function toArtifactComparisonRowV2(
  { row, }: { readonly row: SliceLaneComparison; },
): ArtifactComparisonRowV2 {
  return {
    chunkIndex: row.chunkIndex,
    incumbentKind: row.incumbentKind,
    incumbentText: row.incumbentText,
    repairText: row.repairText,
    translateText: row.translateText,
    verdict: row.verdict,
    repairOutcome: toArtifactOutcomeV2({ outcome: row.repairOutcome, },),
    translateOutcome: toArtifactOutcomeV2({ outcome: row.translateOutcome, },),
    decisionComparison: toArtifactDecisionsV2({ decisionComparison: row.decisionComparison, },),
    repairDelivery: toArtifactDeliveryV2({ delivery: row.repairDelivery, },),
    translateDelivery: toArtifactDeliveryV2({ delivery: row.translateDelivery, },),
  };
}

//endregion Artifact version 2 projection
