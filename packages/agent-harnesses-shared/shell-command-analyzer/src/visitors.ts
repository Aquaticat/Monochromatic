/**
 * AST visitors for `unbash` shell command analysis.
 *
 * @module
 */

import type {
  ArithmeticExpression as UnbashArithmeticExpression,
  DoubleQuotedChild as UnbashDoubleQuotedChild,
  Node as UnbashNode,
  Redirect as UnbashRedirect,
  TestExpression as UnbashTestExpression,
  Word as UnbashWord,
  WordPart as UnbashWordPart,
} from 'unbash';
import { commandToInfo, redirectOnlyCommand, } from './convert.ts';
import type { ShellCommandContext, } from './types.ts';
import {
  EMPTY_REDIRECTS,
  EMPTY_VISIT_RESULT,
  type VisitResult,
} from './internal-types.ts';
import { visitExpansion, } from './nested.ts';
import {
  caseItemWorkItems,
  commandWordItems,
  nodeWorkItems,
  parameterWordItems,
  redirectWordItems,
  redirectWorkItems,
  statementWorkItems,
  wordWorkItems,
  wordsWorkItems,
} from './work-items.ts';

//region Word visitors

/**
 * Build child work from one word.
 *
 * @param params - word and execution context
 *
 * @returns work items for word parts
 *
 * @example
 * ```ts
 * visitWord({ word, context });
 * ```
 */
function visitWord(
  {
    word,
    context,
  }: {
    readonly word: UnbashWord;
    readonly context: ShellCommandContext;
  },
): VisitResult {
  return {
    ...EMPTY_VISIT_RESULT,
    workItems: [{
      kind: 'parts',
      parts: word.parts ?? [],
      context,
    },],
  };
}

/**
 * Build child work from one word part.
 *
 * @param params - word part and execution context
 *
 * @returns child work and nested parse diagnostics
 *
 * @example
 * ```ts
 * visitPart({ part, context });
 * ```
 */
function visitPart(
  {
    part,
    context,
  }: {
    readonly part: UnbashWordPart | UnbashDoubleQuotedChild;
    readonly context: ShellCommandContext;
  },
): VisitResult {
  if ((part.type === 'DoubleQuoted') || (part.type === 'LocaleString')) {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [{
        kind: 'parts',
        parts: part.parts,
        context,
      },],
    };
  }
  if (part.type === 'ParameterExpansion') {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: parameterWordItems({
        part,
        context,
      },),
    };
  }
  if ((part.type === 'CommandExpansion') || (part.type === 'ProcessSubstitution')) {
    return visitExpansion({
      expansion: part,
      context,
    },);
  }
  if ((part.type === 'ArithmeticExpansion') && (part.expression !== undefined)) {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [{
        kind: 'arithmetic',
        expression: part.expression,
        context,
      },],
    };
  }
  return EMPTY_VISIT_RESULT;
}

/**
 * Build child work from word parts.
 *
 * @param params - parts and execution context
 *
 * @returns child work and nested parse diagnostics
 *
 * @example
 * ```ts
 * visitParts({ parts, context });
 * ```
 */
function visitParts(
  {
    parts,
    context,
  }: {
    readonly parts: readonly (UnbashWordPart | UnbashDoubleQuotedChild)[];
    readonly context: ShellCommandContext;
  },
): VisitResult {
  /**
   * Visit result for each word part.
   */
  const results = parts.map(function visitWordPart(part,): VisitResult {
    return visitPart({
      part,
      context,
    },);
  },);

  return {
    ...EMPTY_VISIT_RESULT,
    workItems: results.flatMap(function resultWorkItems(result,): VisitResult['workItems'] {
      return result.workItems;
    },),
    flags: {
      isPipeline: false,
      hasBackground: false,
      hasCommandSubstitution: results.some(function resultHasCommandSubstitution(result,): boolean {
        return result.flags.hasCommandSubstitution;
      },),
      hasProcessSubstitution: results.some(function resultHasProcessSubstitution(result,): boolean {
        return result.flags.hasProcessSubstitution;
      },),
    },
    parseErrors: results.flatMap(function resultParseErrors(result,): VisitResult['parseErrors'] {
      return result.parseErrors;
    },),
  };
}

