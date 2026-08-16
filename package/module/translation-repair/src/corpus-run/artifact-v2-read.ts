import {
  ArtifactParseError,
  requireArray,
  requireCount,
  requireRecord,
  requireString,
} from '../artifact-guard.ts';
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import {
  requireArtifactJsonRecord,
  requireExactKeys,
  requireOneOf,
} from '../artifact-exact-guard.ts';
import {
  assertPreparationIdentity,
  type PreparationIdentity,
} from '../preparation-identity.ts';
import { ARTIFACT_SCHEMA_VERSION_V2, } from './artifact-v2-contract.ts';
import { assertRecordedComparisonMatches, } from './artifact-v2-read-comparison.ts';
import type {
  ParsedArtifactV2,
  ParsedPreparationV2,
} from './artifact-v2-read-contract.ts';
import { parseLanesV2, } from './artifact-v2-read-lanes.ts';
import { parseComparisonRowV2, } from './artifact-v2-read-rows.ts';
import {
  assertPipelineDigest,
  type PipelineDigest,
} from './pipeline-digest.ts';

//region Artifact version 2 reading
// Reading one whole version 2 artifact, and refusing everything it cannot
// account for.
//
// WHAT THIS IS NOT is a verification that the run happened as recorded. The
// artifact stores measurements of the two documents rather than the documents,
// so the preparation identity is checked for SYNTAX here and nothing more; a
// reader holding the corpus checkout and the matching pipeline can rebuild the
// preparation and check the rest through a separate entry point that takes one.
// Saying so out loud is the point: a syntax check read as a verification is
// exactly the kind of absence this generation exists to stop recording.
//
// WHAT IT DOES DO is refuse every internal contradiction a file alone can show:
// a key this version does not name, a union member it cannot project, a ledger
// its own raw result disagrees with, an index set its rows do not produce, a
// status the deliveries could not have come from, a row whose two axes cannot
// both be true, and a recorded comparison the ledgers do not derive.

/**
 * Reads the branded identity a preparation gives itself.
 *
 * @param value - recorded identity
 *
 * @param path - dotted path for error message
 *
 * @returns Identity, narrowed by the same check a fresh one passes
 *
 * @throws {@link ArtifactParseError} when the value is not a string, or not
 * shaped like an identity
 *
 * @example
 * ```ts
 * const identity = requireIdentity({ value: preparation.identity, path, },);
 * ```
 */
function requireIdentity(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): PreparationIdentity {
  /**
   * Recorded string, before it is known to be an identity.
   */
  const held = requireString({
    value,
    path,
  },);
  try {
    assertPreparationIdentity(held,);
  } catch (error) {
    throw new ArtifactParseError({
      path,
      reason: `an identity of this scheme: ${caughtValueText(error,)}`,
    },);
  }
  return held;
}

/**
 * Reads the digest naming the built output that ran.
 *
 * @param value - recorded digest
 *
 * @param path - dotted path for error message
 *
 * @returns Digest, narrowed by the same check a fresh one passes
 *
 * @throws {@link ArtifactParseError} when the value is not a string, or not
 * shaped like a digest
 *
 * @example
 * ```ts
 * const digest = requireDigest({ value: artifact.pipelineDigest, path, },);
 * ```
 */
function requireDigest(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): PipelineDigest {
  /**
   * Recorded string, before it is known to be a digest.
   */
  const held = requireString({
    value,
    path,
  },);
  try {
    assertPipelineDigest(held,);
  } catch (error) {
    throw new ArtifactParseError({
      path,
      reason: `a pipeline digest: ${caughtValueText(error,)}`,
    },);
  }
  return held;
}

/**
 * Reads the slicing both lanes ran over.
 *
 * @param value - preparation JSON
 *
 * @param path - dotted path for error messages
 *
 * @returns Preparation as a reader gets it
 *
 * @throws {@link ArtifactParseError} when it carries a key this version does
 * not name, or any field is the wrong shape
 *
 * @example
 * ```ts
 * const preparation = parsePreparationV2({ value: artifact.preparation, path, },);
 * ```
 */
function parsePreparationV2(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): ParsedPreparationV2 {
  /**
   * Preparation as a record.
   */
  const record = requireRecord({
    value,
    path,
  },);
  requireExactKeys({
    record,
    allowed: [
      'identity',
      'sliceCount',
      'sourceChars',
      'targetChars',
      'sourceBytes',
      'alignmentPairCount',
      'alignmentFindings',
    ],
    path,
  },);
  return {
    identity: requireIdentity({
      value: record.identity,
      path: `${path}.identity`,
    },),
    sliceCount: requireCount({
      value: record.sliceCount,
      path: `${path}.sliceCount`,
    },),
    sourceChars: requireCount({
      value: record.sourceChars,
      path: `${path}.sourceChars`,
    },),
    targetChars: requireCount({
      value: record.targetChars,
      path: `${path}.targetChars`,
    },),
    sourceBytes: requireCount({
      value: record.sourceBytes,
      path: `${path}.sourceBytes`,
    },),
    alignmentPairCount: requireCount({
      value: record.alignmentPairCount,
      path: `${path}.alignmentPairCount`,
    },),
    alignmentFindings: requireArray({
      value: record.alignmentFindings,
      path: `${path}.alignmentFindings`,
    },)
      .map(function readFinding(
        finding,
        position,
      ): string {
        return requireString({
          value: finding,
          path: `${path}.alignmentFindings[${String(position,)}]`,
        },);
      },),
  };
}

