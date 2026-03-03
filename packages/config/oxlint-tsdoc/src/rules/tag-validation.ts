import { StandardTags } from '@microsoft/tsdoc';

import type {
  Comment,
  Context,
  CreateOnceRule,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

import {
  findTsdocComment,
  parseTsdocForNode,
  shouldIgnoreFile,
} from '../tsdoc-utils.ts';

//region Shared

/** Regex matching a TSDoc block comment line prefix ` * `. */
const COMMENT_LINE_PREFIX = /^ *\*/;

/**
 * Creates a visitor for all documentable nodes, calling callback with parsed TSDoc.
 *
 * @param context - oxlint rule context
 * @param callback - invoked for each (node, comment) pair where TSDoc exists
 * @returns visitor with hooks
 */
function createTsdocVisitor(
  context: Context,
  callback: (node: Span, comment: Comment) => void,
): VisitorWithHooks {
  /** Checks node for TSDoc and fires callback. */
  function check(node: Span): void {
    const comment = findTsdocComment(node, context);
    if (comment !== undefined) {
      callback(node, comment);
    }
  }

  return {
    before(): false | undefined {
      if (shouldIgnoreFile(context.filename)) {
        return false;
      }
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

//endregion Shared

/**
 * Valid TSDoc tag names from the TSDoc standard.
 *
 * Built dynamically from @microsoft/tsdoc StandardTags so the set stays
 * current with spec updates.
 */
const VALID_TSDOC_TAGS: ReadonlySet<string> = new Set(
  StandardTags.allDefinitions.map(function getTagName(def): string {
    return def.tagName;
  }),
);

/**
 * Validates that all tags in a TSDoc comment are recognized TSDoc standard tags.
 *
 * Reports JSDoc-only tags (`@type`, `@typedef`, `@callback`, `@property`, `@memberof`,
 * `@augments`, `@extends`, `@class`, `@constructor`, `@function`, `@method`,
 * `@namespace`, `@module`, `@member`, `@var`, `@global`, `@enum`, `@access`,
 * `@lends`, `@fires`, `@listens`, `@mixes`, `@mixin`, `@interface`) and
 * any other unrecognized tags.
 */
export const checkTagNames: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Validate TSDoc tag names against the TSDoc standard.',
      recommended: true,
    },
    messages: {
      unknown: 'Unknown TSDoc tag "{{tag}}". TSDoc does not define this tag.',
      jsdocOnly: '"{{tag}}" is a JSDoc tag, not valid in TSDoc. {{suggestion}}',
    },
  },
  createOnce(context: Context): VisitorWithHooks {
    /** JSDoc tags that have no TSDoc equivalent or have a different name. */
    const jsdocToTsdocMap: ReadonlyMap<string, string> = new Map([
      ['@type', 'Remove @type -- TypeScript handles types.'],
      ['@typedef', 'Remove @typedef -- use TypeScript type alias instead.'],
      ['@callback', 'Remove @callback -- use TypeScript type alias instead.'],
      ['@property', 'Remove @property -- use TypeScript type members instead.'],
      ['@prop', 'Remove @prop -- use TypeScript type members instead.'],
      ['@memberof', 'Remove @memberof -- not needed in TSDoc.'],
      ['@augments', 'Remove @augments -- use TypeScript extends instead.'],
      ['@extends', 'Remove @extends -- use TypeScript extends instead.'],
      ['@class', 'Remove @class -- use TypeScript class syntax instead.'],
      ['@constructor', 'Remove @constructor -- use TypeScript class syntax instead.'],
      ['@function', 'Remove @function -- not needed in TSDoc.'],
      ['@method', 'Remove @method -- not needed in TSDoc.'],
      ['@namespace', 'Remove @namespace -- use TypeScript namespace instead.'],
      ['@module', 'Remove @module -- use @packageDocumentation instead.'],
      ['@member', 'Remove @member -- not needed in TSDoc.'],
      ['@var', 'Remove @var -- not needed in TSDoc.'],
      ['@global', 'Remove @global -- not needed in TSDoc.'],
      ['@enum', 'Remove @enum -- use TypeScript enum instead.'],
      ['@lends', 'Remove @lends -- not needed in TSDoc.'],
      ['@fires', 'Remove @fires -- not needed in TSDoc.'],
      ['@listens', 'Remove @listens -- not needed in TSDoc.'],
      ['@mixes', 'Remove @mixes -- not needed in TSDoc.'],
      ['@mixin', 'Remove @mixin -- not needed in TSDoc.'],
      ['@interface', 'Remove @interface -- use TypeScript interface instead.'],
      ['@return', 'Use @returns (with "s") instead.'],
      ['@yield', 'Use @yields (with "s") instead.'],
      ['@template', 'Use @typeParam instead.'],
      ['@access', 'Use @public, @internal, @alpha, or @beta modifier tags instead.'],
    ]);

    return createTsdocVisitor(context, function checkTagNamesCallback(_node, comment): void {
      const lines = comment.value.split('\n');
      lines.forEach(function checkLine(line, index): void {
        const tagMatches = line.matchAll(/@(\w+)/g);
        for (const match of tagMatches) {
          const tag = `@${match[1]}`;
          const suggestion = jsdocToTsdocMap.get(tag);
          if (suggestion !== undefined) {
            context.report({
              loc: {
                start: { line: comment.loc.start.line + index, column: 0 },
              },
              messageId: 'jsdocOnly',
              data: { tag, suggestion },
            });
          } else if (!VALID_TSDOC_TAGS.has(tag)) {
            context.report({
              loc: {
                start: { line: comment.loc.start.line + index, column: 0 },
              },
              messageId: 'unknown',
              data: { tag },
            });
          }
        }
      });
    });
  },
};

/**
 * Validates access modifier tags in TSDoc comments.
 *
 * Reports conflicting access modifiers (e.g., `@public` and `@internal` together).
 */
export const checkAccess: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Validate TSDoc access modifier tags.',
      recommended: true,
    },
    messages: {
      conflict: 'Conflicting access modifiers: {{tags}}. Use only one.',
    },
  },
  createOnce(context: Context): VisitorWithHooks {
    const accessTags = ['@public', '@internal', '@alpha', '@beta', '@experimental'];

    return createTsdocVisitor(context, function checkAccessCallback(_node, comment): void {
      const found: string[] = [];
      const text = comment.value;
      accessTags.forEach(function findTag(tag): void {
        // Match tag at word boundary to avoid false positives
        const pattern = new RegExp(`(?:^|\\s)${tag.replace('@', '\\@')}(?:\\s|$|\\*)`);
        if (pattern.test(text)) {
          found.push(tag);
        }
      });

      if (found.length > 1) {
        context.report({
          node: comment,
          messageId: 'conflict',
          data: { tags: found.join(', ') },
        });
      }
    });
  },
};

