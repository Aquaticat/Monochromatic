/**
 * Authored binding names whose slots carry an effect.
 *
 * A report names the inputs a diagnostic is about, and before per-property attribution it could
 * only name all of them: every binding a destructured parameter introduced shared one index, so
 * an unresolved call reached through one property was reported against the parameter's primitive
 * siblings too. `ST9` makes that the ordinary shape here, so the noise was the common case.
 *
 * This is the one place slot-level facts are turned into something the rule's own diagnostics can
 * say. It produces names rather than slots on purpose: a slot number means nothing outside the
 * declaration that allocated it, and the public summary stays parameter-keyed so that the
 * external, overload and foreign-ownership paths keep comparing things that mean the same on both
 * sides.
 *
 * @module
 */

import type { EffectSlot, } from './effect-slot-identity.ts';
import {
  parameterBindingSlots,
  parameterSlotTable,
} from './effect-parameter-slots.ts';
import type { EffectCallableDeclaration, } from './effect-summary-model.ts';

/**
 * Collects the authored binding names whose slots carry an effect, per parameter.
 *
 * A parameter appears only when at least one of its bindings is affected, so an absent entry
 * means the caller should describe the parameter as a whole rather than that it has no bindings.
 * That distinction is what keeps a consumer from reporting an empty subject: an effect recorded
 * against the whole-parameter slot belongs to every binding beneath it, and this returns all of
 * them for that case rather than none.
 *
 * @param declaration - Callable whose parameters are being described.
 *
 * @param slots - Slots carrying the effect being reported.
 *
 * @returns affected binding names per declared parameter position.
 *
 * @example
 * ```ts
 * affectedBindingNames({ declaration, slots: summary.opaque });
 * ```
 */
export function affectedBindingNames({
  declaration,
  slots,
}: {
  readonly declaration: EffectCallableDeclaration;
  readonly slots: ReadonlySet<EffectSlot>;
},): ReadonlyMap<number, ReadonlySet<string>> {
  /**
   * Source file resolving each binding name's authored text.
   */
  const sourceFile = declaration.getSourceFile();
  /**
   * Slot table this declaration's bindings are paired against.
   */
  const table = parameterSlotTable({ declaration, },);
  /**
   * Affected names accumulated per parameter, parameters with none left absent.
   */
  const namesByParameter = new Map<number, ReadonlySet<string>>();
  declaration.parameters
    .forEach(function describeParameter(
      parameter,
      parameterIndex,
    ): void {
      /**
       * Names this parameter introduces whose slot carries the effect.
       */
      const affected = new Set<string>();
      parameterBindingSlots({
        parameter,
        parameterIndex,
        table,
      },)
        .forEach(function keepAffected(bound,): void {
          if (slots.has(bound.slot,))
            affected.add(bound.name
              .getText(sourceFile,),);
        },);
      if (affected.size > 0)
        namesByParameter.set(
          parameterIndex,
          affected,
        );
    },);
  return namesByParameter;
}
