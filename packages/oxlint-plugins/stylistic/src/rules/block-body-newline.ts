import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import type {
  Context,
  CreateOnceRule,
  ESTree,
  Fix,
  Fixer,
  Node,
  VisitorWithHooks,
} from '@oxlint/plugins';

import { at, } from '../utility/range.ts';
import {
  type BodyBraces,
  type SyntaxUnit,
  bodyBaseIndent,
  bracedContent,
  firstBraceAfterNode,
  firstBraceInNode,
  lastBraceInNode,
  lineOfOffset,
  lineOfUnitEnd,
  rangeOfUnit,
} from '../utility/block-body-newline.ts';

//region Constants

/**
 * Extra indentation inserted for block body content.
 */
const BODY_INDENT = '  ';

//endregion Constants

//region Types

/**
 * Body-boundary source facts used for reporting and fixing.
 */
type BodyLayout = BodyBraces & {
  /**
   * Rule context for source lookup and diagnostics.
   */
  readonly context: Context;
  /**
   * Braced AST node currently checked.
   */
  readonly node: Node;
  /**
   * First token or comment inside the body braces.
   */
  readonly firstContent: SyntaxUnit;
  /**
   * Last token or comment inside the body braces.
   */
  readonly lastContent: SyntaxUnit;
  /**
   * Indentation of the line carrying the opening brace.
   */
  readonly baseIndent: string;
  /**
   * Indentation inserted before first body content.
   */
  readonly bodyIndent: string;
};

/**
 * Parameters for {@link checkBodyLayout}.
 */
type CheckBodyLayoutParams = {
  /**
   * Rule context for source lookup and diagnostics.
   */
  readonly context: Context;
  /**
   * Braced node being checked.
   */
  readonly node: Node;
  /**
   * Enclosing body brace tokens.
   */
  readonly braces: BodyBraces;
};

//endregion Types

//region Reporting

/**
 * Reports and fixes a body whose first content shares the opening brace line.
 *
 * @param layout - source facts for one non-empty braced body
 *
 * @example
 * ```ts
 * reportOpening(layout);
 * ```
 *
 * @mutates layout - Emits Oxlint diagnostics through layout.context.
 */
function reportOpening(layout: ForeignBorrowed<Readonly<BodyLayout>>,): void {
  /**
   * Opening brace range, used as replacement start.
   */
  const [, openEnd,] = rangeOfUnit(layout.openBrace,);
  /**
   * First body-content range, used as replacement end.
   */
  const [firstStart,] = rangeOfUnit(layout.firstContent,);
  /**
   * Rule context used to emit the diagnostic.
   */
  const { context, } = layout;

  context.report({
    node: layout.node,
    messageId: 'bodyAfterOpeningBrace',
    fix(fixer: ForeignBorrowed<Fixer>,): Fix {
      return fixer.replaceTextRange(
        [
          openEnd,
          firstStart,
        ],
        `\n${layout.bodyIndent}`,
      );
    },
  },);
}

/**
 * Reports and fixes a body whose closing brace shares the final content line.
 *
 * @param layout - source facts for one non-empty braced body
 *
 * @example
 * ```ts
 * reportClosing(layout);
 * ```
 *
 * @mutates layout - Emits Oxlint diagnostics through layout.context.
 */
function reportClosing(layout: ForeignBorrowed<Readonly<BodyLayout>>,): void {
  /**
   * Last body-content range, used as replacement start.
   */
  const [, lastEnd,] = rangeOfUnit(layout.lastContent,);
  /**
   * Closing brace range, used as replacement end.
   */
  const [closeStart,] = rangeOfUnit(layout.closeBrace,);
  /**
   * Rule context used to emit the diagnostic.
   */
  const { context, } = layout;

  context.report({
    node: layout.node,
    messageId: 'closingBraceAfterBody',
    fix(fixer: ForeignBorrowed<Fixer>,): Fix {
      return fixer.replaceTextRange(
        [
          lastEnd,
          closeStart,
        ],
        `\n${layout.baseIndent}`,
      );
    },
  },);
}

/**
 * Checks one braced body and reports each missing body-boundary newline.
 *
 * @example
 * ```ts
 * checkBodyLayout({ context, node, braces });
 * ```
 */
