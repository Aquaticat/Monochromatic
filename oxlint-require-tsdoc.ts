// HACK: Find a better place for this plugin.

import {
  type Context,
  eslintCompatPlugin,
  type Span,
  type VisitorWithHooks,
} from '@oxlint/plugins';

/**
 * Checks whether a node is preceded by a TSDoc block comment.
 */
function hasTsdoc(
  node: Span,
  context: Context,
): boolean {
  /**
   * Comments adjacent to the node; the rule passes when any one is a TSDoc block.
   */
  const comments = context.sourceCode
    .getCommentsBefore(node,);
  return comments.some(comment =>
    (comment.type
      === 'Block')
      && comment
      .value
      .startsWith('*',)
  );
}

/**
 * Reports a diagnostic when a node lacks a TSDoc comment.
 */
function reportTsdoc(
  node: Span,
  context: Context,
): void {
  if (!hasTsdoc(
    node,
    context,
  )) {
    context.report({
      node,
      messageId: 'no',
    },);
  }
}

/**
 * File extensions that should be excluded from the require-tsdoc rule.
 */
const IGNORED_EXTENSIONS = [
  '.test.ts',
  '.spec.ts',
  '.js',
  '.d.ts',
  '.mjs',
  '.cjs',
  '.d.mts',
  '.d.cts',
];

/**
 * Oxlint JS plugin that requires TSDoc comments on all documentable declarations.
 *
 * Uses the `createOnce` alternative API for better performance; `eslintCompatPlugin`
 * adds a `create` shim so the plugin also works with ESLint.
 */
const plugin = eslintCompatPlugin({
  meta: {
    name: 'require-tsdoc',
  },
  rules: {
    'require-tsdoc': {
      meta: {
        messages: {
          no: 'missing tsdoc',
        },
      },
      createOnce(context,) {
        // Cast needed: upstream VisitorObject index signature is contravariant with specific node callbacks
        return {
          before(): false | undefined {
            if (IGNORED_EXTENSIONS
              .some(function endsWith(ignorePattern,): boolean {
                return context.filename
                  .endsWith(ignorePattern,);
              },))
            {
              return false;
            }
          },
          FunctionDeclaration(node,): void {
            reportTsdoc(
              node,
              context,
            );
          },
          FunctionExpression(node,): void {
            reportTsdoc(
              node,
              context,
            );
          },
          ArrowFunctionExpression(node,): void {
            reportTsdoc(
              node,
              context,
            );
          },
          ClassDeclaration(node,): void {
            reportTsdoc(
              node,
              context,
            );
          },
          MethodDefinition(node,): void {
            reportTsdoc(
              node,
              context,
            );
          },
          TSInterfaceDeclaration(node,): void {
            reportTsdoc(
              node,
              context,
            );
          },
          TSTypeAliasDeclaration(node,): void {
            reportTsdoc(
              node,
              context,
            );
          },
          TSEnumDeclaration(node,): void {
            reportTsdoc(
              node,
              context,
            );
          },
          VariableDeclaration(node,): void {
            reportTsdoc(
              node,
              context,
            );
          },
          PropertyDefinition(node,): void {
            reportTsdoc(
              node,
              context,
            );
          },
          TSEnumMember(node,): void {
            reportTsdoc(
              node,
              context,
            );
          },
          Property(node,): void {
            if ((node.kind
              === 'get') || (node.kind
                === 'set')) {
              reportTsdoc(
                node,
                context,
              );
            }
          },
        } as VisitorWithHooks;
      },
    },
  },
},);

export default plugin;
