import type {
  Comment,
  Context,
  CreateOnceRule,
  Fixer,
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

/**
 * Enforces consistent spacing between TSDoc tags.
 *
 * Requires a blank comment line before block tags (configurable).
 */
export const tagLines: CreateOnceRule = {
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    docs: {
      description: 'Enforce consistent spacing between TSDoc tags.',
      recommended: true,
    },
    messages: {
      noBlankBefore: 'Expected a blank line before "{{tag}}".',
    },
  },
  createOnce(context: Context): VisitorWithHooks {
    return createTsdocVisitor(context, function tagLinesHandler(_node, comment): void {
      const lines = getCommentLines(comment);
      /** Minimum line count for a comment that can contain tag spacing issues. */
      const minContentLines = 3;
      if (lines.length < minContentLines) {
        return;
      }

      /**
       * Indentation for blank comment lines: spaces + `*`.
       * Matches the opener's `*` column (column of `/*` + 1).
       */
      const blankLineIndent = ' '.repeat(comment.loc.start.column + 1);
      const blankCommentLine = `${blankLineIndent}*`;

      // Check each content line (skip opener and closer)
      const contentLines = lines.slice(1, -1);
      contentLines.forEach(function checkTagLine(line, index): void {
        if (index === 0) {
          return;
        }
        const trimmed = line.trimStart().replace(COMMENT_LINE_PREFIX, '').trimStart();
        if (!trimmed.startsWith('@')) {
          return;
        }
        // Check if previous line is blank
        const prevLine = contentLines[index - 1];
        if (prevLine === undefined) {
          return;
        }
        const prevTrimmed = prevLine.trimStart().replace(COMMENT_LINE_PREFIX, '').trimStart();
        if (prevTrimmed.length > 0) {
          const tagMatch = trimmed.match(/^(@\w+)/);
          const tag = tagMatch !== null ? tagMatch[1] ?? '@unknown' : '@unknown';

          /**
           * Line number of the tag line in the source file (1-based).
           * `index` is 0-based within contentLines; +1 for the opener line, +1 for 1-based.
           */
          const tagLineNumber = comment.loc.start.line + index + 1;

          context.report({
            loc: {
              start: { line: tagLineNumber, column: 0 },
            },
            messageId: 'noBlankBefore',
            data: { tag },
            fix(fixer: Fixer) {
              /**
               * Insert a blank comment line (`\n *`) just before the tag line.
               * Use `getIndexFromLoc` to find the byte offset of the tag line start,
               * then insert the blank line text ending with a newline.
               */
              const insertOffset = context.sourceCode.getIndexFromLoc({
                line: tagLineNumber,
                column: 0,
              });
              return fixer.insertTextBeforeRange(
                [insertOffset, insertOffset],
                `${blankCommentLine}\n`,
              );
            },
          });
        }
      });
    });
  },
};

/**
 * Enforces that TSDoc tags which should not have content are empty.
 *
 * Modifier tags like `\@public`, `\@readonly`, `\@override`, `\@sealed`,
 * `\@virtual`, `\@alpha`, `\@beta`, `\@internal`, `\@experimental`,
 * `\@eventProperty`, and `\@packageDocumentation` must not have content.
 */
export const emptyTags: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce that TSDoc modifier tags have no content.',
      recommended: true,
    },
    messages: {
      nonEmpty: 'TSDoc modifier tag "{{tag}}" must not have content.',
    },
  },
  createOnce(context: Context): VisitorWithHooks {
    /** Tags that must be standalone (no content after them). */
    const modifierTags = new Set([
      '@public',
      '@readonly',
      '@override',
      '@sealed',
      '@virtual',
      '@alpha',
      '@beta',
      '@internal',
      '@experimental',
      '@eventProperty',
      '@packageDocumentation',
    ]);

    return createTsdocVisitor(context, function emptyTagsHandler(_node, comment): void {
      const lines = getCommentLines(comment);
      lines.forEach(function checkLine(line, index): void {
        const trimmed = line.trimStart().replace(COMMENT_LINE_PREFIX, '').trimStart();
        const tagMatch = trimmed.match(/^(@\w+)\s+(.+)/);
        if (tagMatch === null) {
          return;
        }
        const { 1: tag, 2: rest } = tagMatch;
        if (tag !== undefined && modifierTags.has(tag) && rest !== undefined && rest.trim().length > 0) {
          context.report({
            loc: {
              start: { line: comment.loc.start.line + index, column: 0 },
            },
            messageId: 'nonEmpty',
            data: { tag },
          });
        }
      });
    });
  },
};

/**
 * Enforces that `*\/` inside TSDoc content is escaped as `*\\/`.
 *
 * An unescaped `*\/` would prematurely close the comment block.
 */
export const escapeInlineTags: CreateOnceRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce escaping of `*/` inside TSDoc comments.',
      recommended: true,
    },
    messages: {
      unescaped: String.raw`Unescaped '*/' inside TSDoc content. Use '*\/' instead.`,
    },
  },
  createOnce(context: Context): VisitorWithHooks {
    return createTsdocVisitor(context, function escapeHandler(_node, comment): void {
      const lines = getCommentLines(comment);
      // Skip the last line which is the legitimate closing `*/`
      lines.slice(0, -1).forEach(function checkLine(line, index): void {
        // Skip the first line opener
        if (index === 0 && line.trimEnd().endsWith('*')) {
          return;
        }
        const trimmed = line.trimStart().replace(COMMENT_LINE_PREFIX, '');
        // Look for `*/` not preceded by backslash inside content
        if (/(?<!\\)\*\//.test(trimmed)) {
          context.report({
            loc: {
              start: { line: comment.loc.start.line + index, column: 0 },
            },
            messageId: 'unescaped',
          });
        }
      });
    });
  },
};