/**
 * Reads one version 2 artifact.
 *
 * NAMED FOR THE VERSION, and it refuses every other one including version 1:
 * generic dispatch has already happened by the time this is called, so a
 * version 1 artifact arriving here is a caller reading the wrong file rather
 * than an old artifact needing tolerance.
 *
 * @param value - artifact JSON, freshly parsed and still untyped
 *
 * @returns Everything the artifact records, with its comparison recomputed
 *
 * @throws {@link ArtifactParseError} when the artifact is not version 2, when
 * any field is missing or the wrong shape, when it carries a key this version
 * does not name, or when any two of its parts contradict each other
 *
 * @example
 * ```ts
 * const artifact = parseSettledArtifactV2({ value: JSON.parse(text,), },);
 * ```
 */
export function parseSettledArtifactV2(
  { value, }: { readonly value: unknown; },
): ParsedArtifactV2 {
  /**
   * Artifact as a record.
   */
  const artifact = requireRecord({
    value,
    path: 'artifact',
  },);
  if (artifact.artifactSchemaVersion !== ARTIFACT_SCHEMA_VERSION_V2) {
    throw new ArtifactParseError({
      path: 'artifact.artifactSchemaVersion',
      reason: `${String(ARTIFACT_SCHEMA_VERSION_V2,)}, since this reader describes that generation only `
        + 'and dispatch has already chosen it',
    },);
  }

  /**
   * Entry id, which every nested path is reported under.
   */
  const id = requireString({
    value: artifact.id,
    path: 'artifact.id',
  },);
  requireExactKeys({
    record: artifact,
    allowed: [
      'artifactSchemaVersion',
      'id',
      'tip',
      'pipelineDigest',
      'corpusSha',
      'callConfig',
      'durationMs',
      'timestamp',
      'preparation',
      'lanes',
      'comparison',
      'laneSelection',
    ],
    path: id,
  },);

  /**
   * Slicing both lanes ran over.
   */
  const preparation = parsePreparationV2({
    value: artifact.preparation,
    path: `${id}.preparation`,
  },);

  /**
   * Both lanes, each checked against its own raw result and its own ledger.
   */
  const lanes = parseLanesV2({
    value: artifact.lanes,
    preparation,
    path: `${id}.lanes`,
  },);

  /**
   * Which lane should ship, which nobody has decided.
   */
  const laneSelection = requireRecord({
    value: artifact.laneSelection,
    path: `${id}.laneSelection`,
  },);
  requireExactKeys({
    record: laneSelection,
    allowed: ['kind',],
    path: `${id}.laneSelection`,
  },);
  return {
    id,
    tip: requireString({
      value: artifact.tip,
      path: `${id}.tip`,
    },),
    pipelineDigest: requireDigest({
      value: artifact.pipelineDigest,
      path: `${id}.pipelineDigest`,
    },),
    corpusSha: requireString({
      value: artifact.corpusSha,
      path: `${id}.corpusSha`,
    },),
    callConfig: requireArtifactJsonRecord({
      value: artifact.callConfig,
      path: `${id}.callConfig`,
    },),
    durationMs: requireCount({
      value: artifact.durationMs,
      path: `${id}.durationMs`,
    },),
    timestamp: requireString({
      value: artifact.timestamp,
      path: `${id}.timestamp`,
    },),
    preparation,
    lanes,

    // THE DERIVED COMPARISON, returned only once it matched the recorded one.
    comparison: assertRecordedComparisonMatches({
      recorded: requireArray({
        value: artifact.comparison,
        path: `${id}.comparison`,
      },)
        .map(function readRow(
          row,
          position,
        ) {
          return parseComparisonRowV2({
            value: row,
            path: `${id}.comparison[${String(position,)}]`,
          },);
        },),
      repair: lanes.repair
        .delivery,
      translate: lanes.translate
        .delivery,
      path: `${id}.comparison`,
    },),
    laneSelection: {
      kind: requireOneOf({
        value: laneSelection.kind,
        allowed: ['pending-human-decision',],
        path: `${id}.laneSelection.kind`,
      },),
    },
  };
}

//endregion Artifact version 2 reading
