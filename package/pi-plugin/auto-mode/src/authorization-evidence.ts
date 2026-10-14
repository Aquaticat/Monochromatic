/**
 Request-local prerequisite evidence collection through fixed bootstrap owners.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { captureOriginalAuthorizationBinding, } from './authorization-evidence-binding.ts';
import { AuthorizationEvidenceError, } from './authorization-evidence-data.ts';
import type {
  AuthorizationEvidenceBinding,
  AuthorizationEvidenceInputs,
  AuthorizationEvidenceRecord,
  AuthorizationFacts,
  AuthorizationInputSources,
  AuthorizationOwnerFactory,
} from './authorization-evidence-types.ts';

/**
 Collection diagnostics never include original source or request contents.
 */
const l = tagged({ tag: 'auto-mode-authorization-evidence', },);

//region Startup selects owners while runtime calls receive only original evidence

/**
 Narrow factory shape without invoking it or establishing its authority.

 @param input - bootstrap capability candidate
 
 @returns whether a callable factory was supplied
 */
function isAuthorizationOwnerFactory(input: unknown,): input is AuthorizationOwnerFactory {
  return (typeof input) === 'function';
}

/**
 Narrow a fixed bootstrap factory without interpreting its output as authority.

 @param input - factory supplied by trusted host bootstrap
 
 @returns same callable, or absence when no owner is configured
 
 @throws AuthorizationEvidenceError for unsupported configured values
 */
export function captureAuthorizationOwnerFactory(input: unknown,): AuthorizationOwnerFactory | undefined {
  /**
   Startup validation is distinct from request-local evidence capture.
   */
  const rl = tagged({
    tag: captureAuthorizationOwnerFactory.name,
    l,
  },);
  rl.debug('checking bootstrap prerequisite owner factory',);
  if (input === undefined)
    return undefined;
  if (!isAuthorizationOwnerFactory(input,))
    throw new AuthorizationEvidenceError('Authorization owner factory must be a bootstrap callable when supplied',);
  return input;
}

/**
 Collect independent prerequisite facts from original native bindings.
 A trusted factory does not replace source authority or clause interpretation.
 Missing evidence stays absent; any eligibility failure permanently retires this collection.

 @param judgment - original prepared judgment selected by the native response owner
 
 @param inputs - already authenticated original source views and candidate readers
 
 @param ownerFor - fixed bootstrap factory, never an action or model field
 
 @returns original evidence collection with scoped lookup and freshness checks
 
 @throws AuthorizationEvidenceError for unsupported, mismatched or stale evidence
 
 @throws original failure from the source or fact owner
 */
export async function captureAuthorizationInputs(
  {
    judgment,
    inputs,
    ownerFor,
  }: {
    readonly judgment: object;
    readonly inputs: AuthorizationInputSources;
    readonly ownerFor?: AuthorizationOwnerFactory | undefined;
  },
): Promise<AuthorizationEvidenceInputs> {
  /**
   Collection lifecycle logs retain the owning function boundary.
   */
  const rl = tagged({
    tag: captureAuthorizationInputs.name,
    l,
  },);
  rl.debug('collecting original prerequisite evidence',);
  /**
   Native ownership authenticates this original candidate array.
   */
  const candidates = inputs.instructionCandidates ?? inputs.ruleCandidates;
  /**
   Each clause retains its own evidence rather than combining facts across clauses.
   */
  const bindings = new Map<object, AuthorizationEvidenceBinding>();
  /**
   Failure wrappers preserve falsy original thrown values.
   */
  let failure: { readonly error: unknown } | undefined;
  if (ownerFor !== undefined) {
    inputs.assertCurrent();
    /**
     Reuse captured views instead of rescanning every source for each candidate.
     */
    const sources = new Map(inputs.instructionSources
      .map(function sourcePair(source,) {
      return [
        source.sourceOccurrence,
        source,
      ] as const;
    },),);
    for (const rule of candidates) {
      /**
       The original candidate reader supplies source occurrence identity.
       */
      const source = sources.get(inputs.readRule(rule,)
        .sourceOccurrence,);
      /**
       Missing original requests remain explicit until a fact owner is selected.
       */
      const request = inputs.requestObservation;
      /**
       The fixed bootstrap factory cannot select another judgment or request.
       */
      const context = Object.freeze({
        judgment,
        rule,
        source,
        request,
      },);
      /**
       Factory absence is not evidence that a condition is satisfied.
       */
      const owner = ownerFor(context,);
      if (owner !== undefined) {
        bindings.set(
          rule,
          await captureOriginalAuthorizationBinding({
            context,
            inputs,
            owner,
          },),
        );
      }
    }
  }

  /**
   Revalidate all original evidence, permanently retaining any failure.

   @throws AuthorizationEvidenceError when prior eligibility was lost
   
   @throws original failure on its first occurrence
   */
  function assertCurrent(): void {
    /**
     Distinguish later eligibility checks from the initial source capture.
     */
    const cl = tagged({
      tag: assertCurrent.name,
      l: rl,
    },);
    cl.debug('checking prerequisite evidence collection eligibility',);
    if (failure !== undefined)
      throw new AuthorizationEvidenceError(
        'Original authorization evidence lost eligibility',
        { cause: failure.error, },
      );
    try {
      inputs.assertCurrent();
      for (const binding of bindings.values())
        binding.current();
    }
    catch (error) {
      failure = { error, };
      throw error;
    }
  }

  /**
   Read only facts bound to this original indexed clause.

   @param rule - original candidate handle selected by the compiler
   
   @returns copied condition facts when an original owner supplied them
   
   @throws AuthorizationEvidenceError for foreign candidates or retired evidence
   */
  function forClause(rule: object,): AuthorizationFacts | undefined {
    /**
     Lookup diagnostics do not expose clause content.
     */
    const fl = tagged({
      tag: forClause.name,
      l: rl,
    },);
    fl.debug('reading original clause prerequisite evidence',);
    assertCurrent();
    if (!candidates.includes(rule,))
      throw new AuthorizationEvidenceError('Authorization lookup requires an original indexed clause',);
    return bindings.get(rule,)
      ?.authorization;
  }

  assertCurrent();
  /**
   Diagnostic records omit the private binding's live capability.
   */
  const records = [...bindings.values(),].map(function diagnosticRecord(binding,): AuthorizationEvidenceRecord {
    const {
      rule,
      source,
      request,
      evidence,
      authorization,
    } = binding;
    return Object.freeze({
      rule,
      source,
      request,
      evidence,
      authorization,
    },);
  },);
  return Object.freeze({
    forClause,
    assertCurrent,
    records: Object.freeze(records,),
  },);
}

//endregion Original prerequisite evidence collection
