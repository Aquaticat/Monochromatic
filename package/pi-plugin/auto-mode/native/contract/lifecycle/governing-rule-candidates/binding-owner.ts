/**
 Bind exact original source clauses and permanently retain source invalidation. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { GoverningRuleBindingError } from './binding-error.ts';
import {
  assertGoverningSource,
  readGoverningBindingIndex,
  referencedGoverningHeadings
} from './binding-index.ts';
import { captureGoverningCandidates } from './binding-candidates.ts';
import type {
  GoverningBindingInput,
  GoverningBindingSnapshot,
  GoverningRuleBindings,
  GoverningRuleProjection,
} from './binding-types.ts';

/**
 Binding diagnostics identify lifecycle changes without logging source content.
 */
const l = tagged({ tag: 'auto-mode-governing-rule-binding' });

//region Original source identity remains mandatory for every usable candidate read.
/**
 Bind exact indexed clauses to one already selected original source.

 @param readSource - original owner authenticates the same source occurrence on every read

 @param parse - incumbent Markdown parser preserves original source positions

 @returns immutable original source binding operations

 @throws GoverningRuleBindingError for unavailable source capabilities, changed bytes, or stale occurrences

 @example createGoverningRuleBindings({ readSource, parse });
 */
export function createGoverningRuleBindings({
  readSource,
  parse
}: GoverningBindingInput): GoverningRuleBindings {
  /**
   Each original source has a distinct diagnostic scope.
   */
  const sl = tagged({
    tag: createGoverningRuleBindings.name,
    l
  });
  sl.debug('binding original governing source');
  if (((typeof readSource) !== 'function') || ((typeof parse) !== 'function')) throw new GoverningRuleBindingError('Original governing-source reader and qualified Markdown parser are required');
  /**
   Preserve the exact original source record, not a normalized copy.
   */
  const source = readSource();
  assertGoverningSource(source);
  /**
   Source bytes determine retained structural intervals before handle construction.
   */
  const index = readGoverningBindingIndex({
    source,
    parse
  });
  /**
   Contextual heading membership uses original parser objects.
   */
  const referenced = referencedGoverningHeadings(index);
  /**
   Original source capture owns every clause and contextual-heading handle.
   */
  const capture = captureGoverningCandidates({
    source,
    index,
    referenced
  });
  /**
   Once invalidated, this original source cannot regain eligibility through later recovery.
   */
  const sourceState: {
    failure: unknown;
    stale: boolean
  } = {
    failure: undefined,
    stale: false
  };
  /**
   Check exact original source identity and permanently retain any failed source read.

   @throws GoverningRuleBindingError for invalidated or changed original sources
   */
  function current(): void {
    /**
     Source lifetime failures remain scoped to the original currentness check.
     */
    const rl = tagged({
      tag: current.name,
      l: sl
    });
    if (sourceState.stale) throw new GoverningRuleBindingError(
      'Original governing-rule source was already invalidated',
      { cause: sourceState.failure }
    );
    try {
      if (readSource() !== source) throw new GoverningRuleBindingError('Original governing-source occurrence changed');
    } catch (error) {
      sourceState.stale = true;
      sourceState.failure = error;
      rl.debug('retained original governing-source invalidation');
      throw new GoverningRuleBindingError(
        'Governing-rule binding is no longer current',
        { cause: error }
      );
    }
  }
  /**
   Enumerate literal tagged candidates without claiming semantic coverage.

   @returns original immutable tagged candidate array
   */
  function indexedCandidates(): readonly Readonly<object>[] {
    current();
    return capture.candidateHandles;
  }
  /**
   Enumerate every retained clause subject without inferring instruction status.

   @returns original immutable clause candidate array in source order
   */
  function indexedInstructionCandidates(): readonly Readonly<object>[] {
    current();
    return capture.instructionHandles;
  }
  /**
   Enumerate the separate aggregate contextual-heading subject when present.

   @returns original immutable aggregate candidate array
   */
  function indexedHeadingContextCandidates(): readonly Readonly<object>[] {
    current();
    return capture.headingCandidates;
  }
  /**
   Select only literal codes from this original source's index.

   @param code - untrusted literal code lookup

   @returns original canonical clause handle

   @throws GoverningRuleBindingError for absent original codes
   */
  function select(code: unknown): Readonly<object> {
    current();
    /**
     Nonstring keys cannot match original literal source codes.
     */
    const handle = (typeof code) === 'string' ? capture.byCode
      .get(code) : undefined;
    if (!handle) throw new GoverningRuleBindingError('Requested clause is not in the original indexed policy');
    return handle;
  }
  /**
   Authenticate original clause membership before checking source eligibility.

   @param handle - untrusted candidate handle

   @returns exact immutable original source projection

   @throws GoverningRuleBindingError for foreign or invalidated candidate handles
   */
  function read(handle: unknown): GoverningRuleProjection {
    /**
     Opaque original handles are objects; primitives and foreign objects have no membership.
     */
    const projection = (handle !== null) && ((typeof handle) === 'object') ? capture.records
      .get(handle) : undefined;
    if (!projection) throw new GoverningRuleBindingError('Clause handle is not owned by this original governing-source binding');
    current();
    return projection;
  }
  /**
   Inspect retained diagnostics without retrying original source reads or granting eligibility.

   @returns frozen historical source coverage and original failure values
   */
  function inspect(): GoverningBindingSnapshot {
    return Object.freeze({
      retainedOnly: true,
      stale: sourceState.stale,
      failure: sourceState.failure,
      sourceSHA256: source.sha256,
      codes: Object.freeze([...capture.byCode
        .keys()]),
      unclassified: capture.retainedUnclassified,
      instructionCandidates: capture.instructionHandles,
      contextualHeadings: capture.retainedContextualHeadings,
      headingContextCandidate: capture.headingContextCandidate,
      structuralCoverage: capture.retainedUnclassified
        .length
        > 0 ? 'unclassified-nodes-retained' : index.structuralCoverage,
      authorityEstablishedByIndex: false,
      semanticQualification: 'not-established',
    });
  }
  current();
  return Object.freeze({
    select,
    read,
    indexedCandidates,
    indexedInstructionCandidates,
    indexedHeadingContextCandidates,
    inspect
  });
}
//endregion
