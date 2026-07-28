/**
 * Projection between slot-keyed effect facts and parameter-keyed ones.
 *
 * Effects are recorded against slots, while several consumers ask parameter-level questions:
 * the rule reports on a parameter, foreign ownership marks a parameter, overload agreement
 * compares two declarations whose slot tables have nothing to do with each other, and an
 * external package's summary crosses a project boundary where only parameter positions mean
 * the same thing on both sides.
 *
 * Projecting loses precision and never soundness, because a parameter answers for every slot
 * it owns. The reverse direction, broadcasting a parameter-level fact to all of its slots, is
 * what a caller does when it cannot decompose an actual, and that one is load-bearing:
 * propagation reads an edge by the callee's effect slot and never consults the whole
 * parameter, so a fact left only on the whole slot is a fact no callee lookup will find.
 *
 * @module
 */

import type {
  EffectSlot,
  ParameterIndex,
} from './effect-slot-identity.ts';
import type { SlotOwnership, } from './effect-summary-model.ts';

/**
 * Collects the parameters owning a set of slots.
 *
 * @param ownership - Slot ownership of the callable those slots belong to.
 *
 * @param slots - Slots carrying some effect.
 *
 * @returns parameters owning at least one of those slots.
 *
 * @example
 * ```ts
 * parametersOfSlots({ ownership: summary.slots, slots: summary.mutated });
 * ```
 */
export function parametersOfSlots({
  ownership,
  slots,
}: {
  readonly ownership: SlotOwnership;
  readonly slots: ReadonlySet<EffectSlot>;
},): ReadonlySet<ParameterIndex> {
  /**
   * Owning parameters accumulated across every affected slot.
   */
  const owners = new Set<ParameterIndex>();
  slots.forEach(function owner(slot,): void {
    /**
     * Parameter owning this slot, absent when the slot is outside this callable.
     */
    const owned = ownership.parameterOfSlot[slot];
    if (owned !== undefined)
      owners.add(owned,);
  },);
  return owners;
}

/**
 * Collects every slot owned by a set of parameters.
 *
 * @param ownership - Slot ownership of the callable those parameters belong to.
 *
 * @param parameters - Parameters whose slots are wanted.
 *
 * @returns whole-parameter slots and every property slot beneath them.
 *
 * @example
 * ```ts
 * slotsOfParameters({ ownership: summary.slots, parameters: foreign });
 * ```
 */
export function slotsOfParameters({
  ownership,
  parameters,
}: {
  readonly ownership: SlotOwnership;
  readonly parameters: Iterable<ParameterIndex>;
},): ReadonlySet<EffectSlot> {
  /**
   * Slots accumulated across every named parameter.
   */
  const owned = new Set<EffectSlot>();
  for (const parameterIndex of parameters)
    (ownership.slotsByParameter[parameterIndex] ?? [])
      .forEach(function collect(slot,): void {
        owned.add(slot,);
      },);
  return owned;
}

/**
 * Unions the uncertainty provenance recorded against every slot one parameter owns.
 *
 * @param ownership - Slot ownership of the callable holding that provenance.
 *
 * @param provenanceBySlot - Uncertainty facts recorded per slot.
 *
 * @param parameterIndex - Parameter whose facts are wanted.
 *
 * @returns every fact recorded against that parameter or a property of it.
 *
 * @example
 * ```ts
 * provenanceOfParameter({ ownership, provenanceBySlot, parameterIndex });
 * ```
 */
export function provenanceOfParameter({
  ownership,
  provenanceBySlot,
  parameterIndex,
}: {
  readonly ownership: SlotOwnership;
  readonly provenanceBySlot: ReadonlyMap<EffectSlot, ReadonlySet<string>>;
  readonly parameterIndex: ParameterIndex;
},): ReadonlySet<string> {
  /**
   * Facts accumulated across every slot the parameter owns.
   */
  const facts = new Set<string>();
  (ownership.slotsByParameter[parameterIndex] ?? [])
    .forEach(function collect(slot,): void {
      (provenanceBySlot.get(slot,) ?? [])
        .forEach(function add(fact,): void {
          facts.add(fact,);
        },);
    },);
  return facts;
}

/**
 * Tests whether any slot owned by one parameter carries an effect.
 *
 * @param ownership - Slot ownership of the callable being asked about.
 *
 * @param slots - Slots carrying some effect.
 *
 * @param parameterIndex - Parameter under test.
 *
 * @returns whether that parameter owns an affected slot.
 *
 * @example
 * ```ts
 * parameterCarriesSlot({ ownership, slots: summary.mutated, parameterIndex });
 * ```
 */
export function parameterCarriesSlot({
  ownership,
  slots,
  parameterIndex,
}: {
  readonly ownership: SlotOwnership;
  readonly slots: ReadonlySet<EffectSlot>;
  readonly parameterIndex: ParameterIndex;
},): boolean {
  return (ownership.slotsByParameter[parameterIndex] ?? [])
    .some(function affected(slot,): boolean {
      return slots.has(slot,);
    },);
}
