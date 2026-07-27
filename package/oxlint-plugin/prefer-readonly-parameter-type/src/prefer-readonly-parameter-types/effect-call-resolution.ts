/**
 * Owned-call resolution and parameter-origin helpers.
 *
 * @module
 */

import {
  type Checker,
  type Project,
  SymbolFlags,
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

import { expressionValueOrigins, } from './effect-expression-provenance.ts';
import {
  expressionCanCarryMutableState,
  receiverElementsArePrimitive,
} from './effect-primitive-origin.ts';
import { isWorkspaceSourceFileName, } from './workspace-source-path.ts';
import {
  type EffectCallableDeclaration,
  expressionRoot,
  isEffectCallableDeclaration,
  type MutableEffectSummary,
  NO_PARAMETER_ORIGIN,
  OWNED_CALLABLE_UNAVAILABLE,
  PARAMETER_INDEX_UNAVAILABLE,
  type ParameterOrigins,
} from './effect-summary-model.ts';

/**
 * Sentinel selecting every property in packaged call argument.
 */
export const ALL_PACKAGED_PROPERTIES: unique symbol = Symbol('all packaged call argument properties',);

/**
 * Maps an expression to every callable parameter its value can be reached from.
 *
 * {@inheritDoc expressionValueOrigins}
 *
 * @param project - TypeScript project resolving symbols and signatures.
 *
 * @param bindingOriginBySymbolId - Local binding symbols mapped to source parameters.
 *
 * @param node - Expression whose value may carry parameter state.
 *
 * @returns parameter origins, empty when value is not parameter-derived.
 *
 * @example
 * ```ts
 * rootParameterOrigins({ project, bindingOriginBySymbolId, node });
 * ```
 */
export function rootParameterOrigins({
  project,
  bindingOriginBySymbolId,
  node,
}: {
  readonly project: Project;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, ParameterOrigins>;
  readonly node: Node;
},): ParameterOrigins {
  return expressionValueOrigins({
    project,
    bindingOriginBySymbolId,
    node,
  },);
}

/**
 * Collects every caller parameter origin packaged inside one call argument.
 *
 * @param project - TypeScript project resolving root symbols and signatures.
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
 *   project,
 *   bindingOriginBySymbolId,
 *   node,
 *   includedPropertyNames: ALL_PACKAGED_PROPERTIES,
 * });
 * ```
 */
export function parameterIndexes({
  project,
  bindingOriginBySymbolId,
  node,
  includedPropertyNames,
}: {
  readonly project: Project;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, ParameterOrigins>;
  readonly node: Node;
  readonly includedPropertyNames: ReadonlySet<string> | typeof ALL_PACKAGED_PROPERTIES;
},): readonly number[] {
  /**
   * Checker for the project resolving this argument structure.
   */
  const { checker, } = project;
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
     * Direct parameter origins at current expression root.
     */
    const direct = rootParameterOrigins({
      project,
      bindingOriginBySymbolId,
      node: current,
    },);
    if (direct.size > 0) {
      if (expressionCanCarryMutableState({
        checker,
        node: current,
      },))
        direct.forEach(function collectDirect(origin,): void {
          origins.add(origin,);
        },);
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
             * Caller parameter origins represented by shorthand value.
             */
            const shorthandOrigins = bindingOriginBySymbolId.get(valueSymbol.id,)
              ?? NO_PARAMETER_ORIGIN;
            if (expressionCanCarryMutableState({
              checker,
              node: property.name,
            },))
              shorthandOrigins.forEach(function collectShorthand(origin,): void {
                origins.add(origin,);
              },);
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
        if (!isSpreadElement(element,)) {
          collect(element,);
          return;
        }
        /**
         * Spread source type used to prove newly allocated arrays retain no
         * caller-reachable object when every copied element is primitive.
         */
        const spreadType = checker.getTypeAtLocation(element.expression,);
        if ((spreadType !== undefined)
          && receiverElementsArePrimitive({
            checker,
            type: spreadType,
          },))
          return;
        collect(element.expression,);
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
 * @param analysisRoot - Optional external implementation root accepted as inspectable source.
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
  analysisRoot,
}: {
  readonly project: Project;
  readonly node: Node;
  readonly analysisRoot?: string;
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
     * Import and re-export aliases followed to exact value declaration.
     */
    const aliasedSymbol = (symbol !== undefined)
      && ((symbol.flags & SymbolFlags.Alias) !== 0)
      ? project
        .checker
        .getAliasedSymbol(symbol,)
      : symbol;
    /**
     * Resolved symbol or absent source symbol.
     */
    const declarationSymbol = aliasedSymbol ?? symbol;
    /**
     * Preferred value declaration handle, with first declaration fallback.
     */
    const handle = declarationSymbol?.valueDeclaration
      ?? declarationSymbol?.declarations
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
  if (sourceFile.isDeclarationFile)
    return OWNED_CALLABLE_UNAVAILABLE;
  if ((!project.program
    .isSourceFileFromExternalLibrary(sourceFile,))
    /* Symlink-resolved workspace dependencies classify as external while
     * living at repository paths; their source stays inspectable. */
    || isWorkspaceSourceFileName(sourceFile.fileName,)
    || ((analysisRoot !== undefined)
      && sourceFile.fileName
      .startsWith(analysisRoot,)))
    return declaration;
  return OWNED_CALLABLE_UNAVAILABLE;
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
