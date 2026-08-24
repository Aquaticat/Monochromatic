import {
  requireArray,
  requireRecord,
  requireString,
} from '../artifact-guard.ts';
import { requireOneOf, } from '../artifact-exact-guard.ts';
import type { CandidateProducer, } from '../candidate-select-model.ts';
import type { RosterModelId, } from '../roster-id.ts';
import { ROSTER_MODEL_IDS, } from '../roster-reach.ts';

//region Artifact producer read
// WHO WROTE A RECORDED CANDIDATE, read back out of an artifact and checked
// against the roster as it stands today.
//
// IT REFUSES A MODEL THAT HAS LEFT THE ROSTER, and that refusal is the point
// rather than a limitation to work around. `RosterModelId` is a closed union of
// the models seated now; `hf:zai-org/GLM-4.7-Flash` was in it until 2026-08-24
// and is not any more. Reading a departed id as though it were current would
// let a standing mix rosters silently, and widening the production union so a
// reporting tool can hold one would loosen the type every seating decision is
// checked against. So a record from an older roster is NAMED, not read.

/**
 * Provenance kinds a recorded candidate can name.
 */
const PRODUCER_KINDS = [
  'model',
  'composite',
  'incumbent',
] as const;

/**
 * Signals a recorded model that no longer holds a place in the roster.
 *
 * ITS OWN CLASS, so a caller can tell "this artifact predates the current
 * roster" from "this artifact is malformed". The first is expected of anything
 * settled before a seating change and says nothing bad about the record; the
 * second is a defect.
 *
 * @example
 * ```ts
 * throw new OffRosterModelError({ modelId: 'hf:zai-org/GLM-4.7-Flash', path, },);
 * ```
 */
export class OffRosterModelError extends Error {
  /**
   * Builds failure naming the id and where it was read.
   *
   * @param modelId - id the record carried
   *
   * @param path - dotted path it was read at
   *
   * @example
   * ```ts
   * new OffRosterModelError({ modelId, path: 'chunks[0].rounds[1]', },);
   * ```
   */
  public constructor(
    {
      modelId,
      path,
    }: {
      readonly modelId: string;
      readonly path: string;
    },
  ) {
    super(
      `${path} names ${modelId}, which no longer holds a place in the roster, so this record `
        + 'was written under an earlier seating and cannot be read as current',
    );
    this.name = 'OffRosterModelError';
  }
}

/**
 * Reads one model id, refusing one the roster no longer seats.
 *
 * @param value - id as recorded
 *
 * @param path - dotted path for error messages
 *
 * @returns Id, narrowed to the roster
 *
 * @throws {@link OffRosterModelError} when the roster no longer seats it
 *
 * @throws {@link ArtifactParseError} when it is not a string at all
 *
 * @example
 * ```ts
 * const modelId = requireRosterModelId({ value, path, },);
 * ```
 *
 * @internal
 */
export function requireRosterModelId(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): RosterModelId {
  /**
   * Id as written, before it is checked against the roster.
   */
  const written = requireString({
    value,
    path,
  },);

  for (const seated of ROSTER_MODEL_IDS) {
    if (seated === written)
      return seated;
  }

  throw new OffRosterModelError({
    modelId: written,
    path,
  },);
}

/**
 * Reads every model id in one list.
 *
 * @param value - list as recorded
 *
 * @param path - dotted path for error messages
 *
 * @returns Ids, each narrowed to the roster
 *
 * @example
 * ```ts
 * const contributors = requireRosterModelIds({ value, path, },);
 * ```
 */
function requireRosterModelIds(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): readonly RosterModelId[] {
  return requireArray({
    value,
    path,
  },)
    .map(function one(
      entry,
      index,
    ): RosterModelId {
    return requireRosterModelId({
      value: entry,
      path: `${path}[${String(index,)}]`,
    },);
  },);
}

/**
 * Reads one candidate's provenance.
 *
 * @param value - producer as recorded
 *
 * @param path - dotted path for error messages
 *
 * @returns Provenance in its three-way shape
 *
 * @example
 * ```ts
 * const producer = requireProducer({ value, path, },);
 * ```
 *
 * @internal
 */
export function requireProducer(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): CandidateProducer {
  /**
   * Producer as a record.
   */
  const record = requireRecord({
    value,
    path,
  },);

  /**
   * Which of the three shapes it claims.
   */
  const kind = requireOneOf({
    value: record.kind,
    path: `${path}.kind`,
    allowed: PRODUCER_KINDS,
  },);

  if (kind === 'model')
    return {
      kind,
      modelId: requireRosterModelId({
        value: record.modelId,
        path: `${path}.modelId`,
      },),
    };

  if (kind === 'composite')
    return {
      kind,
      contributors: requireRosterModelIds({
        value: record.contributors,
        path: `${path}.contributors`,
      },),
    };

  return {
    kind,
    matched: requireRosterModelIds({
      value: record.matched,
      path: `${path}.matched`,
    },),
  };
}

//endregion Artifact producer read