function checkBodyLayout({
  context,
  node,
  braces,
}: ForeignBorrowed<Readonly<CheckBodyLayoutParams>>,): void {
  /**
   * Opening body brace.
   */
  const { openBrace, } = braces;
  /**
   * Closing body brace.
   */
  const { closeBrace, } = braces;
  /**
   * Token and comment content inside the braces.
   */
  const content = bracedContent({
    context,
    openBrace,
    closeBrace,
  },);
  if (content.length === 0)
    return;

  /**
   * Source-code accessor for the current file.
   */
  const { sourceCode, } = context;
  /**
   * Full file source text used for indentation lookup.
   */
  const sourceText = sourceCode.getText();
  /**
   * Indentation of the opening-brace line after same-line parent bodies split.
   */
  const baseIndent = bodyBaseIndent({
    context,
    sourceText,
    openBrace,
    bodyIndent: BODY_INDENT,
  },);
  /**
   * Opening brace start offset.
   */
  const [openStart,] = rangeOfUnit(openBrace,);
  /**
   * First body token or comment.
   */
  const firstContent = at({
    arr: content,
    index: 0,
  },);
  /**
   * Last body token or comment.
   */
  const lastContent = at({
    arr: content,
    index: content.length - 1,
  },);
  /**
   * Shared report data for both boundary checks.
   */
  const layout: BodyLayout = {
    context,
    node,
    openBrace,
    closeBrace,
    firstContent,
    lastContent,
    baseIndent,
    bodyIndent: `${baseIndent}${BODY_INDENT}`,
  };
  /**
   * Line carrying the opening brace.
   */
  const openLine = lineOfOffset({
    context,
    offset: openStart,
  },);
  /**
   * First body-content start offset.
   */
  const [firstStart,] = rangeOfUnit(firstContent,);
  /**
   * Line where first body content starts.
   */
  const firstContentLine = lineOfOffset({
    context,
    offset: firstStart,
  },);
  if (firstContentLine <= openLine)
    reportOpening(layout,);

  /**
   * Closing brace start offset.
   */
  const [closeStart,] = rangeOfUnit(closeBrace,);
  /**
   * Line carrying the closing brace.
   */
  const closeLine = lineOfOffset({
    context,
    offset: closeStart,
  },);
  /**
   * Line where final body content ends.
   */
  const lastContentLine = lineOfUnitEnd({
    context,
    unit: lastContent,
  },);
  if (closeLine <= lastContentLine)
    reportClosing(layout,);
}

//endregion Reporting

/**
 * Requires non-empty brace-delimited bodies to start and end on their own
 * interior lines.
 *
 * The rule is deliberately narrower than brace-style formatting: it never
 * changes where an opening brace appears, never changes `} else`, `} catch`, or
 * `} finally` adjacency, and never adds braces around single-line statements.
 * It only inserts a newline plus two-space body indentation after `{` when the
 * first token or comment shares that line, and a newline plus base indentation
 * before `}` when the closing brace shares the final token or comment line.
 *
 * Empty blocks with no tokens or comments between braces are allowed inline.
 * Comment-only blocks are non-empty, so the comment is treated as body content
 * and must be placed between brace lines.
 *
 * @example
 * ```ts
 * // Bad
 * function f() {return x;}
 * class C {static {this.ready = true;}}
 *
 * // Good
 * function f() {
 *   return x;
 * }
 * class C {
 *   static {
 *     this.ready = true;
 *   }
 * }
 * function empty(): void {}
 * ```
 */
export const blockBodyNewline: CreateOnceRule = {
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    docs: {
      description:
        'Require non-empty brace-delimited bodies to start after the opening brace and end before the closing brace.',
      recommended: true,
    },
    messages: {
      bodyAfterOpeningBrace:
        'Put the first body token on the line after the opening brace.',
      closingBraceAfterBody:
        'Put the closing brace on the line after the final body token.',
    },
  },
  createOnce(context: ForeignBorrowed<Context>,): VisitorWithHooks {
    /**
     * Checks a braced node whose range starts at or before its own body brace.
     *
     * @param node - `BlockStatement`, `ClassBody`, `StaticBlock`, or `TSModuleBlock`
     */
    function checkBracedNode(node: ForeignBorrowed<Node>,): void {
      checkBodyLayout({
        context,
        node,
        braces: {
          openBrace: firstBraceInNode({
            context,
            node,
          },),
          closeBrace: lastBraceInNode({
            context,
            node,
          },),
        },
      },);
    }

    /**
     * Checks a switch body, whose body brace follows the discriminant rather
     * than starting the switch node range.
     *
     * @param node - switch statement being checked
     */
    function checkSwitchStatement(node: ForeignBorrowed<ESTree.SwitchStatement>,): void {
      checkBodyLayout({
        context,
        node,
        braces: {
          openBrace: firstBraceAfterNode({
            context,
            node: node.discriminant,
          },),
          closeBrace: lastBraceInNode({
            context,
            node,
          },),
        },
      },);
    }

    return {
      BlockStatement: checkBracedNode,
      ClassBody: checkBracedNode,
      StaticBlock: checkBracedNode,
      SwitchStatement: checkSwitchStatement,
      TSModuleBlock: checkBracedNode,
    };
  },
};
