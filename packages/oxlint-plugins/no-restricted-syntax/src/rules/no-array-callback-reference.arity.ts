import type {
  Context,
  Definition,
  ESTree,
  Variable,
} from '@oxlint/plugins';
import type { ForeignBorrowed, } from '@monochromatic-dev/config-oxlint-shared/ts';

import {
  getStaticMemberName,
  NO_STATIC_MEMBER_NAME,
} from './ast-shared.ts';
import { NO_VARIABLE, } from './no-sync.constants.ts';
import {
  findVariable,
  getVariableDeclarator,
} from './no-sync.syntax.ts';

//region Constants and types

/**
 * Exact parameter count that means array iterator extra arguments cannot bind
 * to a named parameter.
 */
const UNARY_CALLBACK_PARAMETER_COUNT = 1;

/**
 * Function node kinds whose parameters can be counted directly.
 */
type FunctionWithParams = ESTree.Function | ESTree.ArrowFunctionExpression;

/**
 * Minimal readonly object-property shape needed to read a static key.
 */
type ObjectPropertyNameSource = {
  /**
   * Whether property key is computed.
   */
  readonly computed: boolean;
  /**
   * Property key node.
   */
  readonly key: ESTree.ObjectProperty['key'];
};

//endregion Constants and types

//region Syntax helpers

/**
 * Returns expression with transparent wrappers removed.
 *
 * @param expression - Expression that may be wrapped by parentheses or TS-only casts.
 *
 * @returns Runtime expression inside transparent wrappers.
 *
 * @example
 * ```ts
 * unwrapExpression({ expression: callback });
 * ```
 */
function unwrapExpression(
  { expression, }: ForeignBorrowed<{ readonly expression: ESTree.Expression; }>,
): ESTree.Expression {
  if (expression.type === 'ParenthesizedExpression')
    return unwrapExpression({ expression: expression.expression, },);
  if (expression.type === 'TSAsExpression')
    return unwrapExpression({ expression: expression.expression, },);
  if (expression.type === 'TSSatisfiesExpression')
    return unwrapExpression({ expression: expression.expression, },);
  if (expression.type === 'TSTypeAssertion')
    return unwrapExpression({ expression: expression.expression, },);
  if (expression.type === 'TSNonNullExpression')
    return unwrapExpression({ expression: expression.expression, },);
  if (expression.type === 'TSInstantiationExpression')
    return unwrapExpression({ expression: expression.expression, },);
  return expression;
}

/**
 * Returns static object property name when available.
 *
 * @param property - Object property whose key should be inspected.
 *
 * @returns Static property name, or sentinel for computed/private/unsupported keys.
 *
 * @example
 * ```ts
 * const name = getObjectPropertyName({ property });
 * ```
 */
function getObjectPropertyName(
  { property, }: ForeignBorrowed<{ readonly property: ObjectPropertyNameSource; }>,
): string | typeof NO_STATIC_MEMBER_NAME {
  if (property.computed)
    return NO_STATIC_MEMBER_NAME;
  /**
   * Object property key.
   */
  const { key, } = property;
  if (key.type === 'Identifier')
    return key.name;
  if (key.type !== 'Literal')
    return NO_STATIC_MEMBER_NAME;
  if ((typeof key.value) !== 'string')
    return NO_STATIC_MEMBER_NAME;
  return key.value;
}

//endregion Syntax helpers

//region Function arity

/**
 * Reports whether node exposes a function parameter list.
 *
 * @param node - ESTree node being inspected.
 *
 * @returns Whether node is a function-like node with `params`.
 *
 * @example
 * ```ts
 * isFunctionWithParams(definition.node);
 * ```
 */
function isFunctionWithParams(node: ForeignBorrowed<ESTree.Node>,): node is FunctionWithParams {
  return (node.type === 'FunctionDeclaration')
    || (node.type === 'FunctionExpression')
    || (node.type === 'TSDeclareFunction')
    || (node.type === 'TSEmptyBodyFunctionExpression')
    || (node.type === 'ArrowFunctionExpression');
}

/**
 * Reports whether function has exactly one non-rest declared parameter.
 *
 * @param fn - Function-like node whose declared parameters are inspected.
 *
 * @returns Whether function's declared arity is exactly one.
 *
 * @example
 * ```ts
 * hasUnaryDeclaredArity({ fn: callbackDeclaration });
 * ```
 */
