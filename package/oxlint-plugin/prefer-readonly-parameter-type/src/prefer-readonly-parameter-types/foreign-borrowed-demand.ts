/**
 * Preconditions and result reading for one demanded foreign-ownership proof.
 *
 * Both halves answer questions about a proof rather than performing one: whether a scope can
 * produce any foreign parameter at all, and whether a completed closure answered for the callable
 * it was rooted at. They live beside `foreign-borrowed-complete-graph.ts` rather than inside the
 * demand index because neither is about expanding the effect graph.
 *
 * @module
 */

import type { SourceFile, } from 'typescript/unstable/ast';

import type { ParameterIndex, } from './effect-slot-identity.ts';
import { SemanticBridgeError, } from './semantic-bridge-error.ts';

/**
 * Identifiers an ownership marker must be written as to be detectable at all.
 *
 * `isForeignBorrowedType` in `foreign-borrowed-identity.ts` requires the type's alias symbol to
 * carry one of these names and to resolve to the marker package, so a marker renamed on import is
 * already invisible to the classifier.
 */
const OWNERSHIP_MARKER_NAMES: readonly string[] = [
  'ForeignBorrowed',
  'ForeignHostCapability',
];

/**
 * Whether any indexed source names an ownership marker at all.
 *
 * The complete backwards closure walks exactly these sources, so a scope naming no marker was
 * taken to yield no foreign parameter for any callable, which makes the skip look like an
 * equivalence. It matters because the closure otherwise runs once per callable whose verdict
 * demands it, and most packages name no marker.
 *
 * Two ways it is not the equivalence its original comment claimed, both recorded in
 * `doc/planning/prefer-readonly-foreign-proof-cost.md`:
 * a markerless recursive component can produce a candidate, where the skip is the more correct of
 * the two answers and `foreign-borrowed-grounding.ts` closes the gap from the other side;
 * and this is a syntactic test over owned source text while the classifiers inspect checker types,
 * so a value typed `ForeignBorrowed<T>` through a declaration file this scope never spells can
 * seed provenance the skip then misses. That second one withholds nothing and emits an offer, so
 * it is the unsound direction and is tracked rather than hidden here.
 *
 * @param indexedSourceFiles - Complete owned source scope the closure would walk.
 *
 * @returns whether a proof could find any marker to anchor on.
 *
 * @example
 * ```ts
 * scopeNamesOwnershipMarker({ indexedSourceFiles, });
 * ```
 */
export function scopeNamesOwnershipMarker({
  indexedSourceFiles,
}: {
  readonly indexedSourceFiles: ReadonlyMap<string, SourceFile>;
},): boolean {
  return [...indexedSourceFiles.values(),]
    .some(function namesMarker(sourceFile,): boolean {
      return OWNERSHIP_MARKER_NAMES
        .some(function named(markerName,): boolean {
          return sourceFile.text
            .includes(markerName,);
        },);
    },);
}

/**
 * Reads one root's own entry from its complete backwards closure.
 *
 * The entry is always present: `initializeCandidates` sets one for every summary with no
 * condition, `groundForeignCandidates` returns one per candidate, and the root is seeded into
 * `summaries` before anything is enumerated. Absence therefore means the walk broke its own
 * invariant, and the tempting default is the unsafe one: an empty set reads as "proven to own
 * nothing foreign", which is the answer that emits a read-only offer. Failing loudly costs one
 * file its analysis; defaulting could cost a caller its guarantee.
 *
 * @param completeForeign - Foreign parameters by callable from one rooted closure.
 *
 * @param key - Identity of callable the closure was rooted at.
 *
 * @returns proven foreign parameters for root.
 *
 * @throws SemanticBridgeError when closure omits its own root.
 *
 * @example
 * ```ts
 * provenRootEntry({ completeForeign, key: callableKey(declaration,), });
 * ```
 */
export function provenRootEntry({
  completeForeign,
  key,
}: {
  readonly completeForeign: ReadonlyMap<string, ReadonlySet<ParameterIndex>>;
  readonly key: string;
},): ReadonlySet<ParameterIndex> {
  /**
   * Root's own proven parameters, absent only when the closure omitted its root.
   */
  const rootEntry = completeForeign.get(key,);
  if (rootEntry === undefined) {
    throw new SemanticBridgeError({
      reason: 'analysis-incomplete',
      message: `Foreign ownership closure rooted at ${key} returned no entry for its own root.`,
    },);
  }
  return rootEntry;
}
