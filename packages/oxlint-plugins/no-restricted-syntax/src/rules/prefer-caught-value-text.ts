import type {
  Context,
  CreateOnceRule,
  ESTree,
  VisitorWithHooks,
} from '@oxlint/plugins';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

/**
 * Sentinel returned when an expression is not a supported identifier.
 */
const NO_IDENTIFIER: unique symbol = Symbol('prefer-caught-value-text identifier not found',);

/**
 * Canonical implementation path exempt from duplicate-implementation reports.
 */
const CANONICAL_FORMATTER_PATH = 'packages/module/caught-value/src/index.ts';

/**
 * Tests whether current file owns canonical formatter implementation.
 *
 * @param fileName - Absolute or workspace-relative lint target path.
 *
 * @returns whether target is canonical implementation module.
 *
 * @example
 * ```ts
 * isCanonicalFormatterFile('/repo/packages/module/caught-value/src/index.ts');
 * ```
 */
function isCanonicalFormatterFile(fileName: string,): boolean {
  return fileName
    .replaceAll(
      '\\',
      '/',
    )
    .endsWith(CANONICAL_FORMATTER_PATH,);
}

/**
 * Reads an identifier name from an expression.
 *
 * @param expression - Expression candidate.
 *
 * @returns identifier name or sentinel.
 *
 * @example
 * ```ts
 * identifierName({ expression });
 * ```
 */
function identifierName(
  { expression, }: ForeignBorrowed<{ readonly expression: ESTree.Expression; }>,
): string | typeof NO_IDENTIFIER {
  return expression.type === 'Identifier'
    ? expression.name
    : NO_IDENTIFIER;
}

/**
 * Reads identifier tested by a direct `Error.isError` call.
 *
 * @param expression - Potential detector call.
 *
 * @returns tested identifier name or sentinel.
 *
 * @example
 * ```ts
 * errorDetectorIdentifier({ expression });
 * ```
 */
function errorDetectorIdentifier(
  { expression, }: ForeignBorrowed<{ readonly expression: ESTree.Expression; }>,
): string | typeof NO_IDENTIFIER {
  if (expression.type !== 'CallExpression')
    return NO_IDENTIFIER;
  /**
   * Potential Error.isError member call target.
   */
  const { callee, } = expression;
  if (callee.type !== 'MemberExpression')
    return NO_IDENTIFIER;
  if (callee.computed)
    return NO_IDENTIFIER;
  /**
   * Potential Error constructor and isError property.
   */
  const {
    object,
    property,
  } = callee;
  if (object.type !== 'Identifier')
    return NO_IDENTIFIER;
  if (object.name !== 'Error')
    return NO_IDENTIFIER;
  if (property.type !== 'Identifier')
    return NO_IDENTIFIER;
  if (property.name !== 'isError')
    return NO_IDENTIFIER;
  /**
   * Value tested by Error.isError.
   */
  const [argument,] = expression.arguments;
  if ((argument === undefined) || (argument.type === 'SpreadElement'))
    return NO_IDENTIFIER;
  return identifierName({ expression: argument, },);
}

/**
 * Tests whether expression reads named Error field from detector input.
 *
 * @param expression - Potential member read.
 *
 * @param identifier - Detector input name.
 *
 * @param property - Error field name.
 *
 * @returns whether expression is exact field read.
 *
 * @example
 * ```ts
 * readsErrorField({ expression, identifier: 'error', property: 'message' });
 * ```
 */
function readsErrorField(
  {
    expression,
    identifier,
    property,
  }: ForeignBorrowed<{
    readonly expression: ESTree.Expression;
    readonly identifier: string;
    readonly property: 'message' | 'stack';
  }>,
): boolean {
  if (expression.type !== 'MemberExpression')
    return false;
  if (expression.computed)
    return false;
  /**
   * Potential Error value and field name.
   */
  const {
    object,
    property: memberProperty,
  } = expression;
  if (object.type !== 'Identifier')
    return false;
  if (object.name !== identifier)
    return false;
  return (memberProperty.type === 'Identifier')
    && (memberProperty.name === property);
}

/**
 * Tests whether expression yields Error message or stack diagnostics.
 *
 * @param expression - Branch result expression.
 *
 * @param identifier - Detector input name.
 *
 * @returns whether branch reproduces shared caught-value formatting.
 *
 * @example
 * ```ts
 * readsErrorDiagnostic({ expression, identifier: 'error' });
 * ```
 */