function hasUnaryDeclaredArity({ fn, }: ForeignBorrowed<{ readonly fn: FunctionWithParams; }>,): boolean {
  /**
   * Declared function parameters.
   */
  const { params, } = fn;
  if (params.length !== UNARY_CALLBACK_PARAMETER_COUNT)
    return false;
  /**
   * Sole declared parameter.
   */
  const [parameter,] = params;
  if (parameter === undefined)
    return false;
  return parameter.type !== 'RestElement';
}

/**
 * Reports whether expression itself is a one-parameter function expression.
 *
 * @param expression - Expression being inspected directly.
 *
 * @returns Whether expression is a function-like node with one declared parameter.
 *
 * @example
 * ```ts
 * isDirectUnaryFunctionExpression({ expression: callbackInitializer });
 * ```
 */
function isDirectUnaryFunctionExpression(
  { expression, }: ForeignBorrowed<{ readonly expression: ESTree.Expression; }>,
): boolean {
  /**
   * Runtime expression inside transparent wrappers.
   */
  const unwrappedExpression = unwrapExpression({ expression, },);
  if (!isFunctionWithParams(unwrappedExpression,))
    return false;
  return hasUnaryDeclaredArity({ fn: unwrappedExpression, },);
}

//endregion Function arity

//region Scope resolution

/**
 * Reports whether a scope definition declares or initializes a unary function.
 *
 * @param definition - Scope-manager definition to inspect.
 *
 * @returns Whether definition resolves to a one-parameter function.
 *
 * @example
 * ```ts
 * isKnownUnaryDefinition({ definition });
 * ```
 */
function isKnownUnaryDefinition(
  { definition, }: ForeignBorrowed<{ readonly definition: Definition; }>,
): boolean {
  if (isFunctionWithParams(definition.node,))
    return hasUnaryDeclaredArity({ fn: definition.node, },);
  /**
   * Parent node for scope-manager shapes where definition.node is only the name.
   */
  const { parent, } = definition;
  if ((parent !== null) && isFunctionWithParams(parent,))
    return hasUnaryDeclaredArity({ fn: parent, },);
  if (definition.type !== 'Variable')
    return false;
  /**
   * Variable declarator for the definition, when scope metadata can resolve it.
   */
  const declarator = getVariableDeclarator({ definition, },);
  if (declarator === NO_VARIABLE)
    return false;
  /**
   * Initializer that supplies the variable's runtime value.
   */
  const { init, } = declarator;
  if (init === null)
    return false;
  return isDirectUnaryFunctionExpression({ expression: init, },);
}

/**
 * Reports whether identifier resolves to a statically-known unary function.
 *
 * @param context - Oxlint rule context.
 *
 * @param identifier - Identifier callback expression.
 *
 * @param seen - Variables already visited while resolving aliases.
 *
 * @returns Whether identifier's binding declares one parameter.
 *
 * @example
 * ```ts
 * isKnownUnaryIdentifierReference({ context, identifier, seen: new Set() });
 * ```
 */
function isKnownUnaryIdentifierReference(
  {
    context,
    identifier,
    seen,
  }: ForeignBorrowed<{
    readonly context: Context;
    readonly identifier: ESTree.IdentifierReference;
    readonly seen: ReadonlySet<Variable>;
  }>,
): boolean {
  /**
   * Scope variable behind the identifier.
   */
  const variable = findVariable({
    context,
    node: identifier,
    name: identifier.name,
  },);
  if (variable === NO_VARIABLE)
    return false;
  if (seen.has(variable,))
    return false;
  /**
   * Seen set extended with current variable to avoid alias loops.
   */
  const seenWithVariable = new Set(seen,);
  seenWithVariable.add(variable,);
  /**
   * Scope definitions for the resolved variable.
   */
  const definitions = variable.defs;
  return definitions.some(
    function definitionDeclaresUnaryArity(
      definition: ForeignBorrowed<Definition>,
    ): boolean {
      return isKnownUnaryDefinition({ definition, },);
    },
  );
}

