/**
 Canonical instruction handles publish only after original dependency capture succeeds. @module
 */
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import type {
  InstructionRecord,
  InstructionState
} from './instruction-types.ts';
import type { GoverningRuleSet } from '../../../lifecycle/governing-rule-candidates/set-types.ts';

//region Original maps distinguish program, meaning, and member-bound claim identities.
/**
 Construct private owner state without reading lazy source or request capabilities.
 *
 @returns unpublished original instruction owner
 */
export function createInstructionState(): InstructionState {
  return {
    instructionBindings: new WeakMap(),
    instructionPairs: new WeakMap(),
    instructionMeaningPairs: new WeakMap(),
    programInstructionPairs: new WeakMap(),
    ruleBindings: undefined,
    unitAdoptionPairs: undefined,
    requestMaterialBinding: undefined,
  };
}

/**
 Read a previously initialized source owner without introducing another readiness check.
 *
 @param state - original instruction ownership
 *
 @returns initialized original source owner
 *
 @throws Error if internal construction has not retained its source owner
 */
export function retainedInstructionRules(state: InstructionState): GoverningRuleSet {
  return nonNullishOrThrow(state.ruleBindings);
}

/**
 Publish a binding once after original source and member checks succeed.
 *
 @param state - original private instruction records
 *
 @param map - canonical mapping for the selected claim scope
 *
 @param key - original source, pair, or member-clause identity
 *
 @param createRecord - original dependency capture before publication
 *
 @returns canonical opaque handle
 *
 @throws original dependency-capture failure without publishing the handle
 */
export function retainInstructionHandle({
  state,
  map,
  key,
  createRecord
}: Readonly<{
  state: InstructionState;
  map: WeakMap<object, object>;
  key: object;
  createRecord: () => InstructionRecord;
}>): object {
  const existing = map.get(key);
  if (existing) return existing;
  const bindingHandle = Object.freeze({});
  state.instructionBindings
    .set(bindingHandle, createRecord());
  map.set(
    key,
    bindingHandle
  );
  return bindingHandle;
}

/**
 Each member owns a separate original rule-to-claim mapping.
 *
 @param state - original private member maps
 *
 @param member - original prepared-member handle
 *
 @returns canonical mapping for this member alone
 */
export function memberInstructionPairs({
  state,
  member
}: Readonly<{
  state: InstructionState;
  member: object;
}>): WeakMap<object, object> {
  const existing = state.instructionPairs
    .get(member);
  if (existing) return existing;
  const pairs = new WeakMap<object, object>();
  state.instructionPairs
    .set(member, pairs);
  return pairs;
}
//endregion
