import { requireExactKeys, } from '../artifact-exact-guard.ts';
import {
  ArtifactParseError,
  requireArray,
  requireBoolean,
  requireCount,
  requireRecord,
} from '../artifact-guard.ts';
import type { ArtifactKeyVocabulary, } from '../artifact-key-vocabulary.ts';
import type {
  ArtifactConsolidateSlice,
  ArtifactConsolidationTerminal,
} from './artifact-two-lane-consolidate.ts';
import {
  parseGateBallot,
  parseShipped,
  parseVerdict,
} from './artifact-two-lane-read-consolidate-parts.ts';
import { parseConsolidationPolish, } from './artifact-two-lane-read-polish.ts';

//region Artifact consolidated slice read

/**
 * Ways settlement can leave stage, including retired artifact spelling.
 */
const TERMINAL_NAMES: readonly ArtifactConsolidationTerminal[] = [
  'incumbent-only',
  'no-standing-text',
  'slate-endorsed-standing',
  'slate-unjudged-standing',
  'slate-declined-standing',
  'slate-kept-standing',
  'gate-kept-standing',
  'wrap-erased-difference',
  'consolidated',
];

/**
 * Reads what fidelity gate settled or that it was never asked.
 *
 * @param value - gate field
 *
 * @param path - artifact path
 *
 * @returns Parsed gate record
 *
 * @example
 * ```ts
 * const gate = parseGate({ value, path, });
 * ```
 */
function parseGate(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): ArtifactConsolidateSlice['gate'] {
  /**
   * Gate field as record.
   */
  const record = requireRecord({
    value,
    path,
  },);
  if (record.kind === 'not-asked') {
    requireExactKeys({
      record,
      allowed: ['kind',],
      path,
    },);
    return { kind: 'not-asked', };
  }
  if (record.kind !== 'asked') {
    throw new ArtifactParseError({
      path: `${path}.kind`,
      reason: 'one of asked, not-asked',
    },);
  }
  requireExactKeys({
    record,
    allowed: [
      'kind',
      'ballots',
      'usable',
    ],
    path,
  },);
  /**
   * Every gate ballot.
   */
  const ballotRows = requireArray({
    value: record.ballots,
    path: `${path}.ballots`,
  },);
  /**
   * Parsed gate ballots.
   */
  const ballots = ballotRows.map(function readOne(
    entry,
    at,
  ) {
    return parseGateBallot({
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
    kind: 'asked',
    ballots,
    usable,
  };
}

/**
 * Reads one consolidated slice under generation-selected shape.
 *
 * @param value - slice record
 *
 * @param path - artifact path
 *
 * @param keys - generation key spellings
 *
 * @param polishRequired - whether generation records final body polish
 *
 * @param reviewRequired - whether polish record carries absolute naturalness review
 *
 * @param correctionChainRequired - whether review carries digest-bound corrections
 *
 * @param everyBodyBlockReviewed - whether reviewed paragraphs are every body
 * block rather than the refinable paragraphs alone
 *
 * @returns Parsed consolidation slice
 *
 * @example
 * ```ts
 * const slice = parseConsolidateSlice({ value, path, keys, polishRequired: true, });
 * ```
 */
export function parseConsolidateSlice(
  {
    value,
    path,
    keys,
    polishRequired,
    reviewRequired = false,
    correctionChainRequired = false,
    everyBodyBlockReviewed = false,
  }: {
    readonly value: unknown;
    readonly path: string;
    readonly keys: ArtifactKeyVocabulary;
    readonly polishRequired: boolean;
    readonly reviewRequired?: boolean;
    readonly correctionChainRequired?: boolean;
    readonly everyBodyBlockReviewed?: boolean;
  },
): ArtifactConsolidateSlice {
  /**
   * Slice as exact record.
   */
  const record = requireRecord({
    value,
    path,
  },);
  requireExactKeys({
    record,
    allowed: [
      keys.sliceIndex,
      'terminal',
      'shipped',
      'rewrapped',
      'demoted',
      'verdicts',
      'gate',
      ...(polishRequired ? ['polish',] : []),
    ],
    path,
  },);
  /**
   * Known terminal name.
   */
  const terminal = TERMINAL_NAMES.find(function matches(known,): boolean {
    return known === record.terminal;
  },);
  if (terminal === undefined) {
    throw new ArtifactParseError({
      path: `${path}.terminal`,
      reason: `one of ${TERMINAL_NAMES.join(', ',)}`,
    },);
  }
  /**
   * Unknown proposal verdict rows.
   */
  const verdictRows = requireArray({
    value: record.verdicts,
    path: `${path}.verdicts`,
  },);
  /**
   * Parsed structural verdicts.
   */
  const verdicts = verdictRows.map(function readOne(
    entry,
    at,
  ) {
    return parseVerdict({
      value: entry,
      path: `${path}.verdicts[${String(at,)}]`,
    },);
  },);
  return {
    sliceIndex: requireCount({
      value: record[keys.sliceIndex],
      path: `${path}.${keys.sliceIndex}`,
    },),
    terminal,
    shipped: parseShipped({
      value: record.shipped,
      terminal,
      path: `${path}.shipped`,
    },),
    rewrapped: requireBoolean({
      value: record.rewrapped,
      path: `${path}.rewrapped`,
    },),
    demoted: requireBoolean({
      value: record.demoted,
      path: `${path}.demoted`,
    },),
    verdicts,
    gate: parseGate({
      value: record.gate,
      path: `${path}.gate`,
    },),
    ...(polishRequired
      ? {
        polish: parseConsolidationPolish({
          value: record.polish,
          path: `${path}.polish`,
          reviewRequired,
          correctionChainRequired,
          everyBodyBlockReviewed,
        },),
      }
      : {}),
  };
}

//endregion Artifact consolidated slice read
