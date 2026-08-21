/**
 * Incremental persistent-cache envelope identity and validation.
 *
 * @module
 */

import type { EffectProjectSurfaces, } from './effect-project-fingerprint.ts';
import { EFFECT_CACHE_SCHEMA, } from './effect-summary-cache-identity.ts';
import {
  isCacheString,
  MAX_CALLABLE_ARITY,
} from './effect-summary-cache-primitive.ts';
import { isSerializedEffectSummaries, } from './effect-summary-cache-validation.ts';
import type { SerializedEffectSummaries, } from './effect-summary-serialization.ts';

/**
 * Sentinel returned when envelope validation cannot prove an exact hit.
 */
export const ENVELOPE_INVALID: unique symbol = Symbol(
  'persistent cache envelope failed validation',
);

/**
 * Validated incremental JSON cache envelope.
 *
 * `dependencyDigests` snapshots the content identity of every non-declaration
 * workspace file in the entry's transitive module-dependency closure at
 * creation time; an entry revalidates only while each snapshot digest matches
 * the current program and every whole-scope surface digest is unchanged.
 * `directDependencies` retains the closure's first edges so later builds can
 * recompute closures without re-resolving unchanged files.
 * `dependenciesResolved` marks whether module references resolved completely;
 * an unresolved entry snapshots the whole indexed scope instead and must
 * never seed another file's closure walk.
 */
export type PersistentEffectCacheEnvelope = {
  readonly schema: number;
  readonly analyzerDigest: string;
  readonly projectKey: string;
  readonly fileName: string;
  readonly sourceDigest: string;
  readonly surfaces: EffectProjectSurfaces;
  readonly dependenciesResolved: boolean;
  readonly directDependencies: readonly string[];
  readonly dependencyDigests: Readonly<Record<string, string>>;
  readonly omittedCallableKeys: readonly string[];
  readonly payload: SerializedEffectSummaries;
};

/**
 * Current program state one envelope validates against.
 */
export type PersistentEffectDependencyState = {
  readonly surfaces: EffectProjectSurfaces;
  readonly sourceDigests: ReadonlyMap<string, string>;
};

/**
 * Tests whether unknown JSON value is property-bearing record.
 *
 * @param value - Parsed JSON value.
 *
 * @returns whether value can be inspected by string key.
 */
function isRecord(value: unknown,): value is Readonly<Record<string, unknown>> {
  return ((typeof value) === 'object')
    && (value !== null)
    && (!Array.isArray(value,));
}

/**
 * Tests whether unknown JSON value is string-to-string record.
 *
 * @param value - Parsed JSON value.
 *
 * @returns whether every property value is a string.
 */
function isStringRecord(value: unknown,): value is Readonly<Record<string, string>> {
  if (!isRecord(value,))
    return false;
  return Object.values(value,)
    .every(function stringValue(entry,): boolean {
      return (typeof entry) === 'string';
    },);
}

/**
 * Tests whether parsed omission identities are bounded unique cache strings.
 *
 * @param value - Parsed omission list.
 *
 * @param fileName - Source identity every omitted callable must belong to.
 *
 * @param payload - Validated summaries that omissions must not duplicate.
 *
 * @returns whether every identity belongs to source,
 * is absent from payload,
 * and appears once.
 *
 * @example
 * ```ts
 * isOmittedCallableKeys({
 *   value: ['source.ts:1:2:3'],
 *   fileName: 'source.ts',
 *   payload: [],
 * });
 * ```
 */
function isOmittedCallableKeys({
  value,
  fileName,
  payload,
}: {
  readonly value: readonly unknown[];
  readonly fileName: string;
  readonly payload: SerializedEffectSummaries;
}): boolean {
  if (value.length > MAX_CALLABLE_ARITY)
    return false;
  /**
   * Validated string identities rejecting cache amplification through duplicates.
   */
  const keys = value.filter(function cacheString(entry,): entry is string {
    return isCacheString(entry,);
  },);
  /**
   * Persisted summary identities that cannot also be deliberate omissions.
   */
  const summaryKeys = new Set(payload.map(function summaryKey([key,],): string {
    return key;
  },),);
  return (keys.length === value.length)
    && (new Set(keys,).size === keys.length)
    && keys.every(function validOmissionKey(key,): boolean {
      return key.startsWith(`${fileName}:`,) && (!summaryKeys.has(key,));
    },);
}

