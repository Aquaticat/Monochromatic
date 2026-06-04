/**
 * Word, arithmetic, and test traversal for `unbash` ASTs.
 *
 * @module
 */

import type {
  ArithmeticExpression as UnbashArithmeticExpression,
  DoubleQuotedChild as UnbashDoubleQuotedChild,
  TestExpression as UnbashTestExpression,
  Word as UnbashWord,
  WordPart as UnbashWordPart,
} from 'unbash';
import {
  EMPTY_VISIT_RESULT,
  type VisitResult,
} from './unbash-command-info-types.ts';
import { wordWorkItems, } from './unbash-command-info-items.ts';
import { parameterWordItems, } from './unbash-command-info-parameter-items.ts';
import { visitExpansion, } from './unbash-command-info-nested.ts';

/**
 * Build child work from one word.
 *
 * @param word - word whose lazy parts may contain nested scripts
 *
 * @returns work items for word parts
 *
 * @example
 * ```typescript
 * visitWord(word);
 * ```
 */
function visitWord(
  word: UnbashWord,
): VisitResult {
  return {
    ...EMPTY_VISIT_RESULT,
    workItems: [{
      kind: 'parts',
      parts: word.parts ?? [],
    },],
  };
}

/**
 * Build child work from word parts.
 *
 * @param parts - parts to inspect
 *
 * @returns child work and nested parse diagnostics
 *
 * @example
 * ```typescript
 * visitParts(parts);
 * ```
 */
function visitParts(
  parts: readonly (UnbashWordPart | UnbashDoubleQuotedChild)[],
): VisitResult {
  /**
   * Visit result for each word part.
   */
  const results = parts.map(function visitWordPart(part,) {
    return visitPart(part,);
  },);

  return {
    ...EMPTY_VISIT_RESULT,
    workItems: results.flatMap(function resultWorkItems(result,) {
      return result.workItems;
    },),
    hasParseErrors: results.some(function resultHasParseErrors(result,) {
      return result.hasParseErrors;
    },),
  };
}

/**
 * Build child work from one word part.
 *
 * @param part - word part to inspect
 *
 * @returns child work and nested parse diagnostics
 *
 * @example
 * ```typescript
 * visitPart(part);
 * ```
 */
function visitPart(
  part: UnbashWordPart | UnbashDoubleQuotedChild,
): VisitResult {
  if ((part.type === 'DoubleQuoted') || (part.type === 'LocaleString')) {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [{
        kind: 'parts',
        parts: part.parts,
      },],
    };
  }
  if (part.type === 'ParameterExpansion') {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: parameterWordItems(part,),
    };
  }
  if ((part.type === 'CommandExpansion') || (part.type === 'ProcessSubstitution'))
    return visitExpansion(part,);
  if ((part.type === 'ArithmeticExpansion') && (part.expression !== undefined)) {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [{
        kind: 'arithmetic',
        expression: part.expression,
      },],
    };
  }
  return EMPTY_VISIT_RESULT;
}

/**
 * Build child work from an arithmetic expression.
 *
 * @param expression - expression to inspect
 *
 * @returns nested command expansion work
 *
 * @example
 * ```typescript
 * visitArithmetic(expression);
 * ```
 */
function visitArithmetic(
  expression: UnbashArithmeticExpression,
): VisitResult {
  if (expression.type === 'ArithmeticCommandExpansion')
    return visitExpansion(expression,);
  if (expression.type === 'ArithmeticBinary') {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [
        {
          kind: 'arithmetic',
          expression: expression.left,
        },
        {
          kind: 'arithmetic',
          expression: expression.right,
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
        },
        {
          kind: 'arithmetic',
          expression: expression.consequent,
        },
        {
          kind: 'arithmetic',
          expression: expression.alternate,
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
      },],
    };
  }
  return EMPTY_VISIT_RESULT;
}

/**
 * Build child work from a Bash test expression.
 *
 * @param expression - expression to inspect
 *
 * @returns word or nested test work
 *
 * @example
 * ```typescript
 * visitTest(expression);
 * ```
 */
function visitTest(
  expression: UnbashTestExpression,
): VisitResult {
  if (expression.type === 'TestUnary') {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: wordWorkItems(expression.operand,),
    };
  }
  if (expression.type === 'TestBinary') {
    return {
      ...EMPTY_VISIT_RESULT,
      workItems: [
        ...wordWorkItems(expression.left,),
        ...wordWorkItems(expression.right,),
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
        },
        {
          kind: 'test',
          expression: expression.right,
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
      },],
    };
  }
  return {
    ...EMPTY_VISIT_RESULT,
    workItems: [{
      kind: 'test',
      expression: expression.expression,
    },],
  };
}

export {
  visitArithmetic,
  visitParts,
  visitTest,
  visitWord,
};
