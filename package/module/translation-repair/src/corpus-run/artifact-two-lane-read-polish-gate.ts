import { requireExactKeys, } from '../artifact-exact-guard.ts';
import {
  ArtifactParseError,
  requireArray,
  requireCount,
  requireRecord,
  requireString,
} from '../artifact-guard.ts';
import type { ConsolidationPolishGateOutcome, } from '../consolidation-polish-gate-stage.ts';
import type {
  ConsolidationPolishBallot,
  PolishChoice,
} from '../consolidation-polish-gate-wire.ts';

//region Artifact consolidation polish gate read

/**
 * Polish ballot candidate names.
 */
const POLISH_CHOICES: readonly PolishChoice[] = [
  'polished',
  'base',
  'neither',
];

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
 * Reads polish candidate choice.
 *
 * @param value - unknown candidate name
 *
 * @param path - artifact path
 *
 * @returns Narrow choice
 *
 * @example
 * ```ts
 * const choice = parsePolishChoice({ value, path, });
 * ```
 */
function parsePolishChoice(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): PolishChoice {
  /**
   * Known choice matching stored value.
   */
  const choice = POLISH_CHOICES.find(function matches(name,): boolean {
    return name === value;
  },);
  if (choice !== undefined)
    return choice;
  throw new ArtifactParseError({
    path,
    reason: `one of ${POLISH_CHOICES.join(', ',)}`,
  },);
}

/**
 * Reads one fidelity-first naturalness ballot.
 *
 * @param value - unknown ballot
 *
 * @param path - artifact path
 *
 * @returns Parsed ballot
 *
 * @example
 * ```ts
 * const ballot = parsePolishBallot({ value, path, });
 * ```
 */
function parsePolishBallot(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): ConsolidationPolishBallot {
  /**
   * Ballot record under exact generation-six shape.
   */
  const record = requireRecord({
    value,
    path,
  },);
  requireExactKeys({
    record,
    allowed: [
      'choice',
      'unsupported',
      'unsupportedRaw',
      'dropped',
      'droppedRaw',
      'reason',
    ],
    path,
  },);
  /**
   * Candidate names ballot marked unsupported.
   */
  const unsupportedNames = parseStringList({
    value: record.unsupported,
    path: `${path}.unsupported`,
  },);
  /**
   * Candidate names narrowed to polish choices.
   */
  const unsupported = unsupportedNames.map(function narrow(candidate,) {
    return parsePolishChoice({
      value: candidate,
      path: `${path}.unsupported`,
    },);
  },);
  /**
   * Candidate names ballot marked dropped.
   */
  const droppedNames = parseStringList({
    value: record.dropped,
    path: `${path}.dropped`,
  },);
  /**
   * Candidate names narrowed to polish choices.
   */
  const dropped = droppedNames.map(function narrow(candidate,) {
    return parsePolishChoice({
      value: candidate,
      path: `${path}.dropped`,
    },);
  },);
  return {
    choice: parsePolishChoice({
      value: record.choice,
      path: `${path}.choice`,
    },),
    unsupported,
    unsupportedRaw: parseStringList({
      value: record.unsupportedRaw,
      path: `${path}.unsupportedRaw`,
    },),
    dropped,
    droppedRaw: parseStringList({
      value: record.droppedRaw,
      path: `${path}.droppedRaw`,
    },),
    reason: requireString({
      value: record.reason,
      path: `${path}.reason`,
    },),
  };
}

/**
 * Reads generation-six naturalness gate outcome.
 *
 * @param value - unknown gate
 *
 * @param path - artifact path
 *
 * @returns Parsed gate outcome
 *
 * @example
 * ```ts
 * const gate = parsePolishGate({ value, path, });
 * ```
 */
export function parsePolishGate(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): ConsolidationPolishGateOutcome {
  /**
   * Gate record under exact generation-six shape.
   */
  const record = requireRecord({
    value,
    path,
  },);
  requireExactKeys({
    record,
    allowed: [
      'choice',
      'ships',
      'ballots',
      'usable',
      'findings',
    ],
    path,
  },);
  /**
   * Panel choice, refusal included.
   */
  const choice = parsePolishChoice({
    value: record.choice,
    path: `${path}.choice`,
  },);
  /**
   * Conservative shipping result.
   */
  const ships = (record.ships === 'polished')
    ? 'polished' as const
    : (record.ships === 'base')
    ? 'base' as const
    : undefined;
  if (ships === undefined) {
    throw new ArtifactParseError({
      path: `${path}.ships`,
      reason: 'one of polished, base',
    },);
  }
  /**
   * Every usable gate ballot.
   */
  const ballotRows = requireArray({
    value: record.ballots,
    path: `${path}.ballots`,
  },);
  /**
   * Every unknown row parsed as polish ballot.
   */
  const ballots = ballotRows.map(function readOne(
    entry,
    at,
  ) {
    return parsePolishBallot({
      value: entry,
      path: `${path}.ballots[${String(at,)}]`,
    },);
  },);
  /**
   * Recorded usable voice count.
   */
  const usable = requireCount({
    value: record.usable,
    path: `${path}.usable`,
  },);
  if (usable !== ballots.length) {
    throw new ArtifactParseError({
      path: `${path}.usable`,
      reason: `${String(ballots.length,)} matching stored ballots`,
    },);
  }
  return {
    choice,
    ships,
    ballots,
    usable,
    findings: parseStringList({
      value: record.findings,
      path: `${path}.findings`,
    },),
  };
}

//endregion Artifact consolidation polish gate read
