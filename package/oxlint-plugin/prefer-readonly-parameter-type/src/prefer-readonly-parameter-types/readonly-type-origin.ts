import type {
  Node,
  ParameterDeclaration,
} from 'typescript/unstable/ast';
import {
  isArrowFunction,
  isFunctionExpression,
} from 'typescript/unstable/ast/is';
import type {
  Project,
  Symbol as TypeScriptSymbol,
  Type,
} from 'typescript/unstable/sync';

import {
  readonlyTypeOrigin,
  type ReadonlyTypeOrigin,
  workspaceOrigin,
} from './readonly-type-origin-location.ts';

/**
 * Origin evidence for one parameter's readonly preference guidance.
 */
export type ReadonlyTypeOriginEvidence =
  | { readonly kind: 'authored'; }
  | { readonly kind: 'none'; }
  | { readonly kind: 'multiple'; }
  | {
    readonly kind: 'unique';
    readonly origin: ReadonlyTypeOrigin;
  };

/**
 * Returns distinct symbols exposing declarations for one type.
 *
 * @param type - Semantic type whose declarations are needed.
 *
 * @returns alias and structural symbols without duplicate identity.
 *
 * @example
 * ```ts
 * declarationSymbols(type);
 * ```
 */
function declarationSymbols(type: Type,): readonly TypeScriptSymbol[] {
  return [
    type.getAliasSymbol(),
    type.getSymbol(),
  ]
    .filter(function definedSymbol(
      symbol,
    ): symbol is TypeScriptSymbol {
      return symbol !== undefined;
    },)
    .filter(function firstSymbol(
      symbol,
      index,
      symbols,
    ): boolean {
      return symbols.findIndex(function sameId(candidate,): boolean {
        return candidate.id === symbol.id;
      },) === index;
    },);
}

/**
 * Collects eager editable origins from semantic type graph.
 *
 * @param type - Inferred callback parameter type.
 *
 * @param project - Active project resolving declaration handles.
 *
 * @returns distinct normalized origins.
 *
 * @example
 * ```ts
 * editableOrigins({ type, project });
 * ```
 */
function editableOrigins({
  type,
  project,
}: {
  readonly type: Type;
  readonly project: Project;
},): readonly ReadonlyTypeOrigin[] {
  /**
   * Type graph pending union and intersection expansion.
   */
  const pending: Type[] = [type,];
  /**
   * Semantic type identities already expanded.
   */
  const visited = new Set<number>();
  /**
   * Origins keyed after normalization to callable or named type owner.
   */
  const originsByLocation = new Map<string, ReadonlyTypeOrigin>();
  while (pending.length > 0) {
    /**
     * Next semantic type,
     * absent only after unexpected stack mutation.
     */
    const current = pending.pop();
    if ((current === undefined) || visited.has(current.id,))
      continue;
    visited.add(current.id,);
    if (current.isUnionType() || current.isIntersectionType()) {
      pending.push(...current.getTypes(),);
      continue;
    }
    declarationSymbols(current,)
      .flatMap(function symbolDeclarations(symbol,): readonly Node[] {
        return symbol.declarations
          .flatMap(function resolveDeclaration(handle,): readonly Node[] {
            /**
             * Declaration eagerly resolved through active project snapshot.
             */
            const declaration = handle.resolve(project,);
            return declaration === undefined ? [] : [declaration,];
          },);
      },)
      .filter(function editableDeclaration(declaration,): boolean {
        return workspaceOrigin({
          node: declaration,
          project,
        },);
      },)
      .map(function eagerOrigin(declaration,): ReadonlyTypeOrigin {
        return readonlyTypeOrigin({
          declaration,
          project,
        },);
      },)
      .forEach(function recordOrigin(origin,): void {
        originsByLocation.set(
          origin.location,
          origin,
        );
      },);
  }
  return [...originsByLocation.values(),];
}

/**
 * Builds origin evidence for readonly preference on one parameter.
 *
 * @param parameter - Parameter whose type syntax and callback context are inspected.
 *
 * @param parameterType - Semantic parameter type.
 *
 * @param project - Active project resolving type declarations eagerly.
 *
 * @returns authored,
 * absent,
 * multiple,
 * or unique origin evidence.
 *
 * @example
 * ```ts
 * readonlyTypeOriginEvidence({ parameter, parameterType, project });
 * ```
 */
export function readonlyTypeOriginEvidence({
  parameter,
  parameterType,
  project,
}: {
  readonly parameter: ParameterDeclaration;
  readonly parameterType: Type;
  readonly project: Project;
},): ReadonlyTypeOriginEvidence {
  if (parameter.type !== undefined)
    return { kind: 'authored', };
  /**
   * Callable syntactically owning unannotated parameter.
   */
  const callable = parameter.parent;
  if (!(isFunctionExpression(callable,) || isArrowFunction(callable,)))
    return { kind: 'none', };
  /**
   * Contextual callback type proving parameter was supplied by surrounding expression.
   */
  const contextualType = project.checker
    .getContextualType(callable,);
  if (contextualType === undefined)
    return { kind: 'none', };
  /**
   * Editable origins eagerly resolved in current project snapshot.
   */
  const origins = editableOrigins({
    type: parameterType,
    project,
  },);
  if (origins.length === 0)
    return { kind: 'none', };
  if (origins.length > 1)
    return { kind: 'multiple', };
  return {
    kind: 'unique',
    origin: origins[0] ?? {
      kind: 'expression',
      location: 'unknown location',
    },
  };
}
