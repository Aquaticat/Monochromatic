import {
  ArtifactParseError,
  requireArray,
  requireRecord,
} from '../artifact-guard.ts';
import {
  requireExactKeys,
  requireOpenRecord,
} from '../artifact-exact-guard.ts';
import type {
  ArtifactRepairEvidenceV2,
  ArtifactTranslateEvidenceV2,
  ParsedArtifactV2,
  ParsedLaneV2,
  ParsedPreparationV2,
} from './artifact-v2-read-contract.ts';
import {
  parseRepairEvidenceV2,
  parseTranslateEvidenceV2,
} from './artifact-v2-read-evidence.ts';
import {
  assertEvidenceMatchesLedger,
  assertRowsCoherent,
} from './artifact-v2-read-row-relations.ts';
import { parseDeliveryRowV2, } from './artifact-v2-read-rows.ts';
import {
  assertBlockedCompatible,
  assertIndexSetsMatchLedger,
  assertTranslateCountsAgree,
} from './artifact-v2-read-set-relations.ts';
import type { ArtifactDeliveryRowV2, } from './artifact-v2-vocabulary.ts';

//region Artifact version 2 lane reading
// Reading both lanes, and running every check that belongs to ONE lane.
//
// The order is deliberate: shape first, then the relations, cheapest first and
// each one only where the previous left something to compare. A ledger whose
// rows do not parse cannot be checked against a raw result, and a lane whose
// evidence and ledger describe different runs cannot say anything worth
// checking against the preparation.
//
// THE PREPARATION IS THE OUTERMOST DENOMINATOR, checked here rather than in the
// orchestrator, because both lanes have to satisfy it and stating it once per
// lane is what makes the failure say WHICH lane disagreed.

/**
 * Reads one lane's envelope: its raw result and its ledger, unchecked.
 *
 * @param value - lane JSON
 *
 * @param path - dotted path of the lane
 *
 * @returns Raw record and parsed ledger rows
 *
 * @throws {@link ArtifactParseError} when the lane carries a key this version
 * does not name, or either part is the wrong shape
 *
 * @example
 * ```ts
 * const { raw, delivery, } = parseLaneEnvelope({ value, path: 'lanes.repair', },);
 * ```
 */
function parseLaneEnvelope(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): {
  readonly raw: Readonly<Record<string, unknown>>;
  readonly delivery: readonly ArtifactDeliveryRowV2[];
} {
  /**
   * Lane as a record.
   */
  const lane = requireRecord({
    value,
    path,
  },);

  // EXACT HERE, OPEN ONE LEVEL DOWN, which is the whole schema-ownership rule
  // in one place: version 2 says a lane is a result beside a ledger, and says
  // nothing about what a result holds.
  requireExactKeys({
    record: lane,
    allowed: [
      'result',
      'delivery',
    ],
    path,
  },);
  return {
    raw: requireOpenRecord({
      value: lane.result,
      path: `${path}.result`,
    },),
    delivery: requireArray({
      value: lane.delivery,
      path: `${path}.delivery`,
    },)
      .map(function readRow(
        row,
        position,
      ) {
        return parseDeliveryRowV2({
          value: row,
          path: `${path}.delivery[${String(position,)}]`,
        },);
      },),
  };
}

/**
 * Refuses a lane whose ledger does not cover the preparation.
 *
 * @param delivery - lane's ledger
 *
 * @param preparation - slicing both lanes ran over
 *
 * @param path - dotted path of the lane
 *
 * @throws {@link ArtifactParseError} when the row count differs from the slice
 * count the preparation records
 *
 * @example
 * ```ts
 * assertLedgerCoversPreparation({ delivery, preparation, path: 'lanes.repair', },);
 * ```
 */
function assertLedgerCoversPreparation(
  {
    delivery,
    preparation,
    path,
  }: {
    readonly delivery: readonly ArtifactDeliveryRowV2[];
    readonly preparation: ParsedPreparationV2;
    readonly path: string;
  },
): void {
  if (delivery.length !== preparation.sliceCount) {
    throw new ArtifactParseError({
      path: `${path}.delivery`,
      reason: `one row per prepared slice, which is ${
        String(preparation.sliceCount,)
      } here, rather than ${String(delivery.length,)}`,
    },);
  }
}

