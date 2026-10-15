/**
 Compose original per-source indexes without merging equal text or repeated literal codes. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import { createGoverningRuleBindings } from './binding-owner.ts';
import { GoverningRuleBindingError } from './binding-error.ts';
import type {
  GoverningRuleBindings,
  GoverningRuleProjection,
  GoverningSource
} from './binding-types.ts';
import type {
  GoverningRuleSet,
  GoverningSetInput,
  GoverningSetProjection,
  GoverningSetSnapshot
} from './set-types.ts';

/**
 One original judgment admits only the existing bounded source-list profile.
 */
const MAX_SOURCES = 128;
/**
 Combined original clause membership stays inside the existing batch profile.
 */
const MAX_CLAUSES = 512;
/**
 Set lifecycle diagnostics omit original governing-source content.
 */
const l = tagged({ tag: 'auto-mode-governing-rule-set' });

/**
 Admit the original immutable source list without copying its occurrence identity.

 @param sources - bootstrap-owned original source list

 @throws GoverningRuleBindingError for mutable, empty, oversized, or repeated source membership
 */
function assertOriginalSources(sources: readonly GoverningSource[]): void {
  if ((!Array.isArray(sources)) || (!Object.isFrozen(sources))
    || (sources.length === 0)
    || (sources.length > MAX_SOURCES)) throw new GoverningRuleBindingError('Original governing sources require a bounded immutable source list');
  if (new Set(sources.map(function readGoverningSourceOccurrence(source: GoverningSource) { 
    return source.occurrence; 
  })).size !== sources.length) throw new GoverningRuleBindingError('Original governing source occurrence is repeated');
}

//region Original source order and per-source candidate identity remain independently observable.
/**
 Compose existing per-source indexes while retaining the exact selected source list.

 @param readSources - original owner returns the same frozen source list while eligible

 @param parse - incumbent qualified Markdown parser

 @returns immutable original source-set selection operations

 @throws GoverningRuleBindingError for invalid source membership or exceeded clause bounds

 @example createGoverningRuleSet({ readSources, parse });
 */
