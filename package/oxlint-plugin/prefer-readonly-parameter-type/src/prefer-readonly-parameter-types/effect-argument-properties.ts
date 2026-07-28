/**
 * Decomposition of one call argument into the caller origins reaching each of its properties.
 *
 * A callee that destructures records its writes against property slots, and the edge maps each
 * of those slots onto caller origins. Repeating the whole argument's origins on every property
 * slot is sound and is what slot allocation shipped with, but it attributes a write through one
 * property to everything the argument packages. This module answers the narrower question:
 * given an actual and a property key the callee reads, which caller values can that property
 * hold.
 *
 * The answer is only ever narrowed where the actual is an authored object literal with no
 * accessor in it. Anything else reports `ARGUMENT_NOT_DECOMPOSABLE`, and the edge broadcasts as
 * before. Withholding a narrowing costs precision; narrowing something that should not be
 * narrowed loses a write, which is what offers `readonly` for state a callee mutates.
 *
 * @module
 */

import type {
  Node,
  ObjectLiteralExpression,
} from 'typescript/unstable/ast';
import {
  isAssertionExpression,
  isFunctionLikeDeclaration,
  isGetAccessorDeclaration,
  isMethodDeclaration,
  isNonNullExpression,
  isObjectLiteralExpression,
  isParenthesizedExpression,
  isPropertyAssignment,
  isSatisfiesExpression,
  isSetAccessorDeclaration,
  isShorthandPropertyAssignment,
  isSpreadAssignment,
} from 'typescript/unstable/ast/is';
import type { Project, } from 'typescript/unstable/sync';

import {
  ALL_PACKAGED_PROPERTIES,
  parameterIndexes,
} from './effect-call-resolution.ts';
import { packagedCallableOrigins, } from './effect-packaged-callable-origins.ts';
import { expressionCanCarryMutableState, } from './effect-primitive-origin.ts';
import {
  canonicalPropertyKey,
  type EffectSlot,
  NOT_A_STATIC_KEY,
} from './effect-slot-identity.ts';
import {
  NO_SLOT_ORIGIN,
  type SlotOrigins,
} from './effect-summary-model.ts';

/**
 * Property name whose plain assignment form sets a prototype instead of an own property.
 */
const PROTOTYPE_PROPERTY_KEY = '__proto__';

/**
 * Sentinel for an actual whose property structure cannot be read.
 */
export const ARGUMENT_NOT_DECOMPOSABLE: unique symbol = Symbol(
  'call argument exposes no authored property structure',
);

/**
 * One authored property of an object literal, reduced to what it contributes.
 *
 * `key` is `NOT_A_STATIC_KEY` for a contributor that could fill any property: a spread, a
 * computed name, or a plain prototype assignment. Those contribute to every key and never end
 * the reverse walk.
 */
type PropertyContribution = {
  readonly key: string | typeof NOT_A_STATIC_KEY;
  readonly origins: readonly EffectSlot[];
};

/**
 * Authored properties of one object-literal actual, in source order.
 */
export type ArgumentPropertyView = {
  readonly contributions: readonly PropertyContribution[];
};

/**
 * Unwraps the wrappers that change nothing about the value an argument holds.
 *
 * Parentheses and type-only wrappers only. An assignment, a sequence, an `await` or a call must
 * not be unwrapped: in `callee(argument = {}, Object.assign(argument, { named: owned },),)` the
 * first actual is mutated while the second is evaluated, so the literal written there is not
 * the object the callee receives. A spread element must not be unwrapped either, because
 * `callee(...values)` fills formals from the elements of `values` rather than from `values`.
 *
 * @param node - Call argument, possibly parenthesized or asserted.
 *
 * @returns object literal underneath, or sentinel when the actual is anything else.
 *
 * @example
 * ```ts
 * objectLiteralUnder({ node: call.arguments[0] });
 * ```
 */