/**
 * Reports TSDoc parse errors from the @microsoft/tsdoc parser.
 *
 * Catches syntax errors, malformed inline tags, broken `{@link}` references,
 * and other structural issues the parser detects.
 */
export const validTypes: CreateOnceRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Report TSDoc syntax errors detected by the TSDoc parser.',
      recommended: true,
    },
    messages: {
      parseError: 'TSDoc: {{message}}',
    },
  },
  createOnce(context: Context): VisitorWithHooks {
    /** Checks node for TSDoc parse errors. */
    function check(node: Span): void {
      const result = parseTsdocForNode(node, context);
      if (result === undefined) {
        return;
      }
      result.messages.forEach(function reportMessage(message): void {
        context.report({
          node: result.comment,
          messageId: 'parseError',
          data: { message: `${message.messageId}: ${message.unformattedText}` },
        });
      });
    }

    return {
      before(): false | undefined {
        if (shouldIgnoreFile(context.filename)) {
          return false;
        }
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
  },
};

/**
 * Disallows type annotations in TSDoc tags.
 *
 * In TypeScript projects, types are expressed via type annotations, not JSDoc-style
 * `{Type}` syntax. Reports `@param {Type} name`, `@returns {Type}`, etc.
 */
export const noTypes: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow JSDoc-style type annotations in TSDoc comments.',
      recommended: true,
    },
    messages: {
      noType: 'Type annotations in TSDoc are not allowed in TypeScript. Remove the "{{{type}}}" type.',
    },
  },
  createOnce(context: Context): VisitorWithHooks {
    /** Regex detecting JSDoc-style type annotations like `{Type}` after a tag. */
    const typePattern = /@\w+\s+\{([^}]+)\}/g;

    return createTsdocVisitor(context, function noTypesCallback(_node, comment): void {
      const lines = comment.value.split('\n');
      lines.forEach(function checkLine(line, index): void {
        const trimmed = line.trimStart().replace(COMMENT_LINE_PREFIX, '').trimStart();
        // Reset regex state
        typePattern.lastIndex = 0;
        let match = typePattern.exec(trimmed);
        while (match !== null) {
          context.report({
            loc: {
              start: { line: comment.loc.start.line + index, column: 0 },
            },
            messageId: 'noType',
            data: { type: match[1] ?? 'unknown' },
          });
          match = typePattern.exec(trimmed);
        }
      });
    });
  },
};
