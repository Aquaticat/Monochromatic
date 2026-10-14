/**
 Binding of one prerequisite record to its original judgment, source and request.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import { lowerEstablishedClause, } from './clause-lowering.ts';
import {
  AuthorizationEvidenceError,
  readAuthorizationOwner,
  readAuthorizationRecord,
} from './authorization-evidence-data.ts';
import type {
  AuthorizationEvidenceBinding,
  AuthorizationFacts,
  AuthorizationInputSources,
  AuthorizationOwnerContext,
} from './authorization-evidence-types.ts';

/**
 Binding diagnostics omit captured policy and request contents.
 */
const l = tagged({ tag: 'auto-mode-authorization-evidence-binding', },);

//region Owners authenticate evidence while this boundary enforces reference binding

/**
 Capture one original owner record without issuing permission or interpreting a clause.

 @param context - original judgment, clause, source and request identities
 
 @param inputs - native source owner whose eligibility spans asynchronous capture
 
 @param owner - bootstrap-selected evidence owner with synchronous freshness checks
 
 @returns bound copied facts with their original eligibility check
 
 @throws AuthorizationEvidenceError for mismatched or changed original evidence
 
 @throws original failure from source or evidence owners
 */
export async function captureOriginalAuthorizationBinding(
  {
    context,
    inputs,
    owner,
  }: {
    readonly context: AuthorizationOwnerContext;
    readonly inputs: AuthorizationInputSources;
    readonly owner: unknown;
  },
): Promise<AuthorizationEvidenceBinding> {
  /**
   Retain the capture boundary in lifecycle diagnostics.
   */
  const rl = tagged({
    tag: captureOriginalAuthorizationBinding.name,
    l,
  },);
  rl.debug('capturing original prerequisite evidence',);
  /**
   All original references are captured before invoking the borrowed owner.
   */
  const {
    judgment,
    rule,
    source,
    request,
  } = context;
  if ((source === undefined) || (request === undefined)
    || (!inputs.instructionSources
      .includes(source,))
    || (source.request !== request))
    throw new AuthorizationEvidenceError('Authorization evidence needs its original request-bound instruction source',);
  /**
   Owner methods stay borrowed and are checked again before every use.
   */
  const methods = readAuthorizationOwner(owner,);
  inputs.assertCurrent();
  /**
   Async capture retains the exact owner's return, not a reconstructed record.
   */
  const evidence = await Reflect.apply(
    methods.capture,
    owner,
    [Object.freeze(context,),],
  );
  inputs.assertCurrent();

  /**
   Copy supported primitive facts while checking every original binding dimension.

   @returns validated condition vocabulary, without clause interpretation
   
   @throws AuthorizationEvidenceError for mismatched original references
   */
  function readFacts(): AuthorizationFacts {
    /**
     Fact reads keep their own diagnostic boundary.
     */
    const fl = tagged({
      tag: readFacts.name,
      l: rl,
    },);
    fl.debug('checking original authorization evidence references',);
    /**
     No submitted accessor is evaluated during reference validation.
     */
    const record = readAuthorizationRecord({
      input: evidence,
      fields: [
        'judgment',
        'rule',
        'source',
        'request',
        'authorization',
      ],
    },);
    if ((record.judgment !== judgment) || (record.rule !== rule)
      || (record.source !== source)
      || (record.request !== request))
      throw new AuthorizationEvidenceError('Authorization evidence differs from the original judgment, clause, source or request',);
    /**
     Pure lowering validates vocabulary; it authenticates no owner or instruction.
     */
    const lowered = lowerEstablishedClause({
      id: 'authorization-evidence',
      priority: 0,
      relation: 'prerequisite',
      authorization: record.authorization,
    },);
    /**
     Known prerequisite lowering emits exactly one requirement at this explicit priority.
     */
    const requirement = nonNullishOrThrow(lowered.authorizationRequirements[0],);
    return Object.freeze({
      satisfaction: requirement.satisfaction,
      channel: requirement.channel,
    },);
  }

  Reflect.apply(
    methods.assertCurrent,
    owner,
    [evidence,],
  );
  /**
   Copy primitive facts once without freezing the original record.
   */
  const authorization = readFacts();

  /**
   Revalidate borrowed capabilities, original evidence and unchanged primitive facts.

   @throws AuthorizationEvidenceError for changed owner methods or facts
   
   @throws original failure from the evidence owner
   */
  function current(): void {
    /**
     Eligibility checking stays separate from initial capture.
     */
    const cl = tagged({
      tag: current.name,
      l: rl,
    },);
    cl.debug('checking original prerequisite evidence eligibility',);
    /**
     Re-read live method identities instead of trusting copied capabilities alone.
     */
    const live = readAuthorizationOwner(owner,);
    if ((live.capture !== methods.capture) || (live.assertCurrent !== methods.assertCurrent))
      throw new AuthorizationEvidenceError('Original authorization owner capabilities changed',);
    Reflect.apply(
      methods.assertCurrent,
      owner,
      [evidence,],
    );
    /**
     The owner cannot silently mutate copied condition facts.
     */
    const value = readFacts();
    if ((value.satisfaction !== authorization.satisfaction) || (value.channel !== authorization.channel))
      throw new AuthorizationEvidenceError('Original authorization facts changed',);
  }

  current();
  return Object.freeze({
    rule,
    source,
    request,
    evidence,
    authorization,
    current,
  },);
}

//endregion Original record binding