function objectLiteralUnder(
  { node, }: { readonly node: Node; },
): ObjectLiteralExpression | typeof ARGUMENT_NOT_DECOMPOSABLE {
  /* Recurses one wrapper at a time, which is a bounded structural descent rather than a walk
   * over a sequence: each step moves to a child expression, so the depth is the authored
   * nesting depth. `parameterIndexes` unwraps the same set the same way. */
  if (isParenthesizedExpression(node,)
    || isNonNullExpression(node,)
    || isAssertionExpression(node,)
    || isSatisfiesExpression(node,))
    return objectLiteralUnder({ node: node.expression, },);
  return isObjectLiteralExpression(node,)
    ? node
    : ARGUMENT_NOT_DECOMPOSABLE;
}

/**
 * Tests whether a literal defines any property through an accessor.
 *
 * An accessor defeats the reverse walk from either end. `{ hidden: owned, get named() { return
 * this.hidden; } }` reaches `owned` through `this`, which no scan of the accessor body finds,
 * and `{ get named() { return owned; }, set named(value) {} }` puts the origin-free setter
 * last, so a walk that stops at the first exact match from the end stops on the setter and
 * drops the getter's origin. Both lose a write, so a literal holding either is not narrowed.
 *
 * @param literal - Object literal being decomposed.
 *
 * @returns whether any member is a getter or a setter.
 *
 * @example
 * ```ts
 * definesAccessor({ literal });
 * ```
 */
function definesAccessor(
  { literal, }: { readonly literal: ObjectLiteralExpression; },
): boolean {
  return literal.properties
    .some(function isAccessor(property,): boolean {
      return isGetAccessorDeclaration(property,)
        || isSetAccessorDeclaration(property,);
    },);
}

/**
 * Reduces one authored property to the key it fills and the origins it contributes.
 *
 * @param project - TypeScript project resolving symbols and types.
 *
 * @param bindingOriginBySymbolId - Local binding symbols mapped to caller slots.
 *
 * @param property - Authored member of the object literal.
 *
 * @returns key filled and origins contributed.
 *
 * @example
 * ```ts
 * propertyContribution({ project, bindingOriginBySymbolId, property });
 * ```
 */
function propertyContribution({
  project,
  bindingOriginBySymbolId,
  property,
}: {
  readonly project: Project;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, SlotOrigins>;
  readonly property: Node;
},): PropertyContribution {
  /**
   * Checker resolving shorthand values and primitive classification.
   */
  const { checker, } = project;
  if (isSpreadAssignment(property,))
    /* A spread copies own enumerable properties of something this walk cannot enumerate, so it
     * could fill any key the callee reads and never ends the search for one. */
    return {
      key: NOT_A_STATIC_KEY,
      origins: parameterIndexes({
        project,
        bindingOriginBySymbolId,
        node: property.expression,
        includedPropertyNames: ALL_PACKAGED_PROPERTIES,
      },),
    };
  if (isPropertyAssignment(property,)) {
    /**
     * Key this assignment fills, absent for a computed name.
     */
    const key = canonicalPropertyKey({ name: property.name, },);
    /* `{ __proto__: source }` in this exact spelling sets the prototype rather than defining an
     * own property, so every key the callee reads and the literal does not define is served
     * from `source`. Treating it as a key would leave those keys with no origins at all, and a
     * callee writing through one of them would have that write attributed to nothing. Measured:
     * the write lands, and `Object.hasOwn` reports no own `__proto__`. The computed, shorthand
     * and method spellings of the same name all define ordinary own properties and keep their
     * key. */
    return {
      key: key === PROTOTYPE_PROPERTY_KEY ? NOT_A_STATIC_KEY : key,
      origins: isFunctionLikeDeclaration(property.initializer,)
        ? [
          ...packagedCallableOrigins({
            project,
            bindingOriginBySymbolId,
            packaged: property.initializer,
          },),
        ]
        : parameterIndexes({
          project,
          bindingOriginBySymbolId,
          node: property.initializer,
          includedPropertyNames: ALL_PACKAGED_PROPERTIES,
        },),
    };
  }
  if (isShorthandPropertyAssignment(property,)) {
    /**
     * Value symbol hidden behind the shorthand property symbol.
     */
    const valueSymbol = checker.getShorthandAssignmentValueSymbol(property,);
    /**
     * Caller origins the shorthand value carries.
     */
    const shorthandOrigins = ((valueSymbol === undefined)
        || (!expressionCanCarryMutableState({
          checker,
          node: property.name,
        },)))
      ? NO_SLOT_ORIGIN
      : bindingOriginBySymbolId.get(valueSymbol.id,) ?? NO_SLOT_ORIGIN;
    return {
      key: canonicalPropertyKey({ name: property.name, },),
      origins: [...shorthandOrigins,],
    };
  }
  if (isMethodDeclaration(property,))
    /* A method defines a fresh function object, so it shadows whatever came before under that
     * key. What reaches a caller parameter through it is the body the callee calls, which is
     * scanned for named bindings exactly as the whole-argument walk does. */
    return {
      key: canonicalPropertyKey({ name: property.name, },),
      origins: [
        ...packagedCallableOrigins({
          project,
          bindingOriginBySymbolId,
          packaged: property,
        },),
      ],
    };
  /* Whatever is left names no key this walk can read, so it is treated as filling any of them.
   * Asking a kind predicate rather than probing for a `name` field is deliberate: this AST
   * exposes every field name on the prototype, so `'name' in property` answers true for
   * members that have none. */
  return {
    key: NOT_A_STATIC_KEY,
    origins: [
      ...packagedCallableOrigins({
        project,
        bindingOriginBySymbolId,
        packaged: property,
      },),
    ],
  };
}

