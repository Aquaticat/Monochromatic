// TODO: Find a better place for this plugin.

import {
  type Context,
  definePlugin,
  defineRule,
  type Span,
} from 'oxlint';

function hasTsdoc(node: Span, context: Context,): boolean {
  const comments = context.sourceCode.getCommentsBefore(node,);
  return comments.some(comment =>
    comment.type === 'Block'
    && comment.value.startsWith('*',)
  );
}

function reportTsdoc(node: Span, context: Context,): void {
  if (!hasTsdoc(node, context,))
    context.report({ node, messageId: 'no', },);
}

const rule = defineRule({
  meta: {
    messages: {
      no: 'missing tsdoc',
    },
  },
  createOnce(context,) {
    return {
      before(): false | undefined {
        if (['.test.ts', '.spec.ts', '.js', '.d.ts', '.mjs', '.cjs', '.d.mts', '.d.cts',]
          .some(function endsWith(ignorePattern,): boolean {
            return context.filename.endsWith(ignorePattern,);
          },))
        {
          return false;
        }
      },
      FunctionDeclaration(node,): void {
        reportTsdoc(node, context,);
      },
      FunctionExpression(node,): void {
        reportTsdoc(node, context,);
      },
      ArrowFunctionExpression(node,): void {
        reportTsdoc(node, context,);
      },
      ClassDeclaration(node,): void {
        reportTsdoc(node, context,);
      },
      MethodDefinition(node,): void {
        reportTsdoc(node, context,);
      },
      TSInterfaceDeclaration(node,): void {
        reportTsdoc(node, context,);
      },
      TSTypeAliasDeclaration(node,): void {
        reportTsdoc(node, context,);
      },
      TSEnumDeclaration(node,): void {
        reportTsdoc(node, context,);
      },
      VariableDeclaration(node,): void {
        reportTsdoc(node, context,);
      },
      PropertyDefinition(node,): void {
        reportTsdoc(node, context,);
      },
      TSEnumMember(node,): void {
        reportTsdoc(node, context,);
      },
      Property(node,): void {
        if (node.kind === 'get' || node.kind === 'set')
          reportTsdoc(node, context,);
      },
    };
  },
},);

const plugin = definePlugin({
  meta: {
    name: 'require-tsdoc',
  },
  rules: {
    'require-tsdoc': rule,
  },
},);

export default plugin;