export function createGoverningRuleSet({
  readSources,
  parse
}: GoverningSetInput): GoverningRuleSet {
  /**
   Each original source-set construction keeps its own lifecycle diagnostics.
   */
  const sl = tagged({
    tag: createGoverningRuleSet.name,
    l
  });
  sl.debug('composing original governing source indexes');
  /**
   Retain the original array itself so equal replacement lists cannot regain eligibility.
   */
  const sources = readSources();
  assertOriginalSources(sources);
  /**
   A failed source-set read permanently retires this original set.
   */
  const sourceState: {
    failure: unknown;
    retired: boolean
  } = {
    failure: undefined,
    retired: false
  };
  /**
   Keep each exact per-source projection beside its augmented set projection.
   */
  const records = new WeakMap<object, Readonly<{
    index: GoverningRuleBindings;
    original: GoverningRuleProjection;
    projection: GoverningSetProjection;
  }>>();
  /**
   Equal codes across original sources retain every competing handle.
   */
  const byCode = new Map<string, Readonly<object>[]>();
  /**
   Literal tagged candidates retain source order and local index order.
   */
  const handles: Readonly<object>[] = [];
  /**
   Complete source-owned clause subjects include retained unclassified spans.
   */
  const instructionHandles: Readonly<object>[] = [];
  /**
   Contextual heading aggregates remain separate from individual clause selection.
   */
  const headingHandles: Readonly<object>[] = [];
  /**
   Original indexes retain source-specific diagnostics and currentness checks.
   */
  const indexes: GoverningRuleBindings[] = [];
  /**
   Revalidate the exact original source-list identity and retain original failures.

   @throws GoverningRuleBindingError for changed or retired source sets

   @throws original source-reader failure when that first failure retires the set
   */
  function current(): void {
    if (sourceState.retired) throw new GoverningRuleBindingError(
      'Original governing source set lost eligibility',
      { cause: sourceState.failure }
    );
    try {
      if (readSources() !== sources) throw new GoverningRuleBindingError('Original governing source list changed');
    } catch (error) {
      sourceState.retired = true;
      sourceState.failure = error;
      throw error;
    }
  }
  for (const [sourceOrdinal, source] of sources.entries()) {
    /**
     Per-source bindings use the same original set-lifetime gate.
     */
    const index = createGoverningRuleBindings({
      parse,
      readSource() { 
        current(); 
        return source; 
      }
    });
    indexes.push(index);
    for (const handle of index.indexedInstructionCandidates()) {
      /**
       Preserve the exact source-owned projection before augmenting its source ordinal.
       */
      const original = index.read(handle);
      /**
       Ordinal augmentation does not replace original clause or source identity.
       */
      const projection = Object.freeze({
        ...original,
        sourceOrdinal
      });
      records.set(
        handle,
        { index, original, projection }
      );
      instructionHandles.push(handle);
      if (projection.code !== undefined) {
        handles.push(handle);
        /**
         Duplicate literal codes stay ambiguous across sources.
         */
        const matches = byCode.get(projection.code) ?? [];
        matches.push(handle);
        byCode.set(
          projection.code,
          matches
        );
      }
    }
    for (const handle of index.indexedHeadingContextCandidates()) {
      /**
       Aggregate context keeps the same per-source ownership check as individual clauses.
       */
      const original = index.read(handle);
      /**
       The source ordinal preserves list position without changing contextual content.
       */
      const projection = Object.freeze({
        ...original,
        sourceOrdinal
      });
      records.set(
        handle,
        { index, original, projection }
      );
      headingHandles.push(handle);
    }
  }
  if (instructionHandles.length > MAX_CLAUSES) throw new GoverningRuleBindingError('Combined policy clause count exceeds the original batch profile');
  /**
   Public tagged enumeration remains stable across current reads.
   */
  const candidates = Object.freeze(handles);
  /**
   Public complete enumeration cannot borrow caller-supplied arrays.
   */
  const instructionCandidates = Object.freeze(instructionHandles);
  /**
   Public aggregate enumeration retains source order independently of clause membership.
   */
  const headingContextCandidates = Object.freeze(headingHandles);
  /**
   Enumerate original tagged candidates while the source list remains current.

   @returns canonical frozen tagged candidate array
   */
  function indexedCandidates(): readonly Readonly<object>[] { 
    current();
  return candidates; 
  }
  /**
   Enumerate every retained clause subject while the source list remains current.

   @returns canonical frozen complete candidate array
   */
  function indexedInstructionCandidates(): readonly Readonly<object>[] { 
    current();
  return instructionCandidates; 
  }
  /**
   Enumerate independent contextual-heading subjects while the source list remains current.

   @returns canonical frozen aggregate candidate array
   */
  function indexedHeadingContextCandidates(): readonly Readonly<object>[] { 
    current();
  return headingContextCandidates; 
  }
  /**
   Authenticate original set membership and the unchanged per-source projection.

   @param handle - untrusted original candidate handle

   @returns canonical augmented original source projection

   @throws GoverningRuleBindingError for foreign, changed, or retired membership
   */
  function read(handle: unknown): GoverningSetProjection {
    /**
     Only original object handles can own a retained set projection.
     */
    const record = (handle !== null) && ((typeof handle) === 'object') ? records.get(handle) : undefined;
    if (!record) throw new GoverningRuleBindingError('Clause handle is not owned by this original source set');
    current();
    if (record.index
      .read(handle)
      !== record.original) throw new GoverningRuleBindingError('Original source clause changed');
    return record.projection;
  }
  /**
   Select a literal code only when exactly one original source owns it.

   @param code - untrusted literal source code

   @returns original unambiguous clause handle

   @throws GoverningRuleBindingError for absent or ambiguous source codes
   */
  function select(code: unknown): Readonly<object> {
    current();
    /**
     Nonstring keys cannot identify an original literal source code.
     */
    const matches = (typeof code) === 'string' ? byCode.get(code) : undefined;
    if ((!matches) || (matches.length === 0)) throw new GoverningRuleBindingError('Requested clause is not in the original source set');
    if (matches.length !== 1) throw new GoverningRuleBindingError('Rule code occurs in multiple sources; select its original clause handle');
    return nonNullishOrThrow(matches[0]);
  }
  /**
   Inspect per-source diagnostics only while the original source set remains eligible.

   @returns frozen source-order snapshots retaining occurrence identities
   */
  function inspect(): readonly GoverningSetSnapshot[] {
    current();
    return Object.freeze(indexes.map(function snapshotOriginalSourceIndex(
      index,
      sourceOrdinal
    ) {
      return Object.freeze({
        ...index.inspect(),
        sourceOrdinal,
        sourceOccurrence: nonNullishOrThrow(sources[sourceOrdinal]).occurrence
      });
    }));
  }
  return Object.freeze({
    indexedCandidates,
    indexedInstructionCandidates,
    indexedHeadingContextCandidates,
    read,
    select,
    inspect
  });
}
//endregion
