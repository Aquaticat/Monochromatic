/**
 * Verified semantic type suggestions for readonly parameters.
 *
 * @module
 */

import type {
  Context,
  Fixer,
  Suggestion,
} from '@oxlint/plugins';
import type { ParameterDeclaration, } from 'typescript/unstable/ast';
import { isArrayTypeNode, } from 'typescript/unstable/ast/is';

import { classifyReadonlyType, } from './readonly-classifier.ts';

/**
 * Converts TypeScript offset to Oxlint offset after BOM stripping.
 *
 * @param offset - TypeScript source offset.
 *
 * @param hasBOM - Whether Oxlint stripped leading BOM.
 *
 * @returns Oxlint source offset.
 */
function oxlintOffset({
  offset,
  hasBOM,
}: {
  readonly offset: number;
  readonly hasBOM: boolean;
},): number {
  return hasBOM ? Math.max(
    0,
    offset - 1,
  ) : offset;
}

/* oxlint-disable typescript/prefer-readonly-parameter-types -- ParameterDeclaration mirrors TypeScript semantic AST identity. */
/**
 * Builds verified deep-readonly array type suggestion.
 *
 * @param context - Rule context providing fix range mapping.
 *
 * @param parameter - TypeScript parameter with optional array type annotation.
 *
 * @param project - TypeScript project classifying array element type.
 *
 * @returns suggestion list, empty when exact rewrite is unavailable.
 *
 * @example
 * ```ts
 * readonlyArraySuggestions({ context, parameter, project });
 * ```
 */
export function readonlyArraySuggestions({
  context,
  parameter,
  project,
}: {
  readonly context: Context;
  readonly parameter: ParameterDeclaration;
  readonly project: Parameters<typeof classifyReadonlyType>[0]['project'];
},): Suggestion[] {
  if ((parameter.type === undefined) || (!isArrayTypeNode(parameter.type,)))
    return [];
  /**
   * Semantic element type used to prove deep readonly result.
   */
  const elementType = project.checker
    .getTypeFromTypeNode(parameter.type
      .elementType,);
  if (elementType === undefined)
    return [];
  /**
   * Element classification proving readonly prefix completes deep contract.
   */
  const elementClassification = classifyReadonlyType({
    checker: project.checker,
    project,
    type: elementType,
  },);
  if (elementClassification.kind !== 'honest-readonly')
    return [];
  /**
   * Source file owning parameter type.
   */
  const sourceFile = parameter.getSourceFile();
  /**
   * Oxlint replacement range spanning authored array type.
   */
  const range: [
    number,
    number
  ] = [
    oxlintOffset({
      offset: parameter.type
        .getStart(sourceFile,),
      hasBOM: context.sourceCode
        .hasBOM,
    },),
    oxlintOffset({
      offset: parameter.type
        .end,
      hasBOM: context.sourceCode
        .hasBOM,
    },),
  ];
  /**
   * Exact authored type with readonly array prefix.
   */
  const replacement = `readonly ${parameter.type
    .getText(sourceFile,)}`;
  return [
    {
      desc: `Replace ${parameter.type
        .getText(sourceFile,)} with ${replacement}.`,
      fix(fixer: Fixer,): ReturnType<Fixer['replaceTextRange']> {
        return fixer.replaceTextRange(
          range,
          replacement,
        );
      },
    },
  ];
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */
