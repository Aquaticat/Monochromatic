/**
 * Public effect-summary projection from mutable fixed-point state.
 *
 * Every set crossing this boundary is projected from slots to the parameters that own them.
 * Projection loses precision and never soundness: a parameter answers for every slot beneath
 * it, so a write recorded against one property still marks the parameter affected. The rule's
 * report, overload agreement and external-package effects all speak in parameters, and this is
 * the single place the two vocabularies meet. Foreign ownership speaks in parameters too but
 * never enters here: it is proven per callable on demand through `EffectSummaryIndex`, because
 * it is the one fact whose cost a consumer should be able to decline.
 *
 * @module
 */

import { affectedBindingNames, } from './effect-affected-bindings.ts';
import {
  asParameterIndex,
  type ParameterIndex,
} from './effect-slot-identity.ts';
import {
  parametersOfSlots,
  provenanceOfParameter,
} from './effect-slot-projection.ts';
import type {
  EffectCallableDeclaration,
  MutableEffectSummary,
} from './effect-summary-model.ts';
import type {
  CallableEffectSummary,
  PublicCallbackRelation,
} from './effect-summary-index.ts';

/**
 * Converts completed mutable summary to public immutable view.
 *
 * @param summary - Completed fixed-point summary.
 *
 * @param declaration - Callable the summary describes, resolving binding names.
 *
 * @returns copied public effect summary.
 *
 * @example
 * ```ts
 * effectPublicSummary({ summary, declaration });
 * ```
 */
export function effectPublicSummary({
  summary,
  declaration,
}: {
  readonly summary: MutableEffectSummary;
  readonly declaration: EffectCallableDeclaration;
}): CallableEffectSummary {
  /**
   * Slot ownership this summary's facts are projected through.
   */
  const ownership = summary.slots;
  /**
   * Parameters carrying a proven referent write.
   */
  const mutated = parametersOfSlots({
    ownership,
    slots: summary.mutated,
  },);
  /**
   * Parameters whose value this callable invokes.
   */
  const invoked = parametersOfSlots({
    ownership,
    slots: summary.invoked,
  },);
  /**
   * Parameters carrying unresolved reachability.
   */
  const opaque = parametersOfSlots({
    ownership,
    slots: summary.opaque,
  },);
  return {
    mutatedParameterIndexes: new Set([
      ...mutated,
      ...invoked,
    ],),
    referentMutatedParameterIndexes: mutated,
    /* The propagated set rather than the direct one. A callable returning another's
     * result carries whatever that result carries, and only the fixed point knows it, so
     * projecting the direct set would report `b` returning `a(x,)` as returning nothing.
     * Nothing consumed this fact before result substitution existed, so widening it
     * changes no existing verdict. */
    returnedParameterIndexes: parametersOfSlots({
      ownership,
      slots: summary.returned,
    },),
    invokedParameterIndexes: invoked,
    opaqueParameterIndexes: opaque,
    opaqueProvenanceByParameter: new Map([...opaque,].map(
      function provenanceFor(parameterIndex,): readonly [
        ParameterIndex,
        ReadonlySet<string>,
      ] {
        return [
          parameterIndex,
          provenanceOfParameter({
            ownership,
            provenanceBySlot: summary.opaqueProvenanceBySlot,
            parameterIndex,
          },),
        ];
      },
    ),),
    /* Names rather than slots, because a report has to say which authored inputs it is about
     * and a slot number means nothing to a reader. Built here because this is the last point
     * where the slot facts and the declaration are both in hand. */
    opaqueBindingsByParameter: new Map([...affectedBindingNames({
      declaration,
      slots: summary.opaque,
    },),].map(function brandOwner([
      parameterIndex,
      names,
    ],): readonly [
      ParameterIndex,
      ReadonlySet<string>,
    ] {
      return [
        asParameterIndex(parameterIndex,),
        names,
      ];
    },),),
    /* Deduplicated, because projection can collapse several relations onto one. A callee
     * taking `{ run, target }` records relations against distinct property slots that both
     * name parameter zero, and repeating the pair would inflate what a consumer reads without
     * saying anything new. */
    callbackRelations: [
      ...new Map(summary.relations
        .map(function publicRelation(relation,): readonly [
          string,
          PublicCallbackRelation,
        ] {
          /**
           * Projected relation, parameter-level on both ends.
           */
          const projected = {
            callbackParameterIndex: ownership.parameterOfSlot[relation.callbackSlot]
              ?? asParameterIndex(0,),
            callbackArgumentPosition: relation.callbackArgumentPosition,
            sourceParameterIndex: ownership.parameterOfSlot[relation.sourceSlot]
              ?? asParameterIndex(0,),
          };
          return [
            `${String(projected.callbackParameterIndex,)}:${
              String(projected.callbackArgumentPosition,)
            }:${String(projected.sourceParameterIndex,)}`,
            projected,
          ];
        },),).values(),
    ],
  };
}
