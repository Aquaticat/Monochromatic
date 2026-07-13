/**
 * Owned-call resolution and parameter-origin helpers.
 *
 * @module
 */

import type {
  Checker,
  Project,
} from 'typescript/unstable/sync';
import type { Node, } from 'typescript/unstable/ast';
import {
  isArrayLiteralExpression,
  isIdentifier,
  isObjectLiteralExpression,
  isPropertyAssignment,
  isShorthandPropertyAssignment,
  isSpreadAssignment,
  isSpreadElement,
  isVariableDeclaration,
} from 'typescript/unstable/ast/is';

import {
  type EffectCallableDeclaration,
  expressionRoot,
  isEffectCallableDeclaration,
  type MutableEffectSummary,
  OWNED_CALLABLE_UNAVAILABLE,
  PARAMETER_INDEX_UNAVAILABLE,
} from './effect-summary-model.ts';

/**
 * Sentinel selecting every property in packaged call argument.
 */
export const ALL_PACKAGED_PROPERTIES: unique symbol = Symbol('all packaged call argument properties',);

/**
 * Maps expression root symbol to callable parameter index.
 *
 * @param checker - TypeScript checker resolving root symbol.
 *
 * @param bindingOriginBySymbolId - Local binding symbols mapped to source parameters.
 *
 * @param node - Expression whose root may be parameter.
 *
 * @returns parameter index or sentinel.
 *
 * @example
 * ```ts
 * parameterIndex({ checker, bindingOriginBySymbolId, node });
 * ```
 */
export function parameterIndex({
  checker,
  bindingOriginBySymbolId,
  node,
}: {
  readonly checker: Checker;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, number>;
  readonly node: Node;
},): number | typeof PARAMETER_INDEX_UNAVAILABLE {
  /**
   * Root expression node before symbol resolution.
   */
  const root = expressionRoot(node,);
  if (!isIdentifier(root,))
    return PARAMETER_INDEX_UNAVAILABLE;
  /**
   * Root symbol resolved in current project.
   */
  const symbol = checker.getSymbolAtLocation(root,);
  if (symbol === undefined)
    return PARAMETER_INDEX_UNAVAILABLE;
  return bindingOriginBySymbolId.get(symbol.id,)
    ?? PARAMETER_INDEX_UNAVAILABLE;
}

/**
 * Collects every caller parameter origin packaged inside one call argument.
 *
 * @param checker - TypeScript checker resolving root symbols.
 *
 * @param bindingOriginBySymbolId - Local binding symbols mapped to source parameters.
 *
 * @param node - Call argument whose object or array may package parameter values.
 *
 * @param includedPropertyNames - Object property names relevant to callee effect.
 *
 * @returns unique caller parameter indexes in authored order.
 *
 * @example
 * ```ts
 * parameterIndexes({
 *   checker,
 *   bindingOriginBySymbolId,
 *   node,
 *   includedPropertyNames: ALL_PACKAGED_PROPERTIES,
 * });
 * ```
 */
export function parameterIndexes({
  checker,
  bindingOriginBySymbolId,
  node,
  includedPropertyNames,
}: {
  readonly checker: Checker;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, number>;
  readonly node: Node;
  readonly includedPropertyNames: ReadonlySet<string> | typeof ALL_PACKAGED_PROPERTIES;
},): readonly number[] {
  /**
   * Unique origins discovered through bounded argument structure.
   */
  const origins = new Set<number>();
  /**
   * Visits only authored object and array packaging structure.
   *
   * @param current - Current packaged expression or direct parameter root.
   *
   */
  function collect(current: Node,): void {
    /**
     * Direct parameter origin at current expression root.
     */
    const direct = parameterIndex({
      checker,
      bindingOriginBySymbolId,
      node: current,
    },);
    if (direct !== PARAMETER_INDEX_UNAVAILABLE) {
      origins.add(direct,);
      return;
    }
    if (isObjectLiteralExpression(current,)) {
      current.properties
        .forEach(function collectProperty(property,): void {
        if (isPropertyAssignment(property,)) {
          /**
           * Authored property name used to select callee-mutated target.
           */
          const propertyName = property.name
            .getText();
          if ((includedPropertyNames === ALL_PACKAGED_PROPERTIES)
            || includedPropertyNames.has(propertyName,))
            collect(property.initializer,);
          return;
        }
        if (isShorthandPropertyAssignment(property,)) {
          if ((includedPropertyNames !== ALL_PACKAGED_PROPERTIES)
            && (!includedPropertyNames.has(property.name
              .getText(),)))
            return;
          /**
           * Value symbol hidden behind object shorthand property symbol.
           */
          const valueSymbol = checker.getShorthandAssignmentValueSymbol(property,);
          if (valueSymbol !== undefined) {
            /**
             * Caller parameter origin represented by shorthand value.
             */
            const origin = bindingOriginBySymbolId.get(valueSymbol.id,);
            if (origin !== undefined)
              origins.add(origin,);
          }
          return;
        }
        if (isSpreadAssignment(property,)
          && (includedPropertyNames === ALL_PACKAGED_PROPERTIES))
          collect(property.expression,);
        },);
      return;
    }
    if (isArrayLiteralExpression(current,)) {
      current.elements
        .forEach(function collectElement(element,): void {
        collect(isSpreadElement(element,) ? element.expression : element,);
      },);
    }
  }
  collect(node,);
  return [...origins,];
}

