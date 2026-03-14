import type {
  Comment,
  Context,
  CreateOnceRule,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

import {
  findTsdocComment,
  shouldIgnoreFile,
} from '../tsdoc-utils.ts';

//region Shared helpers for structural rules

/** Regex matching a TSDoc block comment line with leading ` * `. */
const COMMENT_LINE_PREFIX = /^ *\*/;

/**
 * Splits a block comment value into its constituent lines.
 *
 * @param comment - block comment AST node
 *
 * @returns array of lines (without the opening `/*` and closing `*\/`)
 */
function getCommentLines(comment: Comment): readonly string[] {
  return comment.value.split('\n');
}

/**
 * Creates a visitor that iterates over all nodes requiring TSDoc
 * and calls the provided handler when a TSDoc comment is found.
 *
 * @param context - oxlint rule context
 *
 * @param handler - invoked for each (node, comment) pair
 *
 * @returns visitor with hooks
 */
function createTsdocVisitor(
  context: Context,
  handler: (node: Span, comment: Comment) => void,
): VisitorWithHooks {
  /**
   * Checks node and fires handler when TSDoc exists.
   *
   * @param node - AST node to check
   */
  function check(node: Span): void {
    const comment = findTsdocComment(node, context);
    if (comment !== undefined) {
      handler(node, comment);
    }
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint VisitorWithHooks allows arbitrary string keys
  return {
    before() {
      if (shouldIgnoreFile(context.filename)) {
        return false;
      }
      return undefined;
    },
    FunctionDeclaration: check,
    FunctionExpression: check,
    ArrowFunctionExpression: check,
    ClassDeclaration: check,
    MethodDefinition: check,
    TSInterfaceDeclaration: check,
    TSTypeAliasDeclaration: check,
    TSEnumDeclaration: check,
    VariableDeclaration: check,
    PropertyDefinition: check,
    TSEnumMember: check,
    Property(node): void {
      if (node.kind === 'get' || node.kind === 'set') {
        check(node);
      }
    },
  } as VisitorWithHooks;
}

//endregion Shared helpers

/**
 * Enforces consistent alignment of asterisks in TSDoc block comments.
 *
 * Each line of a TSDoc comment (except the opener) must have its leading `*`
 * aligned with the first `*` of the opening `/**`.
 */
export const checkAlignment: CreateOnceRule = {
  meta: {
    type: 'layout',
    docs: {
      description: 'Enforce consistent alignment of leading asterisks in TSDoc comments.',
      recommended: true,
    },
    messages: {
      misaligned: 'TSDoc asterisk misaligned: expected {{expected}} spaces of indent, found {{actual}}.',
    },
  },
  createOnce(context: Context): VisitorWithHooks {
    return createTsdocVisitor(context, function checkAlignmentHandler(_node, comment): void {
      const lines = getCommentLines(comment);
      if (lines.length < 2) {
        return;
      }

      // The opening line `* ...` sets the expected indent
      // comment.loc.start.column is the column of `/*`, so `*` alignment is column + 1
      const expectedIndent = comment.loc.start.column + 1;

      lines.slice(1).forEach(function checkLine(line, index): void {
        const trimmed = line.trimStart();
        if (trimmed.length === 0) {
          return;
        }
        if (!trimmed.startsWith('*')) {
          return;
        }
        const actualIndent = line.length - trimmed.length;
        if (actualIndent !== expectedIndent) {
          context.report({
            loc: {
              start: { line: comment.loc.start.line + index + 1, column: actualIndent },
            },
            messageId: 'misaligned',
            data: { expected: String(expectedIndent), actual: String(actualIndent) },
          });
        }
      });
    });
  },
};

/**
 * Enforces that TSDoc comments use multiline block style.
 *
 * Single-line `/** comment *\/` is reported when the content warrants
 * a multiline format (contains tags or multiple sentences).
 */
export const multilineBlocks: CreateOnceRule = {
  meta: {
    type: 'layout',
    docs: {
      description: 'Enforce multiline format for TSDoc block comments.',
      recommended: true,
    },
    messages: {
      singleLine: 'TSDoc comment with tags must use multiline format.',
    },
  },
  createOnce(context: Context): VisitorWithHooks {
    return createTsdocVisitor(context, function multilineHandler(_node, comment): void {
      const lines = getCommentLines(comment);
      /** Minimum line count for a proper multiline comment: opener, content, closer. */
      const minMultilineLines = 3;
      // A proper multiline comment has at least 3 lines: opener, content, closer
      if (lines.length >= minMultilineLines) {
        return;
      }
      // Single-line comment containing a tag should be multiline
      if (comment.value.includes('@')) {
        context.report({ node: comment, messageId: 'singleLine' });
      }
    });
  },
};

/**
 * Disallows multiple consecutive asterisks in TSDoc comment lines.
 *
 * Lines like ` ** text` are not valid TSDoc.
 */
export const noMultiAsterisks: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow extra asterisks at the start of TSDoc comment lines.',
      recommended: true,
    },
    messages: {
      extra: 'Extra asterisk at start of TSDoc comment line.',
    },
  },
  createOnce(context: Context): VisitorWithHooks {
    return createTsdocVisitor(context, function noMultiHandler(_node, comment): void {
      const lines = getCommentLines(comment);
      // Skip first line (opening) and last line (closing)
      lines.slice(1, -1).forEach(function checkLine(line, index): void {
        const trimmed = line.trimStart();
        // After the leading *, check for immediate additional *
        if (trimmed.startsWith('**') && !trimmed.startsWith('*/')) {
          context.report({
            loc: {
              start: { line: comment.loc.start.line + index + 1, column: 0 },
            },
            messageId: 'extra',
          });
        }
      });
    });
  },
};

export {
  tagLines,
  emptyTags,
  escapeInlineTags,
} from './structural-tags.ts';
