/**
 * Authoritative host-effect evidence gates.
 *
 * @module
 */

import { createHash, } from 'node:crypto';

import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { HOST_STANDARD_ALGORITHM_IDS, } from '../evidence/host-standard-algorithm-ids.ts';

/**
 * Audited standards algorithm identity.
 *
 * @example
 * ```ts
 * const evidence: StandardEffectAuthority = {
 *   kind: 'standard-algorithm',
 *   standard: 'ECMA-262',
 *   revision: '1355a23e',
 * };
 * ```
 */
export type StandardEffectAuthority = {
  readonly kind: 'standard-algorithm';
  readonly standard: string;
  readonly revision: string;
  readonly sourceDigest: string;
  readonly algorithm: string;
};

/**
 * Audited JavaScript source embedded in one exact Node runtime.
 *
 * @example
 * ```ts
 * const evidence: NodeSourceEffectAuthority = {
 *   kind: 'node-builtin-source',
 *   nodeVersion: '26.5.0',
 *   module: 'path',
 *   sourceDigest: 'sha256 digest',
 * };
 * ```
 */
export type NodeSourceEvidence = {
  readonly module: string;
  readonly sourceDigest: string;
  readonly definitionMarkers: readonly {
    readonly text: string;
    readonly occurrenceCount: number;
  }[];
};

/**
 * Audited callable implementation and public export chain in exact Node runtime.
 */
export type NodeSourceEffectAuthority = NodeSourceEvidence & {
  readonly kind: 'node-builtin-source';
  readonly nodeVersion: string;
  readonly relatedSources: readonly NodeSourceEvidence[];
};

/**
 * Authoritative evidence accepted for host effect summaries.
 */
export type HostEffectAuthority = StandardEffectAuthority | NodeSourceEffectAuthority;

/**
 * Exact ECMA-262 revision audited by intrinsic catalog entries.
 *
 * @example
 * ```ts
 * const authority = ecma262Authority({ algorithm: 'Set.prototype.add' });
 * ```
 *
 * @returns exact pinned ECMA-262 algorithm authority.
 */
export function ecma262Authority({
  algorithm,
}: {
  readonly algorithm: string;
}): StandardEffectAuthority {
  return {
    kind: 'standard-algorithm',
    standard: 'ECMA-262',
    revision: '1355a23e48aaf2b1d7b6cbfad0fb98bce999cfd1',
    sourceDigest: '313826a4ff419145470a9d688b8da21e326374afb2a9c73aa9183fbc57162845',
    algorithm: `sec-${algorithm.toLowerCase()}`,
  };
}

/**
 * Pinned authoring-source digests accepted for standard evidence.
 */
const STANDARD_SOURCE_DIGESTS: Readonly<Record<string, string>> = {
  'CSSOM View@0222af95924db44c8e10d993b614596cd6f35cbb': '462ce76726254774db4d7ebb35b620bab95af445872af234391a0342ac043c19',
  'CSSOM@0222af95924db44c8e10d993b614596cd6f35cbb': '5a0b6a2f116ad450c22a202241c997c4a64d9c13bb9e011c5a0bcc4345f89668',
  'DOM@5796f716c857f0a563d11d32e0ca6b49232191be': 'f977c54983bdd54104e3860d5ef62f973ec9907ea8226858f5270fea502ebe52',
  'ECMA-262@1355a23e48aaf2b1d7b6cbfad0fb98bce999cfd1': '313826a4ff419145470a9d688b8da21e326374afb2a9c73aa9183fbc57162845',
  'Encoding@a985b62a9b45c17da3e17a9f0a0b4e30c34c4a8a': '90bd4f43b965186afd34661d5ad0f45d35f9a178da895dcc9f08f610cc031c55',
  'HTML@255188e5a85208fd825650b8e5f9dc17505abc53': 'be8381b4792c5180baa78ec6a6846ea714b7420d90754e2ee53c69af2c888e3a',
};

/**
 * Sentinel for unavailable Node built-in source collection.
 */
const NODE_NATIVE_SOURCES_UNAVAILABLE: unique symbol = Symbol('Node native sources unavailable',);

/**
 * Sentinel before first native-source query.
 */
const NODE_NATIVE_SOURCES_UNINITIALIZED: unique symbol = Symbol('Node native sources not queried',);

/**
 * Host authority logger for private-source access failures.
 */
const l = tagged({ tag: 'host-effect-authority', },);

/**
 * Exact built-in source map cached after first authority query.
 */
const nativeSources: {
  value: Readonly<Record<string, unknown>>
    | typeof NODE_NATIVE_SOURCES_UNAVAILABLE
    | typeof NODE_NATIVE_SOURCES_UNINITIALIZED;
} = { value: NODE_NATIVE_SOURCES_UNINITIALIZED, };

/**
 * Narrows unknown runtime value to string-keyed source collection.
 *
 * @param value - Private binding result.
 *
 * @returns whether property lookup is safe.
 */
function isSourceRecord(value: unknown,): value is Readonly<Record<string, unknown>> {
  return ((typeof value) === 'object') && (value !== null);
}

