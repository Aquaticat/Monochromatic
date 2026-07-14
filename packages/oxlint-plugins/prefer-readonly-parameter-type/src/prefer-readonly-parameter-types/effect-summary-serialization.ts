/**
 * JSON representation for persistent direct effect summaries.
 *
 * @module
 */

import {
  type CallbackRelation,
  type CallEdge,
  type MutableEffectSummary,
  OWNED_CALLABLE_UNAVAILABLE,
} from './effect-summary-model.ts';

/**
 * Serialized unavailable callback identity.
 */
const UNAVAILABLE_CALLBACK = 'unavailable';

/**
 * Serialized owned callback identity.
 */
const OWNED_CALLBACK = 'owned';

/**
 * JSON-safe callback identity.
 */
export type SerializedCallbackKey =
  | {
    readonly kind: typeof UNAVAILABLE_CALLBACK;
  }
  | {
    readonly kind: typeof OWNED_CALLBACK;
    readonly key: string;
  };

/**
 * JSON-safe call edge.
 */
export type SerializedCallEdge = Omit<CallEdge, 'callbackKeys'> & {
  readonly callbackKeys: readonly SerializedCallbackKey[];
};

/**
 * JSON-safe direct summary.
 */
export type SerializedEffectSummary = {
  readonly parameterCount: number;
  readonly directMutated: readonly number[];
  readonly directInvoked: readonly number[];
  readonly directOpaque: readonly number[];
  readonly directDocumentedUncertain: readonly number[];
  readonly opaqueProvenanceByParameter: readonly (readonly [
    number,
    readonly string[]
  ])[];
  readonly mutated: readonly number[];
  readonly invoked: readonly number[];
  readonly opaque: readonly number[];
  readonly documentedUncertain: readonly number[];
  readonly directForeignBorrowed: readonly number[];
  readonly relations: readonly CallbackRelation[];
  readonly calls: readonly SerializedCallEdge[];
};

/**
 * JSON-safe summaries keyed by stable callable identity.
 */
export type SerializedEffectSummaries = readonly (
  readonly [
    string,
    SerializedEffectSummary
  ]
)[];

/**
 * Serializes callback identity without process-local symbols.
 *
 * @param key - Owned callable key or unavailable sentinel.
 *
 * @returns JSON-safe callback identity.
 *
 * @example
 * ```ts
 * serializeCallbackKey(OWNED_CALLABLE_UNAVAILABLE);
 * ```
 */
function serializeCallbackKey(
  key: string | typeof OWNED_CALLABLE_UNAVAILABLE,
): SerializedCallbackKey {
  return key === OWNED_CALLABLE_UNAVAILABLE
    ? { kind: UNAVAILABLE_CALLBACK, }
    : {
      kind: OWNED_CALLBACK,
      key,
    };
}

/**
 * Restores callback identity from JSON-safe representation.
 *
 * @param key - Serialized callback identity.
 *
 * @returns owned callable key or unavailable sentinel.
 *
 * @example
 * ```ts
 * deserializeCallbackKey({ kind: 'unavailable' });
 * ```
 */
function deserializeCallbackKey(
  key: SerializedCallbackKey,
): string | typeof OWNED_CALLABLE_UNAVAILABLE {
  return key.kind === UNAVAILABLE_CALLBACK
    ? OWNED_CALLABLE_UNAVAILABLE
    : key.key;
}

/**
 * Serializes direct summaries for persistent cache storage.
 *
 * @param summaries - Direct summaries tied to one exact source.
 *
 * @returns deterministic JSON-safe entries.
 *
 * @example
 * ```ts
 * serializeEffectSummaries(summaries);
 * ```
 */
export function serializeEffectSummaries(
  summaries: ReadonlyMap<string, MutableEffectSummary>,
): SerializedEffectSummaries {
  return [...summaries.entries(),]
    .toSorted(function sortEntries(
      [left,],
      [right,],
    ): number {
      return left.localeCompare(right,);
    },)
    .map(function serializeEntry([key, summary,],): readonly [
      string,
      SerializedEffectSummary,
    ] {
      return [
        key,
        {
          parameterCount: summary.parameterCount,
          directMutated: [...summary.directMutated,],
          directInvoked: [...summary.directInvoked,],
          directOpaque: [...summary.directOpaque,],
          directDocumentedUncertain: [...summary.directDocumentedUncertain,],
          opaqueProvenanceByParameter: [...summary.opaqueProvenanceByParameter
            .entries(),]
            .map(function serializeProvenance([index, facts,],): readonly [
              number,
              readonly string[]
            ] {
              return [
                index,
                [...facts,].toSorted(),
              ];
            },),
          mutated: [...summary.mutated,],
          invoked: [...summary.invoked,],
          opaque: [...summary.opaque,],
          documentedUncertain: [...summary.documentedUncertain,],
          directForeignBorrowed: [...summary.directForeignBorrowed,],
          relations: summary.relations
            .map(function copyRelation(relation,) {
            return { ...relation, };
          },),
          calls: summary.calls
            .map(function serializeCall(edge,): SerializedCallEdge {
            return {
              ...edge,
              callbackKeys: edge.callbackKeys
                .map(serializeCallbackKey,),
            };
          },),
        },
      ];
    },);
}

/**
 * Deserializes direct summaries after cache envelope validation.
 *
 * @param summaries - JSON-safe summary entries written by this analyzer.
 *
 * @returns mutable direct summaries safe for fixed-point propagation.
 *
 * @throws TypeError when structurally corrupt payload cannot be rehydrated.
 *
 * @example
 * ```ts
 * deserializeEffectSummaries(serialized);
 * ```
 */
export function deserializeEffectSummaries(
  summaries: SerializedEffectSummaries,
): ReadonlyMap<string, MutableEffectSummary> {
  return new Map(summaries.map(function deserializeEntry([key, summary,],): [
    string,
    MutableEffectSummary,
  ] {
    return [
      key,
      {
        parameterCount: summary.parameterCount,
        bindingOriginBySymbolId: new Map(),
        directMutated: new Set(summary.directMutated,),
        directInvoked: new Set(summary.directInvoked,),
        directOpaque: new Set(summary.directOpaque,),
        directDocumentedUncertain: new Set(summary.directDocumentedUncertain,),
        opaqueProvenanceByParameter: new Map(summary.opaqueProvenanceByParameter
          .map(function deserializeProvenance([index, facts,],): [
            number,
            Set<string>
          ] {
            return [
              index,
              new Set(facts,),
            ];
          },),),
        mutated: new Set(summary.mutated,),
        invoked: new Set(summary.invoked,),
        opaque: new Set(summary.opaque,),
        documentedUncertain: new Set(summary.documentedUncertain,),
        directForeignBorrowed: new Set(summary.directForeignBorrowed,),
        relations: summary.relations
          .map(function copyRelation(relation,) {
          return { ...relation, };
        },),
        calls: summary.calls
          .map(function deserializeCall(edge,): CallEdge {
          return {
            ...edge,
            callbackKeys: edge.callbackKeys
              .map(deserializeCallbackKey,),
          };
        },),
      },
    ];
  },),);
}
