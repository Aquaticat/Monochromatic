/**
 * Caller origins a callable handed straight to a call keeps for whoever receives it.
 *
 * The argument walk reads what an actual holds. A function expression holds nothing it can
 * read: what reaches a caller parameter is the body, and the body runs whenever whoever
 * received the callable decides. `parameterIndexes` therefore answers nothing for
 * `retain((): Row => config.row,)` while answering correctly for
 * `retainBox({ produce: (): Row => config.row, },)`, because the second is a literal it
 * descends and the first is not. Falsified before this existed: the annotation applied, type
 * checked clean, and the holder's invocation changed the caller's row.
 *
 * Recorded here and consumed in the fixed point rather than folded into the ordinary origins,
 * because the two license different things. An ordinary origin says the callee received this
 * caller parameter, so every effect the callee records on that formal is an effect on the
 * caller's value, including a write and a return. A capture says only that invoking the
 * callable can reach the parameter, which licenses nothing about writes the callee makes to
 * the callable itself and nothing about what the callee returns.
 *
 * Folding them together would also reach the unresolved boundary, since `parameterIndexes`
 * feeds that path too, and would withhold on `rows.map((row) => config.row.label,)` against
 * any callee this analysis cannot resolve. Kept on the owned edge, the question never arises
 * there: an unresolved call builds no edge to defer anything onto.
 *
 * @module
 */

import type { Node, } from 'typescript/unstable/ast';
import type { Project, } from 'typescript/unstable/sync';

import { transitiveCallableOrigins, } from './effect-callable-capture-closure.ts';
import { possibleValueNodes, } from './effect-possible-values.ts';
import type { EffectSlot, } from './effect-slot-identity.ts';
import {
  isEffectCallableDeclaration,
  OWNED_CALLABLE_UNAVAILABLE,
  type SlotOrigins,
} from './effect-summary-model.ts';

/**
 * Origins carried by nothing, shared so an argument packaging no callable allocates none.
 */
const NO_CAPTURED_ORIGINS: readonly EffectSlot[] = [];

/**
 * Collects, per actual position, the caller origins the callable filling it captured.
 *
 * Driven by resolved callable declarations rather than by argument syntax, which is what
 * makes `retain(producer,)` behave like `retain((): Row => config.row,)`: the resolver
 * follows a local bound to a function expression, and the syntax test would see only an
 * identifier. A declaration reached this way that lives outside the current callable
 * contributes nothing, because its body names symbols absent from this callable's origin
 * map, so an imported or module-level helper handed as an argument stays silent.
 *
 * @param project - TypeScript project resolving binding symbols.
 *
 * @param bindingOriginBySymbolId - Caller parameter and alias origins.
 *
 * @param callables - Resolved callable per actual position, or the unavailable sentinel.
 *
 * @param actuals - Argument expressions, asked separately for callables the resolver declines to
 * name.
 *
 * @returns captured origins per actual position, empty where no callable was reached.
 *
 * @example
 * ```ts
 * argumentCapturedOrigins({ project, bindingOriginBySymbolId, callables, actuals });
 * ```
 */
export function argumentCapturedOrigins({
  project,
  bindingOriginBySymbolId,
  callables,
  actuals,
}: {
  readonly project: Project;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, SlotOrigins>;
  readonly callables: readonly (Node | typeof OWNED_CALLABLE_UNAVAILABLE)[];
  readonly actuals: readonly Node[];
},): readonly (readonly EffectSlot[])[] {
  return callables.map(function capturesOfPosition(
    callable,
    position,
  ): readonly EffectSlot[] {
    /**
     * Caller origins any binding named inside a callable filling this position can carry.
     */
    const captured = new Set<EffectSlot>();
    /**
     * Argument at this position, absent when the mapping outruns the call.
     */
    const actual = actuals[position];
    [
      ...(callable === OWNED_CALLABLE_UNAVAILABLE) ? [] : [callable,],
      ...(actual === undefined)
        ? []
        : packagedActualCallables({
          project,
          actual,
        },),
    ]
      .forEach(function collectPackaged(packaged,): void {
        transitiveCallableOrigins({
          project,
          bindingOriginBySymbolId,
          packaged,
        },)
          .forEach(function collectCapture(origin,): void {
            captured.add(origin,);
          },);
      },);
    return captured.size === 0 ? NO_CAPTURED_ORIGINS : [...captured,];
  },);
}

/**
 * Names every callable one actual can hold, beyond the single one the resolver reports.
 *
 * Asked alongside the resolver rather than instead of it, because the two see different things.
 * `callableDeclaration` follows a local's initializer and stops at a parameter, so a callable
 * arriving as a parameter default was named by nothing: `retain(callback,)`, where `callback`
 * defaults to a closure over the caller's configuration, offered that configuration while the
 * closure `retain` kept wrote through it. Falsified.
 *
 * Kept out of the callback identity beside it, which stays with the narrow resolver: naming a
 * default as the callable a callee invokes would claim the default's effects for a call where the
 * caller supplied something else, and that claim can be wrong in the offering direction. Whereas
 * every consumer of a capture asks what the callee stated about its own formal first, so widening
 * what fills a formal can only ever add an effect the callee already declared.
 *
 * Exported because the unresolved boundary needs the same answer. An earlier note here said a
 * capture only ever adds opacity, which stopped being true once captures began feeding the mutation
 * and returned-origin channels as well.
 *
 * @param project - TypeScript project resolving values an expression can hold.
 *
 * @param actual - Argument expression whose callables are wanted.
 *
 * @returns callables the actual can hold.
 *
 * @example
 * ```ts
 * packagedActualCallables({ project, actual });
 * ```
 */
export function packagedActualCallables({
  project,
  actual,
}: {
  readonly project: Project;
  readonly actual: Node;
},): readonly Node[] {
  return possibleValueNodes({
    project,
    node: actual,
  },)
    .filter(function packagedCallable(value,): boolean {
      return isEffectCallableDeclaration(value,);
    },);
}

/**
 * Unions captured origins across every actual position one formal can receive.
 *
 * Whole-formal granularity on purpose, with no narrowing by property key. A key narrows what
 * a callee reached inside a value the caller authored, and a capture is not inside the value:
 * it is what running the callable can reach. There is no key under which to file it, and
 * filing it under every key would claim the callee reached it through each of them.
 *
 * @param positionsByFormal - Actual positions each formal can receive.
 *
 * @param argumentCaptures - Captured origins per actual position.
 *
 * @returns captured origins per formal.
 *
 * @example
 * ```ts
 * capturedOriginsByFormal({ positionsByFormal, argumentCaptures });
 * ```
 */
export function capturedOriginsByFormal({
  positionsByFormal,
  argumentCaptures,
}: {
  readonly positionsByFormal: readonly (readonly number[])[];
  readonly argumentCaptures: readonly (readonly EffectSlot[])[];
},): readonly (readonly EffectSlot[])[] {
  return positionsByFormal
    .map(function capturesForFormal(positions,): readonly EffectSlot[] {
      /**
       * Distinct captures reaching this formal from every actual that can fill it.
       */
      const captured = new Set<EffectSlot>();
      positions.forEach(function collectPosition(position,): void {
        (argumentCaptures[position] ?? NO_CAPTURED_ORIGINS)
          .forEach(function collectCapture(origin,): void {
            captured.add(origin,);
          },);
      },);
      return captured.size === 0 ? NO_CAPTURED_ORIGINS : [...captured,];
    },);
}
