/**
 Request-local prerequisite evidence collection through fixed bootstrap owners.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { captureOriginalAuthorizationBindings, } from './authorization-evidence-capture.ts';
import { AuthorizationEvidenceError, } from './authorization-evidence-data.ts';
import { MISSING_AUTHORIZATION_EVIDENCE, } from './authorization-evidence-types.ts';
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
 
 @returns same callable; native bootstrap handles unconfigured absence before calling
 
 @throws AuthorizationEvidenceError for unsupported configured values
 
 @example
 ```ts
 const ownerFor = captureAuthorizationOwnerFactory(configuredFactory);
 ```
 */
export function captureAuthorizationOwnerFactory(input: unknown,): AuthorizationOwnerFactory {
  /**
   Startup validation is distinct from request-local evidence capture.
   */
  const rl = tagged({
    tag: captureAuthorizationOwnerFactory.name,
    l,
  },);
  rl.debug('checking bootstrap prerequisite owner factory',);
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
 
 @example
 ```ts
 const evidence = await captureAuthorizationInputs({ judgment, inputs, ownerFor });
 const facts = evidence.forClause(originalClause);
 // MISSING_AUTHORIZATION_EVIDENCE preserves the unresolved prerequisite.
 ```
 */
export async function captureAuthorizationInputs(
  {
    judgment,
    inputs,
    ownerFor,
  }: {
    readonly judgment: object;
    readonly inputs: AuthorizationInputSources;
    readonly ownerFor?: AuthorizationOwnerFactory;
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
  const state: { failure?: { readonly error: unknown } } = {};
  if (ownerFor !== undefined) {
    for await (const binding of captureOriginalAuthorizationBindings({
      judgment,
      inputs,
      ownerFor,
    },))
      bindings.set(
        binding.rule,
        binding,
      );
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
    if (state.failure !== undefined)
      throw new AuthorizationEvidenceError(
        'Original authorization evidence lost eligibility',
        { cause: state.failure
          .error, },
      );
    try {
      inputs.assertCurrent();
      for (const binding of bindings.values())
        binding.current();
    }
    catch (error) {
      state.failure = { error, };
      throw error;
    }
  }

  /**
   Read only facts bound to this original indexed clause.

   @param rule - original candidate handle selected by the compiler
   
   @returns copied condition facts when an original owner supplied them
   
   @throws AuthorizationEvidenceError for foreign candidates or retired evidence
   */
  function forClause(rule: object,): AuthorizationFacts | typeof MISSING_AUTHORIZATION_EVIDENCE {
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
      ?.authorization
      ?? MISSING_AUTHORIZATION_EVIDENCE;
  }

  assertCurrent();
  /**
   Diagnostic records omit the private binding's live capability.
   */
  const records = [...bindings.values(),].map(function diagnosticRecord(binding,): AuthorizationEvidenceRecord {
    /**
     The retained record excludes its live freshness capability.
     */
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
