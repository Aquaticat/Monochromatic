import {
  requireCount,
  requireRecord,
  requireString,
} from '../artifact-guard.ts';
import {
  requireExactKeys,
  requireOneOf,
} from '../artifact-exact-guard.ts';
import type { ArtifactEvidenceRowV2, } from './artifact-v2-read-contract.ts';
import {
  parseDecisionComparisonV2,
  parseSliceDeliveryV2,
  parseSliceOutcomeV2,
} from './artifact-v2-read-vocabulary.ts';
import type {
  ArtifactComparisonRowV2,
  ArtifactDeliveryRowV2,
} from './artifact-v2-vocabulary.ts';

//region Artifact version 2 row parsing
// Reading the three rows a version 2 artifact carries: a ledger row, a
// comparison row, and the evidence row a lane's raw result holds behind them.
//
// THE FIRST TWO ARE EXACT and the third is not, which is the schema-ownership
// rule this generation reads by: version 2 owns the ledger and the comparison,
// so a key it does not name there is a file it cannot read, while the raw
// result belongs to the live pipeline and a key version 2 does not name there
// is evidence a later lane added.

/**
 * Reads one row of one lane's delivery ledger.
 *
 * @param value - row JSON
 *
 * @param path - dotted path for error message
 *
 * @returns Ledger row as version 2 describes it
 *
 * @throws {@link ArtifactParseError} when the row carries a key this version
 * does not name, or any field is the wrong shape
 *
 * @example
 * ```ts
 * const row = parseDeliveryRowV2({ value, path: 'lanes.repair.delivery[0]', },);
 * ```
 */
export function parseDeliveryRowV2(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): ArtifactDeliveryRowV2 {
  /**
   * Row as a record.
   */
  const record = requireRecord({
    value,
    path,
  },);
  requireExactKeys({
    record,
    allowed: [
      'chunkIndex',
      'sourceText',
      'incumbentKind',
      'incumbentText',
      'outcome',
      'shippedText',
      'delivery',
    ],
    path,
  },);
  return {
    chunkIndex: requireCount({
      value: record.chunkIndex,
      path: `${path}.chunkIndex`,
    },),
    sourceText: requireString({
      value: record.sourceText,
      path: `${path}.sourceText`,
    },),
    incumbentKind: requireOneOf({
      value: record.incumbentKind,
      allowed: [
        'present',
        'absent',
      ],
      path: `${path}.incumbentKind`,
    },),
    incumbentText: requireString({
      value: record.incumbentText,
      path: `${path}.incumbentText`,
    },),
    outcome: parseSliceOutcomeV2({
      value: record.outcome,
      unknownKeys: 'refuse',
      path: `${path}.outcome`,
    },),
    shippedText: requireString({
      value: record.shippedText,
      path: `${path}.shippedText`,
    },),
    delivery: parseSliceDeliveryV2({
      value: record.delivery,
      path: `${path}.delivery`,
    },),
  };
}

/**
 * Reads one row of the recorded comparison.
 *
 * @param value - row JSON
 *
 * @param path - dotted path for error message
 *
 * @returns Comparison row as version 2 describes it
 *
 * @throws {@link ArtifactParseError} when the row carries a key this version
 * does not name, or any field is the wrong shape
 *
 * @example
 * ```ts
 * const row = parseComparisonRowV2({ value, path: 'comparison[0]', },);
 * ```
 */
export function parseComparisonRowV2(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): ArtifactComparisonRowV2 {
  /**
   * Row as a record.
   */
  const record = requireRecord({
    value,
    path,
  },);
  requireExactKeys({
    record,
    allowed: [
      'chunkIndex',
      'incumbentKind',
      'incumbentText',
      'repairText',
      'translateText',
      'verdict',
      'repairOutcome',
      'translateOutcome',
      'decisionComparison',
      'repairDelivery',
      'translateDelivery',
    ],
    path,
  },);
  return {
    chunkIndex: requireCount({
      value: record.chunkIndex,
      path: `${path}.chunkIndex`,
    },),
    incumbentKind: requireOneOf({
      value: record.incumbentKind,
      allowed: [
        'present',
        'absent',
      ],
      path: `${path}.incumbentKind`,
    },),
    incumbentText: requireString({
      value: record.incumbentText,
      path: `${path}.incumbentText`,
    },),
    repairText: requireString({
      value: record.repairText,
      path: `${path}.repairText`,
    },),
    translateText: requireString({
      value: record.translateText,
      path: `${path}.translateText`,
    },),
    verdict: requireOneOf({
      value: record.verdict,
      allowed: [
        'archive-stands',
        'repair-only',
        'translate-only',
        'both-agree',
        'both-differ',
        'gap-remains',
      ],
      path: `${path}.verdict`,
    },),
    repairOutcome: parseSliceOutcomeV2({
      value: record.repairOutcome,
      unknownKeys: 'refuse',
      path: `${path}.repairOutcome`,
    },),
    translateOutcome: parseSliceOutcomeV2({
      value: record.translateOutcome,
      unknownKeys: 'refuse',
      path: `${path}.translateOutcome`,
    },),
    decisionComparison: parseDecisionComparisonV2({
      value: record.decisionComparison,
      path: `${path}.decisionComparison`,
    },),
    repairDelivery: parseSliceDeliveryV2({
      value: record.repairDelivery,
      path: `${path}.repairDelivery`,
    },),
    translateDelivery: parseSliceDeliveryV2({
      value: record.translateDelivery,
      path: `${path}.translateDelivery`,
    },),
  };
}

/**
 * Reads one slice out of a lane's RAW result, taking only what version 2 checks.
 *
 * TOLERANT BY DESIGN, and it is the only row parser here that is. A raw slice
 * row is typed by the live pipeline: it has gained fields before and will
 * again, and requiring today's shape of it would make every later addition a
 * retroactive requirement on artifacts already written. What stays required is
 * the part this reader compares against the ledger.
 *
 * @param value - raw slice row JSON
 *
 * @param path - dotted path for error message
 *
 * @returns Evidence row, with everything else in the raw row left unread
 *
 * @throws {@link ArtifactParseError} when a field version 2 checks is missing
 * or the wrong shape, or the outcome names a member this version cannot read
 *
 * @example
 * ```ts
 * const row = parseEvidenceRowV2({ value, path: 'lanes.repair.result.sliceTexts[0]', },);
 * ```
 */
export function parseEvidenceRowV2(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): ArtifactEvidenceRowV2 {
  /**
   * Row as a record, whose other fields stay where they are.
   */
  const record = requireRecord({
    value,
    path,
  },);
  return {
    chunkIndex: requireCount({
      value: record.chunkIndex,
      path: `${path}.chunkIndex`,
    },),
    incumbentKind: requireOneOf({
      value: record.incumbentKind,
      allowed: [
        'present',
        'absent',
      ],
      path: `${path}.incumbentKind`,
    },),
    incumbentText: requireString({
      value: record.incumbentText,
      path: `${path}.incumbentText`,
    },),
    outcome: parseSliceOutcomeV2({
      value: record.outcome,
      unknownKeys: 'tolerate',
      path: `${path}.outcome`,
    },),
  };
}

//endregion Artifact version 2 row parsing