//endregion Word visitors

//region Expression visitors

/**
 * Build child work from arithmetic expression.
 *
 * @param params - arithmetic expression and execution context
 *
 * @returns nested command expansion work
 *
 * @example
 * ```ts
 * visitArithmetic({ expression, context });
 * ```
 */
function visitArithmetic(
  {
    expression,
    context,
  }: {
    readonly expression: UnbashArithmeticExpression;
    readonly context: ShellCommandContext;
  },
): VisitResult {
  if (expression.type === 'ArithmeticCommandExpansion') {
    return visitExpansion({
      expansion: expression,
      context,
    },);
  }
  if (expression.type === 'ArithmeticBinary') {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [
        {
          kind: 'arithmetic',
          expression: expression.left,
          context,
        },
        {
          kind: 'arithmetic',
          expression: expression.right,
          context,
        },
      ],
    };
  }
  if (expression.type === 'ArithmeticUnary') {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [{
        kind: 'arithmetic',
        expression: expression.operand,
        context,
      },],
    };
  }
  if (expression.type === 'ArithmeticTernary') {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [
        {
          kind: 'arithmetic',
          expression: expression.test,
          context,
        },
        {
          kind: 'arithmetic',
          expression: expression.consequent,
          context,
        },
        {
          kind: 'arithmetic',
          expression: expression.alternate,
          context,
        },
      ],
    };
  }
  if (expression.type === 'ArithmeticGroup') {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [{
        kind: 'arithmetic',
        expression: expression.expression,
        context,
      },],
    };
  }
  return EMPTY_VISIT_RESULT;
}

/**
 * Build child work from Bash test expression.
 *
 * @param params - test expression and execution context
 *
 * @returns word or nested test work
 *
 * @example
 * ```ts
 * visitTest({ expression, context });
 * ```
 */
function visitTest(
  {
    expression,
    context,
  }: {
    readonly expression: UnbashTestExpression;
    readonly context: ShellCommandContext;
  },
): VisitResult {
  if (expression.type === 'TestUnary') {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: wordWorkItems({
        word: expression.operand,
        context,
      },),
    };
  }
  if (expression.type === 'TestBinary') {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [
        ...wordWorkItems({
          word: expression.left,
          context,
        },),
        ...wordWorkItems({
          word: expression.right,
          context,
        },),
      ],
    };
  }
  if (expression.type === 'TestLogical') {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [
        {
          kind: 'test',
          expression: expression.left,
          context,
        },
        {
          kind: 'test',
          expression: expression.right,
          context,
        },
      ],
    };
  }
  if (expression.type === 'TestNot') {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [{
        kind: 'test',
        expression: expression.operand,
        context,
      },],
    };
  }
  return {
    ...EMPTY_VISIT_RESULT,
    workItems: [{
      kind: 'test',
      expression: expression.expression,
      context,
    },],
  };
}

//endregion Expression visitors

//region Node visitors

/**
 * Visit redirects attached to compound syntax.
 *
 * @param params - redirects, references, and context
 *
 * @returns redirect-only command plus redirect word traversal
 *
 * @example
 * ```ts
 * visitRedirectsItem({ redirects, paramRefs: [], context });
 * ```
 */
function visitRedirectsItem(
  {
    redirects,
    paramRefs,
    context,
  }: {
    readonly redirects: readonly UnbashRedirect[];
    readonly paramRefs: readonly string[];
    readonly context: ShellCommandContext;
  },
): VisitResult {
  if (redirects.length === 0)
    return EMPTY_VISIT_RESULT;
  return {
    ...EMPTY_VISIT_RESULT,
    commands: [redirectOnlyCommand({
      redirects,
      paramRefs,
      context,
    },),],
    workItems: redirectWordItems({
      redirects,
      context,
    },),
  };
}