/**
 * Reads the authored property structure of one call argument.
 *
 * @param project - TypeScript project resolving symbols and types.
 *
 * @param bindingOriginBySymbolId - Local binding symbols mapped to caller slots.
 *
 * @param node - Call argument to decompose.
 *
 * @returns property view, or sentinel when the actual exposes no readable structure.
 *
 * @example
 * ```ts
 * argumentPropertyView({ project, bindingOriginBySymbolId, node: call.arguments[0] });
 * ```
 */
export function argumentPropertyView({
  project,
  bindingOriginBySymbolId,
  node,
}: {
  readonly project: Project;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, SlotOrigins>;
  readonly node: Node;
},): ArgumentPropertyView | typeof ARGUMENT_NOT_DECOMPOSABLE {
  /**
   * Object literal this actual is, once type-only wrappers are removed.
   */
  const literal = objectLiteralUnder({ node, },);
  if ((literal === ARGUMENT_NOT_DECOMPOSABLE)
    || definesAccessor({ literal, },))
    return ARGUMENT_NOT_DECOMPOSABLE;
  return {
    contributions: literal.properties
      .map(function contribution(property,): PropertyContribution {
        return propertyContribution({
          project,
          bindingOriginBySymbolId,
          property,
        },);
      },),
  };
}

/**
 * Resolves which caller origins one property key of a decomposed actual can hold.
 *
 * Walks the authored properties in reverse. An exact match contributes its value and stops,
 * because the last definition of a key is the one the callee reads. A different known key is
 * ignored. A contributor that fills no nameable key contributes and the walk continues, since
 * only a later exact match can shadow what it supplied. So `{ ...other, named: first }`
 * attributes `named` to `first` alone, while `{ named: first, ...other }` attributes it to
 * both.
 *
 * An empty result is a real answer rather than a missing one: the literal defines that key
 * nowhere, and nothing it packages can reach it. Callers must not read empty as unknown, which
 * is why `calleeSlotOrigins` falls back only on an absent entry.
 *
 * @param view - Decomposed actual.
 *
 * @param key - Canonical property key the callee reads.
 *
 * @returns caller origins that key can hold, empty when the literal never fills it.
 *
 * @example
 * ```ts
 * originsOfPropertyKey({ view, key: 'named' });
 * ```
 */
export function originsOfPropertyKey({
  view,
  key,
}: {
  readonly view: ArgumentPropertyView;
  readonly key: string;
},): readonly EffectSlot[] {
  /**
   * Origins collected while walking back towards the defining property.
   */
  const origins = new Set<EffectSlot>();
  for (const contribution of view.contributions.toReversed()) {
    if (contribution.key === key) {
      contribution.origins
        .forEach(function collectExact(origin,): void {
          origins.add(origin,);
        },);
      return [...origins,];
    }
    if (contribution.key === NOT_A_STATIC_KEY)
      contribution.origins
        .forEach(function collectUnknown(origin,): void {
          origins.add(origin,);
        },);
  }
  return [...origins,];
}
