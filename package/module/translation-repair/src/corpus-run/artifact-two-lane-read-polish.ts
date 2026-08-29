import { requireExactKeys, } from '../artifact-exact-guard.ts';
import {
  ArtifactParseError,
  requireArray,
  requireBoolean,
  requireCount,
  requireRecord,
  requireString,
} from '../artifact-guard.ts';
import type { ArtifactConsolidationPolish, } from './artifact-two-lane-consolidate.ts';
import { parseNaturalnessReview, } from './artifact-two-lane-read-naturalness-review.ts';
import { parsePolishGate, } from './artifact-two-lane-read-polish-gate.ts';

//region Artifact consolidation polish read

/**
 * Reads string list.
 *
 * @param value - unknown list
 *
 * @param path - artifact path
 *
 * @returns Strings in stored order
 *
 * @example
 * ```ts
 * const values = parseStringList({ value, path, });
 * ```
 */
function parseStringList(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): readonly string[] {
  /**
   * Unknown rows before string validation.
   */
  const rows = requireArray({
    value,
    path,
  },);
  return rows.map(function readOne(
    entry,
    at,
  ): string {
    return requireString({
      value: entry,
      path: `${path}[${String(at,)}]`,
    },);
  },);
}

/**
 * Reads generation-six post-consolidation polish record.
 *
 * @param value - unknown polish field
 *
 * @param path - artifact path
 *
 * @param reviewRequired - whether generation carries exact-text absolute review
 *
 * @param correctionChainRequired - whether review requires digest-bound corrections
 *
 * @returns Parsed polish record
 *
 * @example
 * ```ts
 * const polish = parseConsolidationPolish({ value, path, });
 * ```
 */
export function parseConsolidationPolish(
  {
    value,
    path,
    reviewRequired = false,
    correctionChainRequired = false,
  }: {
    readonly value: unknown;
    readonly path: string;
    readonly reviewRequired?: boolean;
    readonly correctionChainRequired?: boolean;
  },
): ArtifactConsolidationPolish {
  /**
   * Polish field under exact generation-six shape.
   */
  const record = requireRecord({
    value,
    path,
  },);
  if (record.kind === 'not-run') {
    requireExactKeys({
      record,
      allowed: [
        'kind',
        'reason',
      ],
      path,
    },);
    if ((record.reason !== 'front-matter')
      && (record.reason !== 'not-configured')
      && (record.reason !== 'unsafe-baseline')) {
      throw new ArtifactParseError({
        path: `${path}.reason`,
        reason: 'one of front-matter, not-configured, unsafe-baseline',
      },);
    }
    return {
      kind: 'not-run',
      reason: record.reason,
    };
  }
  if (record.kind !== 'settled') {
    throw new ArtifactParseError({
      path: `${path}.kind`,
      reason: 'one of settled, not-run',
    },);
  }
  requireExactKeys({
    record,
    allowed: [
      'kind',
      'baseText',
      'proposedText',
      'text',
      'changed',
      'refinersHeard',
      'contributors',
      'roundCount',
      'gate',
      ...(reviewRequired ? ['review',] : []),
      'findings',
    ],
    path,
  },);
  /**
   * Approved wording before naturalness stage.
   */
  const baseText = requireString({
    value: record.baseText,
    path: `${path}.baseText`,
  },);
  /**
   * Selected rewrite before final gate.
   */
  const proposedText = requireString({
    value: record.proposedText,
    path: `${path}.proposedText`,
  },);
  /**
   * Wording after final gate.
   */
  const text = requireString({
    value: record.text,
    path: `${path}.text`,
  },);
  /**
   * Recorded final replacement status.
   */
  const changed = requireBoolean({
    value: record.changed,
    path: `${path}.changed`,
  },);
  if (changed !== (text !== baseText)) {
    throw new ArtifactParseError({
      path: `${path}.changed`,
      reason: 'whether final text differs from baseText',
    },);
  }
  /**
   * Optional final gate as explicit presence reading.
   */
  const gateReading = (record.gate === undefined)
    ? { kind: 'absent', } as const
    : {
      kind: 'present',
      gate: parsePolishGate({
        value: record.gate,
        path: `${path}.gate`,
      },),
    } as const;
  if (changed && (gateReading.kind === 'absent')) {
    throw new ArtifactParseError({
      path: `${path}.gate`,
      reason: 'final gate approving every changed polish',
    },);
  }
  if (gateReading.kind === 'present') {
    /**
     * Parsed final gate under present reading.
     */
    const { gate, } = gateReading;
    /**
     * Shipping role implied by panel choice under conservative gate rule.
     */
    const expectedShips = (gate.choice === 'polished')
      ? 'polished'
      : 'base';
    if (gate.ships !== expectedShips) {
      throw new ArtifactParseError({
        path: `${path}.gate.ships`,
        reason: `${expectedShips}, derived from gate choice`,
      },);
    }
    if (changed && ((gate.ships !== 'polished') || (text !== proposedText))) {
      throw new ArtifactParseError({
        path,
        reason: 'changed polish whose gate ships polished proposedText',
      },);
    }
    if ((!changed) && (gate.ships === 'polished')) {
      throw new ArtifactParseError({
        path,
        reason: 'unchanged polish whose gate keeps base',
      },);
    }
  }
  return {
    kind: 'settled',
    baseText,
    proposedText,
    text,
    changed,
    refinersHeard: parseStringList({
      value: record.refinersHeard,
      path: `${path}.refinersHeard`,
    },),
    contributors: parseStringList({
      value: record.contributors,
      path: `${path}.contributors`,
    },),
    roundCount: requireCount({
      value: record.roundCount,
      path: `${path}.roundCount`,
    },),
    ...((gateReading.kind === 'present') ? { gate: gateReading.gate, } : {}),
    ...(reviewRequired
      ? {
        review: parseNaturalnessReview({
          value: record.review,
          path: `${path}.review`,
          finalText: text,
          correctionChainRequired,
        },),
      }
      : {}),
    findings: parseStringList({
      value: record.findings,
      path: `${path}.findings`,
    },),
  };
}

//endregion Artifact consolidation polish read
