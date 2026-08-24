import {
  ArtifactParseError,
  requireArray,
  requireBoolean,
  requireCount,
  requireFinite,
  requireRecord,
  requireString,
} from '../artifact-guard.ts';
import { requireOneOf, } from '../artifact-exact-guard.ts';
import type { SelectionBallot, } from '../candidate-select-model.ts';
import type {
  RepairJudgedRound,
  RepairRoundStage,
  RepairSlateEntry,
} from '../repair-round-record.ts';
import {
  requireProducer,
  requireRosterModelId,
} from './artifact-producer-read.ts';

//region Artifact rounds read
// Reads judged repair rounds back out of an artifact's raw lane result.
//
// WHY THIS IS NOT THE VERSION 2 PARSER'S JOB. `ParsedLaneV2` deliberately hands
// back the lane's `result` as an unread record and checks only the core version
// 2 requires, saying in its own note that a reader wanting a field this version
// does not check should take it from the artifact. Rounds are such a field.
// Taking them means checking them here, because nothing else has.
//
// IT REFUSES AN ARTIFACT FROM AN OLDER ROSTER, by way of
// `artifact-producer-read.ts`, which names a departed model rather than reading
// it as current. That refusal is the point; the note there says why.
//
// A ROUND IS ALL-OR-NOTHING. Half a slate is worse evidence than none, because
// a standing divides by the ballots it saw and a dropped candidate moves every
// share on the round.

/**
 * Stages a recorded round can name.
 */
const ROUND_STAGES: readonly RepairRoundStage[] = [
  'envelope',
  'chunk-patch',
  'refine',
];

/**
 * Outcomes a recorded round can name.
 */
const ROUND_KINDS = [
  'selected',
  'declined',
] as const;

/**
 * Reads one slate position.
 *
 * @param value - entry as recorded
 *
 * @param path - dotted path for error messages
 *
 * @returns Position with its provenance
 *
 * @example
 * ```ts
 * const entry = requireSlateEntry({ value, path, },);
 * ```
 */
function requireSlateEntry(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): RepairSlateEntry {
  /**
   * Entry as a record.
   */
  const record = requireRecord({
    value,
    path,
  },);

  return {
    index: requireCount({
      value: record.index,
      path: `${path}.index`,
    },),
    rendered: requireString({
      value: record.rendered,
      path: `${path}.rendered`,
    },),
    hash: requireString({
      value: record.hash,
      path: `${path}.hash`,
    },),
    producer: requireProducer({
      value: record.producer,
      path: `${path}.producer`,
    },),
  };
}

/**
 * Reads one ballot.
 *
 * BEST AND WEIGHT ARE FINITE NUMBERS, NOT COUNTS. A judge naming no candidate
 * records a sentinel index, and a judge naming its own writing records a
 * fractional weight, so the count guard would refuse both.
 *
 * @param value - ballot as recorded
 *
 * @param path - dotted path for error messages
 *
 * @returns Ballot as the tally reads it
 *
 * @example
 * ```ts
 * const ballot = requireBallot({ value, path, },);
 * ```
 */
function requireBallot(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): SelectionBallot {
  /**
   * Ballot as a record.
   */
  const record = requireRecord({
    value,
    path,
  },);

  return {
    modelId: requireRosterModelId({
      value: record.modelId,
      path: `${path}.modelId`,
    },),
    best: requireFinite({
      value: record.best,
      path: `${path}.best`,
    },),
    reason: requireString({
      value: record.reason,
      path: `${path}.reason`,
    },),
    weight: requireFinite({
      value: record.weight,
      path: `${path}.weight`,
    },),
    selfVote: requireBoolean({
      value: record.selfVote,
      path: `${path}.selfVote`,
    },),
  };
}