/**
 * Resolves a local identifier to an object literal initializer.
 *
 * @param context - Oxlint rule context.
 *
 * @param identifier - Identifier whose binding should hold an object literal.
 *
 * @returns Object literal initializer, or sentinel when not statically known.
 *
 * @example
 * ```ts
 * const objectLiteral = getLocalObjectLiteral({ context, identifier });
 * ```
 */
function getLocalObjectLiteral(
  {
    context,
    identifier,
  }: ForeignBorrowed<{
    readonly context: Context;
    readonly identifier: ESTree.IdentifierReference;
  }>,
): ESTree.ObjectExpression | typeof NO_VARIABLE {
  /**
   * Scope variable behind object identifier.
   */
  const variable = findVariable({
    context,
    node: identifier,
    name: identifier.name,
  },);
  if (variable === NO_VARIABLE)
    return NO_VARIABLE;
  /**
   * First scope definition for the object identifier.
   */
  const [definition,] = variable.defs;
  if (definition === undefined)
    return NO_VARIABLE;
  if (definition.type !== 'Variable')
    return NO_VARIABLE;
  /**
   * Variable declarator holding the object initializer.
   */
  const declarator = getVariableDeclarator({ definition, },);
  if (declarator === NO_VARIABLE)
    return NO_VARIABLE;
  /**
   * Initializer expression for the object binding.
   */
  const { init, } = declarator;
  if (init === null)
    return NO_VARIABLE;
  /**
   * Runtime initializer inside transparent wrappers.
   */
  const unwrappedInit = unwrapExpression({ expression: init, },);
  if (unwrappedInit.type !== 'ObjectExpression')
    return NO_VARIABLE;
  return unwrappedInit;
}

//endregion Scope resolution

//region Public arity resolver

/**
 * Reports whether expression resolves to a statically-known unary function.
 *
 * @param context - Oxlint rule context.
 *
 * @param expression - Callback expression being resolved.
 *
 * @returns Whether expression's target is known to declare one parameter.
 *
 * @example
 * ```ts
 * isKnownUnaryFunctionExpression({ context, expression: callback });
 * ```
 */
export function isKnownUnaryFunctionExpression(
  {
    context,
    expression,
  }: ForeignBorrowed<{
    readonly context: Context;
    readonly expression: ESTree.Expression;
  }>,
): boolean {
  /**
   * Runtime expression inside transparent wrappers.
   */
  const unwrappedExpression = unwrapExpression({ expression, },);
  if (isDirectUnaryFunctionExpression({ expression: unwrappedExpression, }))
    return true;
  /**
   * Empty visited-variable set for this arity resolution.
   */
  const seen = new Set<Variable>();
  if (unwrappedExpression.type === 'Identifier')
    return isKnownUnaryIdentifierReference({
      context,
      identifier: unwrappedExpression,
      seen,
    },);
  if (unwrappedExpression.type !== 'MemberExpression')
    return false;
  /**
   * Static property name being referenced.
   */
  const propertyName = getStaticMemberName({ member: unwrappedExpression, },);
  if (propertyName === NO_STATIC_MEMBER_NAME)
    return false;
  /**
   * Member receiver expression.
   */
  const objectExpression = unwrapExpression({ expression: unwrappedExpression.object, },);
  if (objectExpression.type !== 'Identifier')
    return false;
  /**
   * Object literal that owns the referenced property.
   */
  const objectLiteral = getLocalObjectLiteral({
    context,
    identifier: objectExpression,
  },);
  if (objectLiteral === NO_VARIABLE)
    return false;
  /**
   * Properties from the resolved object literal.
   */
  const { properties, } = objectLiteral;
  /**
   * Property matching the static member name.
   */
  const property = properties.find(
    function isMatchingProperty(
      candidate: ForeignBorrowed<(typeof properties)[number]>,
    ): boolean {
      return (candidate.type === 'Property')
        && (getObjectPropertyName({ property: candidate, }) === propertyName);
    },
  );
  if ((property === undefined) || (property.type !== 'Property'))
    return false;
  /**
   * Runtime value stored in the matching property.
   */
  const propertyValue = unwrapExpression({ expression: property.value, },);
  if (isDirectUnaryFunctionExpression({ expression: propertyValue, }))
    return true;
  if (propertyValue.type !== 'Identifier')
    return false;
  return isKnownUnaryIdentifierReference({
    context,
    identifier: propertyValue,
    seen,
  },);
}

//endregion Public arity resolver
