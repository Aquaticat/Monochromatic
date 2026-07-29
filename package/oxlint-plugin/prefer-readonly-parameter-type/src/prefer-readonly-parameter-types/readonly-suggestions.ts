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
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import type { ParameterDeclaration, } from 'typescript/unstable/ast';
import { isArrayTypeNode, } from 'typescript/unstable/ast/is';

import { classifyReadonlyType, } from './readonly-classifier.ts';
import { readonlyCollectionSuggestions, } from './readonly-collection-suggestions.ts';

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
function readonlyArraySuggestions({
  context,
  parameter,
  project,
}: ForeignBorrowed<{
  readonly context: Context;
  readonly parameter: ParameterDeclaration;
  readonly project: Parameters<typeof classifyReadonlyType>[0]['project'];
}>,): Suggestion[] {
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
      fix(fixer: ForeignBorrowed<Fixer>,): ReturnType<Fixer['replaceTextRange']> {
        return fixer.replaceTextRange(
          range,
          replacement,
        );
      },
    },
  ];
}

/**
 * Builds type-fest ReadonlyDeep suggestion for mutable structural data.
 *
 * @param context - Rule context providing fix range mapping.
 *
 * @param parameter - TypeScript parameter with mutable type annotation.
 *
 * @param project - TypeScript project proving structural data classification.
 *
 * @returns suggestion list, empty when verified wrapper is unavailable.
 */
function readonlyDeepSuggestions({
  context,
  parameter,
  project,
}: ForeignBorrowed<{
  readonly context: Context;
  readonly parameter: ParameterDeclaration;
  readonly project: Parameters<typeof classifyReadonlyType>[0]['project'];
}>,): Suggestion[] {
  if (parameter.type === undefined)
    return [];
  /**
   * Semantic parameter type used to reject collection projection guesses.
   */
  const parameterType = project.checker
    .getTypeFromTypeNode(parameter.type,);
  if ((parameterType === undefined)
    || project.checker
    .isArrayType(parameterType,)
    || project.checker
    .isTupleType(parameterType,))
    return [];
  /**
   * Mutable structural classification with no opaque capability branch.
   */
  const classification = classifyReadonlyType({
    checker: project.checker,
    project,
    type: parameterType,
  },);
  if ((classification.kind !== 'mutable')
    || ((!classification.reason
      .startsWith('property ',))
      && (!classification.reason
        .startsWith('index signature',))))
    return [];
  /**
   * Source file owning authored type text.
   */
  const sourceFile = parameter.getSourceFile();
  /**
   * Authored type retained inside ReadonlyDeep projection.
   */
  const authoredType = parameter.type
    .getText(sourceFile,);
  /**
   * Exact projection naming the helper through an inline import type.
   *
   * Written this way because the suggestion used to depend on an import statement it could
   * not keep alive. It fired only for a file already importing `ReadonlyDeep` and emitted
   * that local name, and until the suggestion is applied the import is unused, so the
   * unused-import fix removes it in the same pass and wins. Measured end to end: a file
   * that type-checked clean before `oxlint --fix --fix-suggestions` failed afterwards with
   * `TS2552: Cannot find name 'ReadonlyDeep'`.
   *
   * An inline import type needs no statement, so nothing can delete what it depends on.
   * The authored alias is lost with the gate, which is the honest trade: an alias exists to
   * name an import statement, and there is no longer one to name.
   */
  const replacement = `import('type-fest').ReadonlyDeep<${authoredType}>`;
  /**
   * Oxlint replacement range spanning authored parameter type.
   */
  const range: [
    number,
    number,
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
  return [
    {
      desc: `Wrap ${authoredType} with type-fest ReadonlyDeep.`,
      fix(fixer: ForeignBorrowed<Fixer>,): ReturnType<Fixer['replaceTextRange']> {
        return fixer.replaceTextRange(
          range,
          replacement,
        );
      },
    },
  ];
}

/**
 * Builds verified readonly type suggestions.
 *
 * @param context - Rule context providing fix range mapping.
 *
 * @param parameter - TypeScript parameter requiring readonly projection.
 *
 * @param project - TypeScript project proving suggested contract.
 *
 * @returns all verified suggestions for parameter type.
 *
 * @example
 * ```ts
 * readonlyParameterSuggestions({ context, parameter, project });
 * ```
 */
export function readonlyParameterSuggestions({
  context,
  parameter,
  project,
}: ForeignBorrowed<{
  readonly context: Context;
  readonly parameter: ParameterDeclaration;
  readonly project: Parameters<typeof classifyReadonlyType>[0]['project'];
}>,): Suggestion[] {
  return [
    ...readonlyArraySuggestions({
      context,
      parameter,
      project,
    },),
    ...readonlyCollectionSuggestions({
      context,
      parameter,
      project,
    },),
    ...readonlyDeepSuggestions({
      context,
      parameter,
      project,
    },),
  ];
}