/**
 * Reads one judged round.
 *
 * @param value - round as recorded
 *
 * @param path - dotted path for error messages
 *
 * @returns Round in the shape the projection reads
 *
 * @throws {@link ArtifactParseError} when a field is missing or mistyped
 *
 * @throws {@link OffRosterModelError} when it names a departed model
 *
 * @example
 * ```ts
 * const round = requireJudgedRound({ value, path, },);
 * ```
 */
function requireJudgedRound(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): RepairJudgedRound {
  /**
   * Round as a record.
   */
  const record = requireRecord({
    value,
    path,
  },);

  /**
   * Stage that ran it, checked against the three the lane can name.
   */
  const stage = requireOneOf({
    value: record.stage,
    path: `${path}.stage`,
    allowed: ROUND_STAGES,
  },);

  /**
   * Tally as a record, whose four counts are read individually.
   */
  const tally = requireRecord({
    value: record.tally,
    path: `${path}.tally`,
  },);

  return {
    kind: requireOneOf({
      value: record.kind,
      path: `${path}.kind`,
      allowed: ROUND_KINDS,
    },),
    stage,
    envelopeId: requireString({
      value: record.envelopeId,
      path: `${path}.envelopeId`,
    },),
    slate: requireArray({
      value: record.slate,
      path: `${path}.slate`,
    },).map(function one(entry, index,): RepairSlateEntry {
      return requireSlateEntry({
        value: entry,
        path: `${path}.slate[${String(index,)}]`,
      },);
    },),
    ballots: requireArray({
      value: record.ballots,
      path: `${path}.ballots`,
    },).map(function one(entry, index,): SelectionBallot {
      return requireBallot({
        value: entry,
        path: `${path}.ballots[${String(index,)}]`,
      },);
    },),
    tally: {
      judgesAvailable: requireCount({
        value: tally.judgesAvailable,
        path: `${path}.tally.judgesAvailable`,
      },),
      ballots: requireCount({
        value: tally.ballots,
        path: `${path}.tally.ballots`,
      },),
      abstentions: requireCount({
        value: tally.abstentions,
        path: `${path}.tally.abstentions`,
      },),
      selfVotes: requireCount({
        value: tally.selfVotes,
        path: `${path}.tally.selfVotes`,
      },),
    },
  };
}

/**
 * Reads every round every chunk of one raw repair result recorded.
 *
 * GROUPED BY CHUNK rather than flattened, because a standing drawn almost
 * entirely from one chunk reads the same as one drawn evenly across many, and
 * only the grouping tells them apart.
 *
 * @param raw - lane result exactly as the artifact holds it
 *
 * @param path - dotted path for error messages
 *
 * @returns One list of rounds per chunk, in chunk order
 *
 * @throws {@link ArtifactParseError} when the result or a round is malformed
 *
 * @throws {@link OffRosterModelError} when any record names a departed model
 *
 * @example
 * ```ts
 * const perChunk = readRepairRounds({ raw, path: 'lanes.repair.result', },);
 * ```
 */
export function readRepairRounds(
  {
    raw,
    path,
  }: {
    readonly raw: Readonly<Record<string, unknown>>;
    readonly path: string;
  },
): readonly (readonly RepairJudgedRound[])[] {
  if (!('chunks' in raw))
    throw new ArtifactParseError({
      path: `${path}.chunks`,
      reason: 'present, since a repair result records one entry per prepared slice',
    },);

  return requireArray({
    value: raw.chunks,
    path: `${path}.chunks`,
  },).map(function one(chunk, index,): readonly RepairJudgedRound[] {
    /**
     * Where this chunk sits, for every message below it.
     */
    const at = `${path}.chunks[${String(index,)}]`;

    /**
     * Chunk as a record.
     */
    const record = requireRecord({
      value: chunk,
      path: at,
    },);

    return requireArray({
      value: record.rounds,
      path: `${at}.rounds`,
    },).map(function toRound(round, roundIndex,): RepairJudgedRound {
      return requireJudgedRound({
        value: round,
        path: `${at}.rounds[${String(roundIndex,)}]`,
      },);
    },);
  },);
}

//endregion Artifact rounds read
