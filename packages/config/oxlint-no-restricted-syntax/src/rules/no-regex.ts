import type {
  Context,
  CreateOnceRule,
  ESTree,
  VisitorWithHooks,
} from '@oxlint/plugins';

//region Constants

/** Global constructor name used by both `new RegExp()` and `RegExp()`. */
const REGEXP_CONSTRUCTOR_NAME = 'RegExp';

/** String methods whose first argument accepts a regular expression. */
const REGEX_ACCEPTING_STRING_METHODS = [
  'match',
  'matchAll',
  'replace',
  'replaceAll',
  'search',
  'split',
] as const;

//endregion Constants

//region AST helpers

/**
 * Checks whether an AST node is a regular expression literal.
 *
 * @param node - AST node to inspect
 *
 * @returns whether node is a RegExp literal
 *
 * @example
 * ```ts
 * isRegExpLiteral(node); // true for /token/g
 * ```
 */
function isRegExpLiteral(node: ESTree.Node,): node is ESTree.RegExpLiteral {
  if (node.type !== 'Literal')
    return false;
  if (!('regex' in node))
    return false;
  return node.regex !== undefined;
}

/**
 * Checks whether a node calls the global RegExp constructor.
 *
 * Covers both `new RegExp(...)` and `RegExp(...)` because both compile a
 * regular expression from runtime inputs.
 *
 * @param node - AST node to inspect
 *
 * @returns whether node is a RegExp constructor expression
 *
 * @example
 * ```ts
 * isRegExpConstructorExpression(node); // true for new RegExp(source)
 * ```
 */
function isRegExpConstructorExpression(
  node: ESTree.Node,
): node is ESTree.CallExpression | ESTree.NewExpression {
  if ((node.type !== 'CallExpression') && (node.type !== 'NewExpression'))
    return false;
  return (node.callee.type === 'Identifier')
    && (node.callee.name === REGEXP_CONSTRUCTOR_NAME);
}

/**
 * Extracts statically-known member method names.
 *
 * @param node - member expression to inspect
 *
 * @returns property name, or `undefined` when computed dynamically
 *
 * @example
 * ```ts
 * getStaticMethodName({ node: call.callee }); // "match" for text.match(...)
 * ```
 */
function getStaticMethodName(
  { node, }: { node: ESTree.MemberExpression; },
): string | undefined {
  if (!node.computed) {
    if (node.property.type !== 'Identifier')
      return undefined;
    return node.property.name;
  }
  if (node.property.type !== 'Literal')
    return undefined;
  if ((typeof node.property.value) !== 'string')
    return undefined;
  return node.property.value;
}

/**
 * Checks whether a method name accepts regex as its first argument.
 *
 * @param methodName - statically-known method name
 *
 * @returns whether method accepts regex input
 *
 * @example
 * ```ts
 * isRegexAcceptingStringMethod({ methodName: 'match' }); // true
 * ```
 */
function isRegexAcceptingStringMethod(
  { methodName, }: { methodName: string; },
): boolean {
  return REGEX_ACCEPTING_STRING_METHODS.some(
    function isMatchingMethod(candidate,): boolean {
      return candidate === methodName;
    },
  );
}

/**
 * Checks whether an expression is inline regex syntax.
 *
 * @param node - expression node to inspect
 *
 * @returns whether expression is a regex literal or RegExp constructor
 *
 * @example
 * ```ts
 * isInlineRegexExpression(node); // true for /x/ and new RegExp('x')
 * ```
 */
function isInlineRegexExpression(node: ESTree.Node,): boolean {
  return isRegExpLiteral(node,) || isRegExpConstructorExpression(node,);
}

/**
 * Checks whether a call expression is a string-style method call with an
 * inline regex first argument.
 *
 * Type information is unavailable in oxlint JS plugins, so this rule treats
 * any `.match(...)`, `.replace(...)`, `.search(...)`, or `.split(...)` shape
 * with an inline regex as string-method regex usage.
 *
 * @param node - call expression to inspect
 *
 * @returns whether call should receive the string-method message
 *
 * @example
 * ```ts
 * isStringMethodRegexCall({ node }); // true for text.match(/x/)
 * ```
 */
