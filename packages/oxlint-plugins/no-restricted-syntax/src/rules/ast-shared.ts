import type {
  Definition,
  ESTree,
} from '@oxlint/plugins';
import type { ForeignBorrowed, } from './foreign-borrowed.ts';

/**
 * Sentinel for call-expression shapes that do not expose one ordinary argument.
 */
export const NO_SINGLE_ARGUMENT: unique symbol = Symbol('call expression does not have one ordinary argument');

/**
 * Sentinel for member expressions without a readable static property name.
 */
export const NO_STATIC_MEMBER_NAME: unique symbol = Symbol('member expression has no static property name');

/**
 * Sentinel for import-definition lookups that do not resolve to a declaration.
 */
export const NO_IMPORT_DECLARATION: unique symbol = Symbol('definition does not resolve to import declaration');

/**
 * Returns the only non-spread argument of a call expression.
 *
 * @param call - call expression to inspect
 *
 * @returns sole ordinary argument, or sentinel when shape is unsupported
 *
 * @example
 * ```ts
 * const argument = getSingleNonSpreadArgument({ call });
 * ```
 */
export function getSingleNonSpreadArgument(
  { call, }: ForeignBorrowed<{ readonly call: ESTree.CallExpression; }>,
): ESTree.Expression | typeof NO_SINGLE_ARGUMENT {
  if (call.arguments
    .length
    !== 1)
    return NO_SINGLE_ARGUMENT;
  /**
   * Sole call argument.
   */
  const [argument,] = call.arguments;
  if (argument === undefined)
    return NO_SINGLE_ARGUMENT;
  if (argument.type === 'SpreadElement')
    return NO_SINGLE_ARGUMENT;
  return argument;
}

/**
 * Extracts a static property name from a member expression.
 *
 * @param member - member expression to inspect
 *
 * @returns property name, or sentinel when property is private or dynamic
 *
 * @example
 * ```ts
 * const name = getStaticMemberName({ member: node.callee });
 * ```
 */
export function getStaticMemberName(
  { member, }: ForeignBorrowed<{ readonly member: ESTree.MemberExpression; }>,
): string | typeof NO_STATIC_MEMBER_NAME {
  if (member.property
    .type
    === 'PrivateIdentifier')
    return NO_STATIC_MEMBER_NAME;
  if (member.property
    .type
    === 'Identifier')
    return member.property
      .name;
  if (member.property
    .type
    !== 'Literal')
    return NO_STATIC_MEMBER_NAME;
  if ((typeof member.property
    .value) !== 'string')
    return NO_STATIC_MEMBER_NAME;
  return member.property
    .value;
}

/**
 * Returns static member name for calls shaped like `receiver.method()`, via
 * {@link getStaticMemberName}.
 *
 * @param call - call expression to inspect
 *
 * @returns member name, or sentinel when call target is not static member access
 *
 * @example
 * ```ts
 * const method = getStaticCallMemberName({ call: node });
 * ```
 */
export function getStaticCallMemberName(
  { call, }: ForeignBorrowed<{ readonly call: ESTree.CallExpression; }>,
): string | typeof NO_STATIC_MEMBER_NAME {
  /**
   * Call target; only member calls qualify.
   */
  const { callee, } = call;
  if (callee.type !== 'MemberExpression')
    return NO_STATIC_MEMBER_NAME;
  if (callee.computed)
    return NO_STATIC_MEMBER_NAME;
  return getStaticMemberName({ member: callee, },);
}

/**
 * Resolves enclosing import declaration for an import definition.
 *
 * @param definition - scope-manager definition produced for an import binding
 *
 * @returns import declaration, or sentinel when scope metadata is unexpected
 *
 * @example
 * ```ts
 * const declaration = getImportDeclarationForDefinition({ definition });
 * ```
 */
export function getImportDeclarationForDefinition(
  { definition, }: ForeignBorrowed<{ readonly definition: Definition; }>,
): ESTree.ImportDeclaration | typeof NO_IMPORT_DECLARATION {
  /**
   * Definition node itself for whole-declaration imports, or parent for individual specifiers.
   */
  const declaration = definition.node
    .type
    === 'ImportDeclaration'
    ? definition.node
    : definition.node
      .parent;
  if (declaration === null)
    return NO_IMPORT_DECLARATION;
  if (declaration.type !== 'ImportDeclaration')
    return NO_IMPORT_DECLARATION;
  return declaration;
}