function readsErrorDiagnostic(
  {
    expression,
    identifier,
  }: ForeignBorrowed<{
    readonly expression: ESTree.Expression;
    readonly identifier: string;
  }>,
): boolean {
  if (readsErrorField({
    expression,
    identifier,
    property: 'message',
  },))
    return true;
  if (expression.type !== 'LogicalExpression')
    return false;
  if (expression.operator !== '??')
    return false;
  return readsErrorField({
    expression: expression.left,
    identifier,
    property: 'stack',
  },) && readsErrorField({
    expression: expression.right,
    identifier,
    property: 'message',
  },);
}

/**
 * Tests whether statement returns Error diagnostic field.
 *
 * @param statement - Consequent statement.
 *
 * @param identifier - Detector input name.
 *
 * @returns whether statement returns matching diagnostic.
 *
 * @example
 * ```ts
 * returnsErrorDiagnostic({ statement, identifier: 'error' });
 * ```
 */
function returnsErrorDiagnostic(
  {
    statement,
    identifier,
  }: ForeignBorrowed<{
    readonly statement: ESTree.Statement;
    readonly identifier: string;
  }>,
): boolean {
  if (statement.type === 'ReturnStatement') {
    return (statement.argument !== null)
      && readsErrorDiagnostic({
        expression: statement.argument,
        identifier,
      },);
  }
  if (statement.type !== 'BlockStatement')
    return false;
  /**
   * First branch statement, sufficient only when branch contains one return.
   */
  const [onlyStatement, ...remainingStatements] = statement.body;
  return (remainingStatements.length === 0)
    && (onlyStatement !== undefined)
    && returnsErrorDiagnostic({
      statement: onlyStatement,
      identifier,
    },);
}

/**
 * Tests whether function starts a local caught-value formatter implementation.
 *
 * @param node - Function declaration or expression.
 *
 * @returns whether body duplicates shared formatter behavior.
 *
 * @example
 * ```ts
 * duplicatesCaughtValueFormatter({ node });
 * ```
 */
function duplicatesCaughtValueFormatter(
  { node, }: ForeignBorrowed<{
    readonly node: ESTree.Function;
  }>,
): boolean {
  if (node.body === null)
    return false;
  /**
   * First body statement where compact formatter implementations test Error.
   */
  const { body, } = node.body;
  /**
   * Leading function statement.
   */
  const [firstStatement,] = body;
  if ((firstStatement === undefined) || (firstStatement.type !== 'IfStatement'))
    return false;
  /**
   * Identifier tested by leading Error branch.
   */
  const identifier = errorDetectorIdentifier({ expression: firstStatement.test, },);
  if ((typeof identifier) === 'symbol')
    return false;
  return returnsErrorDiagnostic({
    statement: firstStatement.consequent,
    identifier,
  },);
}

/**
 * Prefers shared caught-value diagnostics over package-local implementations.
 *
 * @example
 * ```ts
 * caughtValueText(error,);
 * caughtValueStack(error,);
 * ```
 */
export const preferCaughtValueText: CreateOnceRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Use shared caught-value formatting instead of duplicating Error and fallback branches.',
      recommended: true,
    },
    messages: {
      duplicate: 'Use caughtValueText or caughtValueStack from @monochromatic-dev/module-caught-value/ts.',
    },
  },
  /**
   * Creates duplicate formatter visitor.
   *
   * @param context - Foreign rule context receiving diagnostics.
   *
   * @mutates context - Emits diagnostics through foreign rule context.
   *
   * @example
   * ```ts
   * preferCaughtValueText.createOnce(context);
   * ```
   */
  createOnce(context: ForeignBorrowed<Context>,): VisitorWithHooks {
    if (isCanonicalFormatterFile(context.filename,))
      return {};

    /**
     * Reports duplicate formatter syntax.
     *
     * @param node - Duplicated formatter node.
     */
    function reportDuplicate(node: ForeignBorrowed<ESTree.Node>,): void {
      context.report({
        node,
        messageId: 'duplicate',
      },);
    }

    return {
      ConditionalExpression(node: ForeignBorrowed<ESTree.ConditionalExpression>,): void {
        /**
         * Identifier tested by conditional Error branch.
         */
        const identifier = errorDetectorIdentifier({ expression: node.test, },);
        if ((typeof identifier) === 'symbol')
          return;
        if (readsErrorDiagnostic({
          expression: node.consequent,
          identifier,
        },))
          reportDuplicate(node,);
      },
      FunctionDeclaration(node: ForeignBorrowed<ESTree.Function>,): void {
        if (duplicatesCaughtValueFormatter({ node, },))
          reportDuplicate(node,);
      },
      FunctionExpression(node: ForeignBorrowed<ESTree.Function>,): void {
        if (duplicatesCaughtValueFormatter({ node, },))
          reportDuplicate(node,);
      },
    };
  },
};