function isStringMethodRegexCall({ node, }: { node: ESTree.CallExpression; },): boolean {
  if (node.callee.type !== 'MemberExpression')
    return false;
  /** Method name resolved from static or string-literal member syntax. */
  const methodName = getStaticMethodName({ node: node.callee, },);
  if (methodName === undefined)
    return false;
  if (!isRegexAcceptingStringMethod({ methodName, },))
    return false;
  /** First call argument; only this position accepts regex for targeted methods. */
  const [firstArgument,] = node.arguments;
  if (firstArgument === undefined)
    return false;
  return isInlineRegexExpression(firstArgument,);
}

/**
 * Returns method name for a previously classified string regex call.
 *
 * @param node - call expression already accepted by {@link isStringMethodRegexCall}
 *
 * @returns method name for diagnostic data
 *
 * @example
 * ```ts
 * stringRegexMethodName({ node }); // "replace"
 * ```
 */
function stringRegexMethodName({ node, }: { node: ESTree.CallExpression; },): string {
  if (node.callee.type !== 'MemberExpression')
    return 'unknown';
  return getStaticMethodName({ node: node.callee, },) ?? 'unknown';
}

/**
 * Checks whether a regex expression is already covered by a more specific
 * parent diagnostic.
 *
 * @param node - regex literal or constructor node
 *
 * @returns whether parent call reports same regex usage
 *
 * @example
 * ```ts
 * isCoveredByParentRegexDiagnostic({ node }); // true for /x/ in text.match(/x/)
 * ```
 */
function isCoveredByParentRegexDiagnostic({ node, }: { node: ESTree.Node; },): boolean {
  /** Parent expression that may own the more specific diagnostic. */
  const { parent, } = node;
  if (parent === null)
    return false;
  if (parent.type !== 'CallExpression')
    return false;
  return isStringMethodRegexCall({ node: parent, },)
    || isRegExpConstructorExpression(parent,);
}

//endregion AST helpers

/**
 * Requires regex usage to go through a scoped disable with justification.
 *
 * Regex can be the right abstraction for grammar-like matching, capture
 * extraction, and user-supplied patterns, but it also hides parser state,
 * input bounds, and backtracking cost. This rule reports every regex site;
 * necessary sites use `oxlint-disable-next-line` with a justification so the
 * exception stays visible at the point of use.
 *
 * `RegExp(...)` and `new RegExp(...)` checks are intentionally syntactic:
 * a local binding named `RegExp` still reports. False positives are cheaper
 * than allowing dynamic regex construction to slip through silently.
 *
 * @example
 * ```ts
 * // Bad: unreviewed regex usage.
 * const suffix = /foo$/;
 *
 * // Good: reviewer can inspect why regex is the right tool here.
 * // oxlint-disable-next-line no-restricted-syntax/no-regex -- fixed token grammar over one CLI argument; no nested quantifiers, so linear.
 * const token = /^[a-z]+:[0-9]+$/;
 * ```
 */
export const noRegex: CreateOnceRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require regex usage to be justified with a scoped oxlint-disable comment.',
      recommended: true,
    },
    messages: {
      regexLiteral:
        'Regex literal requires a scoped disable with justification. Prefer an index scan, parser, or string API; if regex is still right, add `oxlint-disable-next-line no-restricted-syntax/no-regex -- <why regex, input bounds, backtracking safety>`.',
      regexpConstructor:
        'RegExp constructor requires a scoped disable with justification. Explain why dynamic regex compilation is needed, what bounds the pattern/input, and why matching stays safe.',
      stringMethod:
        'String#{{method}}() with an inline regex requires a scoped disable with justification. Explain why regex is clearer than a string API or parser, and what bounds matching cost.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    return {
      Literal(node,): void {
        if (!isRegExpLiteral(node,))
          return;
        if (isCoveredByParentRegexDiagnostic({ node, },))
          return;
        context.report({
          node,
          messageId: 'regexLiteral',
        },);
      },
      NewExpression(node,): void {
        if (!isRegExpConstructorExpression(node,))
          return;
        if (isCoveredByParentRegexDiagnostic({ node, },))
          return;
        context.report({
          node,
          messageId: 'regexpConstructor',
        },);
      },
      CallExpression(node,): void {
        if (isRegExpConstructorExpression(node,)) {
          if (isCoveredByParentRegexDiagnostic({ node, },))
            return;
          context.report({
            node,
            messageId: 'regexpConstructor',
          },);
          return;
        }
        if (!isStringMethodRegexCall({ node, },))
          return;
        context.report({
          node,
          messageId: 'stringMethod',
          data: { method: stringRegexMethodName({ node, },), },
        },);
      },
    };
  },
};
