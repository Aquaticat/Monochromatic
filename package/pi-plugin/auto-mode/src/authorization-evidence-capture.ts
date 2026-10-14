/**
 Ordered capture of original prerequisite owners across native clause candidates.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { captureOriginalAuthorizationBinding, } from './authorization-evidence-binding.ts';
import type {
  AuthorizationEvidenceBinding,
  AuthorizationInputSources,
  AuthorizationOwnerFactory,
} from './authorization-evidence-types.ts';

/**
 Ordered capture diagnostics omit submitted policy and evidence.
 */
const l = tagged({ tag: 'auto-mode-authorization-evidence-capture', },);

//region Sequential owners share the same original judgment lifetime

/**
 Capture selected owners in original candidate order.
 Each asynchronous owner finishes and revalidates inputs before another owner is selected.

 @param judgment - original prepared judgment
 
 @param inputs - native candidates, source views and eligibility reader
 
 @param ownerFor - fixed bootstrap evidence factory
 
 @returns original bindings in candidate order, omitting candidates without an owner
 
 @throws original failure from source or fact ownership checks
 
 @example
 ```ts
 for await (const binding of captureOriginalAuthorizationBindings({ judgment, inputs, ownerFor })) {
   bindings.set(binding.rule, binding);
 }
 ```
 */
export async function* captureOriginalAuthorizationBindings(
  {
    judgment,
    inputs,
    ownerFor,
  }: {
    readonly judgment: object;
    readonly inputs: AuthorizationInputSources;
    readonly ownerFor: AuthorizationOwnerFactory;
  },
): AsyncGenerator<AuthorizationEvidenceBinding> {
  /**
   Ordered lifecycle diagnostics retain their original collection boundary.
   */
  const rl = tagged({
    tag: captureOriginalAuthorizationBindings.name,
    l,
  },);
  rl.debug('capturing prerequisite owners in original candidate order',);
  inputs.assertCurrent();
  /**
   Reuse captured views rather than rescanning every source for each candidate.
   */
  const sources = new Map(inputs.instructionSources
    .map(function sourcePair(source,) {
    return [
      source.sourceOccurrence,
      source,
    ] as const;
  },),);
  for (const rule of inputs.instructionCandidates ?? inputs.ruleCandidates) {
    /**
     Native candidate selection authenticates this source occurrence.
     */
    const source = sources.get(inputs.readRule(rule,)
      .sourceOccurrence,);
    /**
     Request absence remains an omitted field until a selected owner requires it.
     */
    const request = inputs.requestObservation;
    /**
     Owned context keeps factory calls from replacing original binding dimensions.
     */
    const context = Object.freeze({
      judgment,
      rule,
      ...(source === undefined ? {} : { source, }),
      ...(request === undefined ? {} : { request, }),
    },);
    /**
     An absent factory result supplies no condition fact.
     */
    const owner = ownerFor(context,);
    if (owner !== undefined)
      yield captureOriginalAuthorizationBinding({
        context,
        inputs,
        owner,
      },);
  }
}

//endregion Ordered prerequisite capture