/**
 * Visit remaining node variants after case statements.
 *
 * @param params - node, redirects, references, and context
 *
 * @returns commands, child work, and flags emitted by node
 *
 * @example
 * ```ts
 * visitRemainingAfterCase({ node, redirects: [], paramRefs: [], context });
 * ```
 */
function visitRemainingAfterCase(
  {
    node,
    redirects,
    paramRefs,
    context,
  }: {
    readonly node: UnbashNode;
    readonly redirects: readonly UnbashRedirect[];
    readonly paramRefs: readonly string[];
    readonly context: ShellCommandContext;
  },
): VisitResult {
  if (node.type === 'Coproc') {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [
        ...(node.name === undefined ? [] : wordWorkItems({
          word: node.name,
          context,
        })),
        {
          kind: 'node',
          node: node.body,
          redirects: EMPTY_REDIRECTS,
          context,
        },
        ...redirectWorkItems({
          redirects: [
            ...redirects,
            ...node.redirects,
          ],
          context,
        },),
      ],
    };
  }
  if (node.type === 'ArithmeticFor') {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [
        ...(node.initialize === undefined ? [] : [{
          kind: 'arithmetic' as const,
          expression: node.initialize,
          context,
        }]),
        ...(node.test === undefined ? [] : [{
          kind: 'arithmetic' as const,
          expression: node.test,
          context,
        }]),
        ...(node.update === undefined ? [] : [{
          kind: 'arithmetic' as const,
          expression: node.update,
          context,
        }]),
        ...statementWorkItems({
          statements: node.body.commands,
          context,
        },),
        ...redirectWorkItems({
          redirects,
          context,
        },),
      ],
    };
  }
  if (node.type === 'TestCommand') {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [
        {
          kind: 'test',
          expression: node.expression,
          context,
        },
        ...redirectWorkItems({
          redirects,
          context,
        },),
      ],
    };
  }
  if (node.type === 'ArithmeticCommand') {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [
        ...(node.expression === undefined ? [] : [{
          kind: 'arithmetic' as const,
          expression: node.expression,
          context,
        }]),
        ...redirectWorkItems({
          redirects,
          context,
        },),
      ],
    };
  }
  return visitRedirectsItem({
    redirects,
    paramRefs,
    context,
  },);
}

/**
 * Visit less-common node variants after primary command forms.
 *
 * @param params - node, redirects, references, and context
 *
 * @returns commands, child work, and flags emitted by node
 *
 * @example
 * ```ts
 * visitRemainingNode({ node, redirects: [], paramRefs: [], context });
 * ```
 */
function visitRemainingNode(
  {
    node,
    redirects,
    paramRefs,
    context,
  }: {
    readonly node: UnbashNode;
    readonly redirects: readonly UnbashRedirect[];
    readonly paramRefs: readonly string[];
    readonly context: ShellCommandContext;
  },
): VisitResult {
  if (node.type === 'Function') {
    /**
     * Context assigned to commands stored in function body.
     */
    const functionContext: ShellCommandContext = {
      kind: 'functionDefinition',
      functionName: node.name.value,
    };
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [
        ...wordWorkItems({
          word: node.name,
          context,
        },),
        {
          kind: 'node',
          node: node.body,
          redirects: node.redirects,
          context: functionContext,
        },
        ...redirectWorkItems({
          redirects,
          context,
        },),
      ],
    };
  }
  if ((node.type === 'Subshell') || (node.type === 'BraceGroup')) {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [
        ...statementWorkItems({
          statements: node.body.commands,
          context,
        },),
        ...redirectWorkItems({
          redirects,
          context,
        },),
      ],
    };
  }
  if (node.type === 'CompoundList') {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [
        ...statementWorkItems({
          statements: node.commands,
          context,
        },),
        ...redirectWorkItems({
          redirects,
          context,
        },),
      ],
    };
  }
  if (node.type === 'Case') {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [
        ...wordWorkItems({
          word: node.word,
          context,
        },),
        ...caseItemWorkItems({
          node,
          context,
        },),
        ...redirectWorkItems({
          redirects,
          context,
        },),
      ],
    };
  }
  return visitRemainingAfterCase({
    node,
    redirects,
    paramRefs,
    context,
  },);
}