/**
 * Reads both lanes and runs every per-lane check.
 *
 * @param value - lanes JSON
 *
 * @param preparation - slicing both lanes ran over, which every count is out of
 *
 * @param path - dotted path of the lanes record
 *
 * @returns Both lanes, each with its raw record, its evidence core and its
 * ledger
 *
 * @throws {@link ArtifactParseError} when either lane is malformed, disagrees
 * with its own raw result, names an index set its rows do not produce, claims a
 * status its deliveries could not have come from, carries a row whose axes
 * contradict, or does not cover the preparation
 *
 * @example
 * ```ts
 * const lanes = parseLanesV2({ value: artifact.lanes, preparation, path, },);
 * ```
 */
export function parseLanesV2(
  {
    value,
    preparation,
    path,
  }: {
    readonly value: unknown;
    readonly preparation: ParsedPreparationV2;
    readonly path: string;
  },
): ParsedArtifactV2['lanes'] {
  /**
   * Lanes as a record, which names exactly two.
   */
  const lanes = requireRecord({
    value,
    path,
  },);
  requireExactKeys({
    record: lanes,
    allowed: [
      'repair',
      'translate',
    ],
    path,
  },);

  /**
   * Repair lane's raw record and ledger.
   */
  const repairEnvelope = parseLaneEnvelope({
    value: lanes.repair,
    path: `${path}.repair`,
  },);

  /**
   * Translate lane's raw record and ledger.
   */
  const translateEnvelope = parseLaneEnvelope({
    value: lanes.translate,
    path: `${path}.translate`,
  },);

  /**
   * What version 2 requires of the repair lane's raw result.
   */
  const repairEvidence: ArtifactRepairEvidenceV2 = parseRepairEvidenceV2({
    value: repairEnvelope.raw,
    path: `${path}.repair.result`,
  },);

  /**
   * Same for the translate lane.
   */
  const translateEvidence: ArtifactTranslateEvidenceV2 = parseTranslateEvidenceV2({
    value: translateEnvelope.raw,
    path: `${path}.translate.result`,
  },);
  assertLedgerCoversPreparation({
    delivery: repairEnvelope.delivery,
    preparation,
    path: `${path}.repair`,
  },);
  assertLedgerCoversPreparation({
    delivery: translateEnvelope.delivery,
    preparation,
    path: `${path}.translate`,
  },);
  assertEvidenceMatchesLedger({
    evidence: repairEvidence.sliceTexts,
    ledger: repairEnvelope.delivery,
    path: `${path}.repair`,
  },);
  assertEvidenceMatchesLedger({
    evidence: translateEvidence.sliceTexts,
    ledger: translateEnvelope.delivery,
    path: `${path}.translate`,
  },);
  assertRowsCoherent({
    ledger: repairEnvelope.delivery,
    path: `${path}.repair`,
  },);
  assertRowsCoherent({
    ledger: translateEnvelope.delivery,
    path: `${path}.translate`,
  },);
  assertIndexSetsMatchLedger({
    evidence: repairEvidence,
    ledger: repairEnvelope.delivery,
    path: `${path}.repair.result`,
  },);
  assertIndexSetsMatchLedger({
    evidence: translateEvidence,
    ledger: translateEnvelope.delivery,
    path: `${path}.translate.result`,
  },);

  // ONE LANE EACH. The whole-document refusal belongs to the repair lane, which
  // is the only one with a status that can express it; the translate lane's
  // counts and its own status are checked instead.
  assertBlockedCompatible({
    evidence: repairEvidence,
    ledger: repairEnvelope.delivery,
    path: `${path}.repair.result`,
  },);
  assertTranslateCountsAgree({
    evidence: translateEvidence,
    path: `${path}.translate.result`,
  },);

  /**
   * Repair lane as a reader gets it.
   */
  const repair: ParsedLaneV2<ArtifactRepairEvidenceV2> = {
    raw: repairEnvelope.raw,
    evidence: repairEvidence,
    delivery: repairEnvelope.delivery,
  };

  /**
   * Translate lane as a reader gets it.
   */
  const translate: ParsedLaneV2<ArtifactTranslateEvidenceV2> = {
    raw: translateEnvelope.raw,
    evidence: translateEvidence,
    delivery: translateEnvelope.delivery,
  };
  return {
    repair,
    translate,
  };
}

//endregion Artifact version 2 lane reading