/**
 * Reads JavaScript sources embedded in current Node executable.
 *
 * @returns source collection or unavailable sentinel.
 */
function nodeNativeSources(): Readonly<Record<string, unknown>> | typeof NODE_NATIVE_SOURCES_UNAVAILABLE {
  if (nativeSources.value !== NODE_NATIVE_SOURCES_UNINITIALIZED)
    return nativeSources.value;
  if (!('binding' in process)) {
    nativeSources.value = NODE_NATIVE_SOURCES_UNAVAILABLE;
    return nativeSources.value;
  }
  if ((typeof process.binding) !== 'function') {
    nativeSources.value = NODE_NATIVE_SOURCES_UNAVAILABLE;
    return nativeSources.value;
  }
  /**
   * Private binding exposed by Node for legacy native-source access.
   */
  const { binding, } = process;
  try {
    /**
     * Native JavaScript source collection from exact running executable.
     */
    const value: unknown = Reflect.apply(
      binding,
      process,
      ['natives',],
    );
    nativeSources.value = isSourceRecord(value,)
      ? value
      : NODE_NATIVE_SOURCES_UNAVAILABLE;
  }
  catch (error) {
    l.debug(`Node native sources unavailable: ${String(error,)}`,);
    nativeSources.value = NODE_NATIVE_SOURCES_UNAVAILABLE;
  }
  return nativeSources.value;
}

/**
 * Counts non-overlapping source marker occurrences.
 *
 * @param source - Exact embedded module source.
 *
 * @param marker - Definition marker and audited occurrence count.
 *
 * @returns number of marker occurrences.
 */
function markerOccurrenceCount({
  source,
  marker,
}: {
  readonly source: string;
  readonly marker: string;
}): number {
  if (marker.length === 0)
    return 0;
  /**
   * Mutable cursor advances monotonically through source.
   */
  const cursor = {
    offset: 0,
    count: 0,
  };
  while (cursor.offset < source.length) {
    /**
     * Next exact marker occurrence.
     */
    const next = source.indexOf(
      marker,
      cursor.offset,
    );
    if (next === (-1))
      return cursor.count;
    cursor.count += 1;
    cursor.offset = next + marker.length;
  }
  return cursor.count;
}

/**
 * Tests one exact embedded Node source and its identity markers.
 *
 * @param sources - Embedded source collection from running executable.
 *
 * @param evidence - Exact module digest and definition or export markers.
 *
 * @returns whether source identity and every marker match.
 */
function nodeSourceEvidenceAvailable({
  sources,
  evidence,
}: {
  readonly sources: Readonly<Record<string, unknown>>;
  readonly evidence: NodeSourceEvidence;
}): boolean {
  /**
   * Exact built-in source audited for effect entry.
   */
  const source = sources[evidence.module];
  if ((typeof source) !== 'string')
    return false;
  /**
   * Exact source digest from running executable.
   */
  const sourceDigest = createHash('sha256',)
    .update(source,)
    .digest('hex',);
  if (sourceDigest !== evidence.sourceDigest)
    return false;
  return evidence.definitionMarkers
    .every(function markerMatches(marker,): boolean {
      return markerOccurrenceCount({
        source,
        marker: marker.text,
      },) === marker.occurrenceCount;
    },);
}

/**
 * Tests whether exact authoritative host evidence is available now.
 *
 * @param authority - Audited standard revision or Node source identity.
 *
 * @returns whether catalog entry may be trusted.
 *
 * @example
 * ```ts
 * hostEffectAuthorityAvailable({
 *   kind: 'standard-algorithm',
 *   standard: 'DOM',
 *   revision: '5796f716',
 * });
 * ```
 */
export function hostEffectAuthorityAvailable(authority: HostEffectAuthority,): boolean {
  if (authority.kind === 'standard-algorithm') {
    /**
     * Exact pinned authoring-source identity.
     */
    const sourceKey = `${authority.standard}@${authority.revision}`;
    /**
     * Independently recorded digest for pinned source identity.
     */
    const expectedDigest = STANDARD_SOURCE_DIGESTS[sourceKey];
    if (expectedDigest !== authority.sourceDigest)
      return false;
    /**
     * Exact algorithm identity extracted from pinned source.
     */
    const algorithmKey = `${sourceKey}#${authority.algorithm}`;
    return HOST_STANDARD_ALGORITHM_IDS.has(algorithmKey,);
  }
  /**
   * Exact running Node version.
   */
  const { node: nodeVersion, } = process.versions;
  if (nodeVersion !== authority.nodeVersion)
    return false;
  /**
   * Embedded source collection for exact running Node executable.
   */
  const sources = nodeNativeSources();
  if (sources === NODE_NATIVE_SOURCES_UNAVAILABLE)
    return false;
  if (!nodeSourceEvidenceAvailable({
    sources,
    evidence: authority,
  }))
    return false;
  return authority.relatedSources
    .every(function relatedSourceAvailable(evidence,): boolean {
    return nodeSourceEvidenceAvailable({
      sources,
      evidence,
    });
  },);
}