/**
 * Visit one AST node.
 *
 * @param params - node, inherited redirects, references, and context
 *
 * @returns commands, child work, and flags emitted by node
 *
 * @example
 * ```ts
 * visitNode({ node, redirects: [], paramRefs: [], context });
 * ```
 */
function visitNode(
  {
    node,
    redirects,
    paramRefs,
    context,
  }: {
    readonly node: UnbashNode;
    readonly redirects: readonly UnbashRedirect[];
    readonly paramRefs: readonly string[];
    readonly context: ShellCommandContext;
  },
): VisitResult {
  if (node.type === 'Statement') {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [{
        kind: 'node',
        node: node.command,
        redirects: [
          ...node.redirects,
          ...redirects,
        ],
        context,
      },],
      flags: {
        ...EMPTY_VISIT_RESULT.flags,
        hasBackground: node.background === true,
      },
    };
  }
  if (node.type === 'Command') {
    return {
      ...EMPTY_VISIT_RESULT,
      commands: [commandToInfo({
        command: node,
        inheritedRedirects: redirects,
        paramRefs,
        context,
      },),],
      workItems: commandWordItems({
        command: node,
        redirects,
        context,
      },),
    };
  }
  if (node.type === 'Pipeline') {
    return {
      ...EMPTY_VISIT_RESULT,
      flags: {
        ...EMPTY_VISIT_RESULT.flags,
        isPipeline: node.operators.length > 0,
      },
      workItems: [
        ...nodeWorkItems({
          nodes: node.commands,
          context,
        },),
        ...redirectWorkItems({
          redirects,
          context,
        },),
      ],
    };
  }
  if (node.type === 'AndOr') {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [
        ...nodeWorkItems({
          nodes: node.commands,
          context,
        },),
        ...redirectWorkItems({
          redirects,
          context,
        },),
      ],
    };
  }
  if (node.type === 'If') {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [
        ...statementWorkItems({
          statements: node.clause.commands,
          context,
        },),
        ...statementWorkItems({
          statements: node.then.commands,
          context,
        },),
        ...(node.else === undefined ? [] : [{
          kind: 'node' as const,
          node: node.else,
          redirects: EMPTY_REDIRECTS,
          context,
        }]),
        ...redirectWorkItems({
          redirects,
          context,
        },),
      ],
    };
  }
  if ((node.type === 'For') || (node.type === 'Select')) {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [
        ...wordWorkItems({
          word: node.name,
          context,
        },),
        ...wordsWorkItems({
          words: node.wordlist,
          context,
        },),
        ...statementWorkItems({
          statements: node.body.commands,
          context,
        },),
        ...redirectWorkItems({
          redirects,
          context,
        },),
      ],
    };
  }
  if (node.type === 'While') {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [
        ...statementWorkItems({
          statements: node.clause.commands,
          context,
        },),
        ...statementWorkItems({
          statements: node.body.commands,
          context,
        },),
        ...redirectWorkItems({
          redirects,
          context,
        },),
      ],
    };
  }
  return visitRemainingNode({
    node,
    redirects,
    paramRefs,
    context,
  },);
}

//endregion Node visitors

export {
  visitArithmetic,
  visitNode,
  visitParts,
  visitRedirectsItem,
  visitTest,
  visitWord,
};