/**
 * Tests whether parsed surfaces match current whole-scope surfaces exactly.
 *
 * @param value - Parsed JSON surfaces value.
 *
 * @param surfaces - Current whole-scope surface digests.
 *
 * @returns whether every surface digest matches.
 */
function surfacesMatch({
  value,
  surfaces,
}: {
  readonly value: unknown;
  readonly surfaces: EffectProjectSurfaces;
}): boolean {
  return isRecord(value,)
    && (value.fileListDigest === surfaces.fileListDigest)
    && (value.declarationSurfaceDigest === surfaces.declarationSurfaceDigest)
    && (value.augmentationSurfaceDigest === surfaces.augmentationSurfaceDigest)
    && (value.compilerOptionsDigest === surfaces.compilerOptionsDigest)
    && (value.lockfileDigest === surfaces.lockfileDigest);
}

/**
 * Tests whether every snapshot dependency digest matches current program.
 *
 * @param dependencyDigests - Parsed snapshot digests keyed by file path.
 *
 * @param sourceDigests - Current per-source content digests.
 *
 * @returns whether each dependency file is present and unchanged.
 */
function dependenciesMatch({
  dependencyDigests,
  sourceDigests,
}: {
  readonly dependencyDigests: Readonly<Record<string, string>>;
  readonly sourceDigests: ReadonlyMap<string, string>;
}): boolean {
  return Object.entries(dependencyDigests,)
    .every(function dependencyUnchanged([fileName, snapshotDigest,],): boolean {
      return sourceDigests.get(fileName,) === snapshotDigest;
    },);
}

/**
 * Validates parsed cache envelope against requested identity and program state.
 *
 * @param value - Parsed JSON value.
 *
 * @param identity - Requested analyzer, project, file, and source identity.
 *
 * @param state - Current whole-scope surfaces and per-source digests.
 *
 * @returns validated envelope or invalid sentinel.
 *
 * @example
 * ```ts
 * validatePersistentEnvelope({ value, identity, state });
 * ```
 */
export function validatePersistentEnvelope({
  value,
  identity,
  state,
}: {
  readonly value: unknown;
  readonly identity: {
    readonly analyzerDigest: string;
    readonly projectKey: string;
    readonly fileName: string;
    readonly sourceDigest: string;
  };
  readonly state: PersistentEffectDependencyState;
}): PersistentEffectCacheEnvelope | typeof ENVELOPE_INVALID {
  if ((!isRecord(value,))
    || (value.schema !== EFFECT_CACHE_SCHEMA)
    || (value.analyzerDigest !== identity.analyzerDigest)
    || (value.projectKey !== identity.projectKey)
    || (value.fileName !== identity.fileName)
    || (value.sourceDigest !== identity.sourceDigest)
    || (!surfacesMatch({
      value: value.surfaces,
      surfaces: state.surfaces,
    },))
    || ((typeof value.dependenciesResolved) !== 'boolean')
    || (!Array.isArray(value.directDependencies,))
    || (!value.directDependencies
      .every(function stringDependency(entry,): boolean {
        return (typeof entry) === 'string';
      },))
    || (!isStringRecord(value.dependencyDigests,))
    || (!dependenciesMatch({
      dependencyDigests: value.dependencyDigests,
      sourceDigests: state.sourceDigests,
    },))
    || (!Array.isArray(value.omittedCallableKeys,))
    || (!isSerializedEffectSummaries(value.payload,))
    || (!isOmittedCallableKeys({
      value: value.omittedCallableKeys,
      fileName: identity.fileName,
      payload: value.payload,
    },)))
    return ENVELOPE_INVALID;
  return {
    schema: EFFECT_CACHE_SCHEMA,
    analyzerDigest: identity.analyzerDigest,
    projectKey: identity.projectKey,
    fileName: identity.fileName,
    sourceDigest: identity.sourceDigest,
    surfaces: state.surfaces,
    dependenciesResolved: value.dependenciesResolved,
    directDependencies: value.directDependencies
      .filter(function stringEntry(entry,): entry is string {
        return (typeof entry) === 'string';
      },),
    dependencyDigests: value.dependencyDigests,
    omittedCallableKeys: value.omittedCallableKeys
      .filter(function omittedKey(entry,): entry is string {
        return (typeof entry) === 'string';
      },),
    payload: value.payload,
  };
}
