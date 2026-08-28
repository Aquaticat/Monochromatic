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
  }: {
    readonly value: unknown;
    readonly path: string;
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
    if ((record.reason !== 'front-matter') && (record.reason !== 'not-configured')) {
      throw new ArtifactParseError({
        path: `${path}.reason`,
        reason: 'one of front-matter, not-configured',
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
    ...((record.gate === undefined)
      ? {}
      : {
        gate: parsePolishGate({
          value: record.gate,
          path: `${path}.gate`,
        },),
      }),
    findings: parseStringList({
      value: record.findings,
      path: `${path}.findings`,
    },),
  };
}

//endregion Artifact consolidation polish read