/**
 * Resolves call target or callback expression to owned function-like declaration.
 *
 * @param project - TypeScript project resolving declaration handles.
 *
 * @param node - Callee or callback expression.
 *
 * @returns owned function-like declaration or sentinel.
 *
 * @example
 * ```ts
 * callableDeclaration({ project, node });
 * ```
 */
export function callableDeclaration({
  project,
  node,
}: {
  readonly project: Project;
  readonly node: Node;
},): EffectCallableDeclaration | typeof OWNED_CALLABLE_UNAVAILABLE {
  /**
   * Cursor follows callable variable aliases iteratively.
   */
  const cursor: { current: Node; } = { current: node, };
  /**
   * Stable node keys prevent cyclic callable alias traversal.
   */
  const visited = new Set<string>();
  while (!isEffectCallableDeclaration(cursor.current,)) {
    /**
     * Stable source span for alias-cycle detection.
     */
    const cursorKey = `${cursor.current
      .getSourceFile()
      .fileName}:${String(cursor.current
        .pos,)}:${String(cursor.current
          .end,)}`;
    if (visited.has(cursorKey,))
      return OWNED_CALLABLE_UNAVAILABLE;
    visited.add(cursorKey,);
    /**
     * Resolved symbol for identifier or expression.
     */
    const symbol = isIdentifier(cursor.current,)
      ? project.checker
        .getResolvedSymbol(cursor.current,)
      : project.checker
        .getSymbolAtLocation(cursor.current,);
    /**
     * Preferred value declaration handle, with first declaration fallback.
     */
    const handle = symbol?.valueDeclaration
      ?? symbol?.declarations
      .at(0,);
    /**
     * Resolved declaration in current project.
     */
    const declaration = handle?.resolve(project,);
    if (declaration === undefined)
      return OWNED_CALLABLE_UNAVAILABLE;
    if (isVariableDeclaration(declaration,)
      && (declaration.initializer !== undefined)) {
      cursor.current = declaration.initializer;
      continue;
    }
    cursor.current = declaration;
  }
  /**
   * Owned callable declaration reached after alias traversal.
   */
  const declaration = cursor.current;
  /**
   * Source file used to reject declaration and external-library boundaries.
   */
  const sourceFile = declaration.getSourceFile();
  return sourceFile.isDeclarationFile
    || project.program
    .isSourceFileFromExternalLibrary(sourceFile,)
    ? OWNED_CALLABLE_UNAVAILABLE
    : declaration;
}

/**
 * Records unresolved external effect and callable provenance.
 *
 * @param summary - Callable summary receiving opaque effect.
 *
 * @param affectedParameterIndex - Affected source parameter index.
 *
 * @param provenance - Authored external call expression text.
 *
 * @mutates summary - Adds opaque index and provenance evidence.
 *
 * @example
 * ```ts
 * addOpaqueEffect({ summary, affectedParameterIndex, provenance });
 * ```
 */
export function addOpaqueEffect({
  summary,
  affectedParameterIndex,
  provenance,
}: {
  readonly summary: MutableEffectSummary;
  readonly affectedParameterIndex: number | typeof PARAMETER_INDEX_UNAVAILABLE;
  readonly provenance: string;
},): void {
  if (affectedParameterIndex === PARAMETER_INDEX_UNAVAILABLE)
    return;
  summary.directOpaque
    .add(affectedParameterIndex,);
  /**
   * Existing provenance facts for parameter, or new accumulator.
   */
  const provenanceFacts = summary.opaqueProvenanceByParameter
    .get(affectedParameterIndex,)
    ?? new Set<string>();
  provenanceFacts.add(provenance,);
  summary.opaqueProvenanceByParameter
    .set(
      affectedParameterIndex,
      provenanceFacts,
    );
}
